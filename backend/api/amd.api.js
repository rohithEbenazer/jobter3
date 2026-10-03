// amd.api.js - Dedicated API module for AMD Careers (AMD Phenom Careers API)
const axios = require("axios");

const AMD_JOBS_API_URL = "https://careers.amd.com/api/jobs";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "referer": "https://careers.amd.com/careers-home/jobs",
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
 * Extract salary information from item or text
 */
function extractSalary(itemData = {}, text = "") {
  if (itemData.salary_value) return String(itemData.salary_value).trim();
  if (itemData.salary_min_value && itemData.salary_max_value) {
    return `$${itemData.salary_min_value} - $${itemData.salary_max_value}`;
  }

  const salaryMatch = /(?:Hiring Range|Salary Range|USD|Compensation)\s*(?:in\s*USD\s*)?(?:from:?\s*)?(\$[\d,]+\s*(?:to|-)\s*\$[\d,]+(?:\s*per\s*(?:annum|year|hr|hour))?)/i.exec(text);
  if (salaryMatch) {
    return salaryMatch[1].trim();
  }
  return "Competitive Package";
}

/**
 * Step 1: Fetch a page of jobs from AMD Careers API
 * @param {number} page Page number (1-based)
 * @param {number} limit Items per page (default 100)
 * @returns {Promise<object|null>}
 */
async function fetchAmdJobsPage(page = 1, limit = 100) {
  const url = `${AMD_JOBS_API_URL}?page=${page}&limit=${limit}&sortBy=relevance&descending=false&internal=false`;

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
      else console.warn(`[AMD API] Error fetching page ${page}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Map raw AMD job item data to standardized Job format
 * @param {object} rawWrapper Outer job item object ({ data: { ... } })
 * @returns {object|null}
 */
function mapAmdJob(rawWrapper) {
  const d = rawWrapper?.data || rawWrapper;
  if (!d) return null;

  const jobId = String(d.slug || d.req_id || '');
  if (!jobId) return null;

  const title = d.title || "AMD Opening";
  const jobUrl = `https://careers.amd.com/careers-home/jobs/${jobId}?lang=en-us`;

  // Locations
  const city = d.city ? [d.city] : [];
  const state = d.state ? [d.state] : [];
  const country = d.country ? [d.country] : [];

  const locationStr = d.full_location || d.short_location || d.location_name || [...city, ...state, ...country].filter(Boolean).join(', ') || 'Not specified';

  // Description
  const rawHtml = d.description || `<p><strong>${title}</strong></p><p>Location: ${locationStr}</p>`;
  const plainDescription = cleanHtml(rawHtml);

  // Experience
  const expResult = extractExperienceFromText(plainDescription);

  // Workmode
  const textBlob = `${title} ${locationStr} ${plainDescription}`.toLowerCase();
  let workmode = "On-site";
  if (d.location_type === 'remote' || textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  // Posted Date
  let postedDate = new Date().toISOString();
  const rawDateStr = d.posted_date || d.create_date || d.update_date;
  if (rawDateStr) {
    const parsed = new Date(rawDateStr);
    if (!isNaN(parsed.getTime())) postedDate = parsed.toISOString();
  }

  // Categories & Department
  let category = "Semiconductors & Computing";
  if (Array.isArray(d.categories) && d.categories.length > 0) {
    category = d.categories.map(c => String(c).trim()).join(', ');
  } else if (Array.isArray(d.category) && d.category.length > 0) {
    category = d.category.map(c => String(c).trim()).join(', ');
  } else if (typeof d.category === 'string' && d.category.trim()) {
    category = d.category.trim();
  }

  const department = d.department || "Hardware & Software Engineering";
  const businessUnit = d.hiring_organization || "AMD";

  // Skills
  const skillsSet = new Set(["AMD", "Semiconductors"]);
  if (category) skillsSet.add(category);

  const techKeywords = [
    "AMD", "GPU", "CPU", "Ryzen", "EPYC", "Radeon", "Instinct", "Xilinx", "ROCm",
    "Verilog", "SystemVerilog", "VHDL", "FPGA", "ASIC", "PCIe", "DDR", "HBM",
    "C++", "C#", "C", "Python", "Linux", "Perl", "Tcl", "Java", "JavaScript", "TypeScript",
    "AI", "Machine Learning", "LLM", "Deep Learning", "CUDA", "OpenCL",
    "Docker", "Kubernetes", "DevOps", "CI/CD", "Silicon", "Hardware", "Firmware"
  ];

  techKeywords.forEach(kw => {
    let regexStr = kw === "C++" || kw === "C#" ? kw.replace(/\+/g, '\\+') : `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);
  const salary = extractSalary(d, plainDescription);

  return {
    source: "AMD",
    company: "AMD",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: businessUnit,
    location: locationStr,
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
    basicQualifications: plainDescription.slice(0, 400),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: category,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 3: Fetch ALL AMD jobs
 * @param {number|object|null} [optionsOrLimit=null] Maximum number of jobs to fetch or options object
 * @returns {Promise<Array>}
 */
async function fetchAllAmdJobs(optionsOrLimit = null) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allMappedJobs = [];
  const seenIds = new Set();
  let page = 1;
  const limitPerPage = 100;
  let totalJobsCount = null;

  try {
    while (true) {
      const pageData = await fetchAmdJobsPage(page, limitPerPage);
      if (!pageData || !Array.isArray(pageData.jobs) || pageData.jobs.length === 0) break;

      totalJobsCount = pageData.totalCount || pageData.count || totalJobsCount;

      for (const item of pageData.jobs) {
        const mapped = mapAmdJob(item);
        if (mapped && mapped.jobId && !seenIds.has(mapped.jobId)) {
          seenIds.add(mapped.jobId);
          allMappedJobs.push(mapped);
        }
      }

      console.log(`[AMD API] Fetched page ${page}: ${allMappedJobs.length} / ${totalJobsCount || 'unknown'} jobs...`);

      if (maxLimit && allMappedJobs.length >= maxLimit) {
        break;
      }

      if (pageData.jobs.length < limitPerPage || (totalJobsCount && allMappedJobs.length >= totalJobsCount)) {
        break;
      }

      page++;
      await delay(250);
    }

    if (maxLimit && allMappedJobs.length > maxLimit) {
      return allMappedJobs.slice(0, maxLimit);
    }

    return allMappedJobs;
  } catch (error) {
    console.error("[AMD API] Error fetching AMD jobs:", error.message);
    return [];
  }
}

/**
 * Step 4: Sync AMD jobs with MongoDB collection
 * @param {object} AmdJobModel 
 * @param {number|object|null} [optionsOrLimit=null] 
 * @returns {Promise<object>}
 */
async function syncAmdJobsWithDb(AmdJobModel, optionsOrLimit = null) {
  if (!AmdJobModel) {
    throw new Error("AmdJob model is required for database sync.");
  }

  console.log("[AMD Sync] Starting AMD jobs DB sync...");
  const fetchedJobs = await fetchAllAmdJobs(optionsOrLimit);
  console.log(`[AMD Sync] Fetched ${fetchedJobs.length} live jobs from AMD API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from AMD API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await AmdJobModel.find({ source: "AMD" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await AmdJobModel.deleteMany({ source: "AMD", jobId: { $in: obsoleteIds } });
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
        filter: { source: "AMD", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await AmdJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await AmdJobModel.countDocuments({ source: "AMD" });

  return {
    success: true,
    message: "AMD DB sync completed successfully.",
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
  fetchAmdJobsPage,
  mapAmdJob,
  fetchAllAmdJobs,
  syncAmdJobsWithDb,
  cleanHtml
};
