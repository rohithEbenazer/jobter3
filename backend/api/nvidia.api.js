// nvidia.api.js - Dedicated API module for NVIDIA Careers (pcsx API)
const axios = require("axios");

const NVIDIA_SEARCH_URL = "https://jobs.nvidia.com/api/pcsx/search";
const NVIDIA_DETAIL_URL = "https://jobs.nvidia.com/api/pcsx/position_details";
const NVIDIA_PUBLIC_BASE = "https://jobs.nvidia.com";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "referer": "https://jobs.nvidia.com/careers",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

/**
 * Step 1: Fetch a page of jobs from NVIDIA search API
 * @param {number} start Start offset (0, 10, 20...)
 * @returns {Promise<object|null>} Response data object containing positions array and total count
 */
async function fetchNvidiaPage(start = 0) {
  const url = `${NVIDIA_SEARCH_URL}?domain=nvidia.com&query=&location=&start=${start}&sort_by=timestamp`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (res.status === 404) return null;
        if (res.status === 429) {
          const waitTime = Math.round(1500 * attempt + Math.random() * 500);
          await delay(waitTime);
          continue;
        }
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data || null;
      } else {
        const response = await axios.get(url, {
          headers: DEFAULT_HEADERS,
          timeout: 15000
        });
        return response.data?.data || null;
      }
    } catch (error) {
      if (error.response && error.response.status === 404) return null;
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[NVIDIA API] Error fetching page start ${start}:`, error.message);
    }
  }
  return null;
}

/**
 * Fetch detailed position information for a specific NVIDIA position_id
 * @param {string|number} positionId e.g. 893397974795
 * @returns {Promise<object|null>}
 */
async function fetchNvidiaJobDetails(positionId) {
  if (!positionId) return null;
  const url = `${NVIDIA_DETAIL_URL}?position_id=${positionId}&domain=nvidia.com&hl=en`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (!res.ok) return null;
        const json = await res.json();
        return json?.data?.position || null;
      } else {
        const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 10000 });
        return res.data?.data?.position || null;
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
 * Extract salary information from text
 */
function extractSalaryInfo(textBlob = "") {
  const salMatch = /(?:USD|\$)\s*([\d,]+)\s*(?:-|to)\s*(?:USD|\$)?\s*([\d,]+)/i.exec(textBlob);
  if (salMatch) {
    return `$${salMatch[1]} - $${salMatch[2]} / year`;
  }
  return "Competitive Package";
}

/**
 * Step 3: Map NVIDIA raw item + optional detail into standardized Job format
 * @param {object} rawItem Raw position item from search API
 * @param {object|null} [detailItem=null] Detailed position item if fetched
 * @returns {object|null} Standardized JSON format of job
 */
function mapNvidiaJobs(rawItem, detailItem = null) {
  if (!rawItem) return null;

  const jobId = String(rawItem.displayJobId || rawItem.atsJobId || rawItem.id || '');
  if (!jobId) return null;

  const title = detailItem?.name || rawItem.name || "NVIDIA Opening";
  const posUrl = rawItem.positionUrl || `/careers/job/${rawItem.id}`;
  const fullUrl = posUrl.startsWith('http') ? posUrl : `${NVIDIA_PUBLIC_BASE}${posUrl}`;

  // Locations
  let rawLocs = rawItem.locations || rawItem.standardizedLocations || [];
  if (typeof rawLocs === 'string') rawLocs = [rawLocs];
  const location = rawLocs.length > 0 ? rawLocs.join(', ') : 'Not specified';

  let country = [];
  let state = [];
  let city = [];

  if (rawLocs.length > 0) {
    const parts = rawLocs[0].split(',').map(s => s.trim());
    if (parts.length >= 3) {
      country = [parts[0]];
      state = [parts[1]];
      city = [parts[2]];
    } else if (parts.length === 2) {
      state = [parts[0]];
      city = [parts[1]];
    } else if (parts.length === 1 && parts[0]) {
      city = [parts[0]];
    }
  }

  // Work Mode detection
  const workOption = String(rawItem.workLocationOption || detailItem?.workLocationOption || '').toLowerCase();
  const descRaw = detailItem?.jobDescription || '';
  const textBlob = `${title} ${location} ${workOption} ${descRaw}`.toLowerCase();

  let workmode = "On-site";
  if (workOption.includes("remote") || textBlob.includes("remote") || textBlob.includes("virtual") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (workOption.includes("hybrid") || textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  // Posted Date parsing
  let postedDate = new Date().toISOString();
  if (rawItem.postedTs) {
    const d = new Date(rawItem.postedTs * 1000);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  const plainDescription = cleanHtml(descRaw || `${title} - ${location}`);
  const rawHtml = descRaw || `<p><strong>${title}</strong></p><p>Location: ${location}</p>`;
  const expResult = extractExperienceFromText(plainDescription);

  const category = rawItem.department || 'AI, GPUs & Graphics';
  const department = rawItem.department || 'Engineering & AI';

  const skillsSet = new Set();
  skillsSet.add("NVIDIA");
  skillsSet.add("AI");
  skillsSet.add("CUDA");

  const techKeywords = [
    "CUDA", "TensorRT", "PyTorch", "TensorFlow", "Deep Learning", "GPU", "Ray Tracing",
    "Omniverse", "C++", "C#", "Python", "Java", "Verilog", "SystemVerilog", "FPGA",
    "Linux", "RTOS", "Embedded", "DevOps", "CI/CD", "Kubernetes", "Docker", "AWS",
    "Autonomous Vehicles", "Robotics", "Computer Vision", "LLM", "Generative AI"
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
    source: "NVIDIA",
    company: "NVIDIA",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "NVIDIA GPU Computing",
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
    role: "AI / Software / Hardware Specialist",
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch ALL NVIDIA jobs (or up to maxLimit)
 * @param {number|object|null} [optionsOrLimit=null] Maximum number of jobs to fetch or options object
 * @returns {Promise<Array>} Array of JSON job objects
 */
async function fetchAllNvidiaJobs(optionsOrLimit = null) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  try {
    let allRawJobs = [];
    let start = 0;

    const firstPage = await fetchNvidiaPage(0);
    if (!firstPage || !Array.isArray(firstPage.positions)) {
      return [];
    }

    allRawJobs.push(...firstPage.positions);
    const totalCount = firstPage.count || 1000;
    const targetTotal = maxLimit ? Math.min(maxLimit, totalCount) : totalCount;

    while (allRawJobs.length < targetTotal) {
      start += firstPage.positions.length || 10;
      const pageData = await fetchNvidiaPage(start);
      if (!pageData || !Array.isArray(pageData.positions) || pageData.positions.length === 0) {
        break;
      }
      allRawJobs.push(...pageData.positions);
      await delay(100);
    }

    if (maxLimit) {
      allRawJobs = allRawJobs.slice(0, maxLimit);
    }

    const mappedJobs = [];
    const seenIds = new Set();

    for (const raw of allRawJobs) {
      let detail = null;
      if (raw.id && mappedJobs.length < 50) {
        detail = await fetchNvidiaJobDetails(raw.id);
      }

      const mapped = mapNvidiaJobs(raw, detail);
      if (mapped && mapped.jobId && !seenIds.has(mapped.jobId)) {
        seenIds.add(mapped.jobId);
        mappedJobs.push(mapped);
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("[NVIDIA API] Error:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync NVIDIA jobs with MongoDB collection
 * @param {object} NvidiaJobModel Mongoose model for NvidiaJob
 * @param {number|object|null} [optionsOrLimit=null] Optional limit or options
 * @returns {Promise<object>} Sync operation result summary
 */
async function syncNvidiaJobsWithDb(NvidiaJobModel, optionsOrLimit = null) {
  if (!NvidiaJobModel) {
    throw new Error("NvidiaJob model is required for database sync.");
  }

  console.log("[NVIDIA Sync] Starting NVIDIA jobs DB sync...");
  const fetchedJobs = await fetchAllNvidiaJobs(optionsOrLimit);
  console.log(`[NVIDIA Sync] Fetched ${fetchedJobs.length} live jobs from NVIDIA API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from NVIDIA API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await NvidiaJobModel.find({ source: "NVIDIA" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await NvidiaJobModel.deleteMany({ source: "NVIDIA", jobId: { $in: obsoleteIds } });
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
        filter: { source: "NVIDIA", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await NvidiaJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await NvidiaJobModel.countDocuments({ source: "NVIDIA" });

  return {
    success: true,
    message: "NVIDIA DB sync completed successfully.",
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
  fetchNvidiaPage,
  fetchNvidiaJobDetails,
  mapNvidiaJobs,
  fetchAllNvidiaJobs,
  syncNvidiaJobsWithDb,
  cleanHtml
};
