// jobs.route.js - Unified Jobs Router supporting Coforge, Microsoft, Amazon, Netflix, or All Companies
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { fetchAllCoforgeJobs, syncCogforceJobsWithDb } = require('../api/cogforce.api');
const { fetchAllMicrosoftJobs, syncMicrosoftJobsWithDb } = require('../api/microsoft.api');
const { fetchAllAmazonJobs, syncAmazonJobsWithDb } = require('../api/amazon.api');
const { fetchAllNetflixJobs, syncNetflixJobsWithDb } = require('../api/netflix.api');
const { fetchAllSalesforceJobs, syncSalesforceJobsWithDb } = require('../api/salesforce.api');
const { fetchAllZohoJobs, syncZohoJobsWithDb } = require('../api/zoho.api');
const { fetchAllIntelJobs, syncIntelJobsWithDb } = require('../api/intel.api');
const { fetchAllNvidiaJobs, syncNvidiaJobsWithDb } = require('../api/nvidia.api');
const { fetchAllOracleJobs, syncOracleJobsWithDb } = require('../api/oracle.api');
const { fetchAllAmdJobs, syncAmdJobsWithDb } = require('../api/amd.api');
const { fetchAllWiproJobs, syncWiproJobsWithDb } = require('../api/wipro.api');

const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { MicrosoftJob } = require('../Db/microsoftdb');
const { AmazonJob } = require('../Db/amazondb');
const { NetflixJob } = require('../Db/netflixdb');
const { SalesforceJob } = require('../Db/salesforcedb');
const { ZohoJob } = require('../Db/zohodb');
const { IntelJob } = require('../Db/inteldb');
const { NvidiaJob } = require('../Db/nvidiadb');
const { OracleJob } = require('../Db/oracledb');
const { AmdJob } = require('../Db/amddb');
const { WiproJob } = require('../Db/wiprodb');

/**
 * Helper to normalize company query param
 */
function parseCompanyFilter(companyParam) {
  if (!companyParam || companyParam === 'All' || companyParam === 'all' || companyParam === 'ALL') {
    return null; // All companies
  }
  if (Array.isArray(companyParam)) {
    return companyParam.map(c => String(c).trim());
  }
  const parts = String(companyParam).split(',').map(s => s.trim()).filter(Boolean);
  if (parts.includes('All') || parts.includes('all')) return null;
  return parts;
}

/**
 * @route   GET /api/jobs/live
 * @desc    Fetch live jobs from Coforge, Microsoft, Amazon, Netflix, Salesforce, Zoho, Intel, NVIDIA, or All
 */
