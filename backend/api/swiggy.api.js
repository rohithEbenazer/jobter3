// swiggy.api.js - Dedicated API module for Swiggy Careers (mynexthire REST API)
const axios = require("axios");

const SWIGGY_API_URL = "https://swiggy.mynexthire.com/employer/careers/reqlist/get";

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "content-type": "application/json",
  "origin": "https://careers.swiggy.com",
  "referer": "https://careers.swiggy.com/",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
};

/**
 * Clean HTML / Text formatting
 */
function cleanText(text = "") {
  if (!text) return "";
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Extract salary information from text if present
 */
function extractSalaryFromText(text = "") {
  if (!text) return "Competitive Package";
  const salaryMatch = /(?:Salary|CTC|Compensation|Package)\s*(?:Range|Band)?\s*(?:is|:)?\s*((?:₹|INR|Rs\.?)\s*[\d,.]+\s*(?:L|LPA|Lakhs?|k)?\s*(?:-|to)\s*(?:₹|INR|Rs\.?)?\s*[\d,.]+\s*(?:L|LPA|Lakhs?|k)?)/i.exec(text);
  if (salaryMatch) {
    return salaryMatch[1].trim();
  }
  return "Competitive Package";
}

/**
 * Step 1: Fetch raw job requisitions list from Swiggy API
 * @returns {Promise<Array>} Raw reqDetailsBOList array
 */
async function fetchSwiggyRawJobs() {
  const payload = { source: "careers", code: "", filterByBuId: -1 };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(SWIGGY_API_URL, {
          method: "POST",
          headers: DEFAULT_HEADERS,
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          if (res.status === 429) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
            continue;
          }
          return [];
        }
        const data = await res.json();
        return data?.reqDetailsBOList || [];
      } else {
        const res = await axios.post(SWIGGY_API_URL, payload, { headers: DEFAULT_HEADERS, timeout: 20000 });
        return res.data?.reqDetailsBOList || [];
      }
    } catch (err) {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      } else {
        console.warn(`[Swiggy API] Error fetching raw jobs list:`, err.message);
      }
    }
  }
  return [];
}

/**
 * Step 2: Map raw Swiggy job item to standardized Job schema
 * @param {object} item Raw job requisition object
 * @returns {object|null} Standardized Job object
 */
