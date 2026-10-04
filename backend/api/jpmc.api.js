// jpmc.api.js - Dedicated API module for JPMorgan Chase Careers (Oracle Cloud Candidate Experience API)
const axios = require("axios");

const JPMC_SEARCH_API_BASE = "https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions";
const JPMC_DETAILS_API_BASE = "https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "Accept": "*/*",
  "Accept-Language": "en",
  "Content-Type": "application/vnd.oracle.adf.resourceitem+json;charset=utf-8",
  "Ora-Irc-Language": "en",
  "Referer": "https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
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

  const zeroYears = /\b(?:0\s*\+?\s*years?|no\s+(?:prior\s+)?experience\s+required|freshers?|intern(?:ship)?|entry\s+level|graduates?)\b/i;
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
 * Step 1: Fetch a page of jobs from JPMC Oracle Cloud API
 * @param {number} offset Offset index (0, 25, 50...)
 * @param {number} limit Items per page (default 25)
 * @returns {Promise<object|null>}
 */
async function fetchJpmcJobsPage(offset = 0, limit = 25) {
  const url = `${JPMC_SEARCH_API_BASE}?onlyData=true&expand=requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations,flexFieldsFacet.values,requisitionList.requisitionFlexFields&finder=findReqs;siteNumber=CX_1001,facetsList=WORK_LOCATIONS%3BWORKPLACE_TYPES%3BTITLES%3BCATEGORIES%3BORGANIZATIONS%3BPOSTING_DATES%3BFLEX_FIELDS%3BLOCATIONS,limit=${limit},offset=${offset},sortBy=POSTING_DATES_DESC`;

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
      else console.warn(`[JPMC API] Error fetching offset ${offset}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch single job details by requisition ID from JPMC Oracle Cloud API
 * @param {string|number} reqId Requisition Id (e.g. 210769885)
 * @returns {Promise<object|null>}
 */
async function fetchJpmcJobById(reqId) {
  if (!reqId) return null;
  const cleanId = String(reqId).trim();
  const url = `${JPMC_DETAILS_API_BASE}/${cleanId}`;

  try {
    if (typeof fetch !== "undefined") {
      const res = await fetch(url, { headers: DEFAULT_HEADERS });
      if (!res.ok) return null;
      return await res.json();
    } else {
      const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 20000 });
      return res.data;
    }
  } catch (error) {
    console.warn(`[JPMC API] Error fetching details for req ID ${cleanId}:`, error.message);
  }
  return null;
}

/**
 * Step 3: Map raw JPMC job requisition item & detail to standardized Job format
 * @param {object} item Raw requisition item from search payload
 * @param {object|null} detail Raw detail object from recruitingCEJobRequisitionDetails API
 * @returns {object|null}
 */
function mapJpmcJob(item, detail = null) {
  if (!item && !detail) return null;

  const jobId = String(item?.Id || detail?.Id || item?.RequisitionId || detail?.RequisitionId || '');
  if (!jobId) return null;

  const title = item?.Title || detail?.Title || "JPMorgan Chase Opening";
  const category = detail?.Category || item?.JobFamily || item?.JobFunction || "Banking & Financial Services";
  const department = item?.JobFunction || category;

  const location = item?.PrimaryLocation || detail?.PrimaryLocation || "Global";
  const locParts = location.split(',').map(s => s.trim()).filter(Boolean);
  const city = locParts.length > 0 ? [locParts[0]] : [location];
  const country = detail?.PrimaryLocationCountry ? [detail.PrimaryLocationCountry] : locParts.length > 1 ? [locParts[locParts.length - 1]] : ["United States"];
  const state = locParts.length > 2 ? [locParts[1]] : [];

  const sitePath = `https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/${jobId}`;
  const jobUrl = sitePath;
  const applyJobUrl = sitePath;
  const detailsUrl = `${JPMC_DETAILS_API_BASE}/${jobId}`;

  // Description
  const rawHtmlDesc = detail?.ExternalDescriptionStr || item?.ShortDescriptionStr || `<p><strong>${title}</strong></p><p>Category: ${category}</p><p>Location: ${location}</p>`;
  const plainDescription = cleanHtml(rawHtmlDesc);

  // Experience
  const expResult = extractExperienceFromText(plainDescription);

  // Workmode mapping
  const rawWorkplace = String(item?.WorkplaceType || detail?.WorkplaceType || '').toLowerCase();
  let workmode = "On-site";
  if (rawWorkplace.includes("remote")) {
    workmode = "Remote";
  } else if (rawWorkplace.includes("hybrid")) {
    workmode = "Hybrid";
  } else {
    const textBlob = `${title} ${location} ${plainDescription}`.toLowerCase();
    if (textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
      workmode = "Remote";
    } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
      workmode = "Hybrid";
    }
  }

  // Skills
  const skillsSet = new Set(["JPMorgan Chase", "Banking", "Financial Services"]);
  if (category) skillsSet.add(category);

  if (Array.isArray(detail?.skills)) {
    detail.skills.forEach(s => {
      if (s?.SkillName) skillsSet.add(s.SkillName);
    });
  }

  const techKeywords = [
    "Java", "Python", "React", "Angular", "Node.js", "C++", "C#", ".NET",
    "SQL", "Oracle", "AWS", "Azure", "GCP", "DevOps", "Cybersecurity",
    "Product Management", "Risk Management", "Data Analytics", "Financial Analysis",
    "Agile", "Scrum", "Investment Banking", "Compliance", "Asset Management"
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
  const rawDate = item?.PostedDate || detail?.ExternalPostedStartDate;
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  return {
    source: "JPMorgan Chase",
    company: "JPMorgan Chase",
    id: jobId,
    jobId: jobId,
    displayJobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "JPMorgan Chase",
    location: location,
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
    shift: detail?.JobShift || "Day Shift",
    description: plainDescription || title,
    descriptionHtml: rawHtmlDesc,
    basicQualifications: detail?.ExternalQualificationsStr || plainDescription.slice(0, 350),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: category || "Associate / Officer",
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch JPMC jobs across pagination with memory safety cap
 * @param {number|object|null} [optionsOrLimit=null]
 * @param {boolean} [fetchDetails=true] Whether to fetch detailed job requisition descriptions
 * @returns {Promise<Array>}
 */
async function fetchAllJpmcJobs(optionsOrLimit = null, fetchDetails = true) {
  let maxLimit = 100; // Default safety cap for memory (live streams)
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || maxLimit;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allRawItems = [];
  let offset = 0;
  const limit = 25;

  try {
    while (true) {
      const pageData = await fetchJpmcJobsPage(offset, limit);
      const reqList = pageData?.items?.[0]?.requisitionList;
      if (!reqList || !Array.isArray(reqList) || reqList.length === 0) break;

      allRawItems.push(...reqList);

      if (maxLimit && allRawItems.length >= maxLimit) {
        break;
      }

      if (reqList.length < limit) {
        break;
      }

      offset += reqList.length;
      await delay(100);
    }

    let targetItems = allRawItems;
    if (maxLimit && targetItems.length > maxLimit) {
      targetItems = targetItems.slice(0, maxLimit);
    }

    console.log(`[JPMC API] Raw items collected: ${targetItems.length}. Fetching Oracle Cloud details...`);

    const finalJobs = [];
    const BATCH_SIZE = fetchDetails ? 5 : 25;

    for (let i = 0; i < targetItems.length; i += BATCH_SIZE) {
      const chunk = targetItems.slice(i, i + BATCH_SIZE);
      const mappedChunk = await Promise.all(
        chunk.map(async (item) => {
          let detail = null;
          if (fetchDetails && item.Id) {
            detail = await fetchJpmcJobById(item.Id);
            await delay(50);
          }
          return mapJpmcJob(item, detail);
        })
      );

      finalJobs.push(...mappedChunk.filter(Boolean));
    }

    console.log(`[JPMC API] Successfully processed ${finalJobs.length} JPMC jobs.`);
    return finalJobs;

  } catch (error) {
    console.error(`[JPMC API] Error in fetchAllJpmcJobs:`, error.message);
    return [];
  }
}

/**
 * Step 5: Sync JPMC jobs with MongoDB collection using memory-safe batching
 * @param {object} JpmcJobModel Mongoose Model for JPMC Jobs
 * @param {number|null} maxLimit Optional limit of jobs to sync
 * @returns {Promise<object>} Sync execution report summary
 */
async function syncJpmcJobsWithDb(JpmcJobModel, maxLimit = null) {
  const startTime = Date.now();
  const targetSyncLimit = maxLimit || 200; // Cap sync to safe batch size by default
  console.log(`[JPMC DB Sync] Starting live fetch & MongoDB sync... (Limit: ${targetSyncLimit})`);

  const liveJobs = await fetchAllJpmcJobs({ maxJobs: targetSyncLimit }, true);
  if (!liveJobs || liveJobs.length === 0) {
    return {
      success: false,
      message: "No live jobs fetched from JPMC API.",
      stats: { insertedToDb: 0, updatedOrKeptInDb: 0, totalFetchedRaw: 0, finalDbCount: 0 }
    };
  }

  let insertedToDb = 0;
  let updatedOrKeptInDb = 0;

  for (const jobData of liveJobs) {
    try {
      const existing = await JpmcJobModel.findOne({ jobId: jobData.jobId });
      if (existing) {
        await JpmcJobModel.updateOne({ jobId: jobData.jobId }, { $set: jobData });
        updatedOrKeptInDb++;
      } else {
        await JpmcJobModel.create(jobData);
        insertedToDb++;
      }
    } catch (err) {
      console.warn(`[JPMC DB Sync] Error upserting job ${jobData.jobId}:`, err.message);
    }
  }

  const finalDbCount = await JpmcJobModel.countDocuments({ source: "JPMorgan Chase" });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  return {
    success: true,
    message: `JPMC DB Sync completed in ${duration}s`,
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
  fetchJpmcJobsPage,
  fetchJpmcJobById,
  fetchJpmcJobDetails: fetchJpmcJobById,
  mapJpmcJob,
  fetchAllJpmcJobs,
  syncJpmcJobsWithDb
};
