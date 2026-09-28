// cogforce.api.js - Dedicated API module for Coforge Careers (via Zwayam Public Search API)
const axios = require("axios");
const FormData = require("form-data");

const COFORGE_API = "https://public.zwayam.com/jobs/search";
const pageSize = 10;

/**
 * Step 1: Fetch a page of jobs from Coforge API (ALL JOBS)
 * @param {number} page Page number (1-indexed)
 * @returns {Promise<object|null>} Response data object containing raw jobs array
 */
async function fetchCoforgePage(page = 1) {
  try {
    const paginationStartNo = (page - 1) * pageSize;
    const filterCri = {
      paginationStartNo: paginationStartNo,
      selectedCall: "sort",
      sortCriteria: {
        name: "modifiedDate",
        isAscending: false
      },
      anyOfTheseWords: ""
    };

    const form = new FormData();
    form.append("filterCri", JSON.stringify(filterCri));
    form.append("domain", "careers.coforge.com");
    form.append("companyId", "MTUxNzM=");

    const response = await axios.post(COFORGE_API, form, {
      headers: {
        ...form.getHeaders(),
        "accept": "application/json, text/plain, */*",
        "origin": "https://careers.coforge.com",
        "referer": "https://careers.coforge.com/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 15000
    });
    

    return response.data;
  } catch (error) {
    console.warn(`[Coforge API] Error fetching page ${page}:`, error.message);
    return null;
  }
}

/**
 * Step 2: GET each job URL to retrieve detail JSON format
 * @param {string} jobUrl Relative or absolute job detail URL
 * @returns {Promise<object|null>} Detailed job JSON object or raw details
 */
async function fetchCoforgeJobDetailsUrl(jobUrl, jobId) {
  if (!jobUrl || !jobId) return null;

  try {
    const response = await axios.post(
      "https://public.zwayam.com/jobs-service/v1/jobs/careersite",
      {
        jobUrl: jobUrl,
        externalSource: "CareerSite",
        campusUrl: "empty",
        companyId: "15173",
        jobId: String(jobId)
      },
      {
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "Origin": "https://careers.coforge.com",
          "Referer": "https://careers.coforge.com/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36"
        },
        timeout: 15000
      }
    );
    console.log(response);

    return response.data;

  } catch (error) {
    console.warn(
      `[Coforge API] Failed to fetch details for ${jobUrl}:`,
      error.message
    );

    return null;
  }
}

/**
 * Step 3: Map raw/detailed Coforge job into standardized JSON format
 * @param {object} rawItem Raw job item from API
 * @returns {object|null} Standardized JSON format of job
 */
