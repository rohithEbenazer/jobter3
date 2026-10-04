// qualcomm.api.js - Dedicated API module for Qualcomm Careers (PCSX API)
const axios = require("axios");

const QUALCOMM_SEARCH_API_URL = "https://careers.qualcomm.com/api/pcsx/search";
const QUALCOMM_DETAILS_API_URL = "https://careers.qualcomm.com/api/pcsx/position_details";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "referer": "https://careers.qualcomm.com/careers",
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
 * Extract experience requirements from text
 */
function extractExperienceFromText(text = "") {
  if (!text) return { minYears: 0, maxYears: 99, experienceRequired: "Not specified" };

  const zeroYears = /\b(?:0\s*\+?\s*years?|no\s+(?:prior\s+)?experience\s+required|freshers?|intern(?:ship)?|entry\s+level|students?|graduates?)\b/i;
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

  return { minYears: 0, maxYears: 99, experienceRequired: "Not specified" };
}

/**
 * Extract salary information from text
 */
function extractSalaryFromText(text = "") {
  if (!text) return "Competitive Package";
  const salaryMatch = /(?:Hiring Range|Salary Range|USD|INR|EUR|GBP|Compensation)\s*(?:in\s*(?:USD|INR|EUR|GBP)\s*)?(?:from:?\s*)?((?:\$|₹|£|€|INR|USD)\s*[\d,]+\s*(?:to|-)\s*(?:\$|₹|£|€|INR|USD)?\s*[\d,]+(?:\s*per\s*(?:annum|year|hr|hour))?)/i.exec(text);
  if (salaryMatch) {
    return salaryMatch[1].trim();
  }
  return "Competitive Package";
}

/**
 * Step 1: Fetch a page of jobs from Qualcomm PCSX API
 * @param {number} start Offset index
 * @returns {Promise<object|null>}
 */
