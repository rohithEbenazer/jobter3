// locationUtils.js - Helper utilities for hierarchical location filtering

export const normalizeCountry = (c) => {
  if (!c) return 'USA';
  const str = String(c).trim();
  const lower = str.toLowerCase();
  if (['united states', 'us', 'usa', 'u.s.', 'u.s.a.'].includes(lower)) {
    return 'USA';
  }
  if (['united kingdom', 'uk', 'u.k.'].includes(lower)) {
    return 'UK';
  }
  return str;
};

// Check if a single job matches any of the selected location filter strings
export const checkLocationMatch = (job, selectedLocations) => {
  if (!selectedLocations || selectedLocations.length === 0) return true;

  const locStr = String(job.location || '').toLowerCase();
  const countries = Array.isArray(job.country) ? job.country.map(c => normalizeCountry(c).toLowerCase()) : [];
  const states = Array.isArray(job.state) ? job.state.map(s => String(s).toLowerCase()) : [];
  const cities = Array.isArray(job.city) ? job.city.map(c => String(c).toLowerCase()) : [];

  return selectedLocations.some(selected => {
    const selLower = String(selected).toLowerCase().trim();

    if (selLower === 'remote') {
      return locStr.includes('remote');
    }

    // Match USA / United States
    if (selLower === 'usa' || selLower === 'united states' || selLower === 'us') {
      if (countries.some(c => c === 'usa' || c.includes('united states') || c === 'us')) return true;
      if (locStr.includes('usa') || locStr.includes('united states') || locStr.includes(', us') || locStr.includes('us;')) return true;
    }

    // Check array matches
    if (countries.some(c => c === selLower || c.includes(selLower))) return true;
    if (states.some(s => s === selLower || s.includes(selLower))) return true;
    if (cities.some(ci => ci === selLower || ci.includes(selLower))) return true;

    // Check location string inclusion
    if (locStr.includes(selLower)) return true;

    // State abbreviation check e.g. "texas" -> "tx", "west virginia" -> "wv", "georgia" -> "ga"
    const stateAbbrMap = {
      'texas': 'tx',
      'west virginia': 'wv',
      'georgia': 'ga',
      'south carolina': 'sc',
      'california': 'ca',
      'new york': 'ny',
      'utah': 'ut',
      'idaho': 'id',
      'arizona': 'az'
    };
    const abbr = stateAbbrMap[selLower];
    if (abbr && (locStr.includes(`, ${abbr}`) || locStr.includes(` ${abbr}`))) return true;

    return false;
  });
};

// Parse any date value (ISO string, epoch number, numeric string, date string) into a Date object
export const parseJobDate = (rawDate) => {
  if (!rawDate) return null;
  if (rawDate instanceof Date) return isNaN(rawDate.getTime()) ? null : rawDate;
  if (typeof rawDate === 'number') {
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof rawDate === 'string') {
    const str = rawDate.trim();
    if (!str) return null;
    if (/^\d{10,13}$/.test(str)) {
      const d = new Date(parseInt(str, 10));
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

// Format job created/posted date into readable relative time (e.g., "5 days ago", "1 day ago", "Today")
export const formatJobDate = (rawDate) => {
  const jobDate = parseJobDate(rawDate);
  if (!jobDate) return 'Recently';

  const now = new Date();
  const diffMs = now.getTime() - jobDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays > 1 && diffDays <= 30) return `${diffDays} days ago`;
  if (diffDays > 30) return `${diffDays} days ago`;

  return jobDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Check if a single job matches selected date posted tags
export const checkDateMatch = (job, selectedDates) => {
  if (!selectedDates || selectedDates.length === 0) return true;
  const rawDate = job.postedDate || job.postingDate || job.createdAt;
  const jobDate = parseJobDate(rawDate);
  if (!jobDate) return false;

  const now = new Date();
  const diffDays = (now.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24);

  return selectedDates.some(tag => {
    if (tag === 'Last 24 Hours' || tag === '1 Day Ago' || tag === '1 Day') return diffDays >= 0 && diffDays <= 1;
    if (tag === 'Last 7 Days' || tag === '7 Days Ago' || tag === '7 Days') return diffDays >= 0 && diffDays <= 7;
    if (tag === 'Last 14 Days' || tag === '14 Days Ago' || tag === '14 Days') return diffDays >= 0 && diffDays <= 14;
    if (tag === 'Last 30 Days' || tag === '30 Days Ago' || tag === '30 Days') return diffDays >= 0 && diffDays <= 30;
    if (tag === 'More than 30 Days' || tag === '30+ Days' || tag === 'Older') return diffDays > 30 || diffDays < 0;
    return false;
  });
};

// Default fallback location tree for Coforge openings
const DEFAULT_TREE = {
  USA: {
    Texas: ['Dallas', 'Austin', 'Houston'],
    Utah: ['Salt Lake City'],
    Georgia: ['Augusta', 'Atlanta'],
    'West Virginia': ['Charleston'],
    'South Carolina': ['Fort Mill', 'Charleston'],
    Idaho: ['Boise'],
    Arizona: ['Phoenix'],
    Pennsylvania: ['Oaks', 'Philadelphia'],
    'New Jersey': ['Hackensack'],
    Minnesota: ['Minneapolis']
  },
  India: {
    Telangana: ['Hyderabad'],
    Karnataka: ['Bengaluru'],
    Maharashtra: ['Mumbai', 'Pune'],
    'Uttar Pradesh': ['Noida', 'Greater Noida'],
    'West Bengal': ['Kolkata']
  },
  UK: {
    England: ['London']
  },
  Spain: {
    'Community of Madrid': ['Madrid']
  },
  Australia: {
    'New South Wales': ['Sydney'],
    Victoria: ['Melbourne']
  },
  Mexico: {
    'Mexico City': ['Mexico City']
  }
};

// Dynamically extract locationTree from jobs
export const buildLocationTree = (jobs = []) => {
  // Deep clone default tree
  const tree = JSON.parse(JSON.stringify(DEFAULT_TREE));

  if (!Array.isArray(jobs)) return tree;

  jobs.forEach(job => {
    let countries = Array.isArray(job.country) && job.country.length > 0
      ? job.country.map(normalizeCountry)
      : [];
    let states = Array.isArray(job.state) && job.state.length > 0 ? job.state : [];
    let cities = Array.isArray(job.city) && job.city.length > 0 ? job.city : [];

    const locStr = String(job.location || '');

    if (countries.length === 0) {
      if (locStr.toLowerCase().includes('usa') || locStr.toLowerCase().includes('us')) {
        countries = ['USA'];
      } else if (locStr.toLowerCase().includes('india')) {
        countries = ['India'];
      } else if (locStr.toLowerCase().includes('uk') || locStr.toLowerCase().includes('london')) {
        countries = ['UK'];
      } else if (locStr.toLowerCase().includes('spain') || locStr.toLowerCase().includes('madrid')) {
        countries = ['Spain'];
      } else if (locStr.toLowerCase().includes('australia') || locStr.toLowerCase().includes('sydney')) {
        countries = ['Australia'];
      } else if (locStr.toLowerCase().includes('mexico')) {
        countries = ['Mexico'];
      }
    }

    countries.forEach(country => {
      if (!tree[country]) tree[country] = {};

      if (states.length > 0) {
        states.forEach(state => {
          if (!tree[country][state]) tree[country][state] = [];

          if (cities.length > 0) {
            cities.forEach(city => {
              if (!tree[country][state].includes(city)) {
                tree[country][state].push(city);
              }
            });
          }
        });
      }
    });
  });

  return tree;
};
