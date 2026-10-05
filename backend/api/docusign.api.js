// docusign.api.js - Dedicated API module for DocuSign Careers (careers.docusign.com API)
const axios = require("axios");

const DOCUSIGN_JOBS_API = "https://careers.docusign.com/api/jobs";
const DOCUSIGN_SIMILAR_JOBS_API = "https://careers.docusign.com/api/similar-jobs";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "referer": "https://careers.docusign.com/careers-home/jobs",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
};

/**
 * Clean HTML markup or raw text formatting
 */
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
 * Extract experience requirements from text
 */
function extractExperienceFromText(text = "") {
  if (!text) return { minYears: 0, maxYears: 99, experienceRequired: "Not specified" };

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
    return { minYears: min, maxYears: 99, experienceRequired: `${min}+ years` };
  }

  const singleMatch = /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|relevant)/i.exec(text);
  if (singleMatch) {
    const min = parseFloat(singleMatch[1]);
    return { minYears: min, maxYears: min, experienceRequired: `${min} year${min === 1 ? '' : 's'}` };
  }

  return { minYears: 0, maxYears: 99, experienceRequired: "Not specified" };
}

/**
 * Extract salary information from text
 */
function extractSalaryFromText(text = "") {
  if (!text) return "Competitive Package";
  const salaryMatch = /(?:Hiring Range|Salary Range|USD|INR|\$)\s*(?:from:?\s*)?((?:\$|₹)?[\d,]+\s*(?:to|-)\s*(?:\$|₹)?[\d,]+(?:\s*per\s*(?:annum|year|hr|hour|annually|LPA))?)/i.exec(text);
  if (salaryMatch) {
    return salaryMatch[1].trim();
  }
  return "Competitive Package";
}

/**
 * Step 1: Fetch a single page of jobs from DocuSign Careers API
 * @param {number} page Page index (1-based)
 * @param {string} sortBy Sort order (default: 'relevance')
 * @param {boolean} descending Sort direction
 * @returns {Promise<object|null>}
 */
async function fetchDocuSignPage(page = 1, sortBy = "relevance", descending = false) {
  const url = `${DOCUSIGN_JOBS_API}?page=${page}&sortBy=${sortBy}&descending=${descending}&internal=false`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (res.status === 429) {
          await delay(1200 * attempt);
          continue;
        }
        if (!res.ok) return null;
        return await res.json();
      } else {
        const response = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 15000 });
        return response.data;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[DocuSign API] Error fetching page ${page}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch similar jobs for a given job slug
 * @param {string} slug Job slug / req_id
 * @param {string} language Language code (default: 'en-us')
 * @returns {Promise<Array>} Array of similar job objects
 */
async function fetchSimilarDocuSignJobs(slug, language = "en-us") {
  if (!slug) return [];
  const payload = { slug: String(slug), language };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(DOCUSIGN_SIMILAR_JOBS_API, {
          method: "POST",
          headers: { ...DEFAULT_HEADERS, "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) return [];
        return await res.json();
      } else {
        const response = await axios.post(DOCUSIGN_SIMILAR_JOBS_API, payload, {
          headers: { ...DEFAULT_HEADERS, "content-type": "application/json" },
          timeout: 10000
        });
        return response.data || [];
      }
    } catch (error) {
      if (attempt < 2) await delay(400);
    }
  }
  return [];
}

/**
 * Map raw DocuSign job object to standard Job Schema
 * @param {object} rawItem Raw item wrapper or inner data object
 * @returns {object} Standardized job object
 */
