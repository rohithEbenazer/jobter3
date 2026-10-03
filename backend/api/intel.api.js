// intel.api.js - Dedicated API module for Intel Careers (Workday CXS API)
const axios = require("axios");

const INTEL_JOBS_URL = "https://intel.wd1.myworkdayjobs.com/wday/cxs/intel/External/jobs";
const INTEL_BASE_DETAIL_URL = "https://intel.wd1.myworkdayjobs.com/wday/cxs/intel/External";
const INTEL_PUBLIC_JOB_BASE = "https://intel.wd1.myworkdayjobs.com/en-US/External";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json",
  "accept-language": "en-US",
  "content-type": "application/json",
  "origin": "https://intel.wd1.myworkdayjobs.com",
  "referer": "https://intel.wd1.myworkdayjobs.com/External",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

/**
 * Step 1: Fetch a page of jobs from Intel Workday API
 * @param {number} offset Offset number (0, 20, 40...)
 * @param {number} limit Page size (default 20)
 * @returns {Promise<object|null>} Response object containing jobPostings and total count
 */
async function fetchIntelPage(offset = 0, limit = 20) {
  const payload = {
    appliedFacets: {},
    limit: limit,
    offset: offset,
    searchText: ""
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(INTEL_JOBS_URL, {
          method: "POST",
          headers: DEFAULT_HEADERS,
          body: JSON.stringify(payload)
        });
        if (res.status === 404) return null;
        if (res.status === 429) {
          const waitTime = Math.round(1500 * attempt + Math.random() * 500);
          await delay(waitTime);
          continue;
        }
        if (!res.ok) return null;
        const data = await res.json();
        return data;
      } else {
        const response = await axios.post(INTEL_JOBS_URL, payload, {
          headers: DEFAULT_HEADERS,
          timeout: 15000
        });
        return response.data;
      }
    } catch (error) {
      if (error.response && error.response.status === 404) return null;
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Intel API] Error fetching page offset ${offset}:`, error.message);
    }
  }
  return null;
}

/**
 * Fetch detailed job information for a specific job external path
 * @param {string} externalPath e.g. "/job/US-Arizona-Phoenix/..."
 * @returns {Promise<object|null>}
 */
async function fetchIntelJobDetails(externalPath) {
  if (!externalPath) return null;
  const url = `${INTEL_BASE_DETAIL_URL}${externalPath}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, {
          headers: {
            "accept": "application/json",
            "user-agent": DEFAULT_HEADERS["user-agent"]
          }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.jobPostingInfo || null;
      } else {
        const res = await axios.get(url, {
          headers: {
            "accept": "application/json",
            "user-agent": DEFAULT_HEADERS["user-agent"]
          },
          timeout: 10000
        });
        return res.data?.jobPostingInfo || null;
      }
    } catch (err) {
      if (attempt < 2) await delay(300);
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
 * Extract salary information from item description
 */
function extractSalaryInfo(textBlob = "") {
  const salMatch = /(?:USD|\$)\s*([\d,]+)\s*(?:-|to)\s*(?:USD|\$)?\s*([\d,]+)/i.exec(textBlob);
  if (salMatch) {
    return `$${salMatch[1]} - $${salMatch[2]} / year`;
  }
  const hrMatch = /(?:USD|\$)\s*([\d.]+)\s*(?:-|to)\s*(?:USD|\$)?\s*([\d.]+)\s*(?:per\s+hour|\/hr)/i.exec(textBlob);
  if (hrMatch) {
    return `$${hrMatch[1]} - $${hrMatch[2]} / hr`;
  }
  return "Competitive Package";
}

/**
 * Map Intel job raw list item + optional details into standardized Job format
 * @param {object} rawItem Raw job item from jobPostings
 * @param {object|null} [detailItem=null] Detailed job posting info if fetched
 * @returns {object|null} Standardized JSON format of job
 */
function mapIntelJobs(rawItem, detailItem = null) {
  if (!rawItem) return null;

  // Extract Job ID
  let jobId = detailItem?.jobReqId || detailItem?.id;
  if (!jobId && Array.isArray(rawItem.bulletFields)) {
    jobId = rawItem.bulletFields.find(f => /^JR\d+$/i.test(f) || /^[A-Z0-9_-]+$/i.test(f));
  }
  if (!jobId && rawItem.externalPath) {
    const match = /_([A-Z0-9]+)$/i.exec(rawItem.externalPath);
    if (match) jobId = match[1];
  }
  if (!jobId) {
    jobId = String(rawItem.title || 'intel-job').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
  }

  const title = detailItem?.title || rawItem.title || "Intel Opening";
  const externalPath = rawItem.externalPath || '';
  const fullUrl = detailItem?.externalUrl || (externalPath ? `${INTEL_PUBLIC_JOB_BASE}${externalPath}` : "https://intel.wd1.myworkdayjobs.com/External");

  const location = detailItem?.location || rawItem.locationsText || "Not specified";
  const locParts = location.split(',').map(s => s.trim());

  let country = [];
  let state = [];
  let city = [];

  if (locParts.length >= 3) {
    country = [locParts[0]];
    state = [locParts[1]];
    city = [locParts[2]];
  } else if (locParts.length === 2) {
    country = [locParts[0]];
    city = [locParts[1]];
  } else if (locParts.length === 1 && locParts[0]) {
    city = [locParts[0]];
  }

  const descRaw = detailItem?.jobDescription || '';
  const textBlob = `${title} ${location} ${descRaw}`.toLowerCase();

  let workmode = "On-site";
  if (textBlob.includes("remote") || textBlob.includes("virtual") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  let postedDate = new Date().toISOString();
  if (detailItem?.startDate) {
    const d = new Date(detailItem.startDate);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  const plainDescription = cleanHtml(descRaw || `${title} - ${location}`);
  const rawHtml = descRaw || `<p><strong>${title}</strong></p><p>Location: ${location}</p>`;
  const expResult = extractExperienceFromText(plainDescription);

  const category = detailItem?.timeType || 'Semiconductors & Hardware';
  const department = 'Engineering & Technology';

  const skillsSet = new Set();
  skillsSet.add("Intel");
  skillsSet.add("Semiconductors");

  const techKeywords = [
    "C++", "C#", "Python", "Java", "Verilog", "SystemVerilog", "VHDL", "FPGA", "ASIC",
    "Silicon", "Semiconductor", "Validation", "Firmware", "Embedded", "Linux", "RTOS",
    "React", "Node.js", "AI", "Machine Learning", "PyTorch", "TensorFlow", "CUDA",
    "OpenVINO", "DevOps", "CI/CD", "Kubernetes", "Docker", "AWS", "Cloud"
  ];

  techKeywords.forEach(kw => {
    let regexStr = kw === "C++" || kw === "C#" ? kw.replace(/\+/g, '\\+') : `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription || title)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);
  const salary = extractSalaryInfo(plainDescription);

  return {
    source: "Intel",
    company: "Intel",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "Intel Foundry",
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
    salary: salary,
    shift: "Day Shift",
    description: plainDescription,
    descriptionHtml: rawHtml,
    basicQualifications: plainDescription.slice(0, 300),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: "Hardware / Software Specialist",
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch ALL Intel jobs (or up to maxLimit)
 * @param {number|object|null} [optionsOrLimit=null] Maximum number of jobs to fetch or options object
 * @returns {Promise<Array>} Array of JSON job objects
 */
async function fetchAllIntelJobs(optionsOrLimit = null) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  try {
    let allRawJobs = [];
    let offset = 0;
    const limit = 20;

    // First page fetch to get total count
    const firstPage = await fetchIntelPage(0, limit);
    if (!firstPage || !Array.isArray(firstPage.jobPostings)) {
      return [];
    }

    allRawJobs.push(...firstPage.jobPostings);
    const totalCount = firstPage.total || 1000;

    let targetTotal = maxLimit ? Math.min(maxLimit, totalCount) : totalCount;

    while (allRawJobs.length < targetTotal) {
      offset += limit;
      const pageRes = await fetchIntelPage(offset, limit);
      if (!pageRes || !Array.isArray(pageRes.jobPostings) || pageRes.jobPostings.length === 0) {
        break;
      }
      allRawJobs.push(...pageRes.jobPostings);
      await delay(100);
    }

    if (maxLimit) {
      allRawJobs = allRawJobs.slice(0, maxLimit);
    }

    const mappedJobs = [];
    const seenIds = new Set();

    for (const raw of allRawJobs) {
      // Fetch detail if externalPath exists (limit detail fetches to avoid long delays, or fetch in batches)
      let detail = null;
      if (raw.externalPath && mappedJobs.length < 50) {
        detail = await fetchIntelJobDetails(raw.externalPath);
      }

      const mapped = mapIntelJobs(raw, detail);
      if (mapped && mapped.jobId && !seenIds.has(mapped.jobId)) {
        seenIds.add(mapped.jobId);
        mappedJobs.push(mapped);
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("[Intel API] Error:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Intel jobs with MongoDB collection
 * @param {object} IntelJobModel Mongoose model for IntelJob
 * @param {number|object|null} [optionsOrLimit=null] Optional limit or options
 * @returns {Promise<object>} Sync operation result summary
 */
async function syncIntelJobsWithDb(IntelJobModel, optionsOrLimit = null) {
  if (!IntelJobModel) {
    throw new Error("IntelJob model is required for database sync.");
  }

  console.log("[Intel Sync] Starting Intel jobs DB sync...");
  const fetchedJobs = await fetchAllIntelJobs(optionsOrLimit);
  console.log(`[Intel Sync] Fetched ${fetchedJobs.length} live jobs from Intel API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Intel API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await IntelJobModel.find({ source: "Intel" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await IntelJobModel.deleteMany({ source: "Intel", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Intel", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await IntelJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await IntelJobModel.countDocuments({ source: "Intel" });

  return {
    success: true,
    message: "Intel DB sync completed successfully.",
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
  fetchIntelPage,
  fetchIntelJobDetails,
  mapIntelJobs,
  fetchAllIntelJobs,
  syncIntelJobsWithDb,
  cleanHtml
};
