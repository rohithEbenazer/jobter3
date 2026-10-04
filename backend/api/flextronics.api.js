// flextronics.api.js - Dedicated API module for Flextronics Careers (Workday CXS API)
const axios = require("axios");

const FLEXTRONICS_JOBS_URL = "https://flextronics.wd1.myworkdayjobs.com/wday/cxs/flextronics/Careers/jobs";
const FLEXTRONICS_BASE_DETAIL_URL = "https://flextronics.wd1.myworkdayjobs.com/wday/cxs/flextronics/Careers";
const FLEXTRONICS_PUBLIC_JOB_BASE = "https://flextronics.wd1.myworkdayjobs.com/en-US/Careers";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json",
  "accept-language": "en-US",
  "content-type": "application/json",
  "origin": "https://flextronics.wd1.myworkdayjobs.com",
  "referer": "https://flextronics.wd1.myworkdayjobs.com/Careers?source=Flex_Career_Site",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
};

/**
 * Step 1: Fetch a page of jobs from Flextronics Workday API
 * @param {number} offset Offset number (0, 20, 40...)
 * @param {number} limit Page size (default 20)
 * @returns {Promise<object|null>} Response object containing jobPostings and total count
 */
async function fetchFlextronicsPage(offset = 0, limit = 20) {
  const payload = {
    appliedFacets: {},
    limit: limit,
    offset: offset,
    searchText: ""
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(FLEXTRONICS_JOBS_URL, {
          method: "POST",
          headers: DEFAULT_HEADERS,
          body: JSON.stringify(payload)
        });
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
        const response = await axios.post(FLEXTRONICS_JOBS_URL, payload, {
          headers: DEFAULT_HEADERS,
          timeout: 15000
        });
        return response.data;
      }
    } catch (error) {
      if (error.response && error.response.status === 404) return null;
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Flextronics API] Error fetching page offset ${offset}:`, error.message);
    }
  }
  return null;
}

/**
 * Fetch detailed job information for a specific job external path
 * @param {string} externalPath e.g. "/job/Israel-Modiin/Systems-Engineer_WD230276"
 * @returns {Promise<object|null>}
 */
async function fetchFlextronicsJobDetails(externalPath) {
  if (!externalPath) return null;
  const pathClean = externalPath.startsWith('/') ? externalPath : `/${externalPath}`;
  const url = `${FLEXTRONICS_BASE_DETAIL_URL}${pathClean}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, {
          headers: {
            "accept": "application/json",
            "user-agent": DEFAULT_HEADERS["user-agent"]
          }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.jobPostingInfo || null;
      } else {
        const res = await axios.get(url, {
          headers: {
            "accept": "application/json",
            "user-agent": DEFAULT_HEADERS["user-agent"]
          },
          timeout: 10000
        });
        return res.data?.jobPostingInfo || null;
      }
    } catch (err) {
      if (attempt < 2) await delay(300);
    }
  }
  return null;
}

/**
 * Clean HTML markup into standard readable text
 */