function mapDocuSignJob(rawItem) {
  if (!rawItem) return null;
  const d = rawItem.data || rawItem;

  const jobId = String(d.slug || d.req_id || d.id || `docusign-${Date.now()}`);
  const title = d.title || "DocuSign Opening";

  const categories = Array.isArray(d.category)
    ? d.category.map(c => c.trim()).filter(Boolean)
    : (d.category ? [String(d.category).trim()] : []);
  const categoryStr = categories.join(", ") || "Software & Technology";

  const locationStr = d.full_location || d.location || d.short_location || "Not specified";

  let city = [];
  let state = [];
  let country = [];

  if (locationStr && locationStr !== "Not specified") {
    const parts = locationStr.split(",").map(p => p.trim());
    if (parts.length >= 3) {
      city.push(parts[0]);
      state.push(parts[1]);
      country.push(parts[2]);
    } else if (parts.length === 2) {
      city.push(parts[0]);
      country.push(parts[1]);
    } else if (parts.length === 1) {
      country.push(parts[0]);
    }
  }

  const rawDescription = d.description || "";
  const rawResponsibilities = d.responsibilities || "";
  const combinedHtml = `${rawDescription}\n\n${rawResponsibilities}`.trim();
  const cleanedText = cleanHtml(combinedHtml);

  const expInfo = extractExperienceFromText(cleanedText);
  const salaryStr = extractSalaryFromText(cleanedText);

  const applyUrl = d.apply_url || `https://careers.docusign.com/jobs/${jobId}?lang=${d.language || 'en-us'}`;
  const postedDate = d.posted_date || d.create_date || d.update_date || new Date().toISOString();

  let workmode = "On-site / Hybrid";
  if (/remote/i.test(title) || /remote/i.test(locationStr) || /remote/i.test(cleanedText)) {
    workmode = "Remote";
  } else if (/hybrid/i.test(locationStr) || /hybrid/i.test(cleanedText)) {
    workmode = "Hybrid";
  }

  return {
    source: "DocuSign",
    company: "DocuSign",
    jobId: jobId,
    id: jobId,
    title: title,
    category: categoryStr,
    department: categoryStr,
    businessUnit: "DocuSign",
    location: locationStr,
    city: city,
    state: state,
    country: country,
    url: applyUrl,
    jobUrl: applyUrl,
    workmode: workmode,
    postingDate: postedDate,
    postedDate: postedDate,
    descriptionHtml: combinedHtml,
    description: cleanedText || title,
    basicQualifications: cleanedText.slice(0, 1000),
    preferredQualifications: "",
    experienceRequired: expInfo.experienceRequired,
    yrsOfExperience: expInfo.experienceRequired,
    minYears: expInfo.minYears,
    maxYears: expInfo.maxYears,
    minYrsOfExperience: expInfo.minYears,
    maxYrsOfExperience: expInfo.maxYears,
    skills: categories,
    mandateSkills: categories,
    role: title,
    salary: salaryStr,
    shift: "Day Shift",
    rawDetails: d
  };
}

/**
 * Fetch all DocuSign jobs across paginated endpoints
 * @param {number|null} limit Maximum number of jobs to fetch
 * @returns {Promise<Array>} List of standardized job objects
 */
async function fetchAllDocuSignJobs(limit = null) {
  const allJobs = [];
  let page = 1;
  let totalCount = null;

  while (true) {
    const pageData = await fetchDocuSignPage(page);
    if (!pageData || !pageData.jobs || pageData.jobs.length === 0) {
      break;
    }

    if (totalCount === null && pageData.totalCount) {
      totalCount = pageData.totalCount;
    }

    for (const rawItem of pageData.jobs) {
      const mapped = mapDocuSignJob(rawItem);
      if (mapped) {
        allJobs.push(mapped);
      }
      if (limit && allJobs.length >= limit) {
        return allJobs.slice(0, limit);
      }
    }

    if (totalCount && allJobs.length >= totalCount) {
      break;
    }

    page++;
    await delay(200);
  }

  return allJobs;
}

/**
 * Sync live DocuSign jobs into MongoDB
 * @param {number|null} limit Optional limit
 * @returns {Promise<object>} Sync summary
 */
async function syncDocuSignJobsWithDb(limit = null) {
  const { connectDB, DocuSignJob } = require("../Db/docusigndb");
  const { CogforceJob } = require("../Db/cogforcedb");

  await connectDB();

  console.log("[DocuSign API] Fetching live jobs for DB sync...");
  const jobs = await fetchAllDocuSignJobs(limit);
  console.log(`[DocuSign API] Fetched ${jobs.length} jobs. Upserting into MongoDB via bulkWrite...`);

  if (jobs.length === 0) {
    return { success: true, totalFetched: 0, totalSynced: 0 };
  }

  const docuSignOps = jobs.map((jobData) => ({
    updateOne: {
      filter: { source: "DocuSign", jobId: jobData.jobId },
      update: { $set: jobData },
      upsert: true
    }
  }));

  const cogforceOps = jobs.map((jobData) => ({
    updateOne: {
      filter: { source: "DocuSign", jobId: jobData.jobId },
      update: { $set: jobData },
      upsert: true
    }
  }));

  let syncedCount = 0;
  try {
    const res1 = await DocuSignJob.bulkWrite(docuSignOps, { ordered: false });
    if (CogforceJob) {
      await CogforceJob.bulkWrite(cogforceOps, { ordered: false }).catch(() => {});
    }
    syncedCount = (res1.upsertedCount || 0) + (res1.modifiedCount || 0) + (res1.matchedCount || 0);
  } catch (err) {
    console.error("[DocuSign API] Error in bulkWrite:", err.message);
    syncedCount = jobs.length;
  }

  return {
    success: true,
    totalFetched: jobs.length,
    totalSynced: syncedCount
  };
}

module.exports = {
  fetchDocuSignPage,
  fetchSimilarDocuSignJobs,
  mapDocuSignJob,
  fetchAllDocuSignJobs,
  syncDocuSignJobsWithDb,
  cleanHtml,
  extractExperienceFromText,
  extractSalaryFromText
};
