// microsoft.api.js - Dedicated API module for Microsoft Careers (via PCSX Search & Position Details API)
const axios = require("axios");

const MICROSOFT_SEARCH_API = "https://apply.careers.microsoft.com/api/pcsx/search";
const MICROSOFT_DETAILS_API = "https://apply.careers.microsoft.com/api/pcsx/position_details";

// Utility sleep helper
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  "referer": "https://apply.careers.microsoft.com/careers",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

/**
 * Step 1: Fetch a page of jobs from Microsoft Careers API
 * @param {number} start Start offset (0, 10, 20...)
 * @param {string} query Search query string
 * @param {string} location Search location string
 * @returns {Promise<object|null>} Response data object containing positions array and count
 */
async function fetchMicrosoftPage(start = 0, query = "", location = "") {
  const url = `${MICROSOFT_SEARCH_API}?domain=microsoft.com&query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&start=${start}&sort_by=timestamp`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (res.status === 429) {
          await delay(1000 * attempt);
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
      if (attempt < 3) await delay(800 * attempt);
      else console.warn(`[Microsoft API] Error fetching page at start=${start}:`, error.message);
    }
  }
  return null;
}

/**
 * Step 2: GET detail JSON format for a given position ID
 * @param {string|number} positionId Position ID
 * @returns {Promise<object|null>} Detailed position JSON object or null
 */
