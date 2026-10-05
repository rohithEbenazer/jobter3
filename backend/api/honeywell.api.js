// honeywell.api.js - Dedicated API module for Honeywell Careers (Oracle HCM Cloud Recruiting API)
const axios = require("axios");

const HONEYWELL_REQUISITIONS_URL = "https://ibqbjb.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions";
const HONEYWELL_DETAILS_URL = "https://ibqbjb.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails";
const HONEYWELL_SITE_NUMBER = "CX_1";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "*/*",
  "accept-language": "en",
  "content-type": "application/vnd.oracle.adf.resourceitem+json;charset=utf-8",
  "ora-irc-language": "en",
  "origin": "https://careers.honeywell.com",
  "referer": "https://careers.honeywell.com/",
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
 * Extract experience requirements from text or flexFields
 */
function extractExperienceFromFlexOrText(flexFields = [], text = "") {
  if (Array.isArray(flexFields)) {
    const yearField = flexFields.find(f => 
      f && f.Prompt && (f.Prompt.toLowerCase().includes("year") || f.Prompt.toLowerCase().includes("experience"))
    );
    if (yearField && yearField.Value) {
      const val = String(yearField.Value);
      const rangeMatch = /(\d+)\s*(?:to|-)\s*(\d+)/i.exec(val);
      if (rangeMatch) {
        return {
          minYears: parseInt(rangeMatch[1], 10),
          maxYears: parseInt(rangeMatch[2], 10),
          experienceRequired: val
        };
      }
      const plusMatch = /(\d+)\+/i.exec(val);
      if (plusMatch) {
        const min = parseInt(plusMatch[1], 10);
        return {
          minYears: min,
          maxYears: null,
          experienceRequired: `${min}+ years`
        };
      }
      return { minYears: 0, maxYears: null, experienceRequired: val };
    }
  }

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
    "Embedded", "RTOS", "Firmware", "IoT", "PLC", "SCADA", "Automation", "Matlab",
    "Cybersecurity", "Microservices", "REST API", "GraphQL", "Machine Learning", "AI"
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
 * Fetch a list page of Honeywell job requisitions
 */
async function fetchHoneywellJobsList({ offset = 0, limit = 25 } = {}) {
  const finderStr = `findReqs;siteNumber=${HONEYWELL_SITE_NUMBER},facetsList=WORK_LOCATIONS%3BWORKPLACE_TYPES%3BTITLES%3BCATEGORIES%3BORGANIZATIONS%3BPOSTING_DATES%3BFLEX_FIELDS%3BLOCATIONS,limit=${limit},offset=${offset},sortBy=POSTING_DATES_DESC`;

  const params = {
    onlyData: "true",
    expand: "requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations,flexFieldsFacet.values,requisitionList.requisitionFlexFields",
    finder: finderStr
  };

  try {
    const response = await axios.get(HONEYWELL_REQUISITIONS_URL, {
      params,
      headers: DEFAULT_HEADERS,
      timeout: 15000
    });

    const itemContainer = response.data?.items?.[0];
    const requisitionList = itemContainer?.requisitionList || [];
    const hasMore = itemContainer?.hasMore || false;
    const totalCount = itemContainer?.TotalRequisitionCount || requisitionList.length;

    return {
      requisitionList,
      hasMore,
      totalCount,
      count: requisitionList.length
    };
  } catch (error) {
    console.error(`[Honeywell API] Error fetching job list at offset ${offset}:`, error.message);
    throw error;
  }
}

/**
 * Fetch detailed requisition info for a single Honeywell job ID
 */
async function fetchHoneywellJobById(reqId) {
  const params = {
    expand: "all",
    onlyData: "true",
    finder: `ById;Id="%22${reqId}%22",siteNumber=${HONEYWELL_SITE_NUMBER}`
  };

  try {
    const response = await axios.get(HONEYWELL_DETAILS_URL, {
      params,
      headers: DEFAULT_HEADERS,
      timeout: 15000
    });

    const detailItem = response.data?.items?.[0];
    return detailItem || null;
  } catch (error) {
    console.warn(`[Honeywell API] Could not fetch details for req ${reqId}: ${error.message}`);
    return null;
  }
}

/**
 * Map raw Oracle requisition & detail data to standard job schema format
 */
function normalizeHoneywellJob(reqItem, detailItem = null) {
  const jobId = String(reqItem.Id || reqItem.RequisitionId || "").trim();
  const title = reqItem.Title || detailItem?.Title || "Honeywell Opening";

  const rawLocation = reqItem.PrimaryLocation || detailItem?.PrimaryLocation || "";
  let city = [];
  let state = [];
  let country = [];

  if (rawLocation) {
    const parts = rawLocation.split(",").map(s => s.trim());
    if (parts.length >= 3) {
      city.push(parts[0]);
      state.push(parts[1]);
      country.push(parts[2]);
    } else if (parts.length === 2) {
      city.push(parts[0]);
      country.push(parts[1]);
    } else if (parts.length === 1) {
      locationStr = parts[0];
    }
  }

  // Workmode mapping
  let workmode = "On-site";
  const wpTypeCode = reqItem.WorkplaceTypeCode || detailItem?.WorkplaceTypeCode || "";
  const wpType = reqItem.WorkplaceType || detailItem?.WorkplaceType || "";
  if (wpTypeCode.includes("REMOTE") || wpType.toLowerCase().includes("remote")) {
    workmode = "Remote";
  } else if (wpTypeCode.includes("HYBRID") || wpType.toLowerCase().includes("hybrid")) {
    workmode = "Hybrid";
  }

  const postingDate = (reqItem.PostedDate || detailItem?.PostedDate || "").split("T")[0] || new Date().toISOString().split("T")[0];
  const shortDesc = reqItem.ShortDescriptionStr || detailItem?.ShortDescriptionStr || "";
  const extDesc = detailItem?.ExternalDescriptionStr || "";
  const extQual = detailItem?.ExternalQualificationsStr || "";
  const extResp = detailItem?.ExternalResponsibilitiesStr || "";

  const combinedHtml = [shortDesc, extDesc, extQual, extResp].filter(Boolean).join("<br/><br/>");
  const cleanDescription = cleanHtml(combinedHtml) || title;

  const flexFields = reqItem.requisitionFlexFields || detailItem?.requisitionFlexFields || [];
  const expInfo = extractExperienceFromFlexOrText(flexFields, cleanDescription);

  const skills = extractSkills(title, cleanDescription);
  const category = reqItem.Category || detailItem?.Category || detailItem?.JobFunction || "Engineering & Technology";

  const publicUrl = `https://careers.honeywell.com/us/en/job/${jobId}`;

  return {
    source: "Honeywell",
    company: "Honeywell",
    jobId: jobId,
    id: jobId,
    displayJobId: jobId,
    title: title,
    category: category,
    department: detailItem?.JobFunction || category,
    businessUnit: reqItem.BusinessUnit || detailItem?.BusinessUnit || "Honeywell International Inc.",
    location: rawLocation || "Not specified",
    city: city,
    state: state,
    country: country,
    url: publicUrl,
    jobUrl: publicUrl,
    applyJobUrl: publicUrl,
    detailsUrl: `${HONEYWELL_DETAILS_URL}?expand=all&onlyData=true&finder=ById;Id="%22${jobId}%22",siteNumber=${HONEYWELL_SITE_NUMBER}`,
    workmode: workmode,
    postingDate: postingDate,
    postedDate: postingDate,
    descriptionHtml: combinedHtml || `<p>${cleanDescription}</p>`,
    description: cleanDescription,
    basicQualifications: cleanHtml(extQual),
    preferredQualifications: cleanHtml(extQual),
    experienceRequired: expInfo.experienceRequired,
    yrsOfExperience: expInfo.experienceRequired,
    minYears: expInfo.minYears || 0,
    maxYears: expInfo.maxYears || 99,
    minYrsOfExperience: expInfo.minYears || 0,
    maxYrsOfExperience: expInfo.maxYears || 99,
    skills: skills,
    mandateSkills: skills.length > 0 ? skills.join(", ") : null,
    role: title,
    qualifications: cleanHtml(extQual),
    applyBy: "",
    salary: "Competitive Package",
    shift: "Day Shift",
    updatedAt: new Date()
  };
}

/**
 * Fetch all available Honeywell jobs up to maxJobs
 */
async function fetchAllHoneywellJobs({ maxJobs = 150, fetchDetails = true } = {}) {
  const jobs = [];
  let offset = 0;
  const limit = 25;
  let hasMore = true;

  console.log(`[Honeywell API] Starting fetch for max ${maxJobs} jobs...`);

  while (hasMore && jobs.length < maxJobs) {
    const listRes = await fetchHoneywellJobsList({ offset, limit });
    const reqList = listRes.requisitionList;

    if (!reqList || reqList.length === 0) {
      break;
    }

    for (const reqItem of reqList) {
      if (jobs.length >= maxJobs) break;

      const jobId = String(reqItem.Id || reqItem.RequisitionId || "").trim();
      let detailItem = null;

      if (fetchDetails && jobId) {
        await delay(100);
        detailItem = await fetchHoneywellJobById(jobId);
      }

      const normalized = normalizeHoneywellJob(reqItem, detailItem);
      jobs.push(normalized);
    }

    offset += reqList.length;
    hasMore = listRes.hasMore && jobs.length < maxJobs;

    await delay(200);
  }

  console.log(`[Honeywell API] Completed fetching ${jobs.length} jobs.`);
  return jobs;
}

/**
 * Sync Honeywell jobs with MongoDB collection
 */
async function syncHoneywellJobsWithDb({ maxJobs = 150, fetchDetails = true } = {}) {
  const { connectDB, HoneywellJob } = require("../Db/honeywelldb");
  const { CogforceJob } = require("../Db/cogforcedb");

  await connectDB();

  const liveJobs = await fetchAllHoneywellJobs({ maxJobs, fetchDetails });
  if (!liveJobs || liveJobs.length === 0) {
    const finalDbCount = await HoneywellJob.countDocuments({ source: "Honeywell" });
    return {
      success: true,
      company: "Honeywell",
      stats: {
        totalFetchedRaw: 0,
        insertedToDb: 0,
        updatedOrKeptInDb: 0,
        finalDbCount
      },
      jobs: []
    };
  }

  const existingJobs = await HoneywellJob.find({ source: "Honeywell" }).select("jobId").lean();
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
        filter: { source: "Honeywell", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });

    if (CogforceJob) {
      cogforceOps.push({
        updateOne: {
          filter: { source: "Honeywell", jobId: job.jobId },
          update: { $set: job },
          upsert: true
        }
      });
    }
  }

  if (bulkOps.length > 0) {
    await HoneywellJob.bulkWrite(bulkOps);
  }
  if (cogforceOps.length > 0 && CogforceJob) {
    try {
      await CogforceJob.bulkWrite(cogforceOps);
    } catch (cogErr) {
      // Log silently
    }
  }

  const finalDbCount = await HoneywellJob.countDocuments({ source: "Honeywell" });

  return {
    success: true,
    company: "Honeywell",
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
  fetchHoneywellJobsList,
  fetchHoneywellJobById,
  fetchAllHoneywellJobs,
  syncHoneywellJobsWithDb,
  normalizeHoneywellJob
};
