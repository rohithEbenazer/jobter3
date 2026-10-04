// goldmansachs.api.js - Dedicated API module for Goldman Sachs Careers (Higher GS GraphQL API)
const axios = require("axios");

const GS_GRAPHQL_URL = "https://api-higher.gs.com/gateway/api/v1/graphql";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "*/*",
  "content-type": "application/json",
  "origin": "https://higher.gs.com",
  "referer": "https://higher.gs.com/",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  "x-higher-request-id": "e0a0c306-8fc5-43a4-976e-9bcbe3fa4c1d",
  "x-higher-session-id": "d0c100a8-60dc-4236-9a2d-487beba08508"
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

  const zeroYears = /\b(?:0\s*\+?\s*years?|no\s+(?:prior\s+)?experience\s+required|freshers?|intern(?:ship)?|campus|graduate)\b/i;
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
 * Extract salary information from compensation object or text
 */
function extractSalary(comp, text = "") {
  if (comp && comp.minSalary && comp.maxSalary) {
    const curr = comp.currency || "USD";
    return `${curr} ${comp.minSalary.toLocaleString()} - ${comp.maxSalary.toLocaleString()}`;
  }
  if (comp && comp.minSalary) {
    const curr = comp.currency || "USD";
    return `${curr} ${comp.minSalary.toLocaleString()}+`;
  }
  if (!text) return "Competitive Package";
  const salaryMatch = /(?:Hiring Range|Salary Range|USD|INR|EUR|GBP|Compensation)\s*(?:in\s*(?:USD|INR|EUR|GBP)\s*)?(?:from:?\s*)?((?:\$|₹|£|€|INR|USD)\s*[\d,]+\s*(?:to|-)\s*(?:\$|₹|£|€|INR|USD)?\s*[\d,]+(?:\s*per\s*(?:annum|year|hr|hour))?)/i.exec(text);
  if (salaryMatch) {
    return salaryMatch[1].trim();
  }
  return "Competitive Package";
}

/**
 * Step 1: Fetch a page of jobs from Goldman Sachs GraphQL API
 * @param {number} pageNumber Page index (0-based)
 * @param {number} pageSize Number of items per page
 * @returns {Promise<object|null>}
 */