function mapSwiggyJob(item) {
  if (!item || !item.reqId) return null;

  const jobId = String(item.reqId);
  const title = item.reqTitle || item.designation || "Swiggy Opening";
  const category = item.buName || item.careerStream || "Food & Delivery Marketplace";
  const department = item.careerStream || item.buName || category;

  const rawLoc = item.location || item.locationAddress || "India";
  const locParts = rawLoc.split(',').map(s => s.trim()).filter(Boolean);
  const city = locParts.length > 0 ? [locParts[0]] : [rawLoc];
  const state = locParts.length > 2 ? [locParts[1]] : [];
  const country = locParts.length > 1 ? [locParts[locParts.length - 1]] : ["India"];

  const jobUrl = `https://careers.swiggy.com/#/careers/job/${jobId}`;
  const rawJd = item.jdDisplay || "";
  const plainDescription = cleanText(rawJd);

  // Experience
  const minYears = Number(item.expMin) || 0;
  const maxYears = Number(item.expMax) || (minYears + 2);
  const expRequired = item.fresher ? "0-1 years" : `${minYears}-${maxYears} years`;

  // Workmode
  let workmode = "On-site";
  const textBlob = `${title} ${rawLoc} ${plainDescription}`.toLowerCase();
  if (textBlob.includes("remote") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  // Skills
  const skillsSet = new Set(["Swiggy", "Hyperlocal", "Quick Commerce"]);
  if (category) skillsSet.add(category);
  if (item.careerStream) skillsSet.add(item.careerStream);

  const techKeywords = [
    "Sales", "Business Development", "Account Management", "Key Accounts",
    "Java", "Python", "React", "Node.js", "Golang", "Kubernetes", "AWS",
    "SQL", "Analytics", "Product Management", "Supply Chain", "Logistics",
    "Operations", "Marketing", "Growth", "Customer Support", "Data Science"
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
  if (item.approvedOn) {
    const d = new Date(item.approvedOn);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }

  return {
    source: "Swiggy",
    company: "Swiggy",
    id: jobId,
    jobId: jobId,
    displayJobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: item.buName || "Swiggy",
    location: rawLoc,
    city: Array.from(new Set(city)),
    state: Array.from(new Set(state)),
    country: Array.from(new Set(country)),
    minYears: minYears,
    maxYears: maxYears,
    minYrsOfExperience: minYears,
    maxYrsOfExperience: maxYears,
    yrsOfExperience: expRequired,
    experienceRequired: expRequired,
    workmode: workmode,
    jobUrl: jobUrl,
    url: jobUrl,
    applyJobUrl: jobUrl,
    detailsUrl: jobUrl,
    skills: skills,
    salary: salary,
    shift: "Day Shift",
    description: plainDescription || title,
    descriptionHtml: rawJd ? `<div style="white-space: pre-wrap;">${rawJd}</div>` : `<p>${title}</p>`,
    basicQualifications: plainDescription.slice(0, 400),
    preferredQualifications: "",
    postedDate: postedDate,
    postingDate: postedDate,
    role: item.designation || category,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null
  };
}

/**
 * Step 3: Fetch all Swiggy jobs mapped to standard schema
 * @param {number|object|null} [optionsOrLimit=null]
 * @returns {Promise<Array>}
 */
async function fetchAllSwiggyJobs(optionsOrLimit = null) {
  let maxLimit = 100;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || maxLimit;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  try {
    const rawItems = await fetchSwiggyRawJobs();
    console.log(`[Swiggy API] Raw items fetched: ${rawItems.length}`);

    let itemsToProcess = rawItems;
    if (maxLimit && itemsToProcess.length > maxLimit) {
      itemsToProcess = itemsToProcess.slice(0, maxLimit);
    }

    const mappedJobs = itemsToProcess.map(mapSwiggyJob).filter(Boolean);
    console.log(`[Swiggy API] Successfully mapped ${mappedJobs.length} jobs.`);
    return mappedJobs;
  } catch (err) {
    console.error(`[Swiggy API] Error in fetchAllSwiggyJobs:`, err.message);
    return [];
  }
}

/**
 * Step 4: Sync Swiggy jobs into MongoDB collection
 * @param {object} SwiggyJobModel Mongoose Model for Swiggy jobs
 * @param {number|null} maxLimit Optional limit
 * @returns {Promise<object>} Sync result summary
 */
async function syncSwiggyJobsWithDb(SwiggyJobModel, maxLimit = null) {
  const startTime = Date.now();
  const limitToUse = maxLimit || 200;
  console.log(`[Swiggy DB Sync] Starting live fetch & MongoDB sync... (Limit: ${limitToUse})`);

  const liveJobs = await fetchAllSwiggyJobs({ maxJobs: limitToUse });
  if (!liveJobs || liveJobs.length === 0) {
    return {
      success: false,
      message: "No live jobs fetched from Swiggy API.",
      stats: { insertedToDb: 0, updatedOrKeptInDb: 0, totalFetchedRaw: 0, finalDbCount: 0 }
    };
  }

  let insertedToDb = 0;
  let updatedOrKeptInDb = 0;

  for (const jobData of liveJobs) {
    try {
      const existing = await SwiggyJobModel.findOne({ jobId: jobData.jobId });
      if (existing) {
        await SwiggyJobModel.updateOne({ jobId: jobData.jobId }, { $set: jobData });
        updatedOrKeptInDb++;
      } else {
        await SwiggyJobModel.create(jobData);
        insertedToDb++;
      }
    } catch (err) {
      console.warn(`[Swiggy DB Sync] Error upserting job ${jobData.jobId}:`, err.message);
    }
  }

  const finalDbCount = await SwiggyJobModel.countDocuments({ source: "Swiggy" });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  return {
    success: true,
    message: `Swiggy DB Sync completed in ${duration}s`,
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
  fetchSwiggyRawJobs,
  mapSwiggyJob,
  fetchAllSwiggyJobs,
  syncSwiggyJobsWithDb
};