router.get(['/live', '/'], async (req, res) => {
  try {
    const { company = 'All', maxJobs = 100 } = req.query;
    const selectedCompanies = parseCompanyFilter(company);

    let jobs = [];

    const fetchCoforge = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'coforge' || c.toLowerCase() === 'cogforce');
    const fetchMicrosoft = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'microsoft');
    const fetchAmazon = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'amazon');
    const fetchNetflix = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'netflix');
    const fetchSalesforce = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'salesforce' || c.toLowerCase() === 'sf');
    const fetchZoho = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'zoho');
    const fetchIntel = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'intel');
    const fetchNvidia = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'nvidia');
    const fetchOracle = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'oracle');
    const fetchAmd = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'amd');
    const fetchWipro = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'wipro');

    const tasks = [];
    if (fetchCoforge) tasks.push(fetchAllCoforgeJobs());
    if (fetchMicrosoft) tasks.push(fetchAllMicrosoftJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchAmazon) tasks.push(fetchAllAmazonJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchNetflix) tasks.push(fetchAllNetflixJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchSalesforce) tasks.push(fetchAllSalesforceJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchZoho) tasks.push(fetchAllZohoJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchIntel) tasks.push(fetchAllIntelJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchNvidia) tasks.push(fetchAllNvidiaJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchOracle) tasks.push(fetchAllOracleJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchAmd) tasks.push(fetchAllAmdJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchWipro) tasks.push(fetchAllWiproJobs({ maxJobs: parseInt(maxJobs, 10) }));

    const results = await Promise.all(tasks);
    results.forEach(arr => {
      if (Array.isArray(arr)) jobs.push(...arr);
    });

    res.json(jobs);
  } catch (err) {
    console.error('Error fetching live jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/db
 * @desc    Fetch stored jobs from MongoDB with filters (Title, Location, Company, Date, Pagination)
 */
router.get('/db', async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[Unified DB Route] Connect DB failed:', err.message);
    return res.status(500).json({ success: false, error: `MongoDB Connection Error: ${err.message}` });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, error: 'MongoDB connection is not established.' });
  }

  try {
    const { company, source, title, location, days, datePosted, limit = 5000, page = 1 } = req.query;
    const filter = {};

    // Company filter (Coforge / Microsoft / Amazon / Netflix / Salesforce / Zoho / Intel / NVIDIA / All)
    const compVal = company || source;
    const selectedCompanies = parseCompanyFilter(compVal);

    if (selectedCompanies && selectedCompanies.length > 0) {
      const regexPatterns = selectedCompanies.map(c => new RegExp(`^${c}$`, 'i'));
      filter.source = { $in: regexPatterns };
    }

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    // Date posted filter
    const daysParam = days || datePosted;
    if (daysParam) {
      const now = new Date();
      if (daysParam === '1' || daysParam === '1day' || daysParam === '24h' || daysParam === 'Last 24 Hours') {
        const d1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        filter.$or = [{ postedDate: { $gte: d1.toISOString() } }, { createdAt: { $gte: d1 } }];
      } else if (daysParam === '7' || daysParam === '7days' || daysParam === 'Last 7 Days') {
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filter.$or = [{ postedDate: { $gte: d7.toISOString() } }, { createdAt: { $gte: d7 } }];
      } else if (daysParam === '14' || daysParam === '14days' || daysParam === 'Last 14 Days') {
        const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        filter.$or = [{ postedDate: { $gte: d14.toISOString() } }, { createdAt: { $gte: d14 } }];
      } else if (daysParam === '30' || daysParam === '30days' || daysParam === 'Last 30 Days') {
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filter.$or = [{ postedDate: { $gte: d30.toISOString() } }, { createdAt: { $gte: d30 } }];
      } else if (daysParam === 'older' || daysParam === '30+' || daysParam === 'More than 30 Days') {
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filter.$or = [{ postedDate: { $lt: d30.toISOString() } }, { createdAt: { $lt: d30 } }];
      }
    }

    const limitNum = parseInt(limit, 10);
    const pageNum = parseInt(page, 10);
    const skip = (pageNum - 1) * limitNum;

    let allDbJobs = [];
    const queryMicrosoft = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'microsoft');
    const queryCoforge = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'coforge' || c.toLowerCase() === 'cogforce');
    const queryAmazon = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'amazon');
    const queryNetflix = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'netflix');
    const querySalesforce = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'salesforce' || c.toLowerCase() === 'sf');
    const queryZoho = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'zoho');
    const queryIntel = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'intel');
    const queryNvidia = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'nvidia');
    const queryOracle = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'oracle');
    const queryAmd = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'amd');
    const queryWipro = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'wipro');

    const tasks = [];
    if (queryCoforge && CogforceJob) {
      tasks.push(CogforceJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryMicrosoft && MicrosoftJob) {
      tasks.push(MicrosoftJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryAmazon && AmazonJob) {
      tasks.push(AmazonJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryNetflix && NetflixJob) {
      tasks.push(NetflixJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (querySalesforce && SalesforceJob) {
      tasks.push(SalesforceJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryZoho && ZohoJob) {
      tasks.push(ZohoJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryIntel && IntelJob) {
      tasks.push(IntelJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryNvidia && NvidiaJob) {
      tasks.push(NvidiaJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryOracle && OracleJob) {
      tasks.push(OracleJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryAmd && AmdJob) {
      tasks.push(AmdJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryWipro && WiproJob) {
      tasks.push(WiproJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }

    const results = await Promise.all(tasks);
    results.forEach(arr => {
      if (Array.isArray(arr)) allDbJobs.push(...arr.map(j => (j.toObject ? j.toObject() : j)));
    });

    // Deduplicate by jobId if needed
    const seenIds = new Set();
    const uniqueJobs = [];
    for (const job of allDbJobs) {
      const idKey = String(job.jobId || job.id);
      if (idKey && !seenIds.has(idKey)) {
        seenIds.add(idKey);
        uniqueJobs.push(job);
      }
    }

    // Sort combined jobs across all sources chronologically (newest first)
    uniqueJobs.sort((a, b) => {
      const dateA = new Date(a.postedDate || a.postingDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.postedDate || b.postingDate || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    const total = uniqueJobs.length;
    const paginatedJobs = limitNum > 0 ? uniqueJobs.slice(skip, skip + limitNum) : uniqueJobs;

    res.json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      jobs: paginatedJobs
    });
  } catch (err) {
    console.error('Error fetching jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/sync
 * @desc    Trigger live DB sync for Coforge, Microsoft, Amazon, Netflix, Salesforce, Zoho, Intel, NVIDIA, or All Companies
 */
router.post(['/sync', '/dbsync'], async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[Sync Route] DB connection error:', err.message);
    return res.status(500).json({ success: false, error: `MongoDB Connection Error: ${err.message}` });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, error: 'MongoDB connection state is not connected.' });
  }

  try {
    const { company = 'All', limit: limitParam } = { ...(req.query || {}), ...(req.body || {}) };
    const selectedCompanies = parseCompanyFilter(company);
    const limit = limitParam ? parseInt(limitParam) : null;

    const syncCoforge = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'coforge' || c.toLowerCase() === 'cogforce');
    const syncMicrosoft = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'microsoft');
    const syncAmazon = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'amazon');
    const syncNetflix = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'netflix');
    const syncSalesforce = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'salesforce' || c.toLowerCase() === 'sf');
    const syncZoho = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'zoho');
    const syncIntel = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'intel');
    const syncNvidia = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'nvidia');
    const syncOracle = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'oracle');
    const syncAmd = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'amd');
    const syncWipro = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'wipro');

    let coforgeStats = null;
    let microsoftStats = null;
    let amazonStats = null;
    let netflixStats = null;
    let salesforceStats = null;
    let zohoStats = null;
    let intelStats = null;
    let nvidiaStats = null;
    let oracleStats = null;
    let amdStats = null;
    let wiproStats = null;

    if (syncCoforge) {
      coforgeStats = await syncCogforceJobsWithDb(CogforceJob);
    }
    if (syncMicrosoft) {
      microsoftStats = await syncMicrosoftJobsWithDb(MicrosoftJob || CogforceJob, limit);
    }
    if (syncAmazon) {
      amazonStats = await syncAmazonJobsWithDb(AmazonJob || CogforceJob, limit);
    }
    if (syncNetflix) {
      netflixStats = await syncNetflixJobsWithDb(NetflixJob || CogforceJob, limit);
    }
    if (syncSalesforce) {
      salesforceStats = await syncSalesforceJobsWithDb(SalesforceJob || CogforceJob, limit);
    }
    if (syncZoho) {
      zohoStats = await syncZohoJobsWithDb(ZohoJob || CogforceJob, limit);
    }
    if (syncIntel) {
      intelStats = await syncIntelJobsWithDb(IntelJob || CogforceJob, limit);
    }
    if (syncNvidia) {
      nvidiaStats = await syncNvidiaJobsWithDb(NvidiaJob || CogforceJob, limit);
    }
    if (syncOracle) {
      oracleStats = await syncOracleJobsWithDb(OracleJob || CogforceJob, limit);
    }
    if (syncAmd) {
      amdStats = await syncAmdJobsWithDb(AmdJob || CogforceJob, limit);
    }
    if (syncWipro) {
      wiproStats = await syncWiproJobsWithDb(WiproJob || CogforceJob, limit);
    }

    const totalFetchedRaw = (coforgeStats?.stats?.totalFetchedRaw || 0) + (microsoftStats?.stats?.totalFetchedRaw || 0) + (amazonStats?.stats?.totalFetchedRaw || 0) + (netflixStats?.stats?.totalFetchedRaw || 0) + (salesforceStats?.stats?.totalFetchedRaw || 0) + (zohoStats?.stats?.totalFetchedRaw || 0) + (intelStats?.stats?.totalFetchedRaw || 0) + (nvidiaStats?.stats?.totalFetchedRaw || 0) + (oracleStats?.stats?.totalFetchedRaw || 0) + (amdStats?.stats?.totalFetchedRaw || 0) + (wiproStats?.stats?.totalFetchedRaw || 0);
    const insertedToDb = (coforgeStats?.stats?.insertedToDb || 0) + (microsoftStats?.stats?.insertedToDb || 0) + (amazonStats?.stats?.insertedToDb || 0) + (netflixStats?.stats?.insertedToDb || 0) + (salesforceStats?.stats?.insertedToDb || 0) + (zohoStats?.stats?.insertedToDb || 0) + (intelStats?.stats?.insertedToDb || 0) + (nvidiaStats?.stats?.insertedToDb || 0) + (oracleStats?.stats?.insertedToDb || 0) + (amdStats?.stats?.insertedToDb || 0) + (wiproStats?.stats?.insertedToDb || 0);
    const updatedOrKeptInDb = (coforgeStats?.stats?.updatedOrKeptInDb || 0) + (microsoftStats?.stats?.updatedOrKeptInDb || 0) + (amazonStats?.stats?.updatedOrKeptInDb || 0) + (netflixStats?.stats?.updatedOrKeptInDb || 0) + (salesforceStats?.stats?.updatedOrKeptInDb || 0) + (zohoStats?.stats?.updatedOrKeptInDb || 0) + (intelStats?.stats?.updatedOrKeptInDb || 0) + (nvidiaStats?.stats?.updatedOrKeptInDb || 0) + (oracleStats?.stats?.updatedOrKeptInDb || 0) + (amdStats?.stats?.updatedOrKeptInDb || 0) + (wiproStats?.stats?.updatedOrKeptInDb || 0);

    const countCoforge = CogforceJob ? await CogforceJob.countDocuments() : 0;
    const countMicrosoft = MicrosoftJob ? await MicrosoftJob.countDocuments() : 0;
    const countAmazon = AmazonJob ? await AmazonJob.countDocuments() : 0;
    const countNetflix = NetflixJob ? await NetflixJob.countDocuments() : 0;
    const countSalesforce = SalesforceJob ? await SalesforceJob.countDocuments() : 0;
    const countZoho = ZohoJob ? await ZohoJob.countDocuments() : 0;
    const countIntel = IntelJob ? await IntelJob.countDocuments() : 0;
    const countNvidia = NvidiaJob ? await NvidiaJob.countDocuments() : 0;
    const countOracle = OracleJob ? await OracleJob.countDocuments() : 0;
    const countAmd = AmdJob ? await AmdJob.countDocuments() : 0;
    const countWipro = WiproJob ? await WiproJob.countDocuments() : 0;
    const finalDbCount = countCoforge + countMicrosoft + countAmazon + countNetflix + countSalesforce + countZoho + countIntel + countNvidia + countOracle + countAmd + countWipro;

    res.json({
      success: true,
      message: `DB sync completed for ${selectedCompanies ? selectedCompanies.join(', ') : 'All Companies'}.`,
      stats: {
        totalFetchedRaw,
        insertedToDb,
        updatedOrKeptInDb,
        finalDbCount,
        coforge: coforgeStats?.stats || null,
        microsoft: microsoftStats?.stats || null,
        amazon: amazonStats?.stats || null,
        netflix: netflixStats?.stats || null,
        salesforce: salesforceStats?.stats || null,
        zoho: zohoStats?.stats || null,
        intel: intelStats?.stats || null,
        nvidia: nvidiaStats?.stats || null,
        oracle: oracleStats?.stats || null,
        amd: amdStats?.stats || null,
        wipro: wiproStats?.stats || null
      }
    });
  } catch (err) {
    console.error('Error during DB sync:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/:id
 * @desc    Get job details by ID from MongoDB across collections
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (mongoose.connection.readyState === 1) {
      let dbJob = await CogforceJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      if (!dbJob && MicrosoftJob) {
        dbJob = await MicrosoftJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (!dbJob && AmazonJob) {
        dbJob = await AmazonJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (!dbJob && NetflixJob) {
        dbJob = await NetflixJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (!dbJob && SalesforceJob) {
        dbJob = await SalesforceJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (!dbJob && ZohoJob) {
        dbJob = await ZohoJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (!dbJob && IntelJob) {
        dbJob = await IntelJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (!dbJob && NvidiaJob) {
        dbJob = await NvidiaJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (!dbJob && OracleJob) {
        dbJob = await OracleJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (!dbJob && AmdJob) {
        dbJob = await AmdJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (!dbJob && WiproJob) {
        dbJob = await WiproJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (dbJob) {
        return res.json({ success: true, job: dbJob });
      }
    }
    res.status(404).json({ success: false, error: 'Job not found in database.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
