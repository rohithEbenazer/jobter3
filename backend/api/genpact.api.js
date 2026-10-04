// genpact.api.js - Dedicated API module for Genpact Careers (Workday CXS API)
const axios = require("axios");

const GENPACT_SEARCH_API_URL = "https://genpact.wd108.myworkdayjobs.com/wday/cxs/genpact/External_Careers/jobs";
const GENPACT_BASE_CXS_URL = "https://genpact.wd108.myworkdayjobs.com/wday/cxs/genpact/External_Careers";
const GENPACT_BASE_SITE_URL = "https://genpact.wd108.myworkdayjobs.com/External_Careers";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json",
  "accept-language": "en-US",
  "content-type": "application/json",
  "origin": "https://genpact.wd108.myworkdayjobs.com",
  "referer": "https://genpact.wd108.myworkdayjobs.com/External_Careers",
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

  const zeroYears = /\b(?:0\s*\+?\s*years?|no\s+(?:prior\s+)?experience\s+required|freshers?|intern(?:ship)?|entry\s+level)\b/i;
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
  const salaryMatch = /(?:Hiring Range|Salary Range|USD|INR|EUR|GBP|Compensation)\s*(?:in\s*(?:USD|INR|EUR|GBP)\s*)?(?:from:?\s*)?((?:\$|₹|£|€|INR|USD)\s*[\d,]+\s*(?:to|-)\s*(?:\$|₹|£|€|INR|USD)?\s*[\d,]+(?:\s*per\s*(?:annum|year|hr|hour))?)/i.exec(text);
  if (salaryMatch) {
    return salaryMatch[1].trim();
  }
  return "Competitive Package";
}

/**
 * Step 1: Fetch a page of jobs from Genpact Workday CXS Search API
 * @param {number} offset Offset index (0, 20, 40...)
 * @param {number} limit Items per page (max 20)
 * @returns {Promise<object|null>}
 */
async function fetchGenpactJobsPage(offset = 0, limit = 20) {
  const payload = {
    appliedFacets: {},
    limit: limit,
    offset: offset,
    searchText: ""
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(GENPACT_SEARCH_API_URL, {
          method: 'POST',
          headers: DEFAULT_HEADERS,
          body: JSON.stringify(payload)
        });
        if (res.status === 429) {
          await delay(1500 * attempt);
          continue;
        }
        if (!res.ok) return null;
        return await res.json();
      } else {
        const res = await axios.post(GENPACT_SEARCH_API_URL, payload, { headers: DEFAULT_HEADERS, timeout: 20000 });
        return res.data;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Genpact API] Error fetching offset ${offset}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch single job details by externalPath or jobReqId from Workday CXS API
 * @param {string} externalPath e.g. "/job/1415-GERCTower.../Title_JR10002462"
 * @returns {Promise<object|null>}
 */
async function fetchGenpactJobByPath(externalPath) {
  if (!externalPath) return null;
  const path = externalPath.startsWith('/') ? externalPath : `/${externalPath}`;
  const url = `${GENPACT_BASE_CXS_URL}${path}`;

  try {
    if (typeof fetch !== "undefined") {
      const res = await fetch(url, { headers: DEFAULT_HEADERS });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.jobPostingInfo || null;
    } else {
      const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 20000 });
      return res.data?.jobPostingInfo || null;
    }
  } catch (error) {
    console.warn(`[Genpact API] Error fetching details for path ${externalPath}:`, error.message);
  }
  return null;
}

/**
 * Step 3: Map raw Genpact job item & detail to standardized Job format
 * @param {object} item Raw job posting item from search payload
 * @param {object|null} detail Raw jobPostingInfo object from Workday CXS detail
 * @returns {object|null}
 */
