// unisys.api.js - Dedicated API module for Unisys Careers (Workday REST API)
const axios = require("axios");

const UNISYS_SEARCH_URL = "https://unisys.wd5.myworkdayjobs.com/wday/cxs/unisys/External/jobs";
const UNISYS_DETAILS_BASE_URL = "https://unisys.wd5.myworkdayjobs.com/wday/cxs/unisys/External";
const UNISYS_CAREERS_SITE_URL = "https://unisys.wd5.myworkdayjobs.com/en-US/External";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/json",
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
 * Step 1: Fetch a page of job postings from Unisys Workday API
 * @param {number} offset 
 * @param {number} limit 
 * @returns {Promise<object|null>}
 */
async function fetchUnisysJobsPage(offset = 0, limit = 20) {
  const payload = {
    appliedFacets: {},
    limit: limit,
    offset: offset,
    searchText: ""
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(UNISYS_SEARCH_URL, {
          method: "POST",
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
        const res = await axios.post(UNISYS_SEARCH_URL, payload, { headers: DEFAULT_HEADERS, timeout: 20000 });
        return res.data;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Unisys API] Error fetching page offset ${offset}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch detailed job information from Unisys Workday detail path
 * @param {string} externalPath 
 * @returns {Promise<object|null>}
 */
async function fetchUnisysJobDetails(externalPath) {
  if (!externalPath) return null;
  const url = `${UNISYS_DETAILS_BASE_URL}${externalPath}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (!res.ok) return null;
        return await res.json();
      } else {
        const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 15000 });
        return res.data;
      }
    } catch (error) {
      if (attempt < 2) await delay(300);
    }
  }
  return null;
}

/**
 * Step 3: Map raw Unisys requisition & detail item to standardized format
 * @param {object} rawReq 
 * @param {object} rawDetail 
 * @returns {object|null}
 */
function mapUnisysJob(rawReq, rawDetail = null) {
  const detailInfo = rawDetail?.jobPostingInfo || {};
  const externalPath = rawReq?.externalPath || detailInfo?.externalUrl || '';
  
  const reqId = detailInfo?.jobReqId || rawReq?.bulletFields?.[0] || '';
  const idKey = detailInfo?.id || reqId || (externalPath ? externalPath.split('_').pop() : '');
  if (!idKey && !rawReq?.title) return null;

  const jobId = String(reqId || idKey || Date.now());
  const title = detailInfo?.title || rawReq?.title || "Unisys Opening";
  const jobUrl = externalPath ? `${UNISYS_CAREERS_SITE_URL}${externalPath}` : UNISYS_CAREERS_SITE_URL;

  // Location handling
  const locStr = detailInfo?.location || rawReq?.locationsText || detailInfo?.country || 'Global';
  const city = new Set();
  const state = new Set();
  const country = new Set();

  if (locStr) {
    const parts = locStr.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      city.add(parts[0]);
      state.add(parts[1]);
      country.add(parts[parts.length - 1]);
    } else if (parts.length === 2) {
      city.add(parts[0]);
      country.add(parts[1]);
    } else if (parts.length === 1) {
      country.add(parts[0]);
    }
  }

  // HTML Description composition
  const rawHtml = detailInfo?.jobDescription || rawReq?.jobDescription || `<p><strong>${title}</strong></p><p>Location: ${locStr}</p>`;
  const plainDescription = cleanHtml(rawHtml);

  // Experience extraction
  const expResult = extractExperienceFromText(plainDescription);

  // Workmode
  let workmode = "On-site";
  const textBlob = `${title} ${locStr} ${plainDescription}`.toLowerCase();
  if (textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  // Posted Date
  let postedDate = new Date().toISOString();
  const rawDateStr = detailInfo?.startDate || detailInfo?.postedOn || rawReq?.postedOn;
  if (rawDateStr) {
    const d = new Date(rawDateStr);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  // Category & Department
  const category = detailInfo?.jobType || "IT Services & Cloud Solutions";
  const department = "Engineering & IT Operations";

  // Skills extraction
  const skillsSet = new Set(["Unisys", "IT Services"]);
  if (category) skillsSet.add(category);

  const techKeywords = [
    "ITIL", "SIAM", "Service Management", "Cloud", "AWS", "Azure", "GCP", "DevOps", "Cybersecurity",
    "Java", "Python", "SQL", "Linux", "Windows", "Networking", "ServiceNow", "Kubernetes", "Docker",
    "Microservices", "System Administration", "API", "Infrastructure", "Data Center"
  ];

  techKeywords.forEach(kw => {
    const regexStr = `\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);

  return {
    source: "Unisys",
    company: "Unisys",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "Unisys",
    location: locStr,
    city: Array.from(city),
    state: Array.from(state),
    country: Array.from(country),
    minYears: expResult.minYears,
    maxYears: expResult.maxYears,
    minYrsOfExperience: expResult.minYears,
    maxYrsOfExperience: expResult.maxYears,
    yrsOfExperience: expResult.experienceRequired,
    experienceRequired: expResult.experienceRequired,
    workmode: workmode,
    jobUrl: jobUrl,
    url: jobUrl,
    skills: skills,
    salary: "Competitive Package",
    shift: "Day Shift",
    description: plainDescription,
    descriptionHtml: rawHtml,
    basicQualifications: cleanHtml(plainDescription.slice(0, 300)),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: category,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch ALL Unisys jobs (with requisition list + details for each job)
 * @param {number|object|null} [optionsOrLimit=null] 
 * @param {boolean} [fetchDetails=true] Whether to fetch details for each job
 * @returns {Promise<Array>}
 */
async function fetchAllUnisysJobs(optionsOrLimit = null, fetchDetails = true) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allReqs = [];
  let offset = 0;
  const limitPerPage = 20;
  let totalJobsCount = null;

  try {
    while (true) {
      const pageData = await fetchUnisysJobsPage(offset, limitPerPage);
      if (!pageData || !Array.isArray(pageData.jobPostings) || pageData.jobPostings.length === 0) {
        break;
      }

      const reqList = pageData.jobPostings;
      allReqs.push(...reqList);
      totalJobsCount = pageData.total || totalJobsCount;

      console.log(`[Unisys API] Fetched ${allReqs.length} / ${totalJobsCount || 'unknown'} requisitions...`);

      if (maxLimit && allReqs.length >= maxLimit) {
        break;
      }

      if (totalJobsCount && allReqs.length >= totalJobsCount) {
        break;
      }

      offset += limitPerPage;
      await delay(300);
    }

    let targetReqs = allReqs;
    if (maxLimit && targetReqs.length > maxLimit) {
      targetReqs = targetReqs.slice(0, maxLimit);
    }

    console.log(`[Unisys API] Now processing ${targetReqs.length} jobs (fetchDetails: ${fetchDetails})...`);

    const mappedJobs = [];
    const concurrency = 10;

    for (let i = 0; i < targetReqs.length; i += concurrency) {
      const chunk = targetReqs.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(async (req) => {
        let detail = null;
        if (fetchDetails && req.externalPath) {
          detail = await fetchUnisysJobDetails(req.externalPath);
        }
        return mapUnisysJob(req, detail);
      }));

      for (const job of chunkResults) {
        if (job && job.jobId) mappedJobs.push(job);
      }

      if (i + concurrency < targetReqs.length) {
        await delay(200);
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("[Unisys API] Error fetching Unisys jobs:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Unisys jobs with MongoDB collection
 * @param {object} UnisysJobModel 
 * @param {number|object|null} [optionsOrLimit=null] 
 * @returns {Promise<object>}
 */
async function syncUnisysJobsWithDb(UnisysJobModel, optionsOrLimit = null) {
  if (!UnisysJobModel) {
    throw new Error("UnisysJob model is required for database sync.");
  }

  console.log("[Unisys Sync] Starting Unisys jobs DB sync...");
  const fetchedJobs = await fetchAllUnisysJobs(optionsOrLimit, true);
  console.log(`[Unisys Sync] Fetched ${fetchedJobs.length} live jobs with details from Unisys API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Unisys API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await UnisysJobModel.find({ source: "Unisys" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await UnisysJobModel.deleteMany({ source: "Unisys", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Unisys", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await UnisysJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await UnisysJobModel.countDocuments({ source: "Unisys" });

  return {
    success: true,
    message: "Unisys DB sync completed successfully.",
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
  fetchUnisysJobsPage,
  fetchUnisysJobDetails,
  mapUnisysJob,
  fetchAllUnisysJobs,
  syncUnisysJobsWithDb,
  cleanHtml
};