async function fetchMicrosoftJobDetails(positionId) {
  if (!positionId) return null;
  const url = `${MICROSOFT_DETAILS_API}?position_id=${positionId}&domain=microsoft.com&hl=en`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(url, { headers: DEFAULT_HEADERS });
        if (res.status === 429) {
          await delay(800 * attempt);
          continue;
        }
        if (!res.ok) return null;
        const data = await res.json();
        return data?.data || data || null;
      } else {
        const response = await axios.get(url, {
          headers: DEFAULT_HEADERS,
          timeout: 15000
        });
        return response.data?.data || response.data || null;
      }
    } catch (error) {
      if (attempt < 3) await delay(500 * attempt);
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

function normalizeText(text = "") {
  return text
    .replace(/[–—]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convert:
 * 6 months -> 0.5
 * 1 year -> 1
 * 1+ year -> 1
 * 2.5 years -> 2.5
 */
function durationToYears(value, unit) {
  const number = parseFloat(value);
  if (!Number.isFinite(number)) return null;
  if (/month|mo/i.test(unit)) {
    return number / 12;
  }
  return number;
}

/**
 * Helper to check if text contains Fresher / Intern / 0 Years / Entry Level signals
 */
function isFresherOrEntryLevel(text = "") {
  if (!text) return false;

  const zeroYearsRegex = /\b(?:0\s*\+?\s*years?|0\s*-\s*1\s*years?|no\s+(?:prior\s+)?experience\s+required|0\s*years?\s+(?:of\s+)?(?:technical\s+)?(?:engineering\s+)?(?:professional\s+)?experience)\b/i;
  const entryLevelRegex = /\b(?:entry\s*level(?:\s+position|\s+role|\s+engineer)?|freshers?\s+welcome|for\s+freshers?|fresher)\b/i;
  const internRoleRegex = /\b(?:internship\s+role|intern\s+position|software\s+engineering\s+intern|engineering\s+intern|university\s+grad(?:uate)?|recent\s+grad(?:uate)?|early\s+career\s+position)\b/i;

  return zeroYearsRegex.test(text) || entryLevelRegex.test(text) || internRoleRegex.test(text);
}

/**
 * Parse experience phrases from a text snippet
 */
function parseExperiencePhrase(sectionText = "") {
  if (!sectionText) return [];

  const matches = [];

  // Pattern 1: 12+ years, 10+ yrs, 6+ months
  const plusRegex = /(\d+(?:\.\d+)?)\s*\+\s*(years?|yrs?|months?|mos?)\b/gi;
  let match;
  while ((match = plusRegex.exec(sectionText)) !== null) {
    const min = durationToYears(match[1], match[2]);
    if (min !== null) {
      matches.push({ min, max: null, text: match[0] });
    }
  }

  // Pattern 2: 3-5 years, 3 to 5 yrs
  const rangeRegex = /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(years?|yrs?|months?|mos?)\b/gi;
  while ((match = rangeRegex.exec(sectionText)) !== null) {
    const min = durationToYears(match[1], match[3]);
    const max = durationToYears(match[2], match[3]);
    if (min !== null && max !== null) {
      matches.push({ min, max, text: match[0] });
    }
  }

  // Pattern 3: minimum 5 years, at least 5 years
  const minRegex = /(?:minimum|at least)\s+(\d+(?:\.\d+)?)\s*(years?|yrs?|months?|mos?)\b/gi;
  while ((match = minRegex.exec(sectionText)) !== null) {
    const min = durationToYears(match[1], match[2]);
    if (min !== null) {
      matches.push({ min, max: null, text: match[0] });
    }
  }

  // Pattern 4: X years of technical engineering experience / 5 years experience
  const normalRegex = /(\d+(?:\.\d+)?)\s*(years?|yrs?|months?|mos?)\s+(?:of\s+)?(?:technical\s+)?(?:engineering\s+)?(?:software\s+)?(?:professional\s+)?(?:relevant\s+)?experience\b/gi;
  while ((match = normalRegex.exec(sectionText)) !== null) {
    const min = durationToYears(match[1], match[2]);
    if (min !== null) {
      const alreadyIncluded = matches.some(m => match[0].includes(m.text) || m.text.includes(match[0]));
      if (!alreadyIncluded) {
        matches.push({ min, max: min, text: match[0] });
      }
    }
  }

  // Pattern 5: "a year of experience" / "one year of experience"
  const singleYearRegex = /\b(?:a|an|one)\s+years?\s+(?:of\s+)?(?:technical\s+)?(?:engineering\s+)?(?:professional\s+)?(?:relevant\s+)?experience\b/gi;
  while ((match = singleYearRegex.exec(sectionText)) !== null) {
    const alreadyIncluded = matches.some(m => m.min === 1);
    if (!alreadyIncluded) {
      matches.push({ min: 1, max: null, text: match[0] });
    }
  }

  // Pattern 6: "multiple years" / "several years" of experience
  const multiYearWordRegex = /\b(?:multiple|several)\s+years?\s+(?:of\s+)?(?:technical\s+)?(?:engineering\s+)?(?:professional\s+)?(?:relevant\s+)?experience\b/gi;
  while ((match = multiYearWordRegex.exec(sectionText)) !== null) {
    const alreadyIncluded = matches.some(m => m.min === 2);
    if (!alreadyIncluded) {
      matches.push({ min: 2, max: null, text: match[0] });
    }
  }

  // Remove duplicates based on min & max
  const unique = matches.filter(
    (item, index, arr) =>
      index === arr.findIndex(x => x.min === item.min && x.max === item.max)
  );

  return unique;
}

/**
 * Format result object from matched experience options in a section
 */
function buildExperienceResult(matches, source) {
  if (!matches || !matches.length) return null;

  // Lowest explicitly required experience among all education options
  const minYears = Math.min(...matches.map(x => x.min));
  const selected = matches.find(x => x.min === minYears);

  let experienceRequired;
  if (selected.max === null || selected.max === 99) {
    experienceRequired = `${selected.min}+ years`;
  } else if (selected.min === selected.max) {
    experienceRequired = `${selected.min} year${selected.min === 1 ? '' : 's'}`;
  } else {
    experienceRequired = `${selected.min}-${selected.max} years`;
  }

  let experienceLevel = "Not specified";
  if (minYears === 0) {
    experienceLevel = "Fresher";
  } else if (minYears <= 1) {
    experienceLevel = "Entry Level";
  } else if (minYears <= 3) {
    experienceLevel = "Junior";
  } else if (minYears <= 5) {
    experienceLevel = "Mid Level";
  } else {
    experienceLevel = "Senior";
  }

  return {
    qualification: source,
    experienceRequired,
    minYears: selected.min,
    maxYears: selected.max,
    experienceLevel,
    allExperienceRequirements: matches.map(m => ({ min: m.min, max: m.max, text: m.text })),
    experienceSource: source
  };
}

/**
 * Extract experience from Microsoft job description using section-based prioritization:
 * 1. Full Description Check (Fresher/Intern/0 years/Entry Level)
 * 2. Required Qualifications (Fresher OR Experience)
 * 3. Preferred Qualifications (Fresher OR Experience)
 * 4. General Qualifications (Fresher OR Experience)
 * 5. Fallback (Not specified)
 */
function extractExperienceFromMicrosoft(jobDescription = "") {
  if (!jobDescription) {
    return {
      qualification: "Not specified",
      experienceRequired: "Not specified",
      minYears: 0,
      maxYears: null,
      experienceLevel: "Not specified",
      experienceSource: null,
      allExperienceRequirements: []
    };
  }

  // 1. Clean HTML to plain text
  const cleanText = normalizeText(cleanHtml(jobDescription));

  // -----------------------------------------------------------------
  // STEP 1: Full Description Check for Fresher/Intern/0 years
  // -----------------------------------------------------------------
  if (isFresherOrEntryLevel(cleanText)) {
    return {
      qualification: "Fresher",
      experienceRequired: "0 years",
      minYears: 0,
      maxYears: 0,
      experienceLevel: "Fresher",
      experienceSource: "Full Description",
      allExperienceRequirements: [{ min: 0, max: 0, text: "0 years" }]
    };
  }

  // 2. Find Required Qualifications section
  const requiredMatch = cleanText.match(
    /(?:Required\s+Qualifications?|Basic\s+Qualifications?|Minimum\s+Qualifications?)([\s\S]*?)(?=Preferred\s+Qualifications?|Desired\s+Qualifications?|Silicon\s+Engineering|Salary|Compensation|Benefits|$)/i
  );
  const requiredText = requiredMatch ? requiredMatch[1].trim() : "";

  // 3. Find Preferred Qualifications section
  const preferredMatch = cleanText.match(
    /(?:Preferred\s+Qualifications?|Desired\s+Qualifications?)([\s\S]*?)(?=Responsibilities|Silicon\s+Engineering|Salary|Compensation|Benefits|$)/i
  );
  const preferredText = preferredMatch ? preferredMatch[1].trim() : "";

  // 4. Find General Qualifications section (when not split into Required vs Preferred)
  const generalQualMatch = cleanText.match(
    /(?:Qualifications)([\s\S]*?)(?=Responsibilities|Silicon\s+Engineering|Salary|Compensation|Benefits|Other\s+Requirements|$)/i
  );
  const generalQualText = generalQualMatch ? generalQualMatch[1].trim() : "";

  // -----------------------------------------------------------------
  // STEP 2: REQUIRED QUALIFICATIONS Section Check
  // -----------------------------------------------------------------
  if (requiredText) {
    if (isFresherOrEntryLevel(requiredText)) {
      return {
        qualification: "Required Qualifications",
        experienceRequired: "0 years",
        minYears: 0,
        maxYears: 0,
        experienceLevel: "Fresher",
        experienceSource: "Required Qualifications",
        allExperienceRequirements: [{ min: 0, max: 0, text: "0 years" }]
      };
    }

    const reqMatches = parseExperiencePhrase(requiredText);
    if (reqMatches.length > 0) {
      return buildExperienceResult(reqMatches, "Required Qualifications");
    }
  }

  // -----------------------------------------------------------------
  // STEP 3: PREFERRED QUALIFICATIONS Section Check
  // -----------------------------------------------------------------
  if (preferredText) {
    if (isFresherOrEntryLevel(preferredText)) {
      return {
        qualification: "Preferred Qualifications",
        experienceRequired: "0 years",
        minYears: 0,
        maxYears: 0,
        experienceLevel: "Fresher",
        experienceSource: "Preferred Qualifications",
        allExperienceRequirements: [{ min: 0, max: 0, text: "0 years" }]
      };
    }

    const prefMatches = parseExperiencePhrase(preferredText);
    if (prefMatches.length > 0) {
      return buildExperienceResult(prefMatches, "Preferred Qualifications");
    }
  }

  // -----------------------------------------------------------------
  // STEP 4: GENERAL QUALIFICATIONS Section Check
  // -----------------------------------------------------------------
  if (generalQualText) {
    if (isFresherOrEntryLevel(generalQualText)) {
      return {
        qualification: "Qualifications",
        experienceRequired: "0 years",
        minYears: 0,
        maxYears: 0,
        experienceLevel: "Fresher",
        experienceSource: "Qualifications",
        allExperienceRequirements: [{ min: 0, max: 0, text: "0 years" }]
      };
    }

    const genMatches = parseExperiencePhrase(generalQualText);
    if (genMatches.length > 0) {
      return buildExperienceResult(genMatches, "Qualifications");
    }
  }

  // -----------------------------------------------------------------
  // STEP 5: Fallback -> Not specified
  // -----------------------------------------------------------------
  return {
    qualification: "Not specified",
    experienceRequired: "Not specified",
    minYears: 0,
    maxYears: null,
    experienceLevel: "Not specified",
    experienceSource: null,
    allExperienceRequirements: []
  };
}

// Alias extractExperience for backward compatibility
const extractExperience = extractExperienceFromMicrosoft;

/**
 * Extract salary information from item details and description text
 */
function extractSalary(itemOrDetails, text) {
  // 1. Check if item has explicit non-default salary string in item object
  if (itemOrDetails && typeof itemOrDetails === 'object') {
    const existing = String(itemOrDetails.salary || itemOrDetails.payRange || itemOrDetails.pay_range || itemOrDetails.compensation || '').trim();
    if (existing && !/^(not disclosed|salary not mentioned|no mention salary|competitive salary|competitive industry package|null|undefined)$/i.test(existing)) {
      return existing;
    }
  }

  const str = String(text || '');
  if (!str.trim()) return 'Salary Not Mentioned';

  const cleanNum = (val) => parseFloat(String(val).replace(/,/g, ''));

  // 1. USD Annual Range ($85,400 - $168,100 per year / $100k - $150k / $120,000.00 - $200,000.00)
  const usdAnnualRange = str.match(/(?:base\s*pay\s*range|pay\s*range|salary|compensation)?[\s\S]{0,40}?(?:USD\s*)?[$]\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{5,6})\s*(?:-\s*|to\s*)(?:USD\s*)?[$]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{5,6})\s*(?:per\s*year|\/yr|\/year|p\.a\.|annually)?/i);
  if (usdAnnualRange) {
    const minV = cleanNum(usdAnnualRange[1]);
    const maxV = cleanNum(usdAnnualRange[2]);
    if (!isNaN(minV) && !isNaN(maxV) && minV >= 15000 && maxV >= minV) {
      const minK = (minV / 1000).toFixed(minV % 1000 === 0 ? 0 : 1);
      const maxK = (maxV / 1000).toFixed(maxV % 1000 === 0 ? 0 : 1);
      const minLpa = (minV * 0.00083).toFixed(1);
      const maxLpa = (maxV * 0.00083).toFixed(1);
      return `₹ ${minLpa} - ₹ ${maxLpa} LPA ($${minK}k - $${maxK}k/yr)`;
    }
  }

  // 2. USD K Range ($100k - $150k or $100K to $150K)
  const usdKRange = str.match(/(?:USD\s*)?[$]\s*(\d+(?:\.\d+)?)\s*k\s*(?:-\s*|to\s*)(?:USD\s*)?[$]?\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (usdKRange) {
    const minK = parseFloat(usdKRange[1]);
    const maxK = parseFloat(usdKRange[2]);
    if (!isNaN(minK) && !isNaN(maxK) && minK >= 15) {
      const minLpa = (minK * 0.83).toFixed(1);
      const maxLpa = (maxK * 0.83).toFixed(1);
      return `₹ ${minLpa} - ₹ ${maxLpa} LPA ($${minK}k - $${maxK}k/yr)`;
    }
  }

  // 3. USD Single Annual ($140,000 per year / $140k/yr)
  const usdSingleAnnual = str.match(/(?:base\s*pay|salary|compensation)\s*[:\-]?\s*(?:USD\s*)?[$]\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{5,6})\s*(?:per\s*year|\/yr|\/year|p\.a\.|annually)/i);
  if (usdSingleAnnual) {
    const val = cleanNum(usdSingleAnnual[1]);
    if (!isNaN(val) && val >= 15000) {
      const k = (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1);
      const lpa = (val * 0.00083).toFixed(1);
      return `₹ ${lpa} LPA ($${k}k/yr)`;
    }
  }

  // 4. USD Monthly Range / Single ($5,690 - $11,210 per month)
  const usdMonthlyRange = str.match(/(?:USD\s*)?[$]\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{4,5})\s*(?:-\s*|to\s*)(?:USD\s*)?[$]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{4,5})\s*(?:per\s*month|\/month|\/mo)/i);
  if (usdMonthlyRange) {
    const minV = cleanNum(usdMonthlyRange[1]);
    const maxV = cleanNum(usdMonthlyRange[2]);
    if (!isNaN(minV) && !isNaN(maxV) && minV > 500 && minV < 25000) {
      const minLpa = (minV * 12 * 0.00083).toFixed(1);
      const maxLpa = (maxV * 12 * 0.00083).toFixed(1);
      return `₹ ${minLpa} - ₹ ${maxLpa} LPA ($${minV.toLocaleString()} - $${maxV.toLocaleString()}/mo)`;
    }
  }

  // 5. USD Hourly Rate / Range ($22.10 - $40.66 per hour / $17/hr / $55.50/hr to $82.00/hr)
  const usdHourlyRange = str.match(/(?:pay\s*rate\s*[:\-]?\s*)?(?:USD\s*)?[$]\s*(\d+(?:\.\d+)?)\s*(?:\/hr|\/hour|per\s*hour)?\s*(?:-\s*|to\s*)(?:USD\s*)?[$]?\s*(\d+(?:\.\d+)?)\s*(?:\/hr|\/hour|per\s*hour)/i);
  if (usdHourlyRange) {
    const minH = parseFloat(usdHourlyRange[1]);
    const maxH = parseFloat(usdHourlyRange[2]);
    if (!isNaN(minH) && !isNaN(maxH) && minH > 0 && minH < 500) {
      const minLpa = (minH * 2080 * 0.00083).toFixed(1);
      const maxLpa = (maxH * 2080 * 0.00083).toFixed(1);
      return minH === maxH
        ? `₹ ${minLpa} LPA ($${minH}/hr)`
        : `₹ ${minLpa} - ₹ ${maxLpa} LPA ($${minH} - $${maxH}/hr)`;
    }
  }

  const usdSingleHourly = str.match(/(?:pay\s*rate\s*[:\-]?\s*)?(?:USD\s*)?[$]\s*(\d+(?:\.\d+)?)\s*(?:\/hr|\/hour|per\s*hour)/i);
  if (usdSingleHourly) {
    const minH = parseFloat(usdSingleHourly[1]);
    if (!isNaN(minH) && minH > 0 && minH < 500) {
      const minLpa = (minH * 2080 * 0.00083).toFixed(1);
      return `₹ ${minLpa} LPA ($${minH}/hr)`;
    }
  }

  // 6. GBP (£ / British Pound)
  const gbpRange = str.match(/£\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{2,6})\s*(?:k)?\s*(?:-\s*|to\s*)?£?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{2,6})?\s*(?:k)?\s*(?:per\s*year|\/yr|\/year|p\.a\.)?/i);
  if (gbpRange && gbpRange[1]) {
    const isK = /k/i.test(gbpRange[0]);
    let minV = cleanNum(gbpRange[1]);
    let maxV = gbpRange[2] ? cleanNum(gbpRange[2]) : minV;
    if (isK && minV < 1000) { minV *= 1000; maxV *= 1000; }
    if (minV >= 15000) {
      const minK = (minV / 1000).toFixed(minV % 1000 === 0 ? 0 : 1);
      const maxK = (maxV / 1000).toFixed(maxV % 1000 === 0 ? 0 : 1);
      const minLpa = (minV * 0.00106).toFixed(1);
      const maxLpa = (maxV * 0.00106).toFixed(1);
      return `₹ ${minLpa} - ₹ ${maxLpa} LPA (£${minK}k - £${maxK}k/yr)`;
    }
  }

  // 7. EUR (€ / Euro)
  const eurRange = str.match(/€\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{2,6})\s*(?:k)?\s*(?:-\s*|to\s*)?€?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{2,6})?\s*(?:k)?\s*(?:per\s*year|\/yr|\/year|p\.a\.)?/i);
  if (eurRange && eurRange[1]) {
    const isK = /k/i.test(eurRange[0]);
    let minV = cleanNum(eurRange[1]);
    let maxV = eurRange[2] ? cleanNum(eurRange[2]) : minV;
    if (isK && minV < 1000) { minV *= 1000; maxV *= 1000; }
    if (minV >= 15000) {
      const minK = (minV / 1000).toFixed(minV % 1000 === 0 ? 0 : 1);
      const maxK = (maxV / 1000).toFixed(maxV % 1000 === 0 ? 0 : 1);
      const minLpa = (minV * 0.00090).toFixed(1);
      const maxLpa = (maxV * 0.00090).toFixed(1);
      return `₹ ${minLpa} - ₹ ${maxLpa} LPA (€${minK}k - €${maxK}k/yr)`;
    }
  }

  // 8. Swedish Krona (kr)
  const krRange = str.match(/\bkr\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{5,7})\s*(?:-\s*|to\s*)?\bkr?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d{5,7})?\s*(?:per\s*year|\/yr)?/i);
  if (krRange && krRange[1]) {
    const minV = cleanNum(krRange[1]);
    const maxV = krRange[2] ? cleanNum(krRange[2]) : minV;
    if (minV >= 100000) {
      const minK = Math.round(minV / 1000);
      const maxK = Math.round(maxV / 1000);
      const minLpa = (minV * 0.00008).toFixed(1);
      const maxLpa = (maxV * 0.00008).toFixed(1);
      return `₹ ${minLpa} - ₹ ${maxLpa} LPA (kr ${minK}k - kr ${maxK}k/yr)`;
    }
  }

  // 9. Rupee / INR / LPA / Lacs / Lakhs
  const lpaMatch = str.match(/(?:salary|package|ctc|pay)?[\s\S]{0,20}?(?:[₹]\s*|\binr\b\s*|\brs\.?\b\s*)?(\d+(?:\.\d+)?)\s*(?:-\s*|to\s*)(?:[₹]\s*|\binr\b\s*|\brs\.?\b\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|lakhs|lacs|lakh)\b/i);
  if (lpaMatch) {
    return `₹ ${lpaMatch[1]} - ₹ ${lpaMatch[2]} LPA`;
  }

  const singleLpaMatch = str.match(/(?:salary|package|ctc|pay)?[\s\S]{0,20}?(?:[₹]\s*|\binr\b\s*|\brs\.?\b\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|lakhs|lacs|lakh)\b/i);
  if (singleLpaMatch) {
    return `₹ ${singleLpaMatch[1]} LPA`;
  }

  const inrMonthlyMatch = str.match(/(?:[₹]|\brs\.?\b|\binr\b)\s*(\d{1,3}(?:,\d{3})+|\d{4,6})\s*(?:-\s*|to\s*)?(?:[₹]|\brs\.?\b|\binr\b)?\s*(\d{1,3}(?:,\d{3})+|\d{4,6})?\s*(?:per\s*month|\/month|\/mo|pm\b)/i);
  if (inrMonthlyMatch) {
    const minV = inrMonthlyMatch[1];
    const maxV = inrMonthlyMatch[2];
    return maxV ? `₹ ${minV} - ₹ ${maxV}/month` : `₹ ${minV}/month`;
  }

  const inrHourlyMatch = str.match(/(?:[₹]|\brs\.?\b|\binr\b)\s*(\d+(?:\.\d+)?)\s*(?:-\s*|to\s*)?(?:[₹]|\brs\.?\b|\binr\b)?\s*(\d+(?:\.\d+)?)?\s*(?:\/hr|\/hour|per\s*hour)/i);
  if (inrHourlyMatch) {
    const minH = inrHourlyMatch[1];
    const maxH = inrHourlyMatch[2];
    return maxH ? `₹ ${minH} - ₹ ${maxH}/hr` : `₹ ${minH}/hr`;
  }

  const inrFigureMatch = str.match(/(?:\binr\b|\brs\.?\b|[₹])\s*(\d{1,3}(?:,\d{3}){2,})\s*(?:-\s*|to\s*)?(?:\binr\b|\brs\.?\b|[₹])?\s*(\d{1,3}(?:,\d{3}){2,})?/i);
  if (inrFigureMatch) {
    const minV = cleanNum(inrFigureMatch[1]);
    const maxV = inrFigureMatch[2] ? cleanNum(inrFigureMatch[2]) : minV;
    if (!isNaN(minV) && minV >= 100000) {
      const minLpa = (minV / 100000).toFixed(1);
      const maxLpa = (maxV / 100000).toFixed(1);
      return minV === maxV ? `₹ ${minLpa} LPA` : `₹ ${minLpa} - ₹ ${maxLpa} LPA`;
    }
  }

  return 'Not Disclosed';
}

