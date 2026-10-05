// walmart.api.js - Dedicated API module for Walmart Careers (GraphQL & NEXT_DATA SSR API)
const axios = require("axios");

const WALMART_GRAPHQL_URL = "https://careers.walmart.com/api/graphql";
const WALMART_PUBLIC_BASE = "https://careers.walmart.com/us/en/jobs";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "*/*",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/json",
  "origin": "https://careers.walmart.com",
  "referer": "https://careers.walmart.com/us/en/results?searchQuery=All&careerareas=Technology",
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
 * Extract experience requirements from text
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
 * Extract technical skills from job title and description
 */
function extractSkills(title = "", description = "") {
  const commonSkills = [
    "Java", "Python", "C++", "C#", "JavaScript", "TypeScript", "React", "Angular", "Vue",
    "Node.js", "Express", "Spring Boot", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Oracle",
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "DevOps", "CI/CD", "Git", "Linux",
    "Microservices", "REST API", "GraphQL", "Machine Learning", "AI", "Kafka", "Hadoop", "Spark"
  ];
  
  const text = `${title} ${description}`.toLowerCase();
  const foundSkills = [];

  for (const skill of commonSkills) {
    const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
    if (pattern.test(text)) {
      foundSkills.push(skill);
    }
  }

  return [...new Set(foundSkills)];
}

/**
 * Fetch a page of Walmart jobs using Walmart's GraphQL Chat Assistant API
 */
