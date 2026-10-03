// meesho.api.js - Dedicated API module for Meesho Careers (Lever Public API)
const axios = require("axios");

const MEESHO_LEVER_API_URL = "https://api.lever.co/v0/postings/meesho/?";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "*/*",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

/**
 * Clean HTML markup to plain text
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
 * Extract salary information from text
 */
function extractSalaryFromText(text = "") {
  if (!text) return "Competitive Package";
  const salaryMatch = /(?:Hiring Range|Salary Range|USD|INR|Compensation)\s*(?:in\s*(?:USD|INR)\s*)?(?:from:?\s*)?((?:\$|₹|INR|USD)\s*[\d,]+\s*(?:to|-)\s*(?:\$|₹|INR|USD)?\s*[\d,]+(?:\s*per\s*(?:annum|year|hr|hour))?)/i.exec(text);
  if (salaryMatch) {
    return salaryMatch[1].trim();
  }
  return "Competitive Package";
}

/**
 * Step 1: Fetch job postings from Lever API for Meesho
 * @returns {Promise<Array>} Array of raw job items
 */
async function fetchMeeshoJobsApi() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(MEESHO_LEVER_API_URL, { headers: DEFAULT_HEADERS });
        if (res.status === 429) {
          await delay(1500 * attempt);
          continue;
        }
        if (!res.ok) return [];
        return await res.json();
      } else {
        const res = await axios.get(MEESHO_LEVER_API_URL, { headers: DEFAULT_HEADERS, timeout: 20000 });
        return res.data;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Meesho API] Error fetching jobs:`, error.message);
    }
  }
  return [];
}

/**
 * Step 2: Map raw Lever job item to standardized Job format
 * @param {object} item Raw job item from Lever API
 * @returns {object|null}
 */
function mapMeeshoJob(item) {
  if (!item) return null;

  const jobId = String(item.id || '');
  if (!jobId) return null;

  const title = item.text || "Meesho Opening";
  
  // Construct meesho.io candidate URL
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const meeshoUrl = `https://www.meesho.io/jobs/${slug}?id=${jobId}`;
  const jobUrl = meeshoUrl || item.hostedUrl || `https://jobs.lever.co/meesho/${jobId}`;

  // Categories & Department
  const categories = item.categories || {};
  const department = categories.department || categories.team || "Product & Tech";
  const category = categories.department || categories.team || "E-Commerce & Tech";
  const businessUnit = categories.team || "Meesho";

  // Location
  const locStr = categories.location || item.country || "Bengaluru, India";
  const city = [];
  const state = [];
  const country = item.country ? [item.country] : [];

  if (locStr) {
    const parts = locStr.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      city.push(parts[0]);
      state.push(parts[1]);
    } else if (parts.length === 1) {
      city.push(parts[0]);
    }
  }

  const location = locStr || 'Not specified';

  // Description HTML composition
  const descParts = [];
  if (item.description) descParts.push(item.description);
  if (item.additional) descParts.push(`<h3>Additional Information</h3>${item.additional}`);

  if (Array.isArray(item.lists)) {
    item.lists.forEach(l => {
      if (l && l.text) {
        descParts.push(`<h4>${l.text}</h4>`);
        if (l.content) descParts.push(l.content);
      }
    });
  }

  const rawHtml = descParts.join('<br/><br/>') || `<p><strong>${title}</strong></p><p>Location: ${location}</p>`;
  const plainDescription = cleanHtml(rawHtml);

  // Experience
  const expResult = extractExperienceFromText(plainDescription);

  // Workmode
  const wpType = (item.workplaceType || '').toLowerCase();
  const textBlob = `${title} ${location} ${plainDescription}`.toLowerCase();
  let workmode = "On-site";
  if (wpType === 'remote' || textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (wpType === 'hybrid' || textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  // Posted Date
  let postedDate = new Date().toISOString();
  if (item.createdAt) {
    const d = new Date(item.createdAt);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  // Skills
  const skillsSet = new Set(["Meesho", "E-Commerce"]);
  if (category) skillsSet.add(category);

  const techKeywords = [
    "Meesho", "E-Commerce", "Data Science", "Python", "SQL", "Java", "C++", "React", "Node.js",
    "Analytics", "Machine Learning", "AI", "AWS", "GCP", "Kubernetes", "Docker", "DevOps",
    "Microservices", "Product Management", "Risk", "Decision Science", "Finance", "Growth",
    "Logistics", "Supply Chain", "PostgreSQL", "MongoDB", "Redis"
  ];

  techKeywords.forEach(kw => {
    let regexStr = kw === "C++" || kw === "C#" ? kw.replace(/\+/g, '\\+') : `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);
  const salary = extractSalaryFromText(plainDescription);

  return {
    source: "Meesho",
    company: "Meesho",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: businessUnit,
    location: location,
    city: Array.from(new Set(city)),
    state: Array.from(new Set(state)),
    country: Array.from(new Set(country)),
    minYears: expResult.minYears,
    maxYears: expResult.maxYears !== null ? expResult.maxYears : 99,
    minYrsOfExperience: expResult.minYears,
    maxYrsOfExperience: expResult.maxYears !== null ? expResult.maxYears : 99,
    yrsOfExperience: expResult.experienceRequired,
    experienceRequired: expResult.experienceRequired,
    workmode: workmode,
    jobUrl: jobUrl,
    url: jobUrl,
    skills: skills,
    salary: salary,
    shift: "Day Shift",
    description: plainDescription,
    descriptionHtml: rawHtml,
    basicQualifications: plainDescription.slice(0, 350),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: category,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 3: Fetch ALL Meesho jobs
 * @param {number|object|null} [optionsOrLimit=null] 
 * @returns {Promise<Array>}
 */
async function fetchAllMeeshoJobs(optionsOrLimit = null) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  try {
    const rawJobs = await fetchMeeshoJobsApi();
    if (!Array.isArray(rawJobs)) return [];

    let targetJobs = rawJobs;
    if (maxLimit && targetJobs.length > maxLimit) {
      targetJobs = targetJobs.slice(0, maxLimit);
    }

    const mappedJobs = [];
    const seenIds = new Set();

    for (const raw of targetJobs) {
      const mapped = mapMeeshoJob(raw);
      if (mapped && mapped.jobId && !seenIds.has(mapped.jobId)) {
        seenIds.add(mapped.jobId);
        mappedJobs.push(mapped);
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("[Meesho API] Error fetching Meesho jobs:", error.message);
    return [];
  }
}

/**
 * Step 4: Sync Meesho jobs with MongoDB collection
 * @param {object} MeeshoJobModel 
 * @param {number|object|null} [optionsOrLimit=null] 
 * @returns {Promise<object>}
 */
async function syncMeeshoJobsWithDb(MeeshoJobModel, optionsOrLimit = null) {
  if (!MeeshoJobModel) {
    throw new Error("MeeshoJob model is required for database sync.");
  }

  console.log("[Meesho Sync] Starting Meesho jobs DB sync...");
  const fetchedJobs = await fetchAllMeeshoJobs(optionsOrLimit);
  console.log(`[Meesho Sync] Fetched ${fetchedJobs.length} live jobs from Meesho API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Meesho API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await MeeshoJobModel.find({ source: "Meesho" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await MeeshoJobModel.deleteMany({ source: "Meesho", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Meesho", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await MeeshoJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await MeeshoJobModel.countDocuments({ source: "Meesho" });

  return {
    success: true,
    message: "Meesho DB sync completed successfully.",
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
  fetchMeeshoJobsApi,
  mapMeeshoJob,
  fetchAllMeeshoJobs,
  syncMeeshoJobsWithDb,
  cleanHtml
};
