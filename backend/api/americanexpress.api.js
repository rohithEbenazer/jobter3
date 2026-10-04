// americanexpress.api.js - Dedicated API module for American Express Careers (Oracle HCM Cloud Recruiting API)
const axios = require("axios");

const AMEX_REQUISITIONS_URL = "https://egug.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions";
const AMEX_DETAILS_URL = "https://egug.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails";
const AMEX_SITE_NUMBER = "CX_1";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "*/*",
  "accept-language": "en",
  "content-type": "application/vnd.oracle.adf.resourceitem+json;charset=utf-8",
  "ora-irc-cx-userid": "29df5d62-1fb7-4875-8c04-4bd9f23c94d0",
  "ora-irc-language": "en",
  "origin": "https://careers.americanexpress.com",
  "referer": "https://careers.americanexpress.com/",
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
 * Extract experience requirements from text or flexFields
 */
function extractExperienceFromFlexOrText(flexFields = [], text = "") {
  if (Array.isArray(flexFields)) {
    const yearField = flexFields.find(f => 
      f && f.Prompt && (f.Prompt.toLowerCase().includes("year") || f.Prompt.toLowerCase().includes("experience"))
    );
    if (yearField && yearField.Value) {
      const val = String(yearField.Value);
      const rangeMatch = /(\d+)\s*(?:to|-)\s*(\d+)/i.exec(val);
      if (rangeMatch) {
        return {
          minYears: parseInt(rangeMatch[1], 10),
          maxYears: parseInt(rangeMatch[2], 10),
          experienceRequired: val
        };
      }
      const plusMatch = /(\d+)\+/i.exec(val);
      if (plusMatch) {
        const min = parseInt(plusMatch[1], 10);
        return {
          minYears: min,
          maxYears: null,
          experienceRequired: `${min}+ years`
        };
      }
      return { minYears: 0, maxYears: null, experienceRequired: val };
    }
  }

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
 * Extract salary information from flexFields or text
 */
function extractSalaryFromFlexOrText(flexFields = [], text = "") {
  if (Array.isArray(flexFields)) {
    const salField = flexFields.find(f =>
      f && f.Prompt && f.Prompt.toLowerCase().includes("salary")
    );
    if (salField && salField.Value) {
      return String(salField.Value).trim();
    }
  }

  if (!text) return "Competitive Package";
  const salaryMatch = /(?:Hiring Range|Salary Range|USD|\$)\s*(?:in\s*USD\s*)?(?:from:?\s*)?(\$[\d,]+\s*(?:to|-)\s*\$[\d,]+(?:\s*per\s*(?:annum|year|hr|hour|annually))?)/i.exec(text);
  if (salaryMatch) {
    return salaryMatch[1].trim();
  }

  const genericSalMatch = /(\$[\d,]+\s*-\s*\$[\d,]+(?:\s*annually|\s*per\s*year)?)/i.exec(text);
  if (genericSalMatch) {
    return genericSalMatch[1].trim();
  }

  return "Competitive Package";
}

/**
 * Step 1: Fetch a page of job requisitions from American Express Oracle Cloud HCM API
 * @param {number} offset 
 * @param {number} limit 
 * @returns {Promise<object|null>}
 */
async function fetchAmexRequisitionsPage(offset = 0, limit = 100) {
  const expandParam = "requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations,flexFieldsFacet.values,requisitionList.requisitionFlexFields";
  const facetsList = "WORK_LOCATIONS;WORKPLACE_TYPES;TITLES;CATEGORIES;ORGANIZATIONS;POSTING_DATES;FLEX_FIELDS;LOCATIONS";
  const finderParam = `findReqs;siteNumber=${AMEX_SITE_NUMBER},facetsList=${encodeURIComponent(facetsList)},limit=${limit},offset=${offset},sortBy=POSTING_DATES_DESC`;

  const url = `${AMEX_REQUISITIONS_URL}?onlyData=true&expand=${expandParam}&finder=${finderParam}`;

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
      else console.warn(`[American Express API] Error fetching page offset ${offset}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch detailed information for a specific American Express job ID
 * @param {string} jobId 
 * @returns {Promise<object|null>}
 */
async function fetchAmexJobDetails(jobId) {
  if (!jobId) return null;
  const finderParam = `ById;Id=%22${jobId}%22,siteNumber=${AMEX_SITE_NUMBER}`;
  const url = `${AMEX_DETAILS_URL}?expand=all&onlyData=true&finder=${finderParam}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (!res.ok) return null;
        const data = await res.json();
        return data.items?.[0] || null;
      } else {
        const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 15000 });
        return res.data.items?.[0] || null;
      }
    } catch (error) {
      if (attempt < 2) await delay(300);
    }
  }
  return null;
}

