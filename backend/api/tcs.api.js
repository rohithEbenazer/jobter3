// tcs.api.js - Dedicated API module for TCS iBegin Careers API
const axios = require("axios");

const TCS_SEARCH_API_URL = "https://ibegin.tcsapps.com/candidate/next/api/en-IN/search/jobs";
const TCS_DETAILS_API_URL = "https://ibegin.tcsapps.com/candidate/next/api/en-IN/job/desc/";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,ta;q=0.8,gu;q=0.7,et;q=0.6,da;q=0.5",
  "Connection": "keep-alive",
  "Content-Type": "application/json",
  "Cookie": "ROUTEID=.6; TS0194f401=0199acb0de74ec7f6eafc770e84ee4791754b347d997a4f4b45c39c6fb57232ef21ce43395a4045c8d8175a77097f0c7c78d387ccd; XSRF-TOKEN=3c7bb7ad-48e5-4d47-bd77-eb364e7ea4f3; SESSION=LWNJam1idExhSkk0b3lRekRDcTV6aFFwUElFbjM2UXgxV0NZcFV6dDFPZw==; TS01303c5b=0199acb0de74ec7f6eafc770e84ee4791754b347d997a4f4b45c39c6fb57232ef21ce43395a4045c8d8175a77097f0c7c78d387ccd; ext_name=ojplmecpdpgccookcobabopnaifgidhf; TS01e3ea0a=0199acb0de74ec7f6eafc770e84ee4791754b347d997a4f4b45c39c6fb57232ef21ce43395a4045c8d8175a77097f0c7c78d387ccd",
  "NEXT-XSRF-TOKEN": "3c7bb7ad-48e5-4d47-bd77-eb364e7ea4f3",
  "Origin": "https://ibegin.tcsapps.com",
  "Referer": "https://ibegin.tcsapps.com/candidate/next/en-IN/jobs/search?page=1&size=10&regular=true&walkin=true&sort=relevance%20desc",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  "sec-ch-ua": '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"'
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
function extractExperienceFromText(text = "", minYearsDefault = 0, maxYearsDefault = 99) {
  if (!text) return { minYears: minYearsDefault, maxYears: maxYearsDefault, experienceRequired: minYearsDefault || maxYearsDefault ? `${minYearsDefault}-${maxYearsDefault} years` : "Not specified" };

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

  if (minYearsDefault > 0 || (maxYearsDefault > 0 && maxYearsDefault < 99)) {
    return { minYears: minYearsDefault, maxYears: maxYearsDefault, experienceRequired: `${minYearsDefault}-${maxYearsDefault} years` };
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
 * Step 1: Fetch a page of jobs from TCS iBegin Search API
 * @param {number} page Page number (1-based)
 * @param {number} resultsPerPage Results per page
 * @returns {Promise<object|null>}
 */
async function fetchTcsJobsPage(page = 1, resultsPerPage = 50) {
  const payload = {
    includeRegularJob: true,
    includeWalkIn: true,
    searchTerms: [],
    jobLocationFilters: [],
    jobDomainFilters: [],
    experienceLevelFilters: [],
    skillFilters: [],
    relevancySortOrder: "desc",
    recentSortOrder: null,
    lastDateToApplySortOrder: null,
    page: page,
    resultsPerPage: resultsPerPage
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(TCS_SEARCH_API_URL, {
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
        const res = await axios.post(TCS_SEARCH_API_URL, payload, { headers: DEFAULT_HEADERS, timeout: 20000 });
        return res.data;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[TCS API] Error fetching page ${page}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch single job details by jobId from TCS iBegin Job Desc API
 * @param {string|number} rawJobId
 * @returns {Promise<object|null>}
 */
async function fetchTcsJobById(rawJobId) {
  if (!rawJobId) return null;
  const cleanId = String(rawJobId).replace(/\D/g, '');
  if (!cleanId) return null;

  const url = `${TCS_DETAILS_API_URL}${cleanId}`;
  try {
    if (typeof fetch !== "undefined") {
      const res = await fetch(url, { headers: DEFAULT_HEADERS });
      if (!res.ok) return null;
      const json = await res.json();
      return json?.payload || null;
    } else {
      const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 20000 });
      return res.data?.payload || null;
    }
  } catch (error) {
    console.warn(`[TCS API] Error fetching details for job ID ${cleanId}:`, error.message);
  }
  return null;
}

/**
 * Step 3: Map raw TCS job item & detail to standardized Job format
 * @param {object} item Raw job item from search payload
 * @param {object|null} detail Raw job detail from desc API payload
 * @returns {object|null}
 */
function mapTcsJob(item, detail = null) {
  if (!item && !detail) return null;

  const rawId = item?.id || detail?.jobId || '';
  const jobId = String(rawId);
  const cleanId = String(rawId).replace(/\D/g, '');
  if (!jobId && !cleanId) return null;

  const title = item?.title || detail?.title || "TCS Opening";
  const category = item?.domain || detail?.functionName || "IT Services & Consulting";
  const department = category;

  const location = item?.location || detail?.location || "India";
  const locParts = location.split(',').map(s => s.trim()).filter(Boolean);
  const city = locParts.length > 0 ? [locParts[0]] : [location];
  const country = detail?.country ? [detail.country] : ["India"];
  const state = locParts.length > 1 ? [locParts[1]] : [];

  const jobUrl = `https://ibegin.tcsapps.com/candidate/next/en-IN/jobs/search?jobId=${cleanId}`;
  const applyJobUrl = jobUrl;
  const detailsUrl = `${TCS_DETAILS_API_URL}${cleanId}`;

  // Description
  const descriptionHtml = detail?.description || `<p><strong>${title}</strong></p><p>Role: ${detail?.role || 'Developer'}</p><p>Location: ${location}</p>`;
  const plainDescription = cleanHtml(descriptionHtml);

  // Experience
  const minYears = item?.minimumExperienceInYears || 0;
  const maxYears = item?.maximumExperienceInYears || 99;
  const expResult = extractExperienceFromText(plainDescription, minYears, maxYears);

  // Workmode
  let workmode = "On-site";
  const textBlob = `${title} ${location} ${plainDescription}`.toLowerCase();
  if (textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  // Skills
  const skillsSet = new Set(["TCS", "Tata Consultancy Services"]);
  if (category) skillsSet.add(category);

  if (Array.isArray(item?.skills)) {
    item.skills.forEach(s => {
      if (s) {
        s.split(/[,|]/).forEach(sub => {
          const trimmed = sub.trim();
          if (trimmed) skillsSet.add(trimmed);
        });
      }
    });
  }

  if (detail?.skilldetail) {
    detail.skilldetail.split(/[,|]/).forEach(sub => {
      const trimmed = sub.trim();
      if (trimmed) skillsSet.add(trimmed);
    });
  }

  const techKeywords = [
    "Java", "Python", "React", "Angular", "Node.js", "C++", "C#", ".NET",
    "SQL", "Oracle", "AWS", "Azure", "GCP", "Google Cloud", "DevOps",
    "Docker", "Kubernetes", "Salesforce", "ServiceNow", "SAP", "Workday",
    "Cybersecurity", "Data Engineering", "Machine Learning", "AI", "Microservices"
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
  if (item?.applyBy || detail?.applyby) {
    const rawApply = item?.applyBy || detail?.applyby;
    const d = new Date(rawApply);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  return {
    source: "TCS",
    company: "TCS",
    id: jobId,
    jobId: jobId,
    displayJobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "TCS iBegin",
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
    shift: "Day Shift",
    description: plainDescription || detail?.skilldetail || title,
    descriptionHtml: descriptionHtml,
    basicQualifications: detail?.qualifications || plainDescription.slice(0, 350),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: detail?.role || category || "IT Professional",
    mandateSkills: skills.length > 0 ? skills.join(', ') : null,
    qualifications: detail?.qualifications || "",
    applyBy: item?.applyBy || detail?.applyby || ""
  };
}

/**
 * Step 4: Fetch ALL TCS jobs across pagination
 * @param {number|object|null} [optionsOrLimit=null]
 * @param {boolean} [fetchDetails=true] Whether to fetch individual job descriptions
 * @returns {Promise<Array>}
 */
async function fetchAllTcsJobs(optionsOrLimit = null, fetchDetails = true) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allRawItems = [];
  let page = 1;
  const resultsPerPage = 50;
  let totalElements = null;

  try {
    while (true) {
      const pageData = await fetchTcsJobsPage(page, resultsPerPage);
      const payload = pageData?.payload;
      if (!payload || !Array.isArray(payload.content) || payload.content.length === 0) break;

      totalElements = payload.totalElements || totalElements;
      const items = payload.content;
      allRawItems.push(...items);

      console.log(`[TCS API] Fetched page ${page}: ${allRawItems.length} / ${totalElements || 'unknown'} jobs...`);

      if (maxLimit && allRawItems.length >= maxLimit) {
        break;
      }

      if (payload.last || (totalElements && allRawItems.length >= totalElements) || page >= (payload.totalPages || 100)) {
        break;
      }

      page++;
      await delay(200);
    }

    let targetItems = allRawItems;
    if (maxLimit && targetItems.length > maxLimit) {
      targetItems = targetItems.slice(0, maxLimit);
    }

    console.log(`[TCS API] Total raw items collected: ${targetItems.length}. Fetching detailed descriptions...`);

    const finalJobs = [];
    const BATCH_SIZE = fetchDetails ? 5 : 20;

    for (let i = 0; i < targetItems.length; i += BATCH_SIZE) {
      const chunk = targetItems.slice(i, i + BATCH_SIZE);
      const mappedChunk = await Promise.all(
        chunk.map(async (item) => {
          let detail = null;
          if (fetchDetails) {
            detail = await fetchTcsJobById(item.id);
            await delay(100);
          }
          return mapTcsJob(item, detail);
        })
      );

      finalJobs.push(...mappedChunk.filter(Boolean));
    }

    console.log(`[TCS API] Successfully processed ${finalJobs.length} TCS jobs.`);
    return finalJobs;

  } catch (error) {
    console.error(`[TCS API] Error in fetchAllTcsJobs:`, error.message);
    return [];
  }
}

/**
 * Step 5: Sync TCS jobs with MongoDB collection
 * @param {object} TcsJobModel Mongoose Model for TCS Jobs
 * @param {number|null} maxLimit Optional limit of jobs to sync
 * @returns {Promise<object>} Sync execution report summary
 */
async function syncTcsJobsWithDb(TcsJobModel, maxLimit = null) {
  const startTime = Date.now();
  console.log(`[TCS DB Sync] Starting live fetch & MongoDB sync... (Limit: ${maxLimit || 'ALL'})`);

  const liveJobs = await fetchAllTcsJobs({ maxJobs: maxLimit }, true);
  if (!liveJobs || liveJobs.length === 0) {
    return {
      success: false,
      message: "No live jobs fetched from TCS API.",
      stats: { insertedToDb: 0, updatedOrKeptInDb: 0, totalFetchedRaw: 0, finalDbCount: 0 }
    };
  }

  let insertedToDb = 0;
  let updatedOrKeptInDb = 0;

  for (const jobData of liveJobs) {
    try {
      const existing = await TcsJobModel.findOne({ jobId: jobData.jobId });
      if (existing) {
        await TcsJobModel.updateOne({ jobId: jobData.jobId }, { $set: jobData });
        updatedOrKeptInDb++;
      } else {
        await TcsJobModel.create(jobData);
        insertedToDb++;
      }
    } catch (err) {
      console.warn(`[TCS DB Sync] Error upserting job ${jobData.jobId}:`, err.message);
    }
  }

  const finalDbCount = await TcsJobModel.countDocuments({ source: "TCS" });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  return {
    success: true,
    message: `TCS DB Sync completed in ${duration}s`,
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
  fetchTcsJobsPage,
  fetchTcsJobById,
  mapTcsJob,
  fetchAllTcsJobs,
  syncTcsJobsWithDb
};