async function fetchWalmartJobsPage({ page = 0, searchText = "All jobs in Technology" } = {}) {
  const payload = {
    queryId: "b0467c1f-f578-4261-9280-0ea4614f251c",
    variables: {
      chatRequest: {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: searchText
              }
            ]
          }
        ],
        thread_id: `S-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        channel: "job_search",
        context: {
          job_search_context: {
            locale: "en_US",
            sort: "relevance",
            active_tab: "jobs",
            management_levels: [],
            content_page: 0,
            future_roles_page: 0,
            job_page: page
          }
        }
      }
    },
    headers: {}
  };

  try {
    const response = await axios.post(WALMART_GRAPHQL_URL, payload, {
      headers: DEFAULT_HEADERS,
      timeout: 15000
    });

    const toolMsg = response.data?.data?.jobSearchAssistant?.tool_messages?.[0];
    const artifact = toolMsg?.artifact || {};
    const jobs = artifact.jobs || [];
    const totalJobs = artifact.total_jobs || jobs.length;

    return {
      jobs,
      totalJobs,
      page,
      hasMore: jobs.length > 0 && (page + 1) * 10 < totalJobs
    };
  } catch (error) {
    console.error(`[Walmart API] Error fetching jobs page ${page}:`, error.message);
    throw error;
  }
}

/**
 * Fetch detailed job info for a single Walmart job ID
 */
async function fetchWalmartJobById(jobId) {
  const cleanId = String(jobId || "").trim();
  if (!cleanId) return null;

  try {
    const url = `${WALMART_PUBLIC_BASE}/${cleanId}`;
    const response = await axios.get(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
      },
      timeout: 10000
    });

    const html = response.data;
    const idx = html.indexOf("__NEXT_DATA__");
    if (idx !== -1) {
      const start = html.indexOf(">", idx) + 1;
      const end = html.indexOf("</script>", start);
      if (start > 0 && end > start) {
        const json = JSON.parse(html.slice(start, end));
        const jobDetails = json.props?.pageProps?.jobDetails;
        if (jobDetails) {
          return jobDetails;
        }
      }
    }
  } catch (err) {
    // Fall back silently
  }

  // Fallback to GraphQL bulk detail query
  try {
    const response = await axios.post(WALMART_GRAPHQL_URL, {
      queryId: "1805b682-d541-4ea2-9288-d9377a9cfb56",
      variables: {
        jobIds: cleanId,
        languageCode: "101",
        isExternal: true
      }
    }, {
      headers: DEFAULT_HEADERS,
      timeout: 10000
    });

    const detailsArr = response.data?.data?.bulkUnifiedJobDetails || [];
    return detailsArr[0] || null;
  } catch (error) {
    console.warn(`[Walmart API] Could not fetch details for req ${cleanId}: ${error.message}`);
    return null;
  }
}

/**
 * Map raw Walmart job item & detail data to standard job schema format
 */
function normalizeWalmartJob(rawItem, detailItem = null) {
  const jobId = String(rawItem.job_id || rawItem.jobId || detailItem?.jobId || "").trim();
  const title = rawItem.title || rawItem.jobPostingTitle || detailItem?.title || detailItem?.jobPostingTitle || "Walmart Opening";

  const city = rawItem.city || detailItem?.primaryLocation?.city || "";
  const state = rawItem.state || detailItem?.primaryLocation?.stateCode || "";
  const country = rawItem.country || detailItem?.primaryLocation?.countryCode || "US";

  let locationStr = "Not specified";
  const locParts = [city, state, country].filter(Boolean);
  if (locParts.length > 0) {
    locationStr = locParts.join(", ");
  }

  const categoryArr = rawItem.categories || [];
  const category = categoryArr[0] || rawItem.areas?.[0] || "Software Engineering & Technology";

  // Workmode & employment
  let workmode = "On-site";
  const empTypes = rawItem.employmentTypes || [];
  if (title.toLowerCase().includes("remote") || locationStr.toLowerCase().includes("remote")) {
    workmode = "Remote";
  } else if (title.toLowerCase().includes("hybrid")) {
    workmode = "Hybrid";
  }

  let postingDate = new Date().toISOString().split("T")[0];
  if (rawItem.jobPostingStartDate) {
    try {
      postingDate = new Date(rawItem.jobPostingStartDate).toISOString().split("T")[0];
    } catch (e) {}
  }

  const rawDescription = detailItem?.description || `<p>${title} at Walmart Global Tech (${locationStr})</p>`;
  const cleanDescription = cleanHtml(rawDescription) || title;

  const expInfo = extractExperienceFromText(cleanDescription);
  const skills = extractSkills(title, cleanDescription);

  // Salary format
  let salaryStr = "Competitive Package";
  const minPay = rawItem.minPay || detailItem?.payRange?.[0]?.min;
  const maxPay = rawItem.maxPay || detailItem?.payRange?.[0]?.max;
  const payFreq = rawItem.payFrequency || detailItem?.payFrequency || "Annual";

  if (minPay && maxPay) {
    salaryStr = `$${Number(minPay).toLocaleString()} - $${Number(maxPay).toLocaleString()} (${payFreq})`;
  } else if (minPay) {
    salaryStr = `$${Number(minPay).toLocaleString()}+ (${payFreq})`;
  }

  const publicUrl = `${WALMART_PUBLIC_BASE}/${jobId}`;

  return {
    source: "Walmart",
    company: "Walmart",
    jobId: jobId,
    id: jobId,
    displayJobId: jobId,
    title: title,
    category: category,
    department: "Global Tech & eCommerce",
    businessUnit: rawItem.brand || "Walmart Inc.",
    location: locationStr,
    city: city ? [city] : [],
    state: state ? [state] : [],
    country: country ? [country] : ["US"],
    url: publicUrl,
    jobUrl: publicUrl,
    applyJobUrl: publicUrl,
    detailsUrl: publicUrl,
    workmode: workmode,
    postingDate: postingDate,
    postedDate: postingDate,
    descriptionHtml: rawDescription,
    description: cleanDescription,
    basicQualifications: cleanDescription.slice(0, 500),
    preferredQualifications: "",
    experienceRequired: expInfo.experienceRequired,
    yrsOfExperience: expInfo.experienceRequired,
    minYears: expInfo.minYears || 0,
    maxYears: expInfo.maxYears || 99,
    minYrsOfExperience: expInfo.minYears || 0,
    maxYrsOfExperience: expInfo.maxYears || 99,
    skills: skills,
    mandateSkills: skills.length > 0 ? skills.join(", ") : null,
    role: title,
    qualifications: cleanDescription.slice(0, 500),
    applyBy: "",
    salary: salaryStr,
    minPay: minPay ? Number(minPay) : 0,
    maxPay: maxPay ? Number(maxPay) : 0,
    payFrequency: payFreq,
    shift: rawItem.shifts?.[0] || "Day Shift",
    updatedAt: new Date()
  };
}

/**
 * Fetch all available Walmart jobs up to maxJobs
 */
async function fetchAllWalmartJobs({ maxJobs = 1000, fetchDetails = true } = {}) {
  const jobs = [];
  let page = 0;
  let hasMore = true;

  console.log(`[Walmart API] Starting fetch for max ${maxJobs} jobs...`);

  while (hasMore && jobs.length < maxJobs) {
    const listRes = await fetchWalmartJobsPage({ page });
    const reqList = listRes.jobs;

    if (!reqList || reqList.length === 0) {
      break;
    }

    for (const reqItem of reqList) {
      if (jobs.length >= maxJobs) break;

      const jobId = String(reqItem.job_id || reqItem.jobId || "").trim();
      let detailItem = null;

      if (fetchDetails && jobId) {
        await delay(50);
        detailItem = await fetchWalmartJobById(jobId);
      }

      const normalized = normalizeWalmartJob(reqItem, detailItem);
      jobs.push(normalized);
    }

    page++;
    hasMore = listRes.hasMore && jobs.length < maxJobs;

    await delay(100);
  }

  console.log(`[Walmart API] Completed fetching ${jobs.length} jobs.`);
  return jobs;
}

/**
 * Sync Walmart jobs with MongoDB collection using batch bulkWrite
 */
async function syncWalmartJobsWithDb({ maxJobs = 1000, fetchDetails = true } = {}) {
  const { connectDB, WalmartJob } = require("../Db/walmartdb");
  const { CogforceJob } = require("../Db/cogforcedb");

  await connectDB();

  const liveJobs = await fetchAllWalmartJobs({ maxJobs, fetchDetails });
  if (!liveJobs || liveJobs.length === 0) {
    const finalDbCount = await WalmartJob.countDocuments({ source: "Walmart" });
    return {
      success: true,
      company: "Walmart",
      stats: {
        totalFetchedRaw: 0,
        insertedToDb: 0,
        updatedOrKeptInDb: 0,
        finalDbCount
      },
      jobs: []
    };
  }

  const existingJobs = await WalmartJob.find({ source: "Walmart" }).select("jobId").lean();
  const existingJobIds = new Set(existingJobs.map(j => j.jobId));

  let insertedCount = 0;
  let updatedCount = 0;
  const bulkOps = [];
  const cogforceOps = [];

  for (const job of liveJobs) {
    if (existingJobIds.has(job.jobId)) {
      updatedCount++;
    } else {
      insertedCount++;
    }

    bulkOps.push({
      updateOne: {
        filter: { source: "Walmart", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });

    if (CogforceJob) {
      cogforceOps.push({
        updateOne: {
          filter: { source: "Walmart", jobId: job.jobId },
          update: { $set: job },
          upsert: true
        }
      });
    }
  }

  if (bulkOps.length > 0) {
    await WalmartJob.bulkWrite(bulkOps);
  }
  if (cogforceOps.length > 0 && CogforceJob) {
    try {
      await CogforceJob.bulkWrite(cogforceOps);
    } catch (cogErr) {
      // Log silently
    }
  }

  const finalDbCount = await WalmartJob.countDocuments({ source: "Walmart" });

  return {
    success: true,
    company: "Walmart",
    stats: {
      totalFetchedRaw: liveJobs.length,
      insertedToDb: insertedCount,
      updatedOrKeptInDb: updatedCount,
      finalDbCount: finalDbCount
    },
    jobs: liveJobs
  };
}

module.exports = {
  fetchWalmartJobsPage,
  fetchWalmartJobById,
  fetchAllWalmartJobs,
  syncWalmartJobsWithDb,
  normalizeWalmartJob
};
