// salesforce.api.js - Dedicated API module for Salesforce Careers (sfdcstatic jobs_N.json API)
const axios = require("axios");

const SALESFORCE_BASE_URL = "https://a.sfdcstatic.com/digital/xsf/careers/prod";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "*/*",
  "accept-language": "en-US,en;q=0.9",
  "origin": "https://www.salesforce.com",
  "referer": "https://www.salesforce.com/",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

/**
 * Step 1: Fetch a page of jobs from Salesforce static API (jobs_1.json, jobs_2.json...)
 * @param {number} page Page number (1, 2...)
 * @returns {Promise<object|null>} Response object containing Report_Entry array and Total_Jobs count
 */
async function fetchSalesforcePage(page = 1) {
  const url = `${SALESFORCE_BASE_URL}/jobs_${page}.json`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (res.status === 404) return null;
        if (res.status === 429) {
          const waitTime = Math.round(1500 * attempt + Math.random() * 500);
          await delay(waitTime);
          continue;
        }
        if (!res.ok) return null;
        const data = await res.json();
        return data;
      } else {
        const response = await axios.get(url, {
          headers: DEFAULT_HEADERS,
          timeout: 15000
        });
        return response.data;
      }
    } catch (error) {
      if (error.response && error.response.status === 404) return null;
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Salesforce API] Error fetching page ${page}:`, error.message);
    }
  }
  return null;
}

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
 * Extract experience requirements from text snippet
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
 * Extract salary information from item properties or text
 */
function extractSalaryInfo(rawItem) {
  if (rawItem.EU_Min_Salary && rawItem.EU_Max_Salary && rawItem.EU_Min_Salary !== "0" && rawItem.EU_Max_Salary !== "0") {
    const curr = rawItem.EU_Salary_Currency || "EUR";
    return `${curr} ${rawItem.EU_Min_Salary} - ${rawItem.EU_Max_Salary} / year`;
  }

  const textBlob = `${rawItem['Pay_Transparency_Text_if_location_region_is__Non-Sales-NAT_US___Geo_A_SEL_'] || ''} ${rawItem['Pay_Transparency_Text_if_location_region_is__Sales-NAT_US___Geo_A_SEL_'] || ''} ${rawItem.Pay_Transparency_text_EU || ''} ${rawItem.US_Compensation_Verbiage_Statement || ''}`;
  const salMatch = /(?:USD|\$)\s*([\d,]+)\s*(?:-|to)\s*(?:USD|\$)?\s*([\d,]+)/i.exec(textBlob);
  if (salMatch) {
    return `$${salMatch[1]} - $${salMatch[2]} / year`;
  }

  return "Competitive Package";
}

/**
 * Step 3: Map Salesforce API item into standardized Job format
 * @param {object} rawItem Raw job item from Salesforce Report_Entry
 * @returns {object|null} Standardized JSON format of job
 */
function mapSalesforceJobs(rawItem) {
  if (!rawItem) return null;

  const jobId = String(rawItem.Job_Requisition_Ref_ID || rawItem.id || '');
  if (!jobId) return null;

  const title = rawItem.Job_Posting_Title || "Salesforce Opening";
  const fullUrl = rawItem.External_Job_Posting_Site || `https://salesforce.wd12.myworkdayjobs.com/External_Career_Site/job/${jobId}`;

  const location = rawItem.Job_Requisition_Primary_Location || (Array.isArray(rawItem.Locations) ? rawItem.Locations.join(', ') : 'Not specified');

  let country = Array.isArray(rawItem.Countries) ? rawItem.Countries : [];
  let state = Array.isArray(rawItem.Regions) ? rawItem.Regions : [];
  let city = Array.isArray(rawItem.Locations) ? rawItem.Locations : [];

  if (country.length === 0 || state.length === 0 || city.length === 0) {
    const locParts = location.split('-').map(s => s.trim());
    if (locParts.length >= 2) {
      if (country.length === 0) country = [locParts[0]];
      if (city.length === 0) city = [locParts[1]];
    }
  }

  // Work Mode detection
  const descRaw = rawItem.Job_Description || '';
  const textBlob = `${title} ${location} ${descRaw}`.toLowerCase();

  let workmode = "On-site";
  if (textBlob.includes("remote") || textBlob.includes("virtual") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  // Posted Date parsing
  let postedDate = new Date().toISOString();
  if (rawItem.External_Job_Posting_Start_Date) {
    const d = new Date(rawItem.External_Job_Posting_Start_Date);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  const plainDescription = cleanHtml(descRaw || `${title} - ${location}`);
  const rawHtml = descRaw || `<p><strong>${title}</strong></p><p>Location: ${location}</p>`;
  const expResult = extractExperienceFromText(plainDescription);

  // Category & Department
  const category = rawItem.Job_Family_Group || 'Software & Cloud Technologies';
  const department = rawItem.Job_Family_Group || 'Engineering & Operations';

  const skillsSet = new Set();
  skillsSet.add("Salesforce");
  if (category) skillsSet.add(category);

  const techKeywords = [
    "Salesforce", "Apex", "Lightning", "LWC", "Trailhead", "MuleSoft", "Tableau", "CRM",
    "C++", "C#", ".NET", "Python", "Java", "JavaScript", "TypeScript", "React", "Angular",
    "Node.js", "AWS", "GCP", "Cloud", "Kubernetes", "Docker", "DevOps", "CI/CD", "Microservices",
    "SQL", "NoSQL", "PostgreSQL", "MongoDB", "AI", "Machine Learning", "LLM", "Linux"
  ];

  techKeywords.forEach(kw => {
    let regexStr = kw === "C++" || kw === "C#" ? kw.replace(/\+/g, '\\+') : `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);
  const salary = extractSalaryInfo(rawItem);

  return {
    source: "Salesforce",
    company: "Salesforce",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "Salesforce",
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
    jobUrl: fullUrl,
    url: fullUrl,
    skills: skills,
    salary: salary,
    shift: "Day Shift",
    description: plainDescription,
    descriptionHtml: rawHtml,
    basicQualifications: plainDescription.slice(0, 300),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: category,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 4: Fetch ALL Salesforce jobs across all jobs_N.json pages
 * @param {number|object|null} [optionsOrLimit=null] Maximum number of jobs to fetch or options object
 * @returns {Promise<Array>} Array of JSON job objects
 */
async function fetchAllSalesforceJobs(optionsOrLimit = null) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  try {
    let allRawJobs = [];
    let page = 1;

    while (true) {
      const pageRes = await fetchSalesforcePage(page);
      if (!pageRes || !Array.isArray(pageRes.Report_Entry) || pageRes.Report_Entry.length === 0) {
        break;
      }

      allRawJobs.push(...pageRes.Report_Entry);

      if (maxLimit && allRawJobs.length >= maxLimit) {
        break;
      }

      page++;
      await delay(100);
    }

    if (maxLimit) {
      allRawJobs = allRawJobs.slice(0, maxLimit);
    }

    const mappedJobs = [];
    const seenIds = new Set();

    for (const raw of allRawJobs) {
      const mapped = mapSalesforceJobs(raw);
      if (mapped && mapped.jobId && !seenIds.has(mapped.jobId)) {
        seenIds.add(mapped.jobId);
        mappedJobs.push(mapped);
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("Salesforce API Error:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Salesforce jobs with MongoDB collection
 * @param {object} SalesforceJobModel Mongoose model for SalesforceJob
 * @param {number|object|null} [optionsOrLimit=null] Optional limit or options
 * @returns {Promise<object>} Sync operation result summary
 */
async function syncSalesforceJobsWithDb(SalesforceJobModel, optionsOrLimit = null) {
  if (!SalesforceJobModel) {
    throw new Error("SalesforceJob model is required for database sync.");
  }

  console.log("[Salesforce Sync] Starting Salesforce jobs DB sync...");
  const fetchedJobs = await fetchAllSalesforceJobs(optionsOrLimit);
  console.log(`[Salesforce Sync] Fetched ${fetchedJobs.length} live jobs from Salesforce API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Salesforce API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await SalesforceJobModel.find({ source: "Salesforce" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await SalesforceJobModel.deleteMany({ source: "Salesforce", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Salesforce", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await SalesforceJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await SalesforceJobModel.countDocuments({ source: "Salesforce" });

  return {
    success: true,
    message: "Salesforce DB sync completed successfully.",
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
  fetchSalesforcePage,
  mapSalesforceJobs,
  fetchAllSalesforceJobs,
  syncSalesforceJobsWithDb,
  cleanHtml
};