function mapGenpactJob(item, detail = null) {
  if (!item && !detail) return null;

  const jobReqId = item?.bulletFields?.[0] || detail?.jobReqId || '';
  const internalId = detail?.id || '';
  const jobId = jobReqId || internalId || String(item?.externalPath || '').split('_').pop() || '';
  if (!jobId) return null;

  const title = item?.title || detail?.title || "Genpact Opening";
  const category = detail?.timeType || "BPO & IT Services";
  const department = "Operations & Digital Solutions";

  const rawLocation = item?.locationsText || detail?.location || "Global / Flexible";
  const locParts = rawLocation.split(',').map(s => s.trim()).filter(Boolean);
  const city = locParts.length > 0 ? [locParts[locParts.length - 1]] : [rawLocation];
  const country = detail?.country?.descriptor ? [detail.country.descriptor] : ["India"];
  const state = locParts.length > 1 ? [locParts[0]] : [];

  const externalPath = item?.externalPath || (detail?.externalUrl ? detail.externalUrl.replace(GENPACT_BASE_SITE_URL, '') : '');
  const jobUrl = detail?.externalUrl || (externalPath ? `${GENPACT_BASE_SITE_URL}${externalPath}` : 'https://genpact.wd108.myworkdayjobs.com/External_Careers');
  const applyJobUrl = jobUrl;
  const detailsUrl = externalPath ? `${GENPACT_BASE_CXS_URL}${externalPath}` : jobUrl;

  // Description
  const descriptionHtml = detail?.jobDescription || `<p><strong>${title}</strong></p><p>Requisition ID: ${jobReqId}</p><p>Location: ${rawLocation}</p>`;
  const plainDescription = cleanHtml(descriptionHtml);

  // Experience
  const expResult = extractExperienceFromText(plainDescription);

  // Workmode
  let workmode = "On-site";
  const remoteType = String(detail?.remoteType || '').toLowerCase();
  if (remoteType.includes("remote") || remoteType.includes("work from home")) {
    workmode = "Remote";
  } else if (remoteType.includes("hybrid")) {
    workmode = "Hybrid";
  } else {
    const textBlob = `${title} ${rawLocation} ${plainDescription}`.toLowerCase();
    if (textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
      workmode = "Remote";
    } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
      workmode = "Hybrid";
    }
  }

  // Skills
  const skillsSet = new Set(["Genpact", "Digital Transformation", "Process Innovation"]);
  if (category) skillsSet.add(category);

  const techKeywords = [
    "AI", "Machine Learning", "Python", "Java", "React", "Angular", "Node.js",
    "SQL", "Oracle", "SAP", "Workday", "AWS", "Azure", "GCP", "DevOps",
    "Risk Advisory", "Consulting", "Finance", "Accounting", "Data Analytics",
    "Cybersecurity", "Automation", "RPA", "UiPath", "Power BI", "Tableau"
  ];

  techKeywords.forEach(kw => {
    let regexStr = kw === "C++" || kw === "C#" || kw === ".NET" ? kw.replace(/[\+\.#]/g, '\\$&') : `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);
  const salary = extractSalaryFromText(plainDescription);

  let postedDate = new Date().toISOString();
  if (detail?.startDate) {
    const d = new Date(detail.startDate);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  return {
    source: "Genpact",
    company: "Genpact",
    id: jobId,
    jobId: jobId,
    jobReqId: jobReqId,
    displayJobId: jobReqId || jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "Genpact Workday Careers",
    location: rawLocation,
    city: Array.from(new Set(city)),
    state: Array.from(new Set(state)),
    country: Array.from(new Set(country)),
    minYears: expResult.minYears,
    maxYears: expResult.maxYears,
    minYrsOfExperience: expResult.minYears,
    maxYrsOfExperience: expResult.maxYears,
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
    description: plainDescription || title,
    descriptionHtml: descriptionHtml,
    basicQualifications: plainDescription.slice(0, 350),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: category || "Consultant / Operations",
    mandateSkills: skills.length > 0 ? skills.join(', ') : null,
    externalPath: externalPath
  };
}

/**
 * Step 4: Fetch ALL Genpact jobs across pagination
 * @param {number|object|null} [optionsOrLimit=null]
 * @param {boolean} [fetchDetails=true] Whether to fetch detailed Workday descriptions
 * @returns {Promise<Array>}
 */
/**
 * Step 4: Fetch Genpact jobs with safety cap for memory
 * @param {number|object|null} [optionsOrLimit=null]
 * @param {boolean} [fetchDetails=true] Whether to fetch detailed Workday descriptions
 * @returns {Promise<Array>}
 */
async function fetchAllGenpactJobs(optionsOrLimit = null, fetchDetails = true) {
  let maxLimit = 100; // Default safety cap for memory (live streams)
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || maxLimit;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allRawItems = [];
  let offset = 0;
  const limit = 20;
  let totalJobs = null;

  try {
    while (true) {
      const pageData = await fetchGenpactJobsPage(offset, limit);
      if (!pageData || !Array.isArray(pageData.jobPostings) || pageData.jobPostings.length === 0) break;

      totalJobs = pageData.total || totalJobs;
      const items = pageData.jobPostings;
      allRawItems.push(...items);

      if (maxLimit && allRawItems.length >= maxLimit) {
        break;
      }

      if (totalJobs && allRawItems.length >= totalJobs) {
        break;
      }

      offset += items.length;
      await delay(100);
    }

    let targetItems = allRawItems;
    if (maxLimit && targetItems.length > maxLimit) {
      targetItems = targetItems.slice(0, maxLimit);
    }

    console.log(`[Genpact API] Raw items collected: ${targetItems.length}. Fetching Workday details...`);

    const finalJobs = [];
    const BATCH_SIZE = fetchDetails ? 5 : 20;

    for (let i = 0; i < targetItems.length; i += BATCH_SIZE) {
      const chunk = targetItems.slice(i, i + BATCH_SIZE);
      const mappedChunk = await Promise.all(
        chunk.map(async (item) => {
          let detail = null;
          if (fetchDetails && item.externalPath) {
            detail = await fetchGenpactJobByPath(item.externalPath);
            await delay(50);
          }
          return mapGenpactJob(item, detail);
        })
      );

      finalJobs.push(...mappedChunk.filter(Boolean));
    }

    console.log(`[Genpact API] Successfully processed ${finalJobs.length} Genpact jobs.`);
    return finalJobs;

  } catch (error) {
    console.error(`[Genpact API] Error in fetchAllGenpactJobs:`, error.message);
    return [];
  }
}

/**
 * Step 5: Sync Genpact jobs with MongoDB collection using memory-safe batching
 * @param {object} GenpactJobModel Mongoose Model for Genpact Jobs
 * @param {number|null} maxLimit Optional limit of jobs to sync
 * @returns {Promise<object>} Sync execution report summary
 */
async function syncGenpactJobsWithDb(GenpactJobModel, maxLimit = null) {
  const startTime = Date.now();
  const targetSyncLimit = maxLimit || 200; // Cap sync to safe batch size by default
  console.log(`[Genpact DB Sync] Starting live fetch & MongoDB sync... (Limit: ${targetSyncLimit})`);

  const liveJobs = await fetchAllGenpactJobs({ maxJobs: targetSyncLimit }, true);
  if (!liveJobs || liveJobs.length === 0) {
    return {
      success: false,
      message: "No live jobs fetched from Genpact API.",
      stats: { insertedToDb: 0, updatedOrKeptInDb: 0, totalFetchedRaw: 0, finalDbCount: 0 }
    };
  }

  let insertedToDb = 0;
  let updatedOrKeptInDb = 0;

  for (const jobData of liveJobs) {
    try {
      const existing = await GenpactJobModel.findOne({ jobId: jobData.jobId });
      if (existing) {
        await GenpactJobModel.updateOne({ jobId: jobData.jobId }, { $set: jobData });
        updatedOrKeptInDb++;
      } else {
        await GenpactJobModel.create(jobData);
        insertedToDb++;
      }
    } catch (err) {
      console.warn(`[Genpact DB Sync] Error upserting job ${jobData.jobId}:`, err.message);
    }
  }

  const finalDbCount = await GenpactJobModel.countDocuments({ source: "Genpact" });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  return {
    success: true,
    message: `Genpact DB Sync completed in ${duration}s`,
    stats: {
      totalFetchedRaw: liveJobs.length,
      insertedToDb,
      updatedOrKeptInDb,
      finalDbCount,
      durationSeconds: parseFloat(duration)
    }
  };
}

module.exports = {
  fetchGenpactJobsPage,
  fetchGenpactJobByPath,
  mapGenpactJob,
  fetchAllGenpactJobs,
  syncGenpactJobsWithDb
};
