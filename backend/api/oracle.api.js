// oracle.api.js - Dedicated API module for Oracle Careers (Oracle HCM Cloud Recruiting API)
const axios = require("axios");

const ORACLE_REQUISITIONS_URL = "https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions";
const ORACLE_DETAILS_URL = "https://eeho.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails";
const ORACLE_SITE_NUMBER = "CX_45001";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "*/*",
  "accept-language": "en",
  "content-type": "application/vnd.oracle.adf.resourceitem+json;charset=utf-8",
  "ora-irc-cx-userid": "4ffaba8f-8e71-416c-963a-34fd302c7eac",
  "ora-irc-language": "en",
  "origin": "https://careers.oracle.com",
  "referer": "https://careers.oracle.com/",
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
 * Extract experience requirements from text or flexFields
 */
function extractExperienceFromFlexOrText(flexFields = [], text = "") {
  // Check requisition flex fields first (e.g. Prompt: "Years", Value: "6 to 10+ years")
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
 * Extract salary information if present in internal text
 */
function extractSalaryFromText(text = "") {
  if (!text) return "Competitive Package";
  const salaryMatch = /(?:Hiring Range|Salary Range|USD|Compensation)\s*(?:in\s*USD\s*)?(?:from:?\s*)?(\$[\d,]+\s*(?:to|-)\s*\$[\d,]+(?:\s*per\s*(?:annum|year|hr|hour))?)/i.exec(text);
  if (salaryMatch) {
    return salaryMatch[1].trim();
  }
  return "Competitive Package";
}

/**
 * Step 1: Fetch a page of job requisitions from Oracle Cloud HCM API
 * @param {number} offset 
 * @param {number} limit 
 * @returns {Promise<object|null>}
 */
async function fetchOracleRequisitionsPage(offset = 0, limit = 100) {
  const expandParam = "requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations,flexFieldsFacet.values,requisitionList.requisitionFlexFields";
  const facetsList = "WORK_LOCATIONS;WORKPLACE_TYPES;TITLES;CATEGORIES;ORGANIZATIONS;POSTING_DATES;FLEX_FIELDS;LOCATIONS";
  const finderParam = `findReqs;siteNumber=${ORACLE_SITE_NUMBER},facetsList=${encodeURIComponent(facetsList)},limit=${limit},offset=${offset},sortBy=POSTING_DATES_DESC`;
  
  const url = `${ORACLE_REQUISITIONS_URL}?onlyData=true&expand=${expandParam}&finder=${finderParam}`;

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
      else console.warn(`[Oracle API] Error fetching page offset ${offset}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch detailed information for a specific Oracle job ID
 * @param {string} jobId 
 * @returns {Promise<object|null>}
 */
async function fetchOracleJobDetails(jobId) {
  if (!jobId) return null;
  const finderParam = `ById;Id=%22${jobId}%22,siteNumber=${ORACLE_SITE_NUMBER}`;
  const url = `${ORACLE_DETAILS_URL}?expand=all&onlyData=true&finder=${finderParam}`;

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
 * Step 3: Map raw Oracle requisition & detail item to standardized format
 * @param {object} rawReq 
 * @param {object} rawDetail 
 * @returns {object|null}
 */
function mapOracleJob(rawReq, rawDetail = null) {
  const jobId = String(rawReq?.Id || rawDetail?.Id || '');
  if (!jobId) return null;

  const title = rawDetail?.Title || rawReq?.Title || "Oracle Opening";
  const jobUrl = `https://careers.oracle.com/jobs/#/en/sites/jobsearch/requisitions/preview/${jobId}`;

  // Location handling
  const primaryLoc = rawDetail?.PrimaryLocation || rawReq?.PrimaryLocation || '';
  const countryCode = rawDetail?.PrimaryLocationCountry || rawReq?.PrimaryLocationCountry || '';

  const city = [];
  const state = [];
  const country = countryCode ? [countryCode] : [];

  if (primaryLoc) {
    const parts = primaryLoc.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      city.push(parts[0]);
      state.push(parts[1]);
      country.push(parts[parts.length - 1]);
    } else if (parts.length === 2) {
      city.push(parts[0]);
      country.push(parts[1]);
    } else if (parts.length === 1) {
      if (!country.includes(parts[0])) country.push(parts[0]);
    }
  }

  const location = primaryLoc || (country.length > 0 ? country.join(', ') : 'Not specified');

  // HTML Description composition
  const descParts = [];
  if (rawDetail?.ExternalDescriptionStr) descParts.push(rawDetail.ExternalDescriptionStr);
  if (rawDetail?.ExternalResponsibilitiesStr) descParts.push(`<h3>Responsibilities</h3>${rawDetail.ExternalResponsibilitiesStr}`);
  if (rawDetail?.ExternalQualificationsStr) descParts.push(`<h3>Qualifications</h3>${rawDetail.ExternalQualificationsStr}`);
  if (rawDetail?.InternalQualificationsStr) descParts.push(`<div>${rawDetail.InternalQualificationsStr}</div>`);
  if (descParts.length === 0 && rawReq?.ShortDescriptionStr) descParts.push(rawReq.ShortDescriptionStr);

  const rawHtml = descParts.join('<br/><br/>') || `<p><strong>${title}</strong></p><p>Location: ${location}</p>`;
  const plainDescription = cleanHtml(rawHtml);

  // Experience extraction
  const flexFields = rawDetail?.requisitionFlexFields || rawReq?.requisitionFlexFields || [];
  const expResult = extractExperienceFromFlexOrText(flexFields, plainDescription);

  // Workmode detection
  const textBlob = `${title} ${location} ${plainDescription}`.toLowerCase();
  let workmode = "On-site";
  if (textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  // Posted date
  let postedDate = new Date().toISOString();
  const rawDateStr = rawDetail?.ExternalPostedStartDate || rawReq?.PostedDate;
  if (rawDateStr) {
    const d = new Date(rawDateStr);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  // Category & Department
  const category = rawDetail?.Category || rawReq?.JobFunction || "Enterprise Cloud & Software";
  const department = rawDetail?.Department || rawReq?.Department || "Engineering & Cloud Solutions";
  const businessUnit = rawDetail?.BusinessUnit || rawReq?.BusinessUnit || "Oracle Cloud Infrastructure (OCI)";

  // Skills extraction
  const skillsSet = new Set(["Oracle", "Cloud"]);
  if (category) skillsSet.add(category);

  const techKeywords = [
    "Oracle", "OCI", "MySQL", "Java", "Spring", "SQL", "PL/SQL", "Python", "C++", "C#", ".NET",
    "JavaScript", "TypeScript", "React", "Angular", "Node.js", "Kubernetes", "Docker", "Linux",
    "DevOps", "CI/CD", "AWS", "GCP", "Azure", "Microservices", "AI", "Machine Learning", "LLM",
    "Distributed Systems", "Storage", "Database", "Security"
  ];

  techKeywords.forEach(kw => {
    let regexStr = kw === "C++" || kw === "C#" ? kw.replace(/\+/g, '\\+') : `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);
  const salary = extractSalaryFromText(rawDetail?.InternalQualificationsStr || plainDescription);

  return {
    source: "Oracle",
    company: "Oracle",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: businessUnit,
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
    basicQualifications: cleanHtml(rawDetail?.ExternalQualificationsStr || plainDescription.slice(0, 300)),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: category,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch ALL Oracle jobs (with requisition list + details for each job)
 * @param {number|object|null} [optionsOrLimit=null] 
 * @param {boolean} [fetchDetails=true] Whether to fetch details for each job
 * @returns {Promise<Array>}
 */
async function fetchAllOracleJobs(optionsOrLimit = null, fetchDetails = true) {
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
      const pageData = await fetchOracleRequisitionsPage(offset, limitPerPage);
      if (!pageData || !pageData.items || pageData.items.length === 0) break;

      const item = pageData.items[0];
      const reqList = item.requisitionList || [];
      if (reqList.length === 0) break;

      allReqs.push(...reqList);
      totalJobsCount = item.TotalJobsCount || totalJobsCount;

      console.log(`[Oracle API] Fetched ${allReqs.length} / ${totalJobsCount || 'unknown'} requisitions...`);

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

    console.log(`[Oracle API] Now processing ${targetReqs.length} jobs (fetchDetails: ${fetchDetails})...`);

    const mappedJobs = [];
    const concurrency = 10;

    for (let i = 0; i < targetReqs.length; i += concurrency) {
      const chunk = targetReqs.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(async (req) => {
        let detail = null;
        if (fetchDetails) {
          detail = await fetchOracleJobDetails(req.Id);
        }
        return mapOracleJob(req, detail);
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
    console.error("[Oracle API] Error fetching Oracle jobs:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Oracle jobs with MongoDB collection
 * @param {object} OracleJobModel 
 * @param {number|object|null} [optionsOrLimit=null] 
 * @returns {Promise<object>}
 */
async function syncOracleJobsWithDb(OracleJobModel, optionsOrLimit = null) {
  if (!OracleJobModel) {
    throw new Error("OracleJob model is required for database sync.");
  }

  console.log("[Oracle Sync] Starting Oracle jobs DB sync...");
  const fetchedJobs = await fetchAllOracleJobs(optionsOrLimit, true);
  console.log(`[Oracle Sync] Fetched ${fetchedJobs.length} live jobs with details from Oracle API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Oracle API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await OracleJobModel.find({ source: "Oracle" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await OracleJobModel.deleteMany({ source: "Oracle", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Oracle", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await OracleJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await OracleJobModel.countDocuments({ source: "Oracle" });

  return {
    success: true,
    message: "Oracle DB sync completed successfully.",
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
  fetchOracleRequisitionsPage,
  fetchOracleJobDetails,
  mapOracleJob,
  fetchAllOracleJobs,
  syncOracleJobsWithDb,
  cleanHtml
};
