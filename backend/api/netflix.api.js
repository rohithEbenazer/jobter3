// netflix.api.js - Dedicated API module for Netflix Careers (explore.jobs.netflix.net API)
const axios = require("axios");

const NETFLIX_JOBS_API = "https://explore.jobs.netflix.net/api/apply/v2/jobs";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "referer": "https://explore.jobs.netflix.net/careers",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

/**
 * Step 1: Fetch a page of jobs from Netflix Careers API
 * @param {number} start Result start offset (0, 10, 20...)
 * @returns {Promise<object|null>} Response data containing positions array and total count
 */
async function fetchNetflixPage(start = 0) {
  const url = `${NETFLIX_JOBS_API}?domain=netflix.com&start=${start}`;

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
      else console.warn(`[Netflix API] Error fetching page at start=${start}:`, error.message);
    }
  }
  return null;
}

/**
 * Fetch detailed job information for a specific Netflix job ID
 * @param {string|number} jobId Job ID
 * @returns {Promise<object|null>}
 */
async function fetchNetflixJobDetail(jobId) {
  if (!jobId) return null;
  const url = `${NETFLIX_JOBS_API}/${jobId}?domain=netflix.com`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (!res.ok) return null;
        return await res.json();
      } else {
        const response = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 15000 });
        return response.data;
      }
    } catch (error) {
      if (attempt < 3) await delay(400 * attempt);
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
 * Step 3: Map Netflix API item into standardized Job format
 * @param {object} rawItem Raw job item from Netflix Search API
 * @param {object} [detailItem] Optional detailed job object
 * @returns {object|null} Standardized JSON format of job
 */
function mapNetflixJobs(rawItem, detailItem = null) {
  if (!rawItem) return null;

  const jobId = String(rawItem.id || rawItem.ats_job_id || '');
  if (!jobId) return null;

  const title = rawItem.name || rawItem.posting_name || "Netflix Opening";
  const canonicalUrl = detailItem?.canonicalPositionUrl || rawItem.canonicalPositionUrl || `https://explore.jobs.netflix.net/careers/job/${jobId}?domain=netflix.com`;
  const fullUrl = canonicalUrl.startsWith('http') ? canonicalUrl : `https://explore.jobs.netflix.net${canonicalUrl}`;

  let location = 'Not specified';
  if (rawItem.location) {
    location = rawItem.location;
  } else if (Array.isArray(rawItem.locations) && rawItem.locations.length > 0) {
    location = rawItem.locations.join(', ');
  }

  const locParts = location.split(',').map(s => s.trim());
  let city = [];
  let state = [];
  let country = [];

  if (locParts.length >= 3) {
    city = locParts[0] ? [locParts[0]] : [];
    state = locParts[1] ? [locParts[1]] : [];
    country = locParts[2] ? [locParts[2]] : [];
  } else if (locParts.length === 2) {
    city = locParts[0] ? [locParts[0]] : [];
    const p2Lower = locParts[1].toLowerCase();
    const knownCountries = ['united states', 'usa', 'us', 'india', 'uk', 'united kingdom', 'spain', 'australia', 'mexico', 'canada', 'japan', 'germany', 'france', 'singapore', 'brazil', 'netherlands', 'sweden', 'korea', 'south korea', 'italy'];
    if (knownCountries.includes(p2Lower)) {
      country = [locParts[1]];
    } else {
      state = [locParts[1]];
      country = ['USA'];
    }
  } else if (locParts.length === 1 && locParts[0] && locParts[0] !== 'Not specified') {
    city = [locParts[0]];
  }

  // Work Mode detection
  const workLocOpt = String(rawItem.work_location_option || rawItem.location_flexibility || '').toLowerCase();
  const descRaw = detailItem?.job_description || rawItem.job_description || '';
  const textBlob = `${title} ${location} ${workLocOpt} ${descRaw}`.toLowerCase();

  let workmode = "On-site";
  if (workLocOpt.includes("remote") || textBlob.includes("remote") || textBlob.includes("work from home")) {
    workmode = "Remote";
  } else if (workLocOpt.includes("hybrid") || textBlob.includes("hybrid")) {
    workmode = "Hybrid";
  }

  // Posted Date parsing
  let postedDate = new Date().toISOString();
  if (rawItem.t_create) {
    const d = new Date(Number(rawItem.t_create) * 1000);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  } else if (rawItem.t_update) {
    const d = new Date(Number(rawItem.t_update) * 1000);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  const rawHtml = descRaw || `<p><strong>${title}</strong></p><p>Location: ${location}</p><p>Department: ${rawItem.department || 'Engineering & Technology'}</p>`;
  const plainDescription = cleanHtml(descRaw || `${title} - ${location} (${rawItem.department || ''})`);
  const expResult = extractExperienceFromText(plainDescription);

  // Category & Skills
  const category = rawItem.department || rawItem.business_unit || 'Engineering & Technology';
  const department = rawItem.department || 'Engineering & Technology';
  const businessUnit = rawItem.business_unit || 'Streaming';

  const skillsSet = new Set();
  if (category) skillsSet.add(category);
  if (department) skillsSet.add(department);

  const techKeywords = [
    "C++", "C#", ".NET", "Python", "Java", "JavaScript", "TypeScript", "React", "Angular",
    "Node.js", "AWS", "Cloud", "Kubernetes", "Docker", "DevOps", "CI/CD", "Microservices",
    "SQL", "NoSQL", "PostgreSQL", "MongoDB", "AI", "Machine Learning", "LLM", "Linux",
    "Streaming", "Video", "Encoding", "Distributed Systems", "Golang", "Go", "Rust"
  ];

  techKeywords.forEach(kw => {
    let regexStr = kw === "C++" || kw === "C#" ? kw.replace(/\+/g, '\\+') : `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);

  return {
    source: "Netflix",
    company: "Netflix",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: businessUnit,
    location: location,
    city: city,
    state: state,
    country: country,
    minYears: expResult.minYears,
    maxYears: expResult.maxYears !== null ? expResult.maxYears : 99,
    minYrsOfExperience: expResult.minYears,
    maxYrsOfExperience: expResult.maxYears !== null ? expResult.maxYears : 99,
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
    basicQualifications: plainDescription.slice(0, 300),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: category,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch ALL Netflix jobs (or up to maxLimit)
 * @param {number|object|null} [optionsOrLimit=null] Maximum number of jobs to fetch or options object
 * @returns {Promise<Array>} Array of JSON job objects
 */
async function fetchAllNetflixJobs(optionsOrLimit = null) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  try {
    const firstPage = await fetchNetflixPage(0);
    if (!firstPage || !Array.isArray(firstPage.positions)) {
      return [];
    }

    const totalAvailable = firstPage.count || firstPage.positions.length;
    const fetchLimit = maxLimit ? Math.min(totalAvailable, maxLimit) : Math.min(totalAvailable, 1000);

    let allRawJobs = [...firstPage.positions];

    // Page through search results in chunks of 10
    for (let start = 10; start < fetchLimit; start += 10) {
      const pageRes = await fetchNetflixPage(start);
      if (pageRes && Array.isArray(pageRes.positions) && pageRes.positions.length > 0) {
        allRawJobs.push(...pageRes.positions);
      } else {
        break;
      }
      await delay(80);
    }

    // Limit raw jobs
    const slicedRawJobs = allRawJobs.slice(0, fetchLimit);

    // Fetch details for jobs in parallel chunks (up to 15 concurrent) to populate full descriptions
    const detailedJobs = [];
    const chunkSize = 15;

    for (let i = 0; i < slicedRawJobs.length; i += chunkSize) {
      const chunk = slicedRawJobs.slice(i, i + chunkSize);
      const detailPromises = chunk.map(raw => 
        fetchNetflixJobDetail(raw.id || raw.ats_job_id)
          .then(detail => mapNetflixJobs(raw, detail))
          .catch(() => mapNetflixJobs(raw, null))
      );
      const mappedChunk = await Promise.all(detailPromises);
      mappedChunk.forEach(mapped => {
        if (mapped && mapped.jobId) detailedJobs.push(mapped);
      });
    }

    // Deduplicate by jobId
    const mappedJobs = [];
    const seenIds = new Set();
    for (const job of detailedJobs) {
      if (!seenIds.has(job.jobId)) {
        seenIds.add(job.jobId);
        mappedJobs.push(job);
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("Netflix API Error:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Netflix jobs with MongoDB collection
 * @param {object} NetflixJobModel Mongoose model for NetflixJob
 * @param {number|object|null} [optionsOrLimit=null] Optional limit or options
 * @returns {Promise<object>} Sync operation result summary
 */
async function syncNetflixJobsWithDb(NetflixJobModel, optionsOrLimit = null) {
  if (!NetflixJobModel) {
    throw new Error("NetflixJob model is required for database sync.");
  }

  console.log("[Netflix Sync] Starting Netflix jobs DB sync...");
  const fetchedJobs = await fetchAllNetflixJobs(optionsOrLimit);
  console.log(`[Netflix Sync] Fetched ${fetchedJobs.length} live jobs from Netflix API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Netflix API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await NetflixJobModel.find({ source: "Netflix" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await NetflixJobModel.deleteMany({ source: "Netflix", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Netflix", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await NetflixJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await NetflixJobModel.countDocuments({ source: "Netflix" });

  return {
    success: true,
    message: "Netflix DB sync completed successfully.",
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
  fetchNetflixPage,
  fetchNetflixJobDetail,
  mapNetflixJobs,
  fetchAllNetflixJobs,
  syncNetflixJobsWithDb,
  cleanHtml
};
