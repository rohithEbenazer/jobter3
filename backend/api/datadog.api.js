// datadog.api.js - Dedicated API module for DataDog Careers (Typesense Search + Greenhouse API)
const axios = require("axios");

const TYPESENSE_URL = "https://gk6e3zbyuntvc5dap.a1.typesense.net/multi_search?x-typesense-api-key=1Hwq7hntXp211hKvRS3CSI2QSU7w2gFm";
const GREENHOUSE_JOB_URL = "https://boards-api.greenhouse.io/v1/boards/datadog/jobs";
const DATADOG_PUBLIC_BASE = "https://careers.datadoghq.com/detail";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "content-type": "text/plain",
  "origin": "https://careers.datadoghq.com",
  "referer": "https://careers.datadoghq.com/",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
};

/**
 * Step 1: Fetch a page of jobs from DataDog Typesense API
 * @param {number} page Page number (1, 2, 3...)
 * @param {number} perPage Page size (default 50)
 * @returns {Promise<object|null>} Response containing hits and total count
 */
async function fetchDataDogPage(page = 1, perPage = 50) {
  const payload = JSON.stringify({
    searches: [{
      preset: "careers_list_view",
      collection: "careers_alias",
      q: "*",
      filter_by: "language: en",
      page: page,
      per_page: perPage
    }]
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(TYPESENSE_URL, {
          method: "POST",
          headers: DEFAULT_HEADERS,
          body: payload
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.results?.[0] || null;
      } else {
        const response = await axios.post(TYPESENSE_URL, payload, {
          headers: DEFAULT_HEADERS,
          timeout: 15000
        });
        return response.data?.results?.[0] || null;
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[DataDog API] Error fetching page ${page}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: Fetch single job detail by Greenhouse job ID
 * @param {string|number} jobId 
 * @returns {Promise<object|null>}
 */
async function fetchDataDogJobById(jobId) {
  if (!jobId) return null;
  const url = `${GREENHOUSE_JOB_URL}/${jobId}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: { "accept": "application/json" } });
        if (!res.ok) return null;
        const data = await res.json();
        return mapGreenhouseJob(data);
      } else {
        const res = await axios.get(url, { headers: { "accept": "application/json" }, timeout: 10000 });
        return mapGreenhouseJob(res.data);
      }
    } catch (err) {
      if (attempt < 2) await delay(300);
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
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
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
 * Extract salary information from item description
 */
function extractSalaryInfo(textBlob = "") {
  const salMatch = /(?:USD|\$)\s*([\d,]+)\s*(?:-|to)\s*(?:USD|\$)?\s*([\d,]+)/i.exec(textBlob);
  if (salMatch) {
    return `$${salMatch[1]} - $${salMatch[2]} / year`;
  }
  const hrMatch = /(?:USD|\$)\s*([\d.]+)\s*(?:-|to)\s*(?:USD|\$)?\s*([\d.]+)\s*(?:per\s+hour|\/hr)/i.exec(textBlob);
  if (hrMatch) {
    return `$${hrMatch[1]} - $${hrMatch[2]} / hr`;
  }
  return "Competitive Package";
}

/**
 * Map DataDog Typesense document into standardized Job format
 * @param {object} doc Raw document from Typesense hits
 * @returns {object|null} Standardized JSON format of job
 */
function mapDataDogJobs(doc) {
  if (!doc) return null;

  const jobId = String(doc.job_id || doc.internal_job_id || doc.id);
  const title = doc.title || "DataDog Opening";
  const externalUrl = doc.absolute_url || `${DATADOG_PUBLIC_BASE}/${jobId}/?gh_jid=${jobId}`;

  const location = doc.location_string || "Not specified";
  const locParts = location.split(';')[0].split(',').map(s => s.trim());

  let country = [];
  let state = [];
  let city = [];

  if (locParts.length >= 3) {
    city = [locParts[0]];
    state = [locParts[1]];
    country = [locParts[2]];
  } else if (locParts.length === 2) {
    city = [locParts[0]];
    country = [locParts[1]];
  } else if (locParts.length === 1 && locParts[0]) {
    city = [locParts[0]];
  }

  const descRaw = doc.description || '';
  const textBlob = `${title} ${location} ${descRaw}`.toLowerCase();

  let workmode = "On-site";
  if (doc.remote || textBlob.includes("remote") || textBlob.includes("virtual") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  let postedDate = new Date().toISOString();
  if (doc.last_mod) {
    const d = new Date(doc.last_mod);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  const plainDescription = cleanHtml(descRaw || `${title} - ${location}`);
  const rawHtml = descRaw || `<p><strong>${title}</strong></p><p>Location: ${location}</p>`;
  const expResult = extractExperienceFromText(plainDescription);

  const category = doc.department || 'Cloud & Observability';
  const department = doc.team || doc.department || 'Engineering & Technology';

  const skillsSet = new Set();
  skillsSet.add("DataDog");
  skillsSet.add("Observability");
  skillsSet.add("Cloud");

  const techKeywords = [
    "Go", "Golang", "Python", "Java", "C++", "Rust", "Kubernetes", "Docker",
    "AWS", "GCP", "Azure", "Distributed Systems", "Kafka", "PostgreSQL",
    "React", "TypeScript", "JavaScript", "Node.js", "DevOps", "SRE", "Linux",
    "Security", "AI", "Machine Learning"
  ];

  techKeywords.forEach(kw => {
    let regexStr = kw === "C++" || kw === "Go" ? (kw === "Go" ? "\\bGo\\b" : kw.replace(/\+/g, '\\+')) : `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription || title)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);
  const salary = extractSalaryInfo(plainDescription);

  return {
    source: "DataDog",
    company: "DataDog",
    id: jobId,
    jobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "DataDog Inc.",
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
    jobUrl: externalUrl,
    url: externalUrl,
    applyJobUrl: externalUrl,
    skills: skills,
    salary: salary,
    shift: "Day Shift",
    description: plainDescription,
    descriptionHtml: rawHtml,
    basicQualifications: plainDescription.slice(0, 300),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: "Software / Systems Engineer",
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Map Greenhouse raw job detail object into standardized Job format
 * @param {object} ghData 
 */
function mapGreenhouseJob(ghData) {
  if (!ghData) return null;
  const jobId = String(ghData.id);
  const title = ghData.title || "DataDog Opening";
  const externalUrl = ghData.absolute_url || `${DATADOG_PUBLIC_BASE}/${jobId}/?gh_jid=${jobId}`;
  const location = ghData.location?.name || "Not specified";

  const descRaw = ghData.content || '';
  const plainDescription = cleanHtml(descRaw || `${title} - ${location}`);
  const expResult = extractExperienceFromText(plainDescription);

  return {
    source: "DataDog",
    company: "DataDog",
    id: jobId,
    jobId: jobId,
    title: title,
    category: ghData.departments?.[0]?.name || "Observability & Cloud",
    department: ghData.offices?.[0]?.name || "Engineering",
    businessUnit: "DataDog Inc.",
    location: location,
    minYears: expResult.minYears,
    maxYears: expResult.maxYears !== null ? expResult.maxYears : 99,
    minYrsOfExperience: expResult.minYears,
    maxYrsOfExperience: expResult.maxYears !== null ? expResult.maxYears : 99,
    yrsOfExperience: expResult.experienceRequired,
    experienceRequired: expResult.experienceRequired,
    workmode: "On-site",
    jobUrl: externalUrl,
    url: externalUrl,
    applyJobUrl: externalUrl,
    skills: ["DataDog", "Observability", "Cloud"],
    salary: extractSalaryInfo(plainDescription),
    shift: "Day Shift",
    description: plainDescription,
    descriptionHtml: descRaw,
    postedDate: ghData.updated_at || new Date().toISOString(),
    postingDate: ghData.updated_at || new Date().toISOString()
  };
}

/**
 * Step 4: Fetch ALL DataDog jobs (or up to maxLimit)
 * @param {number|object|null} [optionsOrLimit=null] Maximum number of jobs to fetch or options object
 * @returns {Promise<Array>} Array of JSON job objects
 */
async function fetchAllDataDogJobs(optionsOrLimit = null) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  try {
    let allMappedJobs = [];
    let page = 1;
    const perPage = 50;

    const firstPageRes = await fetchDataDogPage(1, perPage);
    if (!firstPageRes || !Array.isArray(firstPageRes.hits)) {
      return [];
    }

    const totalCount = firstPageRes.out_of || 500;
    firstPageRes.hits.forEach(hit => {
      const mapped = mapDataDogJobs(hit.document);
      if (mapped) allMappedJobs.push(mapped);
    });

    let targetTotal = maxLimit ? Math.min(maxLimit, totalCount) : totalCount;

    while (allMappedJobs.length < targetTotal) {
      page++;
      const pageRes = await fetchDataDogPage(page, perPage);
      if (!pageRes || !Array.isArray(pageRes.hits) || pageRes.hits.length === 0) {
        break;
      }
      pageRes.hits.forEach(hit => {
        const mapped = mapDataDogJobs(hit.document);
        if (mapped) allMappedJobs.push(mapped);
      });
      await delay(100);
    }

    if (maxLimit) {
      allMappedJobs = allMappedJobs.slice(0, maxLimit);
    }

    // Deduplicate by jobId
    const seenIds = new Set();
    const uniqueJobs = [];
    for (const j of allMappedJobs) {
      if (j.jobId && !seenIds.has(j.jobId)) {
        seenIds.add(j.jobId);
        uniqueJobs.push(j);
      }
    }

    return uniqueJobs;
  } catch (error) {
    console.error("[DataDog API] Error:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync DataDog jobs with MongoDB collection
 * @param {object} DataDogJobModel Mongoose model for DataDogJob
 * @param {number|object|null} [optionsOrLimit=null] Optional limit or options
 * @returns {Promise<object>} Sync operation result summary
 */
async function syncDataDogJobsWithDb(DataDogJobModel, optionsOrLimit = null) {
  if (!DataDogJobModel) {
    throw new Error("DataDogJob model is required for database sync.");
  }

  console.log("[DataDog Sync] Starting DataDog jobs DB sync...");
  const fetchedJobs = await fetchAllDataDogJobs(optionsOrLimit);
  console.log(`[DataDog Sync] Fetched ${fetchedJobs.length} live jobs from DataDog API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from DataDog API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await DataDogJobModel.find({ source: "DataDog" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await DataDogJobModel.deleteMany({ source: "DataDog", jobId: { $in: obsoleteIds } });
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
        filter: { source: "DataDog", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await DataDogJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await DataDogJobModel.countDocuments({ source: "DataDog" });

  return {
    success: true,
    message: "DataDog DB sync completed successfully.",
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
  fetchDataDogPage,
  fetchDataDogJobById,
  mapDataDogJobs,
  fetchAllDataDogJobs,
  syncDataDogJobsWithDb,
  cleanHtml
};
