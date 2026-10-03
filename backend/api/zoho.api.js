// zoho.api.js - Dedicated API module for Zoho Careers (Zoho Recruit Public API)
const axios = require("axios");

const ZOHO_RECRUIT_API = "https://zohoapac.zohorecruit.in/recruit/v2/public/Job_Openings";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Origin": "https://www.zoho.com",
  "Referer": "https://www.zoho.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

/**
 * Step 1: Fetch job openings from Zoho Recruit API
 * @returns {Promise<object|null>} Response data object containing data array
 */
async function fetchZohoJobsApi() {
  const extraFields = JSON.stringify(["Remote_Job", "Job_Description", "Work_Experience", "Date_Opened"]);
  const url = `${ZOHO_RECRUIT_API}?pagename=Careers&source=CareerSite&extra_fields=${encodeURIComponent(extraFields)}`;

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
      else console.warn(`[Zoho API] Error fetching jobs:`, error.message);
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
 * Step 3: Map Zoho API item into standardized Job format
 * @param {object} rawItem Raw job item from Zoho Recruit API
 * @returns {object|null} Standardized JSON format of job
 */
function mapZohoJobs(rawItem) {
  if (!rawItem) return null;

  const jobId = String(rawItem.id || rawItem.Job_Opening_Name || '');
  if (!jobId) return null;

  const title = rawItem.Posting_Title || rawItem.Job_Opening_Name || "Zoho Opening";
  const fullUrl = rawItem['$url'] || `https://zohoapac.zohorecruit.in/jobs/Careers/${jobId}?source=CareerSite`;

  const city = rawItem.City ? [rawItem.City] : [];
  const state = rawItem.State ? [rawItem.State] : [];
  const country = rawItem.Country ? [rawItem.Country] : [];

  const locParts = [...city, ...state, ...country].filter(Boolean);
  const location = locParts.length > 0 ? locParts.join(', ') : 'Not specified';

  // Work Mode detection
  const descRaw = rawItem.Job_Description || '';
  const isRemoteFlag = rawItem.Remote_Job === true || String(rawItem.Remote_Job || '').toLowerCase().includes('remote');
  const textBlob = `${title} ${location} ${descRaw}`.toLowerCase();

  let workmode = "On-site";
  if (isRemoteFlag || textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  // Posted Date parsing
  let postedDate = new Date().toISOString();
  if (rawItem.Date_Opened) {
    const d = new Date(rawItem.Date_Opened);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  const plainDescription = cleanHtml(descRaw || `${title} - ${location}`);
  const rawHtml = descRaw || `<p><strong>${title}</strong></p><p>Location: ${location}</p>`;
  
  const expText = rawItem.Work_Experience || plainDescription;
  const expResult = extractExperienceFromText(expText);

  // Category & Industry
  const category = rawItem.Industry || 'Software & IT Services';
  const department = rawItem.Industry || 'Engineering & Product Solutions';

  const skillsSet = new Set();
  skillsSet.add("Zoho");
  if (category) skillsSet.add(category);

  const techKeywords = [
    "Zoho", "SaaS", "PaaS", "CRM", "Deluge", "Cloud",
    "C++", "C#", ".NET", "Python", "Java", "JavaScript", "TypeScript", "React", "Angular",
    "Node.js", "AWS", "GCP", "Kubernetes", "Docker", "DevOps", "CI/CD", "Microservices",
    "SQL", "NoSQL", "PostgreSQL", "MongoDB", "AI", "Machine Learning", "LLM", "Linux"
  ];

  techKeywords.forEach(kw => {
    let regexStr = kw === "C++" || kw === "C#" ? kw.replace(/\+/g, '\\+') : `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);

  return {
    source: "Zoho",
    company: "Zoho",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "Zoho",
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
 * Step 4: Fetch ALL Zoho jobs
 * @param {number|object|null} [optionsOrLimit=null] Maximum number of jobs to fetch or options object
 * @returns {Promise<Array>} Array of JSON job objects
 */
async function fetchAllZohoJobs(optionsOrLimit = null) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  try {
    const resData = await fetchZohoJobsApi();
    if (!resData || !Array.isArray(resData.data)) {
      return [];
    }

    let rawJobs = resData.data;
    if (maxLimit && rawJobs.length > maxLimit) {
      rawJobs = rawJobs.slice(0, maxLimit);
    }

    const mappedJobs = [];
    const seenIds = new Set();

    for (const raw of rawJobs) {
      const mapped = mapZohoJobs(raw);
      if (mapped && mapped.jobId && !seenIds.has(mapped.jobId)) {
        seenIds.add(mapped.jobId);
        mappedJobs.push(mapped);
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("Zoho API Error:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Zoho jobs with MongoDB collection
 * @param {object} ZohoJobModel Mongoose model for ZohoJob
 * @param {number|object|null} [optionsOrLimit=null] Optional limit or options
 * @returns {Promise<object>} Sync operation result summary
 */
async function syncZohoJobsWithDb(ZohoJobModel, optionsOrLimit = null) {
  if (!ZohoJobModel) {
    throw new Error("ZohoJob model is required for database sync.");
  }

  console.log("[Zoho Sync] Starting Zoho jobs DB sync...");
  const fetchedJobs = await fetchAllZohoJobs(optionsOrLimit);
  console.log(`[Zoho Sync] Fetched ${fetchedJobs.length} live jobs from Zoho API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Zoho API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await ZohoJobModel.find({ source: "Zoho" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await ZohoJobModel.deleteMany({ source: "Zoho", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Zoho", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await ZohoJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await ZohoJobModel.countDocuments({ source: "Zoho" });

  return {
    success: true,
    message: "Zoho DB sync completed successfully.",
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
  fetchZohoJobsApi,
  mapZohoJobs,
  fetchAllZohoJobs,
  syncZohoJobsWithDb,
  cleanHtml
};