function cleanHtml(htmlStr) {
  if (!htmlStr) return "";
  return htmlStr
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

/**
 * Extract minimum and maximum years of experience from description text
 */
function extractExperienceFromText(text) {
  if (!text) return { minYears: 0, maxYears: 99, expString: "Not specified" };

  const matches = [];
  const rangeRegex = /(\d+)\s*(?:-|to)\s*(\d+)\s*(?:\+)?\s*years?/gi;
  let match;
  while ((match = rangeRegex.exec(text)) !== null) {
    matches.push({ min: parseInt(match[1]), max: parseInt(match[2]), str: match[0] });
  }

  const singleRegex = /(?:at least|minimum of|min|req|requires)\s*(\d+)\s*(?:\+)?\s*years?/gi;
  while ((match = singleRegex.exec(text)) !== null) {
    matches.push({ min: parseInt(match[1]), max: parseInt(match[1]) + 3, str: match[0] });
  }

  if (matches.length > 0) {
    const minVal = Math.min(...matches.map(m => m.min));
    const maxVal = Math.max(...matches.map(m => m.max));
    return {
      minYears: minVal,
      maxYears: maxVal,
      expString: `${minVal} - ${maxVal} years`
    };
  }

  if (/freshers?|entry level|intern|graduate/i.test(text)) {
    return { minYears: 0, maxYears: 1, expString: "0 - 1 years (Entry Level)" };
  }

  return { minYears: 0, maxYears: 99, expString: "Not specified" };
}

/**
 * Extract salary information from description text if available
 */
function extractSalaryInfo(textBlob) {
  if (!textBlob) return "Competitive Package";
  const salMatch = /(?:USD|\$)\s*([\d,]+)\s*(?:-|to)\s*(?:USD|\$)?\s*([\d,]+)\s*(?:per\s+year|\/yr|annually)/i.exec(textBlob);
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
 * Map Flextronics job raw list item + optional details into standardized Job format
 * @param {object} rawItem Raw job item from jobPostings
 * @param {object|null} [detailItem=null] Detailed job posting info if fetched
 * @returns {object|null} Standardized JSON format of job
 */
function mapFlextronicsJobs(rawItem, detailItem = null) {
  if (!rawItem) return null;

  // Extract Job ID
  let jobId = detailItem?.jobReqId || detailItem?.id;
  if (!jobId && Array.isArray(rawItem.bulletFields)) {
    jobId = rawItem.bulletFields.find(f => /^WD\d+$/i.test(f) || /^R\d+$/i.test(f) || /^JR\d+$/i.test(f) || /^[A-Z0-9_-]+$/i.test(f));
  }
  if (!jobId && rawItem.externalPath) {
    const match = /_([A-Z0-9]+)$/i.exec(rawItem.externalPath);
    if (match) jobId = match[1];
  }
  if (!jobId) {
    jobId = String(rawItem.title || 'flextronics-job').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
  }

  const title = detailItem?.title || rawItem.title || "Flextronics Opening";
  const externalPath = rawItem.externalPath || '';
  const pathClean = externalPath.startsWith('/') ? externalPath : `/${externalPath}`;
  const fullUrl = detailItem?.externalUrl || (externalPath ? `${FLEXTRONICS_PUBLIC_JOB_BASE}${pathClean}` : "https://flextronics.wd1.myworkdayjobs.com/Careers");

  const location = detailItem?.location || rawItem.locationsText || "Not specified";
  const locParts = location.split(',').map(s => s.trim());

  let country = [];
  let state = [];
  let city = [];

  if (locParts.length >= 3) {
    country = [locParts[0]];
    state = [locParts[1]];
    city = [locParts[2]];
  } else if (locParts.length === 2) {
    country = [locParts[0]];
    city = [locParts[1]];
  } else if (locParts.length === 1 && locParts[0]) {
    city = [locParts[0]];
  }

  const descRaw = detailItem?.jobDescription || '';
  const textBlob = `${title} ${location} ${descRaw}`.toLowerCase();

  let workmode = "On-site";
  if (textBlob.includes("remote") || textBlob.includes("virtual") || textBlob.includes("work from home") || textBlob.includes("wfh")) {
    workmode = "Remote";
  } else if (textBlob.includes("hybrid") || textBlob.includes("flexible")) {
    workmode = "Hybrid";
  }

  let postedDate = new Date().toISOString();
  if (detailItem?.startDate) {
    const d = new Date(detailItem.startDate);
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  } else if (rawItem.postedOn) {
    postedDate = rawItem.postedOn;
  }

  const plainDescription = cleanHtml(descRaw || `${title} - ${location}`);
  const rawHtml = descRaw || `<p><strong>${title}</strong></p><p>Location: ${location}</p>`;
  const expResult = extractExperienceFromText(plainDescription);

  const category = detailItem?.timeType || 'Electronics Manufacturing & Supply Chain';
  const department = 'Engineering & Technology';

  const skillsSet = new Set();
  skillsSet.add("Flextronics");
  skillsSet.add("Flex");
  skillsSet.add("Electronics Manufacturing");
  skillsSet.add("Supply Chain");

  const techKeywords = [
    "C++", "C#", "Python", "Java", "Embedded", "Firmware", "PLC", "Hardware",
    "PCB", "CAD", "Automation", "Quality", "Testing", "Linux", "Cloud",
    "DevOps", "ASIC", "Manufacturing", "Supply Chain", "SAP", "ERP", "IoT",
    "Robotics", "AI", "Machine Learning"
  ];

  techKeywords.forEach(kw => {
    let regexStr = kw === "C++" || kw === "C#" ? kw.replace(/\+/g, '\\+') : `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription || title)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);
  const salary = extractSalaryInfo(plainDescription);

  return {
    source: "Flextronics",
    company: "Flextronics",
    id: jobId,
    jobId: jobId,
    displayJobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "Flex Ltd.",
    location: location,
    city: city,
    state: state,
    country: country,
    url: fullUrl,
    jobUrl: fullUrl,
    applyJobUrl: fullUrl,
    detailsUrl: fullUrl,
    workmode: workmode,
    postingDate: postedDate,
    postedDate: postedDate,
    descriptionHtml: rawHtml,
    description: plainDescription,
    basicQualifications: plainDescription,
    preferredQualifications: "",
    experienceRequired: expResult.expString,
    yrsOfExperience: expResult.expString,
    minYears: expResult.minYears,
    maxYears: expResult.maxYears,
    minYrsOfExperience: expResult.minYears,
    maxYrsOfExperience: expResult.maxYears,
    skills: skills,
    mandateSkills: skills,
    role: title,
    qualifications: expResult.expString,
    applyBy: "Until Filled",
    salary: salary,
    shift: "Day Shift",
    updatedAt: new Date()
  };
}

/**
 * Fetch all Flextronics jobs across pages from Workday CXS API
 * @param {object} options Options like maxJobs, fetchDetails
 * @returns {Promise<Array<object>>}
 */
async function fetchAllFlextronicsJobs(options = {}) {
  const maxJobs = options.maxJobs || 200;
  const fetchDetails = options.fetchDetails !== false;

  console.log(`[Flextronics API] Starting job fetch (maxJobs: ${maxJobs}, fetchDetails: ${fetchDetails})...`);

  const initialRes = await fetchFlextronicsPage(0, 20);
  if (!initialRes || !Array.isArray(initialRes.jobPostings)) {
    console.error("[Flextronics API] Failed to fetch initial page.");
    return [];
  }

  const totalAvailable = initialRes.total || initialRes.jobPostings.length;
  console.log(`[Flextronics API] Total available jobs on Flextronics Workday: ${totalAvailable}`);

  let allRawItems = [...initialRes.jobPostings];
  const targetCount = Math.min(totalAvailable, maxJobs);

  let offset = 20;
  while (allRawItems.length < targetCount && offset < totalAvailable) {
    const limit = Math.min(20, targetCount - allRawItems.length);
    const pageRes = await fetchFlextronicsPage(offset, limit);
    if (!pageRes || !Array.isArray(pageRes.jobPostings) || pageRes.jobPostings.length === 0) {
      break;
    }
    allRawItems.push(...pageRes.jobPostings);
    offset += pageRes.jobPostings.length;
    await delay(200);
  }

  console.log(`[Flextronics API] Fetched ${allRawItems.length} raw job postings.`);

  // Map to standardized format
  const mappedJobs = [];
  const chunkSize = fetchDetails ? 5 : 20;

  for (let i = 0; i < allRawItems.length; i += chunkSize) {
    const chunk = allRawItems.slice(i, i + chunkSize);
    const mappedChunk = await Promise.all(
      chunk.map(async (item) => {
        let detail = null;
        if (fetchDetails && item.externalPath) {
          detail = await fetchFlextronicsJobDetails(item.externalPath);
        }
        return mapFlextronicsJobs(item, detail);
      })
    );
    mappedJobs.push(...mappedChunk.filter(Boolean));
    if (fetchDetails && i + chunkSize < allRawItems.length) {
      await delay(150);
    }
  }

  console.log(`[Flextronics API] Successfully processed ${mappedJobs.length} Flextronics jobs.`);
  return mappedJobs;
}

/**
 * Fetch a single Flextronics job details by external path or ID
 * @param {string} pathOrId
 * @returns {Promise<object|null>}
 */
async function fetchFlextronicsJobById(pathOrId) {
  if (!pathOrId) return null;
  const path = pathOrId.startsWith('/job/') ? pathOrId : `/job/${pathOrId}`;
  const detail = await fetchFlextronicsJobDetails(path);
  if (!detail) return null;
  return mapFlextronicsJobs({ externalPath: path }, detail);
}

/**
 * Sync Flextronics jobs from API into MongoDB database collections
 * @param {object} options
 * @returns {Promise<object>} Sync stats
 */
async function syncFlextronicsJobsWithDb(options = {}) {
  const { connectDB, CogforceJob } = require("../Db/cogforcedb");
  const { FlextronicsJob } = require("../Db/flextronicsdb");

  await connectDB();

  const maxJobs = options.maxJobs || 150;
  const liveJobs = await fetchAllFlextronicsJobs({ maxJobs, fetchDetails: true });

  if (!liveJobs || liveJobs.length === 0) {
    return {
      success: false,
      message: "No Flextronics jobs fetched from Workday API",
      stats: { totalFetchedRaw: 0, insertedToDb: 0, updatedOrKeptInDb: 0, finalDbCount: 0 }
    };
  }

  let insertedCount = 0;
  let updatedCount = 0;

  for (const job of liveJobs) {
    try {
      // Upsert into FlextronicsJob model
      if (FlextronicsJob) {
        const resDedicated = await FlextronicsJob.updateOne(
          { jobId: job.jobId },
          { $set: job },
          { upsert: true }
        );
        if (resDedicated.upsertedCount > 0) insertedCount++;
        else updatedCount++;
      }

      // Also sync into unified CogforceJob model if present
      if (CogforceJob) {
        await CogforceJob.updateOne(
          { source: "Flextronics", jobId: job.jobId },
          { $set: job },
          { upsert: true }
        );
      }
    } catch (err) {
      console.warn(`[Flextronics Sync] Error saving job ${job.jobId}:`, err.message);
    }
  }

  const finalDbCount = FlextronicsJob ? await FlextronicsJob.countDocuments({ source: "Flextronics" }) : 0;

  return {
    success: true,
    message: `Successfully synced ${liveJobs.length} Flextronics jobs into MongoDB!`,
    stats: {
      totalFetchedRaw: liveJobs.length,
      insertedToDb: insertedCount,
      updatedOrKeptInDb: updatedCount,
      finalDbCount: finalDbCount
    }
  };
}

module.exports = {
  fetchFlextronicsPage,
  fetchFlextronicsJobDetails,
  mapFlextronicsJobs,
  fetchAllFlextronicsJobs,
  fetchFlextronicsJobById,
  syncFlextronicsJobsWithDb
};