/**
 * Extract shift type from job description and details
 */
function extractShift(details, text) {
  const combined = (String(text || '')).toLowerCase();

  if (combined.match(/night shift|evening shift|us shift|uk shift|night|24\/7|rotational shift|graveyard|third shift/i)) {
    return "Night Shift";
  }
  if (combined.match(/flexible shift|flexible hours|flexi shift|flexible/i)) {
    return "Flexible / Rotational";
  }
  return "Day Shift";
}

/**
 * Parse location strings into structured city, state, country arrays
 */
function parseMicrosoftLocations(locations = [], standardizedLocations = []) {
  const citySet = new Set();
  const stateSet = new Set();
  const countrySet = new Set();
  const locList = [];

  const rawList = Array.isArray(locations) && locations.length > 0
    ? locations
    : (Array.isArray(standardizedLocations) ? standardizedLocations : []);

  for (const item of rawList) {
    if (!item || typeof item !== "string") continue;
    const parts = item.split(",").map(p => p.trim()).filter(Boolean);
    locList.push(item);

    if (parts.length >= 3) {
      if (/united states|us|usa|india|uk|united kingdom|canada|australia|germany|france|japan|china|singapore/i.test(parts[0])) {
        countrySet.add(parts[0]);
        stateSet.add(parts[1]);
        citySet.add(parts[2]);
      } else {
        citySet.add(parts[0]);
        stateSet.add(parts[1]);
        countrySet.add(parts[2]);
      }
    } else if (parts.length === 2) {
      citySet.add(parts[0]);
      if (/united states|us|usa|india|uk|canada|australia/i.test(parts[1])) {
        countrySet.add(parts[1]);
      } else {
        stateSet.add(parts[1]);
      }
    } else if (parts.length === 1) {
      citySet.add(parts[0]);
    }
  }

  if (Array.isArray(standardizedLocations)) {
    for (const std of standardizedLocations) {
      if (!std || typeof std !== "string") continue;
      const parts = std.split(",").map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        citySet.add(parts[0]);
        stateSet.add(parts[1]);
        countrySet.add(parts[2]);
      }
    }
  }

  const locationStr = locList.join("; ") || "Not specified";
  return {
    location: locationStr,
    city: Array.from(citySet),
    state: Array.from(stateSet),
    country: Array.from(countrySet)
  };
}