async function fetchGoldmanSachsJobsPage(pageNumber = 0, pageSize = 20) {
  const payload = {
    operationName: "GetRoles",
    variables: {
      searchQueryInput: {
        page: { pageSize, pageNumber },
        sort: { sortStrategy: "RELEVANCE", sortOrder: "DESC" },
        filters: [],
        experiences: ["EARLY_CAREER", "PROFESSIONAL"],
        searchTerm: ""
      }
    },
    query: `query GetRoles($searchQueryInput: RoleSearchQueryInput!) {
      roleSearch(searchQueryInput: $searchQueryInput) {
        totalCount
        items {
          roleId
          corporateTitle
          jobTitle
          jobFunction
          locations {
            primary
            state
            country
            city
            __typename
          }
          status
          division
          skills
          jobType {
            code
            description
            __typename
          }
          externalSource {
            sourceId
            __typename
          }
          __typename
        }
        __typename
      }
    }`
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(GS_GRAPHQL_URL, {
          method: "POST",
          headers: DEFAULT_HEADERS,
          body: JSON.stringify(payload)
        });
        if (res.status === 429) {
          await delay(1500 * attempt);
          continue;
        }
        if (!res.ok) return null;
        const data = await res.json();
        return data?.data?.roleSearch || null;
      } else {
        const res = await axios.post(GS_GRAPHQL_URL, payload, { headers: DEFAULT_HEADERS, timeout: 20000 });
        return res.data?.data?.roleSearch || null;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Goldman Sachs API] Error fetching page ${pageNumber}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch single job details by externalSourceId from Goldman Sachs GraphQL API
 * @param {string} sourceId
 * @returns {Promise<object|null>}
 */
async function fetchGoldmanSachsJobById(sourceId) {
  if (!sourceId) return null;
  const payload = {
    operationName: "GetRoleById",
    variables: { externalSourceId: String(sourceId), externalSourceFetch: true },
    query: `query GetRoleById($externalSourceId: String!, $externalSourceFetch: Boolean) {
      role(
        externalSourceId: $externalSourceId
        externalSourceFetch: $externalSourceFetch
      ) {
        roleId
        corporateTitle
        jobTitle
        jobFunction
        locations {
          primary
          state
          country
          city
          __typename
        }
        division
        descriptionHtml
        jobType {
          code
          description
          __typename
        }
        skillset
        compensation {
          minSalary
          maxSalary
          currency
          __typename
        }
        applyActive
        status
        externalSource {
          externalApplicationUrl
          applyInExternalSource
          sourceId
          secondarySourceId
          __typename
        }
        __typename
      }
    }`
  };

  try {
    if (typeof fetch !== "undefined") {
      const res = await fetch(GS_GRAPHQL_URL, {
        method: "POST",
        headers: DEFAULT_HEADERS,
        body: JSON.stringify(payload)
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.data?.role || null;
    } else {
      const res = await axios.post(GS_GRAPHQL_URL, payload, { headers: DEFAULT_HEADERS, timeout: 20000 });
      return res.data?.data?.role || null;
    }
  } catch (error) {
    console.warn(`[Goldman Sachs API] Error fetching details for job ID ${sourceId}:`, error.message);
  }
  return null;
}

/**
 * Step 3: Map raw GraphQL job item & detail to standardized Job format
 * @param {object} item Raw job item from GetRoles
 * @param {object|null} detail Raw detail object from GetRoleById
 * @returns {object|null}
 */
function mapGoldmanSachsJob(item, detail = null) {
  if (!item) return null;

  const sourceId = String(item.externalSource?.sourceId || detail?.externalSource?.sourceId || item.roleId || '');
  if (!sourceId) return null;

  const title = item.jobTitle || detail?.jobTitle || item.corporateTitle || "Goldman Sachs Opening";
  const corporateTitle = item.corporateTitle || detail?.corporateTitle || "";
  const division = item.division || detail?.division || "Global Markets";
  const category = item.jobFunction || detail?.jobFunction || division || "Investment Banking & Technology";
  const department = division || category;

  // Locations array processing
  const rawLocs = item.locations || detail?.locations || [];
  const citySet = new Set();
  const stateSet = new Set();
  const countrySet = new Set();
  const locStrings = [];

  if (Array.isArray(rawLocs)) {
    rawLocs.forEach(loc => {
      if (loc.city) citySet.add(loc.city);
      if (loc.state) stateSet.add(loc.state);
      if (loc.country) countrySet.add(loc.country);
      const str = [loc.city, loc.state, loc.country].filter(Boolean).join(', ');
      if (str) locStrings.push(str);
    });
  }

  const location = locStrings.join(' | ') || Array.from(citySet).join(', ') || 'Not specified';
  const city = Array.from(citySet);
  const state = Array.from(stateSet);
  const country = Array.from(countrySet);

  // URLs
  const jobUrl = `https://higher.gs.com/roles/${sourceId}`;
  const applyJobUrl = detail?.externalSource?.externalApplicationUrl || detail?.externalSource?.applyInExternalSource ? jobUrl : jobUrl;
  const detailsUrl = jobUrl;

  // Description
  const descriptionHtml = detail?.descriptionHtml || `<p><strong>${title}</strong></p><p>Division: ${division}</p><p>Location: ${location}</p>`;
  const plainDescription = cleanHtml(descriptionHtml);

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
  const postedDate = new Date().toISOString();

  // Skills
  const skillsSet = new Set(["Goldman Sachs", "Investment Banking", "Finance"]);
  if (division) skillsSet.add(division);
  if (category) skillsSet.add(category);

  if (Array.isArray(item.skills)) {
    item.skills.forEach(s => {
      if (s) skillsSet.add(s);
    });
  }

  const techKeywords = [
    "Goldman Sachs", "Java", "Python", "C++", "C#", ".NET", "SQL", "PostgreSQL",
    "JavaScript", "TypeScript", "React", "Angular", "Node.js", "AWS", "Azure", "GCP",
    "Kubernetes", "Docker", "DevOps", "CI/CD", "Microservices", "Cloud", "Quantitative",
    "Algorithms", "Data Structures", "Financial Engineering", "Risk Management", "Cybersecurity", "AI", "Machine Learning"
  ];

  techKeywords.forEach(kw => {
    let regexStr = kw === "C++" || kw === "C#" ? kw.replace(/\+/g, '\\+') : `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);
  const salary = extractSalary(detail?.compensation, plainDescription);

  return {
    source: "GoldmanSachs",
    company: "Goldman Sachs",
    id: sourceId,
    jobId: sourceId,
    title: title,
    corporateTitle: corporateTitle,
    category: category,
    department: department,
    businessUnit: division,
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
 * Step 4: Fetch ALL Goldman Sachs jobs across pages
 * @param {number|object|null} [optionsOrLimit=null] 
 * @param {boolean} [fetchDetails=true] Whether to fetch individual GraphQL details
 * @returns {Promise<Array>}
 */
async function fetchAllGoldmanSachsJobs(optionsOrLimit = null, fetchDetails = true) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allRawItems = [];
  let pageNumber = 0;
  const pageSize = 20;
  let totalJobsCount = null;

  try {
    while (true) {
      const pageData = await fetchGoldmanSachsJobsPage(pageNumber, pageSize);
      if (!pageData || !Array.isArray(pageData.items) || pageData.items.length === 0) break;

      totalJobsCount = pageData.totalCount || totalJobsCount;
      allRawItems.push(...pageData.items);

      console.log(`[Goldman Sachs API] Fetched page ${pageNumber}: ${allRawItems.length} / ${totalJobsCount || 'unknown'} jobs...`);

      if (maxLimit && allRawItems.length >= maxLimit) {
        break;
      }

      if (totalJobsCount && allRawItems.length >= totalJobsCount) {
        break;
      }

      pageNumber++;
      await delay(200);
    }

    let targetItems = allRawItems;
    if (maxLimit && targetItems.length > maxLimit) {
      targetItems = targetItems.slice(0, maxLimit);
    }

    console.log(`[Goldman Sachs API] Processing ${targetItems.length} jobs (fetchDetails: ${fetchDetails})...`);

    const mappedJobs = [];
    const concurrency = 5;

    for (let i = 0; i < targetItems.length; i += concurrency) {
      const chunk = targetItems.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(async (item) => {
        const sourceId = item.externalSource?.sourceId || item.roleId;
        let detail = null;
        if (fetchDetails && sourceId) {
          detail = await fetchGoldmanSachsJobById(sourceId);
        }
        return mapGoldmanSachsJob(item, detail);
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
    console.error("[Goldman Sachs API] Error fetching Goldman Sachs jobs:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Goldman Sachs jobs with MongoDB collection
 * @param {object} GoldmanSachsJobModel 
 * @param {number|object|null} [optionsOrLimit=null] 
 * @returns {Promise<object>}
 */
async function syncGoldmanSachsJobsWithDb(GoldmanSachsJobModel, optionsOrLimit = null) {
  if (!GoldmanSachsJobModel) {
    throw new Error("GoldmanSachsJob model is required for database sync.");
  }

  console.log("[Goldman Sachs Sync] Starting Goldman Sachs jobs DB sync...");
  const fetchedJobs = await fetchAllGoldmanSachsJobs(optionsOrLimit, true);
  console.log(`[Goldman Sachs Sync] Fetched ${fetchedJobs.length} live jobs with details from Goldman Sachs GraphQL API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Goldman Sachs API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await GoldmanSachsJobModel.find({ source: "GoldmanSachs" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await GoldmanSachsJobModel.deleteMany({ source: "GoldmanSachs", jobId: { $in: obsoleteIds } });
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
        filter: { source: "GoldmanSachs", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await GoldmanSachsJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await GoldmanSachsJobModel.countDocuments({ source: "GoldmanSachs" });

  return {
    success: true,
    message: "Goldman Sachs DB sync completed successfully.",
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
  fetchGoldmanSachsJobsPage,
  fetchGoldmanSachsJobById,
  mapGoldmanSachsJob,
  fetchAllGoldmanSachsJobs,
  syncGoldmanSachsJobsWithDb,
  cleanHtml
};
