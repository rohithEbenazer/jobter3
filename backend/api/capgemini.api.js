// capgemini.api.js - Dedicated API module for Capgemini Careers (cg-jobstream API)
const axios = require("axios");

const CAPGEMINI_JOBS_API_URL = "https://cg-jobstream-api.azurewebsites.net/api/job-search";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "origin": "https://www.capgemini.com",
  "priority": "u=1, i",
  "sec-ch-ua": '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "cross-site",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
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
 * Extract experience requirements from text or level
 */
function extractExperienceFromText(text = "", expLevel = "") {
  const combined = `${expLevel} ${text}`;

  const zeroYears = /\b(?:0\s*\+?\s*years?|no\s+(?:prior\s+)?experience\s+required|freshers?|intern(?:ship)?|entry\s+level|students?|graduates?)\b/i;
  if (zeroYears.test(combined)) {
    return { minYears: 0, maxYears: 1, experienceRequired: "0-1 years" };
  }

  const rangeMatch = /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i.exec(combined);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return { minYears: min, maxYears: max, experienceRequired: `${min}-${max} years` };
  }

  const plusMatch = /(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/i.exec(combined);
  if (plusMatch) {
    const min = parseFloat(plusMatch[1]);
    return { minYears: min, maxYears: null, experienceRequired: `${min}+ years` };
  }

  const singleMatch = /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|relevant)/i.exec(combined);
  if (singleMatch) {
    const min = parseFloat(singleMatch[1]);
    return { minYears: min, maxYears: min, experienceRequired: `${min} year${min === 1 ? '' : 's'}` };
  }

  if (expLevel.toLowerCase().includes("experienced")) {
    return { minYears: 3, maxYears: 99, experienceRequired: "3+ years" };
  }

  return { minYears: 0, maxYears: 99, experienceRequired: "Not specified" };
}

/**
 * Extract salary information from text
 */
function extractSalaryFromText(text = "") {
  if (!text) return "Competitive Package";
  const salaryMatch = /(?:Hiring Range|Salary Range|EUR|USD|INR|GBP|Compensation|beloningsbudget)\s*(?:in\s*(?:EUR|USD|INR|GBP)\s*)?(?:from:?\s*|tot\s*)?((?:€|\$|£|₹|INR|USD|EUR)\s*[\d,.]+(?:\s*(?:to|-|tot)\s*(?:€|\$|£|₹|INR|USD|EUR)?\s*[\d,.]+)?(?:\s*per\s*(?:annum|year|hr|hour|maand))?)/i.exec(text);
  if (salaryMatch) {
    return salaryMatch[1].trim();
  }
  return "Competitive Package";
}

/**
 * Step 1: Fetch a page of jobs from Capgemini API
 * @param {number} page Page number (1-indexed)
 * @param {number} size Number of items per page
 * @returns {Promise<object|null>}
 */