async function fetchQualcommJobsPage(start = 0) {
  const url = `${QUALCOMM_SEARCH_API_URL}?domain=qualcomm.com&query=&location=&start=${start}&sort_by=timestamp`;
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
      else console.warn(`[Qualcomm API] Error fetching start ${start}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch single job details by position_id from Qualcomm PCSX API
 * @param {string|number} positionId
 * @returns {Promise<object|null>}
 */
async function fetchQualcommJobById(positionId) {
  if (!positionId) return null;
  const url = `${QUALCOMM_DETAILS_API_URL}?position_id=${positionId}&domain=qualcomm.com&hl=en`;
  try {
    if (typeof fetch !== "undefined") {
      const res = await fetch(url, { headers: DEFAULT_HEADERS });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.data || null;
    } else {
      const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 20000 });
      return res.data?.data || null;
    }
  } catch (error) {
    console.warn(`[Qualcomm API] Error fetching details for position ID ${positionId}:`, error.message);
  }
  return null;
}

/**
 * Step 3: Map raw Qualcomm job position & detail to standardized Job format
 * @param {object} item Raw position object from PCSX search
 * @param {object|null} detail Raw detail object from position_details
 * @returns {object|null}
 */
function mapQualcommJob(item, detail = null) {
  if (!item) return null;

  const jobId = String(item.id || item.position_id || item.atsJobId || item.displayJobId || '');
  if (!jobId) return null;

  const title = item.name || detail?.name || "Qualcomm Opening";
  const category = item.department || detail?.department || "Semiconductor & Wireless Engineering";
  const department = category;

  // Locations array
  const rawLocs = item.locations || detail?.locations || [];
  const location = Array.isArray(rawLocs) && rawLocs.length > 0 ? rawLocs.join(', ') : 'Not specified';
  
  // Parse location city/state/country
  const locParts = location.split(',').map(s => s.trim()).filter(Boolean);
  const city = locParts.length > 0 ? [locParts[0]] : [];
  const country = locParts.length > 1 ? [locParts[locParts.length - 1]] : [];
  const state = locParts.length > 2 ? [locParts[1]] : [];

  // URLs
  const positionPath = item.positionUrl || `/careers/job/${jobId}`;
  const jobUrl = positionPath.startsWith('http') ? positionPath : `https://careers.qualcomm.com${positionPath}`;
  const applyJobUrl = jobUrl;
  const detailsUrl = `${QUALCOMM_DETAILS_API_URL}?position_id=${jobId}&domain=qualcomm.com&hl=en`;

  // Descriptions
  const descriptionHtml = detail?.jobDescription || `<p><strong>${title}</strong></p><p>Department: ${department}</p><p>Location: ${location}</p>`;
  const plainDescription = cleanHtml(descriptionHtml);

  // Experience
  const expResult = extractExperienceFromText(plainDescription);

  // Workmode mapping
  const rawWorkmode = item.workLocationOption || detail?.workLocationOption || "";
  let workmode = "On-site";
  if (rawWorkmode.toLowerCase().includes("remote")) {
    workmode = "Remote";
  } else if (rawWorkmode.toLowerCase().includes("hybrid")) {
    workmode = "Hybrid";
  } else {
    const textBlob = `${title} ${location} ${plainDescription}`.toLowerCase();
    if (textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
      workmode = "Remote";
    } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
      workmode = "Hybrid";
    }
  }

  // Posted Date
  let postedDate = new Date().toISOString();
  const ts = item.postedTs || detail?.postedTs || item.creationTs;
  if (ts) {
    const d = new Date(ts > 1e11 ? ts : ts * 1000);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  // Skills
  const skillsSet = new Set(["Qualcomm", "Semiconductors", "Wireless"]);
  if (category) skillsSet.add(category);

  const techKeywords = [
    "Qualcomm", "Snapdragon", "5G", "LTE", "RF", "DSP", "FPGA", "Embedded",
    "C", "C++", "Python", "ARM", "ASIC", "SoC", "Verilog", "SystemVerilog",
    "Linux", "RTOS", "Bluetooth", "Wi-Fi", "Machine Learning", "AI", "NPU",
    "GPU", "Software Engineering", "Hardware Engineering", "Validation", "Firmware"
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
    source: "Qualcomm",
    company: "Qualcomm",
    id: jobId,
    jobId: jobId,
    displayJobId: item.displayJobId || item.atsJobId || jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "Qualcomm",
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
 * Step 4: Fetch ALL Qualcomm jobs across pagination
 * @param {number|object|null} [optionsOrLimit=null] 
 * @param {boolean} [fetchDetails=true] Whether to fetch individual details
 * @returns {Promise<Array>}
 */
async function fetchAllQualcommJobs(optionsOrLimit = null, fetchDetails = true) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allRawItems = [];
  let start = 0;
  let totalJobsCount = null;

  try {
    while (true) {
      const pageData = await fetchQualcommJobsPage(start);
      if (!pageData || !pageData.data || !Array.isArray(pageData.data.positions) || pageData.data.positions.length === 0) break;

      totalJobsCount = pageData.data.count || totalJobsCount;
      const positions = pageData.data.positions;
      allRawItems.push(...positions);

      console.log(`[Qualcomm API] Fetched start ${start}: ${allRawItems.length} / ${totalJobsCount || 'unknown'} jobs...`);

      if (maxLimit && allRawItems.length >= maxLimit) {
        break;
      }

      if (totalJobsCount && allRawItems.length >= totalJobsCount) {
        break;
      }

      start += positions.length;
      await delay(200);
    }

    let targetItems = allRawItems;
    if (maxLimit && targetItems.length > maxLimit) {
      targetItems = targetItems.slice(0, maxLimit);
    }

    console.log(`[Qualcomm API] Processing ${targetItems.length} jobs (fetchDetails: ${fetchDetails})...`);

    const mappedJobs = [];
    const concurrency = 5;

    for (let i = 0; i < targetItems.length; i += concurrency) {
      const chunk = targetItems.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(async (item) => {
        const posId = item.id || item.position_id;
        let detail = null;
        if (fetchDetails && posId) {
          detail = await fetchQualcommJobById(posId);
        }
        return mapQualcommJob(item, detail);
      }));

      for (const job of chunkResults) {
        if (job && job.jobId) mappedJobs.push(job);
      }

      if (i + concurrency < targetItems.length) {
        await delay(200);
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("[Qualcomm API] Error fetching Qualcomm jobs:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Qualcomm jobs with MongoDB collection
 * @param {object} QualcommJobModel 
 * @param {number|object|null} [optionsOrLimit=null] 
 * @returns {Promise<object>}
 */
async function syncQualcommJobsWithDb(QualcommJobModel, optionsOrLimit = null) {
  if (!QualcommJobModel) {
    throw new Error("QualcommJob model is required for database sync.");
  }

  console.log("[Qualcomm Sync] Starting Qualcomm jobs DB sync...");
  const fetchedJobs = await fetchAllQualcommJobs(optionsOrLimit, true);
  console.log(`[Qualcomm Sync] Fetched ${fetchedJobs.length} live jobs with details from Qualcomm PCSX API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Qualcomm API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await QualcommJobModel.find({ source: "Qualcomm" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await QualcommJobModel.deleteMany({ source: "Qualcomm", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Qualcomm", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await QualcommJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await QualcommJobModel.countDocuments({ source: "Qualcomm" });

  return {
    success: true,
    message: "Qualcomm DB sync completed successfully.",
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
  fetchQualcommJobsPage,
  fetchQualcommJobById,
  mapQualcommJob,
  fetchAllQualcommJobs,
  syncQualcommJobsWithDb,
  cleanHtml
};