/**
 * Step 3: Map raw/detailed Microsoft job into standardized JSON format
 * @param {object} rawItem Raw job item from Search API
 * @param {object} [detailsObj] Details object from Position Details API
 * @returns {object|null} Standardized JSON format of job
 */
function mapMicrosoftJobs(rawItem, detailsObj = null) {
  if (!rawItem) return null;

  const jobId = String(rawItem.id || rawItem.atsJobId || rawItem.displayJobId || '');
  const title = rawItem.name || detailsObj?.name || "Microsoft Opening";
  console.log(`[Microsoft Job ID]: ${jobId} | Company: Microsoft | Title: ${title}`);

  const details = detailsObj || {};

  const rawUrl = rawItem.publicUrl || details.publicUrl || rawItem.positionUrl || details.positionUrl || '';
  let fullUrl = '';
  if (rawUrl) {
    if (rawUrl.startsWith("http")) {
      fullUrl = rawUrl;
    } else {
      const cleanSlug = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
      fullUrl = `https://apply.careers.microsoft.com${cleanSlug}`;
    }
  } else {
    fullUrl = `https://apply.careers.microsoft.com/careers/job/${jobId}`;
  }

  const parsedLocs = parseMicrosoftLocations(rawItem.locations, rawItem.standardizedLocations);

  // Work Mode detection
  const opt = String(rawItem.workLocationOption || details.workLocationOption || '').toLowerCase();
  const workSiteArr = Array.isArray(details.efcustomTextWorkSite) ? details.efcustomTextWorkSite.join(' ') : '';
  const workSiteLower = workSiteArr.toLowerCase();

  let workmode = "On-site";
  if (opt.includes("remote") || workSiteLower.includes("100% work from home") || workSiteLower.includes("remote")) {
    workmode = "Remote";
  } else if (opt.includes("hybrid") || workSiteLower.includes("up to 50%") || workSiteLower.includes("hybrid")) {
    workmode = "Hybrid";
  }

  // Posted Date parsing
  let postedDate = null;
  const postedTs = rawItem.postedTs || details.postedTs;
  if (postedTs) {
    const d = new Date(postedTs * (postedTs < 10000000000 ? 1000 : 1));
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }
  if (!postedDate && (rawItem.creationTs || details.creationTs)) {
    const creationTs = rawItem.creationTs || details.creationTs;
    const d = new Date(creationTs * (creationTs < 10000000000 ? 1000 : 1));
    if (!isNaN(d.getTime())) postedDate = d.toISOString();
  }
  if (!postedDate) {
    postedDate = new Date().toISOString();
  }

  // Description & HTML
  const rawHtml = details.jobDescription || `<p style="font-family: inherit; font-size: 1rem; color: var(--text-dark, #1e293b); line-height: 1.6;"><strong>${title}</strong><br/>Location: ${parsedLocs.location}</p>`;
  const plainDescription = rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // Experience extraction using extractExperienceFromMicrosoft (section & phrase parsing)
  const expResult = extractExperienceFromMicrosoft(rawHtml);
  const minExp = expResult.minYears !== null && expResult.minYears !== undefined ? expResult.minYears : 0;
  const maxExp = expResult.maxYears;
  const yrsOfExperience = expResult.experienceRequired || "Not specified";

  // Skills & Role
  const skillsSet = new Set();
  if (Array.isArray(details.efcustomTextCurrentProfession)) {
    details.efcustomTextCurrentProfession.forEach(p => p && typeof p === 'string' && skillsSet.add(p.trim()));
  }
  if (Array.isArray(details.efcustomTextTaDisciplineName)) {
    details.efcustomTextTaDisciplineName.forEach(d => d && typeof d === 'string' && skillsSet.add(d.trim()));
  }
  if (rawItem.department && typeof rawItem.department === 'string') {
    skillsSet.add(rawItem.department.trim());
  }

  // Technical skill keywords in description
  const techKeywords = [
    "C++", "C#", ".NET", "Python", "Java", "JavaScript", "TypeScript", "React", "Angular", "Vue",
    "Node.js", "Azure", "AWS", "GCP", "Cloud", "Kubernetes", "Docker", "Terraform", "DevOps", "CI/CD",
    "Microservices", "SQL", "NoSQL", "PostgreSQL", "SQL Server", "Cosmos DB", "MongoDB",
    "AI", "Machine Learning", "LLM", "Generative AI", "Deep Learning", "PyTorch", "TensorFlow",
    "Security", "Cybersecurity", "Networking", "TCP/IP", "BGP", "DNS", "Linux", "PowerShell", "Bash",
    "Go", "Golang", "Rust", "REST API", "GraphQL", "Data Engineering", "Data Architecture", "Databricks", "Spark",
    "Agile", "Scrum", "PMP", "Project Management", "Solution Architecture"
  ];

  techKeywords.forEach(kw => {
    let regexStr;
    if (kw === "C++" || kw === "C#" || kw === ".NET") {
      regexStr = kw.replace(/\+/g, '\\+').replace(/\./g, '\\.');
    } else {
      regexStr = `\\b${kw.replace(/\+/g, '\\+').replace(/\./g, '\\.')}\\b`;
    }
    if (new RegExp(regexStr, 'i').test(plainDescription)) {
      skillsSet.add(kw);
    }
  });

  const skills = Array.from(skillsSet);

  const role = (Array.isArray(details.efcustomTextTaDisciplineName) && details.efcustomTextTaDisciplineName[0]) ||
    rawItem.department || details.department || (Array.isArray(details.efcustomTextCurrentProfession) && details.efcustomTextCurrentProfession[0]) || "Software / Cloud Specialist";

  const salary = extractSalary(details, plainDescription);
  const shift = extractShift(details, `${title} ${plainDescription}`);

  return {
    source: "Microsoft",
    company: "Microsoft",
    id: jobId,
    jobId: jobId,
    title: title,
    location: parsedLocs.location,
    minYears: minExp,
    maxYears: expResult.maxYears,
    minYrsOfExperience: minExp,
    maxYrsOfExperience: expResult.maxYears !== null && expResult.maxYears !== undefined ? expResult.maxYears : 99,
    yrsOfExperience: yrsOfExperience,
    qualification: expResult.qualification || expResult.experienceLevel,
    experienceLevel: expResult.experienceLevel || expResult.qualification,
    experienceRequired: expResult.experienceRequired,
    experienceSource: expResult.experienceSource,
    allExperienceRequirements: expResult.allExperienceRequirements,
    experienceDetails: {
      source: expResult.experienceSource,
      all: expResult.allExperienceRequirements
    },
    workmode: workmode,
    jobUrl: fullUrl,
    url: fullUrl,
    skills: skills,
    salary: salary,
    shift: shift,
    description: plainDescription,
    descriptionHtml: rawHtml,
    postedDate: postedDate,
    postingDate: postedDate,
    role: role,
    mandateSkills: skills.length > 0 ? skills.join(', ') : null,
    city: parsedLocs.city,
    state: parsedLocs.state,
    country: parsedLocs.country
  };
}

