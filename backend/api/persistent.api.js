// persistent.api.js - Dedicated API module for Persistent Systems Careers (Zwayam ATS API)
const axios = require("axios");

const PERSISTENT_SEARCH_URL = "https://public.zwayam.com/jobs/search";
const PERSISTENT_DETAILS_URL = "https://public.zwayam.com/jobs-service/v1/jobs/careersite";
const PERSISTENT_COMPANY_ID = "16344";
const PERSISTENT_COMPANY_ID_B64 = "MTYzNDQ=";
const PERSISTENT_DOMAIN = "careers.persistent.com";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "origin": "https://careers.persistent.com",
  "referer": "https://careers.persistent.com/",
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
 * Extract experience requirements from text or numeric fields
 */
function extractExperience(minExp, maxExp, text = "") {
  if (minExp !== undefined && minExp !== null && minExp > 0) {
    const min = Number(minExp);
    const max = (maxExp !== undefined && maxExp !== null && maxExp > 0) ? Number(maxExp) : null;
    if (max && max > min) {
      return {
        minYears: min,
        maxYears: max,
        experienceRequired: `${min}-${max} years`
      };
    }
    return {
      minYears: min,
      maxYears: max || 99,
      experienceRequired: `${min}+ years`
    };
  }

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

  return { minYears: 0, maxYears: 99, experienceRequired: "Not specified" };
}

/**
 * Extract salary from text or numeric fields
 */
function extractSalary(minSal, maxSal, text = "") {
  if (minSal || maxSal) {
    const minStr = minSal ? String(minSal).trim() : '';
    const maxStr = maxSal ? String(maxSal).trim() : '';
    if (minStr && maxStr) return `${minStr} - ${maxStr}`;
    if (minStr) return `${minStr}+`;
  }

  if (!text) return "Competitive Package";
  const salaryMatch = /(?:Hiring Range|Salary Range|USD|INR|\$)\s*(?:from:?\s*)?((?:\$|₹)?[\d,]+\s*(?:to|-)\s*(?:\$|₹)?[\d,]+(?:\s*per\s*(?:annum|year|hr|hour|annually|LPA))?)/i.exec(text);
  if (salaryMatch) {
    return salaryMatch[1].trim();
  }

  return "Competitive Package";
}

/**
 * Step 1: Fetch a page of job requisitions from Persistent Zwayam Search API
 * @param {number} paginationStartNo 
 * @returns {Promise<object|null>}
 */
async function fetchPersistentRequisitionsPage(paginationStartNo = 0) {
  const boundary = '----WebKitFormBoundary3WTBEqGJjrp2rHpx';
  const filterCri = JSON.stringify({
    paginationStartNo: paginationStartNo,
    selectedCall: "sort",
    sortCriteria: { name: "modifiedDate", isAscending: false },
    anyOfTheseWords: ""
  });

  const bodyParts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="filterCri"',
    '',
    filterCri,
    `--${boundary}`,
    'Content-Disposition: form-data; name="domain"',
    '',
    PERSISTENT_DOMAIN,
    `--${boundary}`,
    'Content-Disposition: form-data; name="companyId"',
    '',
    PERSISTENT_COMPANY_ID_B64,
    `--${boundary}--`,
    ''
  ];
  const body = bodyParts.join('\r\n');

  const headers = {
    ...DEFAULT_HEADERS,
    "content-type": `multipart/form-data; boundary=${boundary}`
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(PERSISTENT_SEARCH_URL, { method: "POST", headers, body });
        if (res.status === 429) {
          await delay(1500 * attempt);
          continue;
        }
        if (!res.ok) return null;
        return await res.json();
      } else {
        const res = await axios.post(PERSISTENT_SEARCH_URL, body, { headers, timeout: 20000 });
        return res.data;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Persistent API] Error fetching page start ${paginationStartNo}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch detailed job information for a specific Persistent job
 * @param {string|number} jobId 
 * @param {string} jobUrl 
 * @returns {Promise<object|null>}
 */
async function fetchPersistentJobDetails(jobId, jobUrl = "") {
  if (!jobId) return null;
  const payload = {
    jobUrl: jobUrl || "",
    externalSource: "CareerSite",
    campusUrl: "empty",
    companyId: PERSISTENT_COMPANY_ID,
    jobId: String(jobId)
  };

  const headers = {
    ...DEFAULT_HEADERS,
    "content-type": "application/json"
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(PERSISTENT_DETAILS_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });
        if (!res.ok) return null;
        return await res.json();
      } else {
        const res = await axios.post(PERSISTENT_DETAILS_URL, payload, { headers, timeout: 15000 });
        return res.data;
      }
    } catch (error) {
      if (attempt < 2) await delay(300);
    }
  }
  return null;
}

