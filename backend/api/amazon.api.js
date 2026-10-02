// amazon.api.js - Dedicated API module for Amazon Careers (via search.json API)
const axios = require("axios");

const AMAZON_SEARCH_API = "https://www.amazon.jobs/en/search.json";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "referer": "https://www.amazon.jobs/en/search",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

/**
 * Step 1: Fetch a page of jobs from Amazon Careers API
 * @param {number} offset Result offset (0, 100, 200...)
 * @param {string} query Search query string
 * @param {string} location Search location string
 * @returns {Promise<object|null>} Response data containing jobs array and hits count
 */
async function fetchAmazonPage(offset = 0, query = "", location = "") {
  const url = `${AMAZON_SEARCH_API}?base_query=${encodeURIComponent(query)}&loc_query=${encodeURIComponent(location)}&offset=${offset}&result_limit=100&sort=recent`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (res.status === 429) {
          const waitTime = Math.round(1500 * attempt + Math.random() * 500);
          await delay(waitTime);
          continue;
        }
        if (!res.ok) return null;
        const data = await res.json();
        return data;
      } else {
        const response = await axios.get(url, {
          headers: DEFAULT_HEADERS,
          timeout: 15000
        });
        return response.data;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Amazon API] Error fetching page at offset=${offset}:`, error.message);
    }
  }
  return null;
}

function cleanHtml(html = "") {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract experience requirements from text snippet
 */
function extractExperienceFromText(text = "") {
  if (!text) return { minYears: 0, maxYears: null, experienceRequired: "Not specified" };

  const zeroYears = /\b(?:0\s*\+?\s*years?|no\s+(?:prior\s+)?experience\s+required|freshers?|intern(?:ship)?)\b/i;
  if (zeroYears.test(text)) {
    return { minYears: 0, maxYears: 1, experienceRequired: "0-1 years" };
  }

  const rangeMatch = /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i.exec(text);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return { minYears: min, maxYears: max, experienceRequired: `${min}-${max} years` };
  }

  const plusMatch = /(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/i.exec(text);
  if (plusMatch) {
    const min = parseFloat(plusMatch[1]);
    return { minYears: min, maxYears: null, experienceRequired: `${min}+ years` };
  }

  const singleMatch = /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|relevant)/i.exec(text);
  if (singleMatch) {
    const min = parseFloat(singleMatch[1]);
    return { minYears: min, maxYears: min, experienceRequired: `${min} year${min === 1 ? '' : 's'}` };
  }

  return { minYears: 0, maxYears: null, experienceRequired: "Not specified" };
}

/**
 * Step 3: Map Amazon API item into standardized Job format
 * @param {object} rawItem Raw job item from Amazon Search API
 * @returns {object|null} Standardized JSON format of job
 */
function mapAmazonJobs(rawItem) {
  if (!rawItem) return null;

  const jobId = String(rawItem.id_icims || rawItem.id || '');
  if (!jobId) return null;

  const title = rawItem.title || "Amazon Opening";
  const jobPath = rawItem.job_path || `/en/jobs/${jobId}`;
  const fullUrl = jobPath.startsWith('http') ? jobPath : `https://www.amazon.jobs${jobPath}`;

  const location = rawItem.normalized_location || rawItem.location || 'Not specified';
  const locParts = location.split(',').map(s => s.trim());
  const city = locParts[0] ? [locParts[0]] : [];
  const country = locParts[1] ? [locParts[1]] : [];

  // Work Mode detection
  const textBlob = `${title} ${location} ${rawItem.description_short || ''} ${rawItem.basic_qualifications || ''}`.toLowerCase();
  let workmode = "On-site";
  if (textBlob.includes("remote") || textBlob.includes("virtual") || textBlob.includes("work from home")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid")) {
    workmode = "Hybrid";
  }

  // Posted Date parsing
  let postedDate = new Date().toISOString();
  if (rawItem.posted_date) {
    const d = new Date(rawItem.posted_date);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  const basicQuals = cleanHtml(rawItem.basic_qualifications || '');
  const prefQuals = cleanHtml(rawItem.preferred_qualifications || '');
  const plainDescription = cleanHtml(rawItem.description_short || rawItem.description || `${basicQuals} ${prefQuals}`);
  
  const rawHtml = `<p><strong>${title}</strong></p><p>Location: ${location}</p><div><strong>Basic Qualifications:</strong><p>${rawItem.basic_qualifications || 'N/A'}</p></div><div><strong>Preferred Qualifications:</strong><p>${rawItem.preferred_qualifications || 'N/A'}</p></div>`;

  const expResult = extractExperienceFromText(`${basicQuals} ${prefQuals}`);

  // Skills & Category
  const category = rawItem.job_category || rawItem.job_family || 'Software & Technology';
  const skillsSet = new Set();
  if (category) skillsSet.add(category);
  if (rawItem.job_family) skillsSet.add(rawItem.job_family);

  const techKeywords = [
    "C++", "C#", ".NET", "Python", "Java", "JavaScript", "TypeScript", "React", "Angular",
    "Node.js", "AWS", "Cloud", "Kubernetes", "Docker", "DevOps", "CI/CD", "Microservices",
    "SQL", "NoSQL", "DynamoDB", "PostgreSQL", "MongoDB", "AI", "Machine Learning", "LLM", "Linux"
  ];

  techKeywords.forEach(kw => {
    let regexStr = kw === "C++" || kw === "C#" ? kw.replace(/\+/g, '\\+') : `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);

  return {
    source: "Amazon",
    company: "Amazon",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    location: location,
    city: city,
    state: [],
    country: country,
    minYears: expResult.minYears,
    maxYears: expResult.maxYears,
    yrsOfExperience: expResult.experienceRequired,
    experienceRequired: expResult.experienceRequired,
    workmode: workmode,
    jobUrl: fullUrl,
    url: fullUrl,
    skills: skills,
    salary: "Competitive Package",
    shift: "Day Shift",
    description: plainDescription,
    descriptionHtml: rawHtml,
    basicQualifications: basicQuals,
    preferredQualifications: prefQuals,
    postedDate: postedDate,
    postingDate: postedDate,
    role: category,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch ALL Amazon jobs (or up to maxLimit)
 * @param {number|object|null} [optionsOrLimit=null] Maximum number of jobs to fetch or options object
 * @returns {Promise<Array>} Array of JSON job objects
 */
async function fetchAllAmazonJobs(optionsOrLimit = null) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  try {
    const firstPage = await fetchAmazonPage(0);
    if (!firstPage || !Array.isArray(firstPage.jobs)) {
      return [];
    }

    const totalAvailable = firstPage.hits || firstPage.jobs.length;
    const fetchLimit = maxLimit ? Math.min(totalAvailable, maxLimit) : Math.min(totalAvailable, 1000);

    let allRawJobs = [...firstPage.jobs];

    // Page through search results in chunks of 100
    for (let offset = 100; offset < fetchLimit; offset += 100) {
      const pageRes = await fetchAmazonPage(offset);
      if (pageRes && Array.isArray(pageRes.jobs) && pageRes.jobs.length > 0) {
        allRawJobs.push(...pageRes.jobs);
      } else {
        break;
      }
      await delay(100);
    }

    const mappedJobs = [];
    const seenIds = new Set();
    for (const raw of allRawJobs) {
      const mapped = mapAmazonJobs(raw);
      if (mapped && mapped.jobId && !seenIds.has(mapped.jobId)) {
        seenIds.add(mapped.jobId);
        mappedJobs.push(mapped);
        if (mappedJobs.length >= fetchLimit) break;
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("Amazon API Error:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Amazon jobs with MongoDB collection
 * @param {object} AmazonJobModel Mongoose model for AmazonJob
 * @param {number|object|null} [optionsOrLimit=null] Optional limit or options
 * @returns {Promise<object>} Sync operation result summary
 */
async function syncAmazonJobsWithDb(AmazonJobModel, optionsOrLimit = null) {
  if (!AmazonJobModel) {
    throw new Error("AmazonJob model is required for database sync.");
  }

  console.log("[Amazon Sync] Starting Amazon jobs DB sync...");
  const fetchedJobs = await fetchAllAmazonJobs(optionsOrLimit);
  console.log(`[Amazon Sync] Fetched ${fetchedJobs.length} live jobs from Amazon API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Amazon API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await AmazonJobModel.find({ source: "Amazon" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await AmazonJobModel.deleteMany({ source: "Amazon", jobId: { $in: obsoleteIds } });
    deletedCount = delRes.deletedCount || 0;
  }

  let insertedCount = 0;
  let updatedCount = 0;
  const bulkOps = [];

  for (const job of fetchedJobs) {
    if (existingDbIdsSet.has(job.jobId)) {
      updatedCount++;
    } else {
      insertedCount++;
    }

    bulkOps.push({
      updateOne: {
        filter: { source: "Amazon", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await AmazonJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await AmazonJobModel.countDocuments({ source: "Amazon" });

  return {
    success: true,
    message: "Amazon DB sync completed successfully.",
    stats: {
      totalFetchedRaw: fetchedJobs.length,
      previousDbCount: existingDbJobs.length,
      deletedFromDb: deletedCount,
      insertedToDb: insertedCount,
      updatedOrKeptInDb: updatedCount,
      finalDbCount: finalDbCount
    },
    jobs: fetchedJobs
  };
}

module.exports = {
  fetchAmazonPage,
  mapAmazonJobs,
  fetchAllAmazonJobs,
  syncAmazonJobsWithDb,
  cleanHtml
};
