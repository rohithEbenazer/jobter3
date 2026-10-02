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

function parseToIsoString(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof val === 'string') {
    const str = val.trim();
    if (!str) return null;
    if (/^\d{10,13}$/.test(str)) {
      const d = new Date(parseInt(str, 10));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function extractSalary(item, text) {
  if (item.salary && String(item.salary).trim() !== '' && String(item.salary).toLowerCase() !== 'null' && String(item.salary).toLowerCase() !== 'undefined') {
    return String(item.salary).trim();
  }

  const str = String(text || '');

  // 1. Hourly Rate Range extraction: e.g. '$17/hr - $18/hr', '$25/hr', '$17 - $18 / hour', 'Pay Rate: $25/hr'
  const hourlyRangeMatch = str.match(/(?:pay\s*rate\s*[:\-]?\s*)?[$₹€£]?\s*(\d+(?:\.\d+)?)\s*(?:\/hr|\/hour|per\s*hour)?\s*(?:to|-)\s*[$₹€£]?\s*(\d+(?:\.\d+)?)\s*(?:\/hr|\/hour|per\s*hour|\s*on\s*w2)/i);
  if (hourlyRangeMatch) {
    const minH = parseFloat(hourlyRangeMatch[1]);
    const maxH = parseFloat(hourlyRangeMatch[2]);
    if (!isNaN(minH) && !isNaN(maxH) && minH > 0 && minH < 500 && maxH < 500) {
      const minLpa = (minH * 2080 * 0.00083).toFixed(1);
      const maxLpa = (maxH * 2080 * 0.00083).toFixed(1);
      return `₹ ${minLpa} - ₹ ${maxLpa} LPA ($${minH} - $${maxH}/hr)`;
    }
  }

  // 2. Single Hourly Rate extraction: e.g. '$17/hr', '$25/hr', 'Pay Rate - $25/hr'
  const singleHourlyMatch = str.match(/(?:pay\s*rate\s*[:\-]?\s*)?[$₹€£]\s*(\d+(?:\.\d+)?)\s*(?:\/hr|\/hour|per\s*hour|\s*on\s*w2)/i);
  if (singleHourlyMatch) {
    const h = parseFloat(singleHourlyMatch[1]);
    if (!isNaN(h) && h > 0 && h < 500) {
      const lpa = (h * 2080 * 0.00083).toFixed(1);
      return `₹ ${lpa} LPA ($${h}/hr)`;
    }
  }

  // 3. Rupee Explicit Range in text (₹ / INR / Rs / LPA / Lakhs)
  const rupeeMatch = str.match(/(?:[₹]\s*\d+[0-9,.]*\s*(?:lpa|lakhs|lacs|\/month)?\s*(?:to|-)\s*[₹]?\s*\d+[0-9,.]*\s*(?:lpa|lakhs|lacs)?|inr\s*\d+[0-9,.]*|\d+\s*-\s*\d+\s*(?:lpa|lakhs|lacs)|rs\.?\s*\d+[0-9,.]*)/i);
  if (rupeeMatch) {
    return rupeeMatch[0].trim();
  }

  // 4. Annual Dollar Range extraction: e.g. '$50,000 - $80,000', '$50k - $80k'
  const dollarMatch = str.match(/[$]\s*(\d+)[0-9,.]*\s*(?:k)?\s*(?:to|-)\s*[$]?\s*(\d+)[0-9,.]*\s*(?:k)?/i);
  if (dollarMatch) {
    const minK = parseInt(dollarMatch[1]);
    const maxK = parseInt(dollarMatch[2]);
    if (!isNaN(minK) && !isNaN(maxK) && minK > 10) {
      const minLpa = (minK * 0.83).toFixed(1);
      const maxLpa = (maxK * 0.83).toFixed(1);
      return `₹ ${minLpa} - ₹ ${maxLpa} LPA ($${minK}k - $${maxK}k)`;
    }
  }

  return null;
}

function extractShift(item, text) {
  const combined = (String(item.workMode || '') + ' ' + String(item.jobType || '') + ' ' + String(text || '')).toLowerCase();

  if (combined.match(/night shift|evening shift|us shift|uk shift|night|24\/7|rotational shift|graveyard|third shift|second shift/i)) {
    return "Night Shift";
  }
  if (combined.match(/flexible shift|flexible hours|flexi shift|flexible/i)) {
    return "Flexible / Rotational";
  }
  return "Day Shift";
}

function mapCoforgeJobs(rawItem) {
  if (!rawItem) return null;
  const item = rawItem._source || rawItem;

  const jobId = String(item.id || item.jobId || item.jobCode || item.refNumber || rawItem._id || '');
  if (!jobId) return null;

  const title = item.jobTitle || item.title || item.parsed_designation || item.roles || "Coforge Opening";
  const rawUrl = item.jobUrl || item.url || '';
  let fullUrl = '';
  if (rawUrl) {
    if (rawUrl.startsWith("http")) {
      fullUrl = rawUrl;
    } else {
      const cleanSlug = rawUrl.startsWith('/') ? rawUrl.substring(1) : rawUrl;
      fullUrl = `https://careers.coforge.com/coforge/jobview/${cleanSlug}?id=${jobId}`;
    }
  } else {
    fullUrl = `https://careers.coforge.com/coforge/jobview/job?id=${jobId}`;
  }

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

  const salary = extractSalary(item, description);
  const shift = extractShift(item, `${title} ${description}`);

  let postedDate = parseToIsoString(item.createDate) ||
    parseToIsoString(item.createdDate) ||
    parseToIsoString(item.jobCreatedDate) ||
    parseToIsoString(item.modifiedDate) ||
    parseToIsoString(item.requisitionApprovedDate);

  if (!postedDate && item.jobUrl) {
    const match = String(item.jobUrl).match(/(\d{8})/);
    if (match) {
      const yyyymmdd = match[1];
      const y = yyyymmdd.substring(0, 4);
      const m = yyyymmdd.substring(4, 6);
      const d = yyyymmdd.substring(6, 8);
      const parsed = new Date(`${y}-${m}-${d}`);
      if (!isNaN(parsed.getTime())) {
        postedDate = parsed.toISOString();
      }
    }
  }

  if (!postedDate) {
    postedDate = new Date().toISOString();
  }

  const workmode = (item.locationDisplayForManageJobs && String(item.locationDisplayForManageJobs).trim().toLowerCase().includes("work from home"))
    ? "Remote"
    : (item.workmode || item.workMode || item.jobType || item.modeOfWork || null);
  const roleRaw = (Array.isArray(item.jobCollaborationRecord)
    ? item.jobCollaborationRecord.find(l => String(l.jobId || l.id) === jobId)?.role
    : null) || item.roles || (Array.isArray(item.rolesList) ? item.rolesList[0] : null) || null;
  const role = Array.isArray(roleRaw) ? roleRaw.filter(Boolean).join(', ') : (roleRaw ? String(roleRaw) : null);
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
    salary: salary,
    shift: shift,
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
    const firstPageData = await fetchCoforgePage(1);
    if (!firstPageData) return [];

    const totalCount = firstPageData?.data?.totalCount;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const pagePromises = [Promise.resolve(firstPageData)];
    for (let p = 2; p <= totalPages; p++) {
      pagePromises.push(fetchCoforgePage(p));
    }

    const pageResults = await Promise.all(pagePromises);
    const allJobs = [];
    const jobIds = new Set();

    for (const data of pageResults) {
      if (!data) continue;
      const rawJobs = Array.isArray(data?.data?.data)
        ? data.data.data
        : (Array.isArray(data?.data) ? data.data : []);

      for (const item of rawJobs) {
        const job = mapCoforgeJobs(item);

        if (!job || !job.id || jobIds.has(job.id)) {
          continue;
        }

        jobIds.add(job.id);
        allJobs.push(job);
      }
    }

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