// browserstack.api.js - Dedicated API module for BrowserStack Careers (Workday CXS API)
const axios = require("axios");

const BROWSERSTACK_SEARCH_API_BASE = "https://browserstack.wd3.myworkdayjobs.com/wday/cxs/browserstack/External/jobs";
const BROWSERSTACK_DETAIL_API_BASE = "https://browserstack.wd3.myworkdayjobs.com/wday/cxs/browserstack/External";
const BROWSERSTACK_WEB_JOB_BASE = "https://browserstack.wd3.myworkdayjobs.com/en-US/External";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json",
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

  const zeroYears = /\b(?:0\s*\+?\s*years?|freshers?|intern(?:ship)?|entry\s+level|graduates?)\b/i;
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
 * Step 1: Fetch a page of jobs from BrowserStack Workday API
 * @param {number} offset Offset index (0, 20, 40...)
 * @param {number} limit Items per page (default 20)
 * @returns {Promise<object|null>}
 */
async function fetchBrowserStackJobsPage(offset = 0, limit = 20) {
  const payload = { appliedFacets: {}, limit, offset, searchText: "" };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(BROWSERSTACK_SEARCH_API_BASE, {
          method: "POST",
          headers: DEFAULT_HEADERS,
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          if (res.status === 429) {
            await delay(1500 * attempt);
            continue;
          }
          return null;
        }
        return await res.json();
      } else {
        const res = await axios.post(BROWSERSTACK_SEARCH_API_BASE, payload, { headers: DEFAULT_HEADERS, timeout: 20000 });
        return res.data;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[BrowserStack API] Error fetching offset ${offset}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch single job detail by external path
 * @param {string} externalPath e.g. "/job/Mumbai-Remote/Senior-Lead---Strategy_JR103691"
 * @returns {Promise<object|null>}
 */
async function fetchBrowserStackJobDetail(externalPath) {
  if (!externalPath) return null;
  const url = `${BROWSERSTACK_DETAIL_API_BASE}${externalPath}`;

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
    console.warn(`[BrowserStack API] Error fetching detail for ${externalPath}:`, error.message);
  }
  return null;
}

/**
 * Step 3: Map Workday item & detail to standard Job format
 * @param {object} item Raw job posting item from search payload
 * @param {object|null} detail Raw detail object from Workday CXS API
 * @returns {object|null}
 */
function mapBrowserStackJob(item, detail = null) {
  if (!item && !detail) return null;

  const info = detail?.jobPostingInfo || {};
  const reqId = info.jobReqId || (Array.isArray(item?.bulletFields) && item.bulletFields[0]) || "";
  const rawId = info.id || reqId || (item?.externalPath ? item.externalPath.split('_').pop() : '');
  if (!rawId && !reqId) return null;

  const jobId = reqId || rawId;
  const title = info.title || item?.title || "BrowserStack Opening";
  const category = "Software Testing & Cloud Engineering";
  const department = "Engineering & Product";

  const location = info.location || item?.locationsText || "Mumbai, India";
  const locParts = location.split(',').map(s => s.trim()).filter(Boolean);
  const city = locParts.length > 0 ? [locParts[0]] : [location];
  const country = locParts.length > 1 ? [locParts[locParts.length - 1]] : ["India"];

  const externalPath = item?.externalPath || info.externalUrl || "";
  const jobUrl = externalPath ? `${BROWSERSTACK_WEB_JOB_BASE}${externalPath}` : "https://browserstack.wd3.myworkdayjobs.com/External";

  // Description
  const rawHtmlDesc = info.jobDescription || `<p><strong>${title}</strong></p><p>Location: ${location}</p>`;
  const plainDescription = cleanHtml(rawHtmlDesc);

  // Experience
  const expResult = extractExperienceFromText(plainDescription);

  // Workmode
  let workmode = "On-site";
  const textBlob = `${title} ${location} ${plainDescription}`.toLowerCase();
  if (textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  // Skills
  const skillsSet = new Set(["BrowserStack", "Software Testing", "Cloud Platform"]);
  const techKeywords = [
    "Selenium", "Appium", "Cypress", "Playwright", "Java", "Python", "React",
    "Node.js", "Golang", "Ruby", "AWS", "Docker", "Kubernetes", "DevOps",
    "Product Management", "Strategy", "Sales", "Customer Success"
  ];

  techKeywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(title) || regex.test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);
  const salary = extractSalaryFromText(plainDescription);

  let postedDate = new Date().toISOString();
  if (info.startDate) {
    const d = new Date(info.startDate);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  return {
    source: "BrowserStack",
    company: "BrowserStack",
    id: String(rawId),
    jobId: String(jobId),
    displayJobId: String(jobId),
    title: title,
    category: category,
    department: department,
    businessUnit: "BrowserStack",
    location: location,
    city: Array.from(new Set(city)),
    state: [],
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
    applyJobUrl: jobUrl,
    detailsUrl: externalPath ? `${BROWSERSTACK_DETAIL_API_BASE}${externalPath}` : jobUrl,
    skills: skills,
    salary: salary,
    shift: "Day Shift",
    description: plainDescription || title,
    descriptionHtml: rawHtmlDesc,
    basicQualifications: plainDescription.slice(0, 350),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: title,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch BrowserStack jobs across pagination with memory safety limit
 * @param {number|object|null} [optionsOrLimit=null]
 * @param {boolean} [fetchDetails=true]
 * @returns {Promise<Array>}
 */
async function fetchAllBrowserStackJobs(optionsOrLimit = null, fetchDetails = true) {
  let maxLimit = 100;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || maxLimit;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allRawItems = [];
  let offset = 0;
  const limit = 20;

  try {
    while (true) {
      const pageData = await fetchBrowserStackJobsPage(offset, limit);
      const postings = pageData?.jobPostings;
      if (!postings || !Array.isArray(postings) || postings.length === 0) break;

      allRawItems.push(...postings);

      if (maxLimit && allRawItems.length >= maxLimit) {
        break;
      }

      if (allRawItems.length >= (pageData.total || 0) || postings.length < limit) {
        break;
      }

      offset += postings.length;
      await delay(100);
    }

    let targetItems = allRawItems;
    if (maxLimit && targetItems.length > maxLimit) {
      targetItems = targetItems.slice(0, maxLimit);
    }

    console.log(`[BrowserStack API] Raw items collected: ${targetItems.length}. Fetching Workday details...`);

    const finalJobs = [];
    const BATCH_SIZE = fetchDetails ? 5 : 20;

    for (let i = 0; i < targetItems.length; i += BATCH_SIZE) {
      const chunk = targetItems.slice(i, i + BATCH_SIZE);
      const mappedChunk = await Promise.all(
        chunk.map(async (item) => {
          let detail = null;
          if (fetchDetails && item.externalPath) {
            detail = await fetchBrowserStackJobDetail(item.externalPath);
            await delay(50);
          }
          return mapBrowserStackJob(item, detail);
        })
      );

      finalJobs.push(...mappedChunk.filter(Boolean));
    }

    console.log(`[BrowserStack API] Successfully processed ${finalJobs.length} BrowserStack jobs.`);
    return finalJobs;
  } catch (error) {
    console.error(`[BrowserStack API] Error in fetchAllBrowserStackJobs:`, error.message);
    return [];
  }
}

/**
 * Step 5: Sync BrowserStack jobs with MongoDB collection
 * @param {object} BrowserStackJobModel Mongoose Model for BrowserStack jobs
 * @param {number|null} maxLimit Optional limit
 * @returns {Promise<object>}
 */
async function syncBrowserStackJobsWithDb(BrowserStackJobModel, maxLimit = null) {
  const startTime = Date.now();
  const targetSyncLimit = maxLimit || 200;
  console.log(`[BrowserStack DB Sync] Starting live fetch & MongoDB sync... (Limit: ${targetSyncLimit})`);

  const liveJobs = await fetchAllBrowserStackJobs({ maxJobs: targetSyncLimit }, true);
  if (!liveJobs || liveJobs.length === 0) {
    return {
      success: false,
      message: "No live jobs fetched from BrowserStack API.",
      stats: { insertedToDb: 0, updatedOrKeptInDb: 0, totalFetchedRaw: 0, finalDbCount: 0 }
    };
  }

  let insertedToDb = 0;
  let updatedOrKeptInDb = 0;

  for (const jobData of liveJobs) {
    try {
      const existing = await BrowserStackJobModel.findOne({ jobId: jobData.jobId });
      if (existing) {
        await BrowserStackJobModel.updateOne({ jobId: jobData.jobId }, { $set: jobData });
        updatedOrKeptInDb++;
      } else {
        await BrowserStackJobModel.create(jobData);
        insertedToDb++;
      }
    } catch (err) {
      console.warn(`[BrowserStack DB Sync] Error upserting job ${jobData.jobId}:`, err.message);
    }
  }

  const finalDbCount = await BrowserStackJobModel.countDocuments({ source: "BrowserStack" });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  return {
    success: true,
    message: `BrowserStack DB Sync completed in ${duration}s`,
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
  fetchBrowserStackJobsPage,
  fetchBrowserStackJobDetail,
  mapBrowserStackJob,
  fetchAllBrowserStackJobs,
  syncBrowserStackJobsWithDb
};
