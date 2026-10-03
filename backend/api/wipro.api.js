// wipro.api.js - Dedicated API module for Wipro Careers (Wipro SuccessFactors Recruiting API)
const axios = require("axios");

const WIPRO_JOBS_API_URL = "https://careers.wipro.com/services/recruiting/v1/jobs";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "*/*",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/json",
  "origin": "https://careers.wipro.com",
  "referer": "https://careers.wipro.com/search/",
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
 * Step 1: Fetch a page of jobs from Wipro Careers API
 * @param {number} pageNumber Page number (0-based)
 * @returns {Promise<object|null>}
 */
async function fetchWiproJobsPage(pageNumber = 0) {
  const payload = {
    locale: "en_US",
    pageNumber: pageNumber,
    sortBy: "",
    keywords: "",
    location: "",
    facetFilters: {},
    brand: "",
    skills: [],
    categoryId: 0,
    alertId: "",
    rcmCandidateId: ""
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(WIPRO_JOBS_API_URL, {
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
        const res = await axios.post(WIPRO_JOBS_API_URL, payload, { headers: DEFAULT_HEADERS, timeout: 20000 });
        return res.data;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Wipro API] Error fetching page ${pageNumber}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch detail HTML for a specific Wipro job URL
 * @param {string} jobUrl 
 * @returns {Promise<string>} HTML snippet or empty string
 */
async function fetchWiproJobDetailsHtml(jobUrl) {
  if (!jobUrl) return "";
  const headers = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "user-agent": DEFAULT_HEADERS["user-agent"]
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(jobUrl, { headers });
        if (!res.ok) return "";
        const html = await res.text();
        const descMatch = html.match(/<span[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/span>/i) ||
                          html.match(/<div[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/div>/i) ||
                          html.match(/<div[^>]*class="jobdisplay[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        return descMatch ? descMatch[1] : "";
      } else {
        const res = await axios.get(jobUrl, { headers, timeout: 15000 });
        const html = res.data || "";
        const descMatch = html.match(/<span[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/span>/i) ||
                          html.match(/<div[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/div>/i) ||
                          html.match(/<div[^>]*class="jobdisplay[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        return descMatch ? descMatch[1] : "";
      }
    } catch (err) {
      if (attempt < 2) await delay(300);
    }
  }
  return "";
}

/**
 * Step 3: Map raw Wipro job item object to standardized Job format
 * @param {object} rawWrapper Outer item object ({ response: { ... } })
 * @param {string} detailHtml Extracted detail HTML if available
 * @returns {object|null}
 */
function mapWiproJob(rawWrapper, detailHtml = "") {
  const resp = rawWrapper?.response || rawWrapper;
  if (!resp) return null;

  const jobId = String(resp.id || '');
  if (!jobId) return null;

  const title = resp.unifiedStandardTitle || resp.urlTitle || "Wipro Opening";
  const urlTitle = resp.urlTitle || resp.unifiedUrlTitle || title.replace(/[^a-zA-Z0-9]+/g, '-');
  const locale = (Array.isArray(resp.supportedLocales) && resp.supportedLocales[0]) ? resp.supportedLocales[0] : 'en_US';
  
  const jobUrl = `https://careers.wipro.com/job/${urlTitle}/${jobId}-${locale}`;

  // Locations
  const city = Array.isArray(resp.sfstd_jobLocation_obj) ? resp.sfstd_jobLocation_obj : [];
  const state = Array.isArray(resp.jobLocationState) ? resp.jobLocationState : [];
  const country = Array.isArray(resp.jobLocationCountry) ? resp.jobLocationCountry : [];
  const locShort = Array.isArray(resp.jobLocationShort) && resp.jobLocationShort[0] ? resp.jobLocationShort[0].replace(/,\s*$/, '').trim() : '';

  const location = locShort || [...city, ...state, ...country].filter(Boolean).join(', ') || 'Not specified';

  // Categories & Department
  const category = (Array.isArray(resp.custRMKMappingPicklist) && resp.custRMKMappingPicklist[0]) 
    ? resp.custRMKMappingPicklist[0] 
    : 'IT Services & Consulting';
  const department = category || 'Engineering & Operations';

  // Description
  const rawHtml = detailHtml || `<p><strong>${title}</strong></p><p>Category: ${category}</p><p>Location: ${location}</p>`;
  const plainDescription = cleanHtml(rawHtml);

  // Experience
  const expResult = extractExperienceFromText(plainDescription);

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
  if (resp.unifiedStandardStart) {
    const d = new Date(resp.unifiedStandardStart);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  // Skills
  const skillsSet = new Set(["Wipro", "IT Services"]);
  if (category) skillsSet.add(category);

  const techKeywords = [
    "Wipro", "SAP", "Java", "Python", "C++", "C#", ".NET", "SQL", "PL/SQL",
    "JavaScript", "TypeScript", "React", "Angular", "Node.js", "AWS", "Azure", "GCP",
    "Kubernetes", "Docker", "DevOps", "CI/CD", "Microservices", "Cloud",
    "Business Process", "Accounts Payable", "Finance", "Consulting", "Cybersecurity", "AI", "Machine Learning"
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
    source: "Wipro",
    company: "Wipro",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "Wipro",
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
 * Step 4: Fetch ALL Wipro jobs
 * @param {number|object|null} [optionsOrLimit=null] 
 * @param {boolean} [fetchDetails=true] Whether to fetch HTML details for each job
 * @returns {Promise<Array>}
 */
async function fetchAllWiproJobs(optionsOrLimit = null, fetchDetails = true) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allRawItems = [];
  let pageNumber = 0;
  let totalJobsCount = null;

  try {
    while (true) {
      const pageData = await fetchWiproJobsPage(pageNumber);
      if (!pageData || !Array.isArray(pageData.jobSearchResult) || pageData.jobSearchResult.length === 0) break;

      totalJobsCount = pageData.totalJobs || totalJobsCount;
      allRawItems.push(...pageData.jobSearchResult);

      console.log(`[Wipro API] Fetched page ${pageNumber}: ${allRawItems.length} / ${totalJobsCount || 'unknown'} jobs...`);

      if (maxLimit && allRawItems.length >= maxLimit) {
        break;
      }

      if (allRawItems.length >= totalJobsCount) {
        break;
      }

      pageNumber++;
      await delay(200);
    }

    let targetItems = allRawItems;
    if (maxLimit && targetItems.length > maxLimit) {
      targetItems = targetItems.slice(0, maxLimit);
    }

    console.log(`[Wipro API] Now processing ${targetItems.length} Wipro jobs (fetchDetails: ${fetchDetails})...`);

    const mappedJobs = [];
    const concurrency = 10;

    for (let i = 0; i < targetItems.length; i += concurrency) {
      const chunk = targetItems.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(async (raw) => {
        const resp = raw?.response || raw;
        const jobId = String(resp.id || '');
        const title = resp.unifiedStandardTitle || resp.urlTitle || "Wipro Opening";
        const urlTitle = resp.urlTitle || resp.unifiedUrlTitle || title.replace(/[^a-zA-Z0-9]+/g, '-');
        const locale = (Array.isArray(resp.supportedLocales) && resp.supportedLocales[0]) ? resp.supportedLocales[0] : 'en_US';
        const jobUrl = `https://careers.wipro.com/job/${urlTitle}/${jobId}-${locale}`;

        let detailHtml = "";
        if (fetchDetails) {
          detailHtml = await fetchWiproJobDetailsHtml(jobUrl);
        }
        return mapWiproJob(raw, detailHtml);
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
    console.error("[Wipro API] Error fetching Wipro jobs:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Wipro jobs with MongoDB collection
 * @param {object} WiproJobModel 
 * @param {number|object|null} [optionsOrLimit=null] 
 * @returns {Promise<object>}
 */
async function syncWiproJobsWithDb(WiproJobModel, optionsOrLimit = null) {
  if (!WiproJobModel) {
    throw new Error("WiproJob model is required for database sync.");
  }

  console.log("[Wipro Sync] Starting Wipro jobs DB sync...");
  const fetchedJobs = await fetchAllWiproJobs(optionsOrLimit, true);
  console.log(`[Wipro Sync] Fetched ${fetchedJobs.length} live jobs with details from Wipro API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Wipro API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await WiproJobModel.find({ source: "Wipro" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await WiproJobModel.deleteMany({ source: "Wipro", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Wipro", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await WiproJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await WiproJobModel.countDocuments({ source: "Wipro" });

  return {
    success: true,
    message: "Wipro DB sync completed successfully.",
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
  fetchWiproJobsPage,
  fetchWiproJobDetailsHtml,
  mapWiproJob,
  fetchAllWiproJobs,
  syncWiproJobsWithDb,
  cleanHtml
};
