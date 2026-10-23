// squareyards.api.js - Dedicated API module for Square Yards Careers API
const axios = require("axios");

const SQUAREYARDS_BASE_URL = "https://www.squareyards.com/career";

// Active Departments on Square Yards Careers portal
const DEPARTMENTS = ["Sales", "Technology", "Marketing", "CR", "HR", "Interior Company"];

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "sec-ch-ua-platform": '"Windows"',
  "Referer": "https://www.squareyards.com/career",
  "X-Requested-With": "XMLHttpRequest",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  "Accept": "application/json, text/javascript, */*; q=0.01",
  "sec-ch-ua": '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
  "sec-ch-ua-mobile": "?0"
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
function extractExperienceFromText(text = "", positionTitle = "") {
  const combined = `${positionTitle} ${text}`;

  const zeroYears = /\b(?:0\s*\+?\s*years?|no\s+(?:prior\s+)?experience\s+required|freshers?|intern(?:ship)?|entry\s+level|trainee|graduates?)\b/i;
  if (zeroYears.test(combined)) {
    return { minYears: 0, maxYears: 1, experienceRequired: "0-1 years" };
  }

  const rangeMatch = /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i.exec(combined);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    return { minYears: min, maxYears: max, experienceRequired: `${min}-${max} years` };
  }

  const plusMatch = /(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/i.exec(combined);
  if (plusMatch) {
    const min = parseFloat(plusMatch[1]);
    return { minYears: min, maxYears: null, experienceRequired: `${min}+ years` };
  }

  const singleMatch = /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|relevant)/i.exec(combined);
  if (singleMatch) {
    const min = parseFloat(singleMatch[1]);
    return { minYears: min, maxYears: min, experienceRequired: `${min} year${min === 1 ? '' : 's'}` };
  }

  if (/\b(?:senior|lead|manager|head|director|vp)\b/i.test(positionTitle)) {
    return { minYears: 4, maxYears: 99, experienceRequired: "4+ years" };
  }

  return { minYears: 0, maxYears: 99, experienceRequired: "Not specified" };
}

/**
 * Extract salary information from text
 */
function extractSalaryFromText(text = "") {
  if (!text) return "Competitive Package";
  const salaryMatch = /(?:CTC|Salary|Package|INR|LPA|Compensation)\s*(?:offered|range)?\s*:?\s*((?:₹|INR|LPA|\$)?\s*[\d,.]+(?:\s*(?:to|-|lpa)\s*[\d,.]+(?:\s*LPA|\s*Lakhs)?)?)/i.exec(text);
  if (salaryMatch) {
    return salaryMatch[1].trim();
  }
  return "Competitive Package";
}

/**
 * Step 1: Fetch jobs for a specific department from Square Yards API
 * @param {string} department
 * @returns {Promise<Array>}
 */
async function fetchSquareYardsJobsByDept(department = "Sales") {
  const url = `${SQUAREYARDS_BASE_URL}/${encodeURIComponent(department)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (res.status === 429) {
          await delay(1500 * attempt);
          continue;
        }
        if (!res.ok) return [];
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) return [];
        const json = await res.json();
        if (json && json.status === 1 && Array.isArray(json.data)) {
          return json.data;
        }
        return [];
      } else {
        const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 20000 });
        if (res.data && res.data.status === 1 && Array.isArray(res.data.data)) {
          return res.data.data;
        }
        return [];
      }
    } catch (error) {
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[SquareYards API] Error fetching department '${department}':`, error.message);
    }
  }
  return [];
}

/**
 * Step 2: Map raw Square Yards job item to standardized Job format
 * @param {object} item Raw job item from Square Yards API
 * @returns {object|null}
 */