// Alias mapMicrosoftJob for backward compatibility
const mapMicrosoftJob = mapMicrosoftJobs;

/**
 * Step 4: Fetch ALL Microsoft jobs (or up to maxLimit)
 * @param {number|object|null} [optionsOrLimit=null] Maximum number of jobs to fetch or options object
 * @returns {Promise<Array>} Array of JSON job objects
 */
async function fetchAllMicrosoftJobs(optionsOrLimit = null) {
  let maxLimit = null;
  let fetchDetails = false;
  if (optionsOrLimit && typeof optionsOrLimit === 'object') {
    maxLimit = optionsOrLimit.maxJobs || optionsOrLimit.limit || optionsOrLimit.maxLimit || null;
    fetchDetails = optionsOrLimit.fetchDetails || false;
  } else if (typeof optionsOrLimit === 'number') {
    maxLimit = optionsOrLimit;
  }

  try {
    const firstPage = await fetchMicrosoftPage(0);
    if (!firstPage || !firstPage.data || !Array.isArray(firstPage.data.positions)) {
      return [];
    }

    const totalAvailable = firstPage.data.count || firstPage.data.positions.length;
    const fetchLimit = maxLimit ? Math.min(totalAvailable, maxLimit) : totalAvailable;

    let allPositions = [...firstPage.data.positions];

    // Fetch search pages in concurrent chunks of 15 pages
    const CHUNK_SIZE = 15;
    for (let start = 10; start < fetchLimit; start += CHUNK_SIZE * 10) {
      const pagePromises = [];
      for (let s = start; s < Math.min(fetchLimit, start + CHUNK_SIZE * 10); s += 10) {
        pagePromises.push(fetchMicrosoftPage(s));
      }
      const pageResults = await Promise.all(pagePromises);
      for (const res of pageResults) {
        if (res && res.data && Array.isArray(res.data.positions)) {
          allPositions.push(...res.data.positions);
        }
      }
      await delay(50);
    }

    // Deduplicate positions
    const uniquePositions = [];
    const seenIds = new Set();
    for (const pos of allPositions) {
      if (pos && pos.id && !seenIds.has(pos.id)) {
        seenIds.add(pos.id);
        uniquePositions.push(pos);
        if (uniquePositions.length >= fetchLimit) break;
      }
    }

    const finalJobs = [];
    if (fetchDetails) {
      const BATCH_SIZE = 20;
      for (let i = 0; i < uniquePositions.length; i += BATCH_SIZE) {
        const batch = uniquePositions.slice(i, i + BATCH_SIZE);
        const detailPromises = batch.map(pos =>
          fetchMicrosoftJobDetails(pos.id).catch(() => null)
        );
        const detailResults = await Promise.all(detailPromises);

        for (let j = 0; j < batch.length; j++) {
          const mapped = mapMicrosoftJobs(batch[j], detailResults[j]);
          if (mapped) finalJobs.push(mapped);
        }
        await delay(30);
      }
    } else {
      for (const pos of uniquePositions) {
        const mapped = mapMicrosoftJobs(pos, null);
        if (mapped) finalJobs.push(mapped);
      }
    }

    return finalJobs;

  } catch (error) {
    console.error("Microsoft API Error:", error.message);
    return [];
  }
}