async function fetchCapgeminiJobsPage(page = 1, size = 50) {
  const url = `${CAPGEMINI_JOBS_API_URL}?page=${page}&size=${size}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (res.status === 429) {
          await delay(1500 * attempt);
          continue;
        }
        if (!res.ok) return null;
        return await res.json();
      } else {
        const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 20000 });
        return res.data;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Capgemini API] Error fetching page ${page}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch single job details by ID from Capgemini API
 * @param {string} jobId
 * @returns {Promise<object|null>}
 */
async function fetchCapgeminiJobById(jobId) {
  if (!jobId) return null;
  const url = `${CAPGEMINI_JOBS_API_URL}?id=${encodeURIComponent(jobId)}`;
  try {
    if (typeof fetch !== "undefined") {
      const res = await fetch(url, { headers: DEFAULT_HEADERS });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && Array.isArray(data.data) && data.data.length > 0) {
        return data.data[0];
      }
    } else {
      const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 20000 });
      if (res.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
        return res.data.data[0];
      }
    }
  } catch (error) {
    console.warn(`[Capgemini API] Error fetching details for job ID ${jobId}:`, error.message);
  }
  return null;
}

/**
 * Step 3: Map raw Capgemini job item to standardized Job format
 * @param {object} item Raw job item from Capgemini API
 * @returns {object|null}
 */
function mapCapgeminiJob(item) {
  if (!item) return null;

  const jobId = String(item.id || item._id || '');
  if (!jobId) return null;

  const title = item.title || "Capgemini Opening";
  const brand = item.brand || "Capgemini";
  const category = item.professional_communities || item.department || item.sbu || "Consulting & Technology";
  const department = item.department || category || "Engineering & Operations";
  const location = item.location || item.country_name || "Not specified";

  // Parse location into city, state, country arrays
  const locParts = location.split(',').map(s => s.trim()).filter(Boolean);
  const city = locParts.length > 0 ? [locParts[0]] : [];
  const country = item.country_name ? [item.country_name] : (locParts.length > 1 ? [locParts[locParts.length - 1]] : []);
  const state = locParts.length > 2 ? [locParts[1]] : [];

  // URLs
  const applyJobUrl = item.apply_job_url || item.wp_url || `https://careers.capgemini.com/`;
  const jobUrl = applyJobUrl;
  const detailsUrl = `${CAPGEMINI_JOBS_API_URL}?id=${encodeURIComponent(jobId)}`;

  // Descriptions
  const descriptionHtml = item.description || `<p><strong>${title}</strong></p><p>Brand: ${brand}</p><p>Location: ${location}</p>`;
  const plainDescription = cleanHtml(descriptionHtml || item.description_stripped || '');

  // Experience
  const expResult = extractExperienceFromText(plainDescription, item.experience_level || '');

  // Workmode
  const textBlob = `${title} ${location} ${plainDescription}`.toLowerCase();
  let workmode = "On-site";
  if (textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  // Posted Date
  let postedDate = new Date().toISOString();
  if (item.updated_at) {
    const d = new Date(item.updated_at);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  } else if (item.indexed_at) {
    const d = new Date(item.indexed_at);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  // Skills
  const skillsSet = new Set(["Capgemini", "IT Consulting"]);
  if (brand) skillsSet.add(brand);
  if (category) skillsSet.add(category);

  const techKeywords = [
    "Capgemini", "Sogeti", "SAP", "Java", "Python", "C++", "C#", ".NET", "SQL", "PL/SQL",
    "JavaScript", "TypeScript", "React", "Angular", "Node.js", "AWS", "Azure", "GCP",
    "Kubernetes", "Docker", "DevOps", "CI/CD", "Microservices", "Cloud", "Generative AI",
    "Agentic AI", "MLOps", "Responsible AI", "Consulting", "Cybersecurity", "AI", "Machine Learning"
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
    source: "Capgemini",
    company: "Capgemini",
    id: jobId,
    jobId: jobId,
    title: title,
    brand: brand,
    contractType: item.contract_type || "Permanent",
    experienceLevel: item.experience_level || "Experienced Professionals",
    category: category,
    department: department,
    businessUnit: item.sbu || brand || "Capgemini",
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
    applyJobUrl: applyJobUrl,
    detailsUrl: detailsUrl,
    skills: skills,
    salary: salary,
    shift: "Day Shift",
    description: plainDescription,
    descriptionHtml: descriptionHtml,
    basicQualifications: plainDescription.slice(0, 350),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: category,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch ALL Capgemini jobs across pages
 * @param {number|object|null} [optionsOrLimit=null] 
 * @param {boolean} [fetchDetails=true] Whether to fetch individual details
 * @returns {Promise<Array>}
 */
async function fetchAllCapgeminiJobs(optionsOrLimit = null, fetchDetails = true) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allRawItems = [];
  let page = 1;
  const pageSize = 50;
  let totalJobsCount = null;

  try {
    while (true) {
      const pageData = await fetchCapgeminiJobsPage(page, pageSize);
      if (!pageData || !Array.isArray(pageData.data) || pageData.data.length === 0) break;

      totalJobsCount = pageData.count || pageData.total || totalJobsCount;
      allRawItems.push(...pageData.data);

      console.log(`[Capgemini API] Fetched page ${page}: ${allRawItems.length} / ${totalJobsCount || 'unknown'} jobs...`);

      if (maxLimit && allRawItems.length >= maxLimit) {
        break;
      }

      if (totalJobsCount && allRawItems.length >= totalJobsCount) {
        break;
      }

      page++;
      await delay(200);
    }

    let targetItems = allRawItems;
    if (maxLimit && targetItems.length > maxLimit) {
      targetItems = targetItems.slice(0, maxLimit);
    }

    console.log(`[Capgemini API] Processing ${targetItems.length} Capgemini jobs...`);

    const mappedJobs = [];
    for (const item of targetItems) {
      const mapped = mapCapgeminiJob(item);
      if (mapped && mapped.jobId) {
        mappedJobs.push(mapped);
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("[Capgemini API] Error fetching Capgemini jobs:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Capgemini jobs with MongoDB collection
 * @param {object} CapgeminiJobModel 
 * @param {number|object|null} [optionsOrLimit=null] 
 * @returns {Promise<object>}
 */
async function syncCapgeminiJobsWithDb(CapgeminiJobModel, optionsOrLimit = null) {
  if (!CapgeminiJobModel) {
    throw new Error("CapgeminiJob model is required for database sync.");
  }

  console.log("[Capgemini Sync] Starting Capgemini jobs DB sync...");
  const fetchedJobs = await fetchAllCapgeminiJobs(optionsOrLimit, true);
  console.log(`[Capgemini Sync] Fetched ${fetchedJobs.length} live jobs from Capgemini API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Capgemini API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await CapgeminiJobModel.find({ source: "Capgemini" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await CapgeminiJobModel.deleteMany({ source: "Capgemini", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Capgemini", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await CapgeminiJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await CapgeminiJobModel.countDocuments({ source: "Capgemini" });

  return {
    success: true,
    message: "Capgemini DB sync completed successfully.",
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
  fetchCapgeminiJobsPage,
  fetchCapgeminiJobById,
  mapCapgeminiJob,
  fetchAllCapgeminiJobs,
  syncCapgeminiJobsWithDb,
  cleanHtml
};