function parseExpNumber(val, defaultVal) {
  if (val === null || val === undefined || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const cleaned = String(val).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? defaultVal : num;
}

function mapCoforgeJobs(rawItem) {
  if (!rawItem) return null;
  const item = rawItem._source || rawItem;

  const jobId = String(item.id || item.jobId || item.jobCode || item.refNumber || rawItem._id || '');
  if (!jobId) return null;

  const title = item.jobTitle || item.title || item.parsed_designation || item.roles || "Coforge Opening";
  const rawUrl = item.jobUrl || item.url || '';
  const fullUrl = rawUrl
    ? (rawUrl.startsWith("http") ? rawUrl : `https://careers.coforge.com/${rawUrl.startsWith('/') ? rawUrl.substring(1) : rawUrl}`)
    : `https://careers.coforge.com/coforge/jobs/${jobId}`;

  const minExp = parseExpNumber(item.minYrsOfExperience ?? item.minYearOfExperience ?? item.minYears, 0);
  const maxExp = parseExpNumber(item.maxYrsOfExperience ?? item.maxYearOfExperience ?? item.maxYears, 99);
  const yrsOfExperience = (item.yrsOfExperience ? String(item.yrsOfExperience).trim() : null) || `${minExp}${maxExp !== 99 ? '-' + maxExp : '+'} Years`;

  let location = item.location || item.locAgg || item.locationSeparatedbySlash || item.locationDisplayForManageJobs;
  if (!location && Array.isArray(item.jobLocationRecord) && item.jobLocationRecord.length > 0) {
    location = item.jobLocationRecord.map(l => l.formattedLocation || l.location || `${l.city ? l.city + ', ' : ''}${l.state || l.country || ''}`).filter(Boolean).join('; ');
  }
  if (!location) {
    location = item.city || item.state || item.country || "Not specified";
  }
  let city = Array.isArray(item.jobLocationRecord) ? item.jobLocationRecord.map(l => l.city).filter(Boolean) : [];
  let state = Array.isArray(item.jobLocationRecord) ? item.jobLocationRecord.map(l => l.state).filter(Boolean) : [];
  let country = Array.isArray(item.jobLocationRecord) ? item.jobLocationRecord.map(l => l.country).filter(Boolean) : [];

  let skills = [];
  if (Array.isArray(item.parsed_skills) && item.parsed_skills.length > 0) {
    skills = item.parsed_skills;
  } else if (Array.isArray(item.jdSkillsKnownList) && item.jdSkillsKnownList.length > 0) {
    skills = item.jdSkillsKnownList;
  } else if (Array.isArray(item.mandatorySkills) && item.mandatorySkills.length > 0) {
    skills = item.mandatorySkills;
  } else if (Array.isArray(item.skills)) {
    skills = item.skills;
  }
  
  const description = item.mediumDescriptionWithoutHtml || item.metaDescription || item.description || item.jobDescription || item.overview || '';
  const rawHtml = item.descriptionHtml || item.details || (item.mediumDescription && item.mediumDescription.length > 500 ? item.mediumDescription : null);
  const descriptionHtml = rawHtml || `<div style="white-space: pre-wrap; font-family: inherit;">${description}</div>`;

  let postedDate = new Date().toISOString();
  if (item.jobCreatedDate) {
    postedDate = new Date(item.jobCreatedDate).toISOString();
  } else if (item.createdDate) {
    postedDate = typeof item.createdDate === 'number' ? new Date(item.createdDate).toISOString() : String(item.createdDate);
  } else if (item.createDate) {
    postedDate = String(item.createDate);
  }

  const workmode = (item.locationDisplayForManageJobs && String(item.locationDisplayForManageJobs).trim().toLowerCase().includes("work from home")) 
    ? "Remote" 
    : (item.workmode || item.workMode || item.jobType || item.modeOfWork || null);
  const role = (Array.isArray(item.jobCollaborationRecord) 
    ? item.jobCollaborationRecord.find(l => String(l.jobId || l.id) === jobId)?.role 
    : null) || item.roles || (Array.isArray(item.rolesList) ? item.rolesList[0] : null) || null;
  let mandateSkills = item.skillSet;

  return {
    source: "Coforge",
    company: "Coforge",
    id: jobId,
    jobId: jobId,
    title: title,
    location: location,
    minYrsOfExperience: minExp,
    maxYrsOfExperience: maxExp,
    minYears: minExp,
    maxYears: maxExp,
    yrsOfExperience: yrsOfExperience,
    workmode: workmode,
    jobUrl: fullUrl,
    url: fullUrl,
    skills: skills,
    description: description,
    descriptionHtml: descriptionHtml,
    postedDate: postedDate,
    postingDate: postedDate,
    role: role,
    mandateSkills: mandateSkills,
    city: city,
    state: state,
    country: country,
  };
}

/**
 * Main function executing the complete Coforge listing pipeline:
 * ALL JOBS -> Return ONLY JSON Array of each job
 * 
 * @returns {Promise<Array>} Array of JSON job objects
 */
async function fetchAllCoforgeJobs() {
  try {
    const allJobs = [];
    const jobIds = new Set();

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await fetchCoforgePage(page);
      

      const rawJobs = Array.isArray(data?.data?.data)
        ? data.data.data
        : (Array.isArray(data?.data) ? data.data : []);
        

      if (!rawJobs || rawJobs.length === 0) {
        break;
      }

      for (const item of rawJobs) {
        // data=fetchCoforgeJobDetailsUrl(item._source.jobUrl,item._source.jobLocationRecord[0].jobId);
        const job = mapCoforgeJobs(item);
        

        if (!job || !job.id) {
          continue;
        }

        if (jobIds.has(job.id)) {
          continue;
        }

        jobIds.add(job.id);
        allJobs.push(job);
      }

      if (rawJobs.length < pageSize) {
        hasMore = false;
      } else {
        page++;

        await new Promise(resolve =>
          setTimeout(resolve, 300)
        );
      }
    }

    // ONLY JSON ARRAY
    return allJobs;

  } catch (error) {
    console.error("Coforge Error:", error.message);

    // Return JSON only
    return [];
  }
}

/**
 * Sync Coforge jobs with MongoDB collection
 * @param {object} CogforceJobModel Mongoose model for CogforceJob
 * @returns {Promise<object>} Sync operation result summary
 */
async function syncCogforceJobsWithDb(CogforceJobModel) {
  if (!CogforceJobModel) {
    throw new Error("CogforceJob model is required for database sync.");
  }

  console.log("[Coforge Sync] Starting Coforge jobs DB sync...");
  const fetchedJobs = await fetchAllCoforgeJobs();
  console.log(`[Coforge Sync] Fetched ${fetchedJobs.length} live jobs from Coforge API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Coforge API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await CogforceJobModel.find({ source: "Coforge" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await CogforceJobModel.deleteMany({ source: "Coforge", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Coforge", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await CogforceJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await CogforceJobModel.countDocuments({ source: "Coforge" });

  return {
    success: true,
    message: "Coforge DB sync completed successfully.",
    stats: {
      totalFetchedRaw: fetchedJobs.length,
      previousDbCount: existingDbJobs.length,
      deletedFromDb: deletedCount,
      insertedToDb: insertedCount,
      updatedOrKeptInDb: updatedCount,
      finalDbCount: finalDbCount
    }
  };
}

module.exports = {
  fetchCoforgePage,
  fetchCoforgeJobDetailsUrl,
  mapCoforgeJobs,
  fetchAllCoforgeJobs,
  syncCogforceJobsWithDb
};