/**
 * Step 3: Map raw Persistent requisition & detail item to standardized format
 * @param {object} rawReq 
 * @param {object} rawDetail 
 * @returns {object|null}
 */
function mapPersistentJob(rawReq, rawDetail = null) {
  const reqSource = rawReq?._source || rawReq || {};
  const jobId = String(rawDetail?.id || reqSource?.id || '');
  if (!jobId) return null;

  const title = rawDetail?.jobTitle || reqSource?.jobTitle || "Persistent Opening";
  const jobSlug = rawDetail?.jobUrl || reqSource?.jobUrl || '';
  const jobUrl = jobSlug ? `https://careers.persistent.com/job-description?jobUrl=${jobSlug}` : `https://careers.persistent.com/job-description?jobId=${jobId}`;

  // Location handling
  const locStr = rawDetail?.location || reqSource?.location || reqSource?.text1 || 'India';
  const officeLoc = rawDetail?.officeLocation || '';
  const combinedLoc = [officeLoc, locStr].filter(Boolean).join(', ') || locStr;

  const city = new Set();
  const state = new Set();
  const country = new Set();

  if (locStr) {
    const parts = locStr.split(/[\/,]/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      city.add(parts[0]);
      state.add(parts[1]);
      country.add(parts[2]);
    } else if (parts.length === 2) {
      city.add(parts[0]);
      country.add(parts[1]);
    } else if (parts.length === 1) {
      if (parts[0].toLowerCase() === 'india' || parts[0].toLowerCase() === 'us' || parts[0].toLowerCase() === 'usa') {
        country.add(parts[0]);
      } else {
        city.add(parts[0]);
      }
    }
  }

  // HTML Description composition
  const descParts = [];
  if (rawDetail?.longDescription) descParts.push(rawDetail.longDescription);
  if (rawDetail?.shortDescription) descParts.push(rawDetail.shortDescription);
  if (descParts.length === 0 && rawDetail?.mediumDescriptionWithoutHtml) descParts.push(rawDetail.mediumDescriptionWithoutHtml);

  const rawHtml = descParts.join('<br/><br/>') || `<p><strong>${title}</strong></p><p>Location: ${combinedLoc}</p>`;
  const plainDescription = cleanHtml(rawHtml);

  // Experience extraction
  const minExp = rawDetail?.minYrsOfExperience ?? reqSource?.minYearOfExperience;
  const maxExp = rawDetail?.maxYrsOfExperience ?? reqSource?.maxYearOfExperience;
  const expResult = extractExperience(minExp, maxExp, plainDescription);

  // Salary
  const salary = extractSalary(rawDetail?.minJobSalary, rawDetail?.maxJobSalary, plainDescription);

  // Workmode
  let workmode = rawDetail?.workMode || reqSource?.workMode || "On-site";
  const textBlob = `${title} ${combinedLoc} ${plainDescription}`.toLowerCase();
  if (workmode.toLowerCase().includes("hybrid") || textBlob.includes("hybrid")) {
    workmode = "Hybrid";
  } else if (workmode.toLowerCase().includes("remote") || textBlob.includes("remote") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else {
    workmode = "On-site";
  }

  // Posted Date
  let postedDate = new Date().toISOString();
  const rawDate = rawDetail?.modifiedDate || rawDetail?.createdDate || reqSource?.modifiedDate || reqSource?.createdDate;
  if (rawDate) {
    const d = new Date(typeof rawDate === 'number' ? rawDate : rawDate);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  // Category & Department
  const category = rawDetail?.departmentName || rawDetail?.department || reqSource?.department || "Digital Engineering & Software";
  const department = rawDetail?.subDepartment || category;

  // Skills extraction
  const skillsSet = new Set(["Persistent Systems", "Software Engineering"]);
  if (category) skillsSet.add(category);

  const reqSkills = reqSource?.skillsToEvaluateList || [];
  if (Array.isArray(reqSkills)) {
    reqSkills.forEach(s => {
      if (s && String(s).trim()) skillsSet.add(String(s).trim());
    });
  }

  const detailSkills = rawDetail?.skillSet || rawDetail?.desiredSkill || [];
  if (Array.isArray(detailSkills)) {
    detailSkills.forEach(s => {
      if (s && String(s).trim()) skillsSet.add(String(s).trim());
    });
  }

  const techKeywords = [
    "Java", "Spring Boot", "Python", "Snowflake", "AWS", "Azure", "GCP", "DevOps", "Kubernetes",
    "Docker", "React", "Angular", "Node.js", "TypeScript", "JavaScript", "SQL", "Microservices",
    "Kafka", "Data Engineering", "PySpark", "Spark", "CI/CD", "Linux", "C++", "C#", ".NET",
    "Generative AI", "LLM", "Machine Learning", "Cybersecurity", "Salesforce"
  ];

  techKeywords.forEach(kw => {
    const regexStr = `\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);

  return {
    source: "Persistent Systems",
    company: "Persistent Systems",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "Persistent Systems",
    location: combinedLoc,
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
    salary: salary,
    shift: "Day Shift",
    description: plainDescription,
    descriptionHtml: rawHtml,
    basicQualifications: cleanHtml(rawDetail?.shortDescriptionWithoutHtml || plainDescription.slice(0, 300)),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: category,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch ALL Persistent Systems jobs (with requisition list + details for each job)
 * @param {number|object|null} [optionsOrLimit=null] 
 * @param {boolean} [fetchDetails=true] Whether to fetch details for each job
 * @returns {Promise<Array>}
 */
async function fetchAllPersistentJobs(optionsOrLimit = null, fetchDetails = true) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allReqs = [];
  let startNo = 0;
  let totalCount = null;

  try {
    while (true) {
      const pageData = await fetchPersistentRequisitionsPage(startNo);
      if (!pageData || !pageData.data || !Array.isArray(pageData.data.data) || pageData.data.data.length === 0) {
        break;
      }

      const reqList = pageData.data.data;
      allReqs.push(...reqList);
      totalCount = pageData.data.totalCount || totalCount;

      console.log(`[Persistent API] Fetched ${allReqs.length} / ${totalCount || 'unknown'} requisitions...`);

      if (maxLimit && allReqs.length >= maxLimit) {
        break;
      }

      if (!pageData.data.hasMoreData || (totalCount && allReqs.length >= totalCount)) {
        break;
      }

      startNo += reqList.length;
      await delay(300);
    }

    let targetReqs = allReqs;
    if (maxLimit && targetReqs.length > maxLimit) {
      targetReqs = targetReqs.slice(0, maxLimit);
    }

    console.log(`[Persistent API] Now processing ${targetReqs.length} jobs (fetchDetails: ${fetchDetails})...`);

    const mappedJobs = [];
    const concurrency = 10;

    for (let i = 0; i < targetReqs.length; i += concurrency) {
      const chunk = targetReqs.slice(i, i + concurrency);
      const chunkResults = await Promise.all(chunk.map(async (req) => {
        const sourceObj = req._source || req;
        let detail = null;
        if (fetchDetails && sourceObj.id) {
          detail = await fetchPersistentJobDetails(sourceObj.id, sourceObj.jobUrl);
        }
        return mapPersistentJob(req, detail);
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
    console.error("[Persistent API] Error fetching Persistent Systems jobs:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Persistent Systems jobs with MongoDB collection
 * @param {object} PersistentJobModel 
 * @param {number|object|null} [optionsOrLimit=null] 
 * @returns {Promise<object>}
 */
async function syncPersistentJobsWithDb(PersistentJobModel, optionsOrLimit = null) {
  if (!PersistentJobModel) {
    throw new Error("PersistentJob model is required for database sync.");
  }

  console.log("[Persistent Sync] Starting Persistent Systems jobs DB sync...");
  const fetchedJobs = await fetchAllPersistentJobs(optionsOrLimit, true);
  console.log(`[Persistent Sync] Fetched ${fetchedJobs.length} live jobs with details from Persistent API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Persistent API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await PersistentJobModel.find({ source: "Persistent Systems" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await PersistentJobModel.deleteMany({ source: "Persistent Systems", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Persistent Systems", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await PersistentJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await PersistentJobModel.countDocuments({ source: "Persistent Systems" });

  return {
    success: true,
    message: "Persistent DB sync completed successfully.",
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
  fetchPersistentRequisitionsPage,
  fetchPersistentJobDetails,
  mapPersistentJob,
  fetchAllPersistentJobs,
  syncPersistentJobsWithDb,
  cleanHtml
};