function mapSquareYardsJob(item) {
  if (!item) return null;

  const rawId = item.id || item.jobId;
  if (!rawId) return null;

  const idStr = String(rawId);
  const jobId = item.jobId ? String(item.jobId) : `JD${idStr}`;
  const title = (item.positionName || "Square Yards Opening").trim();
  const department = item.department || "Sales";
  const verticalName = item.verticalName || "Real Estate";
  const location = (item.location || "Not specified").trim();

  // Location parsing
  const locParts = location.split(',').map(s => s.trim()).filter(Boolean);
  const city = locParts.length > 0 ? [locParts[0]] : [];
  const state = locParts.length > 2 ? [locParts[1]] : [];
  const country = locParts.length > 1 ? [locParts[locParts.length - 1]] : ["India"];

  // Form details URL & Apply URL contain ok
  const formattedLoc = encodeURIComponent(location);
  const formattedDept = encodeURIComponent(department);
  const detailsUrl = `https://www.squareyards.com/career_form/${idStr}?location=${formattedLoc}&dept=${formattedDept}`;
  const applyJobUrl = detailsUrl;
  const jobUrl = detailsUrl;

  // Descriptions
  const descriptionHtml = item.description || `<p><strong>${title}</strong></p><p>Department: ${department}</p><p>Location: ${location}</p>`;
  const plainDescription = cleanHtml(descriptionHtml);

  // Experience & Salary
  const expResult = extractExperienceFromText(plainDescription, title);
  const salary = extractSalaryFromText(plainDescription);

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
  if (item.postedOn) {
    const parsed = new Date(item.postedOn);
    if (!isNaN(parsed.getTime())) postedDate = parsed.toISOString();
  }

  // Skills
  const skillsSet = new Set(["Square Yards", "Real Estate", department]);
  if (verticalName) skillsSet.add(verticalName);

  const keywords = [
    "Sales", "Business Development", "Real Estate", "Client Acquisition", "Negotiation",
    "Primary Sales", "NRI Sales", "Inside Sales", "Direct Sales", "Channel Sales",
    "Java", "Python", "React", "Node.js", "PHP", "JavaScript", "SQL", "HTML", "CSS",
    "Digital Marketing", "SEO", "Content Writing", "Customer Relations", "CRM"
  ];

  keywords.forEach(kw => {
    if (new RegExp(`\\b${kw.replace(/\+/g, '\\+')}\\b`, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);

  return {
    source: "SquareYards",
    company: "SquareYards",
    id: idStr,
    jobId: jobId,
    title: title,
    positionName: title,
    openPosition: Number(item.openPosition || 1),
    total: Number(item.total || 1),
    noOfClosePosition: Number(item.noOfClosePosition || 0),
    verticalName: verticalName,
    category: `${department} & Real Estate`,
    department: department,
    businessUnit: "Square Yards",
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
    postedOn: item.postedOn || "",
    role: `${department} Professional`,
    remarks: item.remarks || "",
    status: item.status || "Open",
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 3: Fetch single job details by ID from Square Yards API
 * @param {string|number} jobIdOrId
 * @returns {Promise<object|null>}
 */
async function fetchSquareYardsJobById(jobIdOrId) {
  if (!jobIdOrId) return null;
  const targetId = String(jobIdOrId).replace(/^JD/i, "");
  const allJobs = await fetchAllSquareYardsJobs(null, false);
  return allJobs.find(j => String(j.id) === targetId || String(j.jobId) === String(jobIdOrId)) || null;
}

/**
 * Step 4: Fetch ALL Square Yards jobs across all departments
 * @param {number|object|null} [optionsOrLimit=null]
 * @param {boolean} [fetchDetails=true]
 * @returns {Promise<Array>}
 */
async function fetchAllSquareYardsJobs(optionsOrLimit = null, fetchDetails = true) {
  let maxLimit = null;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  const allRawItems = [];
  const seenIds = new Set();

  try {
    for (const dept of DEPARTMENTS) {
      console.log(`[SquareYards API] Fetching jobs for department '${dept}'...`);
      const deptItems = await fetchSquareYardsJobsByDept(dept);
      for (const item of deptItems) {
        const itemKey = item.id || item.jobId;
        if (itemKey && !seenIds.has(String(itemKey))) {
          seenIds.add(String(itemKey));
          allRawItems.push(item);
        }
      }
      if (maxLimit && allRawItems.length >= maxLimit) break;
      await delay(200);
    }

    let targetItems = allRawItems;
    if (maxLimit && targetItems.length > maxLimit) {
      targetItems = targetItems.slice(0, maxLimit);
    }

    console.log(`[SquareYards API] Processing ${targetItems.length} Square Yards jobs...`);

    const mappedJobs = [];
    for (const item of targetItems) {
      const mapped = mapSquareYardsJob(item);
      if (mapped && mapped.jobId) {
        mappedJobs.push(mapped);
      }
    }

    return mappedJobs;
  } catch (error) {
    console.error("[SquareYards API] Error fetching Square Yards jobs:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Square Yards jobs with MongoDB collection
 * @param {object} SquareYardsJobModel
 * @param {number|object|null} [optionsOrLimit=null]
 * @returns {Promise<object>}
 */
async function syncSquareYardsJobsWithDb(SquareYardsJobModel, optionsOrLimit = null) {
  if (!SquareYardsJobModel) {
    throw new Error("SquareYardsJob model is required for database sync.");
  }

  console.log("[SquareYards Sync] Starting Square Yards jobs DB sync...");
  const fetchedJobs = await fetchAllSquareYardsJobs(optionsOrLimit, true);
  console.log(`[SquareYards Sync] Fetched ${fetchedJobs.length} live jobs from Square Yards API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Square Yards API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await SquareYardsJobModel.find({ source: "SquareYards" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await SquareYardsJobModel.deleteMany({ source: "SquareYards", jobId: { $in: obsoleteIds } });
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
        filter: { source: "SquareYards", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await SquareYardsJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await SquareYardsJobModel.countDocuments({ source: "SquareYards" });

  return {
    success: true,
    message: "Square Yards DB sync completed successfully.",
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
  fetchSquareYardsJobsByDept,
  fetchSquareYardsJobById,
  mapSquareYardsJob,
  fetchAllSquareYardsJobs,
  syncSquareYardsJobsWithDb,
  cleanHtml
};