/**
 * Step 5: Sync Microsoft jobs with MongoDB collection
 * @param {object} CogforceJobModel Mongoose model for CogforceJob
 * @param {number|object|null} [optionsOrLimit=null] Optional limit or options
 * @returns {Promise<object>} Sync operation result summary
 */
async function syncMicrosoftJobsWithDb(CogforceJobModel, optionsOrLimit = null) {
  if (!CogforceJobModel) {
    throw new Error("CogforceJob model is required for database sync.");
  }

  console.log("[Microsoft Sync] Starting Microsoft jobs DB sync...");
  const fetchedJobs = await fetchAllMicrosoftJobs(optionsOrLimit);
  console.log(`[Microsoft Sync] Fetched ${fetchedJobs.length} live jobs from Microsoft API.`);

  if (!Array.isArray(fetchedJobs) || fetchedJobs.length === 0) {
    return {
      success: true,
      message: "No live jobs retrieved from Microsoft API.",
      stats: { fetched: 0, inserted: 0, updated: 0, deleted: 0 }
    };
  }

  const apiJobIdsSet = new Set(fetchedJobs.map(j => String(j.jobId)));
  const existingDbJobs = await CogforceJobModel.find({ source: "Microsoft" }, { jobId: 1, _id: 1 });
  const existingDbIdsSet = new Set(existingDbJobs.map(j => String(j.jobId)));

  const obsoleteIds = Array.from(existingDbIdsSet).filter(id => !apiJobIdsSet.has(id));
  let deletedCount = 0;
  if (obsoleteIds.length > 0) {
    const delRes = await CogforceJobModel.deleteMany({ source: "Microsoft", jobId: { $in: obsoleteIds } });
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
        filter: { source: "Microsoft", jobId: job.jobId },
        update: { $set: job },
        upsert: true
      }
    });
  }

  if (bulkOps.length > 0) {
    await CogforceJobModel.bulkWrite(bulkOps);
  }

  const finalDbCount = await CogforceJobModel.countDocuments({ source: "Microsoft" });

  return {
    success: true,
    message: "Microsoft DB sync completed successfully.",
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
  fetchMicrosoftPage,
  fetchMicrosoftJobDetails,
  mapMicrosoftJob,
  mapMicrosoftJobs,
  fetchAllMicrosoftJobs,
  syncMicrosoftJobsWithDb,
  cleanHtml,
  extractSalary,
  extractExperience,
  extractExperienceFromMicrosoft,
  parseExperiencePhrase
};