/**
 * Step 3: Map raw American Express requisition & detail item to standardized format
 * @param {object} rawReq 
 * @param {object} rawDetail 
 * @returns {object|null}
 */
function mapAmexJob(rawReq, rawDetail = null) {
  const jobId = String(rawReq?.Id || rawDetail?.Id || '');
  if (!jobId) return null;

  const title = rawDetail?.Title || rawReq?.Title || "American Express Opening";
  const jobUrl = `https://careers.americanexpress.com/jobs/#/en/sites/jobsearch/requisitions/preview/${jobId}`;

  // Location parsing
  const city = new Set();
  const state = new Set();
  const country = new Set();
  const locationParts = [];

  const workLocations = rawDetail?.workLocation || rawReq?.workLocation || [];
  if (Array.isArray(workLocations) && workLocations.length > 0) {
    workLocations.forEach(loc => {
      if (loc.TownOrCity) city.add(loc.TownOrCity);
      if (loc.Region2) state.add(loc.Region2);
      if (loc.Country) country.add(loc.Country);
      const locStr = [loc.TownOrCity, loc.Region2, loc.Country].filter(Boolean).join(', ');
      if (locStr) locationParts.push(locStr);
    });
  }

  const secLocations = rawDetail?.secondaryLocations || rawReq?.secondaryLocations || [];
  if (Array.isArray(secLocations) && secLocations.length > 0) {
    secLocations.forEach(loc => {
      if (loc.Name) locationParts.push(loc.Name);
      if (loc.CountryCode) country.add(loc.CountryCode);
    });
  }

  const primaryLocCountry = rawDetail?.PrimaryLocationCountry || rawReq?.PrimaryLocationCountry;
  if (primaryLocCountry) country.add(primaryLocCountry);

  let location = locationParts.length > 0 ? locationParts[0] : (country.size > 0 ? Array.from(country).join(', ') : 'Not specified');

  // HTML Description composition
  const descParts = [];
  if (rawDetail?.ExternalDescriptionStr) descParts.push(rawDetail.ExternalDescriptionStr);
  if (rawDetail?.ExternalResponsibilitiesStr) descParts.push(`<h3>Responsibilities</h3>${rawDetail.ExternalResponsibilitiesStr}`);
  if (rawDetail?.ExternalQualificationsStr) descParts.push(`<h3>Qualifications</h3>${rawDetail.ExternalQualificationsStr}`);
  if (rawDetail?.InternalQualificationsStr) descParts.push(`<div>${rawDetail.InternalQualificationsStr}</div>`);
  if (descParts.length === 0 && rawReq?.ShortDescriptionStr) descParts.push(rawReq.ShortDescriptionStr);

  const rawHtml = descParts.join('<br/><br/>') || `<p><strong>${title}</strong></p><p>Location: ${location}</p>`;
  const plainDescription = cleanHtml(rawHtml);

  // Flex fields for salary, career area, etc.
  const flexFields = rawDetail?.requisitionFlexFields || rawReq?.requisitionFlexFields || [];
  const expResult = extractExperienceFromFlexOrText(flexFields, plainDescription);
  const salary = extractSalaryFromFlexOrText(flexFields, plainDescription);

  // Workmode detection
  let workmode = rawDetail?.WorkplaceType || rawReq?.WorkplaceType || "On-site";
  const textBlob = `${title} ${location} ${plainDescription}`.toLowerCase();
  if (workmode === "Hybrid" || textBlob.includes("hybrid")) {
    workmode = "Hybrid";
  } else if (workmode === "Remote" || textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else {
    workmode = "On-site";
  }

  // Posted date
  let postedDate = new Date().toISOString();
  const rawDateStr = rawDetail?.ExternalPostedStartDate || rawReq?.PostedDate;
  if (rawDateStr) {
    const d = new Date(rawDateStr);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  // Category & Department
  const flexCareerArea = Array.isArray(flexFields) ? flexFields.find(f => f.Prompt === "Career Area")?.Value : null;
  const category = rawDetail?.Category || flexCareerArea || rawReq?.JobFunction || "Technology & Financial Services";
  const department = rawDetail?.JobFunction || rawDetail?.Category || "Engineering & Global Servicing";
  const businessUnit = rawDetail?.BusinessUnit || "American Express";

  // Skills extraction
  const skillsSet = new Set(["American Express", "Financial Services"]);
  if (category) skillsSet.add(category);

  const techKeywords = [
    "Java", "Spring Boot", "Python", "PySpark", "Spark", "SQL", "BigQuery", "GCP", "AWS", "Azure",
    "Kafka", "Pub/Sub", "REST API", "Microservices", "React", "Angular", "Node.js", "TypeScript",
    "JavaScript", "Kubernetes", "Docker", "Linux", "DevOps", "CI/CD", "Git", "NoSQL", "Dataproc",
    "Generative AI", "LLM", "RAG", "Machine Learning", "Data Engineering", "ETL", "FinTech"
  ];

  techKeywords.forEach(kw => {
    const regexStr = `\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);

  return {
    source: "American Express",
    company: "American Express",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: businessUnit,
    location: location,
    city: Array.from(city),
    state: Array.from(state),
    country: Array.from(country),
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
    shift: rawDetail?.JobShift || "Day Shift",
    description: plainDescription,
    descriptionHtml: rawHtml,
    basicQualifications: cleanHtml(rawDetail?.ExternalQualificationsStr || plainDescription.slice(0, 300)),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: category,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch ALL American Express jobs (with requisition list + details for each job)
 * @param {number|object|null} [optionsOrLimit=null] 
 * @param {boolean} [fetchDetails=true] Whether to fetch details for each job
 * @returns {Promise<Array>}
 */
async function fetchAllAmexJobs(optionsOrLimit = null, fetchDetails = true) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allReqs = [];
  let offset = 0;
  const limitPerPage = 100;
  let totalJobsCount = null;

  try {
    while (true) {
      const pageData = await fetchAmexRequisitionsPage(offset, limitPerPage);
      if (!pageData || !pageData.items || pageData.items.length === 0) break;

      const item = pageData.items[0];
      const reqList = item.requisitionList || [];
      if (reqList.length === 0) break;

      allReqs.push(...reqList);
      totalJobsCount = item.TotalJobsCount || totalJobsCount;

      console.log(`[American Express API] Fetched ${allReqs.length} / ${totalJobsCount || 'unknown'} requisitions...`);

      if (maxLimit && allReqs.length >= maxLimit) {
        break;
      }

      if (allReqs.length >= totalJobsCount) {
        break;
      }

      offset += limitPerPage;
      await delay(300);
    }

    let targetReqs = allReqs;
    if (maxLimit && targetReqs.length > maxLimit) {
      targetReqs = targetReqs.slice(0, maxLimit);
    }

    console.log(`[American Express API] Now processing ${targetReqs.length} jobs (fetchDetails: ${fetchDetails})...`);

    const mappedJobs = [];
    const concurrency = 10;

    for (let i = 0; i < targetReqs.length; i += concurrency) {
      const chunk = targetReqs.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(async (req) => {
        let detail = null;
        if (fetchDetails) {
          detail = await fetchAmexJobDetails(req.Id);
        }
        return mapAmexJob(req, detail);
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
    console.error("[American Express API] Error fetching American Express jobs:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync American Express jobs with MongoDB collection
 * @param {object} AmexJobModel 
 * @param {number|object|null} [optionsOrLimit=null] 
 * @returns {Promise<object>}
 */
async function syncAmexJobsWithDb(AmexJobModel, optionsOrLimit = null) {
  if (!AmexJobModel) {
    throw new Error("AmexJob model is required for database sync.");
  }

  console.log("[American Express Sync] Starting American Express jobs DB sync...");
  const fetchedJobs = await fetchAllAmexJobs(optionsOrLimit, true);
  console.log(`[American Express Sync] Fetched ${fetchedJobs.length} live jobs with details from American Express API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from American Express API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await AmexJobModel.find({ source: "American Express" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await AmexJobModel.deleteMany({ source: "American Express", jobId: { $in: obsoleteIds } });
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
        filter: { source: "American Express", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await AmexJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await AmexJobModel.countDocuments({ source: "American Express" });

  return {
    success: true,
    message: "American Express DB sync completed successfully.",
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
  fetchAmexRequisitionsPage,
  fetchAmexJobDetails,
  mapAmexJob,
  fetchAllAmexJobs,
  syncAmexJobsWithDb,
  cleanHtml
};
