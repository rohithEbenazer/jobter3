// synchrony.api.js - Dedicated API module for Synchrony Financial Careers (Workday CXS API)
const axios = require("axios");

const SYNCHRONY_JOBS_URL = "https://synchronyfinancial.wd5.myworkdayjobs.com/wday/cxs/synchronyfinancial/careers/jobs";
const SYNCHRONY_BASE_DETAIL_URL = "https://synchronyfinancial.wd5.myworkdayjobs.com/wday/cxs/synchronyfinancial/careers";
const SYNCHRONY_PUBLIC_JOB_BASE = "https://synchronyfinancial.wd5.myworkdayjobs.com/en-US/careers";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json",
  "accept-language": "en-US",
  "content-type": "application/json",
  "origin": "https://synchronyfinancial.wd5.myworkdayjobs.com",
  "referer": "https://synchronyfinancial.wd5.myworkdayjobs.com/en-US/careers",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
};

/**
 * Step 1: Fetch a page of jobs from Synchrony Financial Workday API
 * @param {number} offset Offset number (0, 20, 40...)
 * @param {number} limit Page size (default 20)
 * @returns {Promise<object|null>} Response object containing jobPostings and total count
 */
async function fetchSynchronyPage(offset = 0, limit = 20) {
  const payload = {
    appliedFacets: {},
    limit: limit,
    offset: offset,
    searchText: ""
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(SYNCHRONY_JOBS_URL, {
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
        const response = await axios.post(SYNCHRONY_JOBS_URL, payload, {
          headers: DEFAULT_HEADERS,
          timeout: 15000
        });
        return response.data;
      }
    } catch (error) {
      if (error.response && error.response.status === 404) return null;
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Synchrony API] Error fetching page offset ${offset}:`, error.message);
    }
  }
  return null;
}

/**
 * Fetch detailed job information for a specific job external path
 * @param {string} externalPath e.g. "/job/Atlanta-Hub/VP--Senior-Cloud-Data-Architecture---Migration-Leader_2602763"
 * @returns {Promise<object|null>}
 */
async function fetchSynchronyJobDetails(externalPath) {
  if (!externalPath) return null;
  const pathClean = externalPath.startsWith('/') ? externalPath : `/${externalPath}`;
  const url = `${SYNCHRONY_BASE_DETAIL_URL}${pathClean}`;

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
 * Map Synchrony raw list item + optional details into standardized Job format
 * @param {object} rawItem Raw job item from jobPostings
 * @param {object|null} [detailItem=null] Detailed job posting info if fetched
 * @returns {object|null} Standardized JSON format of job
 */
function mapSynchronyJobs(rawItem, detailItem = null) {
  if (!rawItem) return null;

  // Extract Job ID
  let jobId = detailItem?.jobReqId || detailItem?.id;
  if (!jobId && Array.isArray(rawItem.bulletFields)) {
    jobId = rawItem.bulletFields.find(f => /^\d+$/i.test(f) || /^WD\d+$/i.test(f) || /^R\d+$/i.test(f) || /^[A-Z0-9_-]+$/i.test(f));
  }
  if (!jobId && rawItem.externalPath) {
    const match = /_([A-Z0-9]+)$/i.exec(rawItem.externalPath);
    if (match) jobId = match[1];
  }
  if (!jobId) {
    jobId = String(rawItem.title || 'synchrony-job').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
  }

  const title = detailItem?.title || rawItem.title || "Synchrony Financial Opening";
  const externalPath = rawItem.externalPath || '';
  const pathClean = externalPath.startsWith('/') ? externalPath : `/${externalPath}`;
  const fullUrl = detailItem?.externalUrl || (externalPath ? `${SYNCHRONY_PUBLIC_JOB_BASE}${pathClean}` : "https://synchronyfinancial.wd5.myworkdayjobs.com/en-US/careers");

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

  const category = detailItem?.timeType || 'Financial Services & Technology';
  const department = 'Technology & Digital';

  const skillsSet = new Set();
  skillsSet.add("Synchrony Financial");
  skillsSet.add("Synchrony");
  skillsSet.add("Fintech");
  skillsSet.add("Banking & Financial Services");

  const techKeywords = [
    "AWS", "Cloud", "Architecture", "Migration", "Java", "Python", "React", "Node.js",
    "SQL", "NoSQL", "Snowflake", "Spark", "Hadoop", "Kubernetes", "Docker", "DevOps",
    "Cybersecurity", "Risk Management", "Data Engineering", "Machine Learning", "AI"
  ];

  techKeywords.forEach(kw => {
    let regexStr = `\\b${kw}\\b`;
    if (new RegExp(regexStr, 'i').test(plainDescription || title)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);
  const salary = extractSalaryInfo(plainDescription);

  return {
    source: "Synchrony Financial",
    company: "Synchrony Financial",
    id: jobId,
    jobId: jobId,
    displayJobId: jobId,
    title: title,
    category: category,
    department: department,
    businessUnit: "Synchrony Financial",
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
 * Fetch all Synchrony Financial jobs across pages from Workday CXS API
 * @param {object} options Options like maxJobs, fetchDetails
 * @returns {Promise<Array<object>>}
 */
async function fetchAllSynchronyJobs(options = {}) {
  const maxJobs = options.maxJobs || 200;
  const fetchDetails = options.fetchDetails !== false;

  console.log(`[Synchrony API] Starting job fetch (maxJobs: ${maxJobs}, fetchDetails: ${fetchDetails})...`);

  const initialRes = await fetchSynchronyPage(0, 20);
  if (!initialRes || !Array.isArray(initialRes.jobPostings)) {
    console.error("[Synchrony API] Failed to fetch initial page.");
    return [];
  }

  const totalAvailable = initialRes.total || initialRes.jobPostings.length;
  console.log(`[Synchrony API] Total available jobs on Synchrony Workday: ${totalAvailable}`);

  let allRawItems = [...initialRes.jobPostings];
  const targetCount = Math.min(totalAvailable, maxJobs);

  let offset = 20;
  while (allRawItems.length < targetCount && offset < totalAvailable) {
    const limit = Math.min(20, targetCount - allRawItems.length);
    const pageRes = await fetchSynchronyPage(offset, limit);
    if (!pageRes || !Array.isArray(pageRes.jobPostings) || pageRes.jobPostings.length === 0) {
      break;
    }
    allRawItems.push(...pageRes.jobPostings);
    offset += pageRes.jobPostings.length;
    await delay(200);
  }

  console.log(`[Synchrony API] Fetched ${allRawItems.length} raw job postings.`);

  // Map to standardized format
  const mappedJobs = [];
  const chunkSize = fetchDetails ? 5 : 20;

  for (let i = 0; i < allRawItems.length; i += chunkSize) {
    const chunk = allRawItems.slice(i, i + chunkSize);
    const mappedChunk = await Promise.all(
      chunk.map(async (item) => {
        let detail = null;
        if (fetchDetails && item.externalPath) {
          detail = await fetchSynchronyJobDetails(item.externalPath);
        }
        return mapSynchronyJobs(item, detail);
      })
    );
    mappedJobs.push(...mappedChunk.filter(Boolean));
    if (fetchDetails && i + chunkSize < allRawItems.length) {
      await delay(150);
    }
  }

  console.log(`[Synchrony API] Successfully processed ${mappedJobs.length} Synchrony jobs.`);
  return mappedJobs;
}

/**
 * Fetch a single Synchrony job details by external path or ID
 * @param {string} pathOrId
 * @returns {Promise<object|null>}
 */
async function fetchSynchronyJobById(pathOrId) {
  if (!pathOrId) return null;
  const path = pathOrId.startsWith('/job/') ? pathOrId : `/job/${pathOrId}`;
  const detail = await fetchSynchronyJobDetails(path);
  if (!detail) return null;
  return mapSynchronyJobs({ externalPath: path }, detail);
}

/**
 * Sync Synchrony jobs from API into MongoDB database collections
 * @param {object} options
 * @returns {Promise<object>} Sync stats
 */
async function syncSynchronyJobsWithDb(options = {}) {
  const { connectDB, CogforceJob } = require("../Db/cogforcedb");
  const { SynchronyJob } = require("../Db/synchronydb");

  await connectDB();

  const maxJobs = options.maxJobs || 150;
  const liveJobs = await fetchAllSynchronyJobs({ maxJobs, fetchDetails: true });

  if (!liveJobs || liveJobs.length === 0) {
    return {
      success: false,
      message: "No Synchrony Financial jobs fetched from Workday API",
      stats: { totalFetchedRaw: 0, insertedToDb: 0, updatedOrKeptInDb: 0, finalDbCount: 0 }
    };
  }

  let insertedCount = 0;
  let updatedCount = 0;

  for (const job of liveJobs) {
    try {
      // Upsert into SynchronyJob model
      if (SynchronyJob) {
        const resDedicated = await SynchronyJob.updateOne(
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
          { source: "Synchrony Financial", jobId: job.jobId },
          { $set: job },
          { upsert: true }
        );
      }
    } catch (err) {
      console.warn(`[Synchrony Sync] Error saving job ${job.jobId}:`, err.message);
    }
  }

  const finalDbCount = SynchronyJob ? await SynchronyJob.countDocuments({ source: "Synchrony Financial" }) : 0;

  return {
    success: true,
    message: `Successfully synced ${liveJobs.length} Synchrony Financial jobs into MongoDB!`,
    stats: {
      totalFetchedRaw: liveJobs.length,
      insertedToDb: insertedCount,
      updatedOrKeptInDb: updatedCount,
      finalDbCount: finalDbCount
    }
  };
}

module.exports = {
  fetchSynchronyPage,
  fetchSynchronyJobDetails,
  mapSynchronyJobs,
  fetchAllSynchronyJobs,
  fetchSynchronyJobById,
  syncSynchronyJobsWithDb
};
