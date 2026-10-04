// jobs.route.js - Unified Jobs Router supporting Capgemini, Coforge, Microsoft, Amazon, Netflix, Salesforce, Zoho, Intel, NVIDIA, Oracle, AMD, Wipro, Meesho, Goldman Sachs, Qualcomm, or All Companies
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
const { fetchAllMeeshoJobs, syncMeeshoJobsWithDb } = require('../api/meesho.api');
const { fetchAllCapgeminiJobs, syncCapgeminiJobsWithDb } = require('../api/capgemini.api');
const { fetchAllGoldmanSachsJobs, syncGoldmanSachsJobsWithDb } = require('../api/goldmansachs.api');
const { fetchAllQualcommJobs, syncQualcommJobsWithDb } = require('../api/qualcomm.api');
const { fetchAllTcsJobs, syncTcsJobsWithDb } = require('../api/tcs.api');
const { fetchAllGenpactJobs, syncGenpactJobsWithDb } = require('../api/genpact.api');
const { fetchAllJpmcJobs, syncJpmcJobsWithDb } = require('../api/jpmc.api');
const { fetchAllSwiggyJobs, syncSwiggyJobsWithDb } = require('../api/swiggy.api');
const { fetchAllBrowserStackJobs, syncBrowserStackJobsWithDb } = require('../api/browserstack.api');
const { fetchAllBroadcomJobs, syncBroadcomJobsWithDb } = require('../api/broadcom.api');
const { fetchAllDataDogJobs, syncDataDogJobsWithDb } = require('../api/datadog.api');
const { fetchAllAmexJobs, syncAmexJobsWithDb } = require('../api/americanexpress.api');
const { fetchAllPersistentJobs, syncPersistentJobsWithDb } = require('../api/persistent.api');
const { fetchAllUnisysJobs, syncUnisysJobsWithDb } = require('../api/unisys.api');

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
const { MeeshoJob } = require('../Db/meeshodb');
const { CapgeminiJob } = require('../Db/capgeminidb');
const { GoldmanSachsJob } = require('../Db/goldmansachsdb');
const { QualcommJob } = require('../Db/qualcommdb');
const { TcsJob } = require('../Db/tcsdb');
const { GenpactJob } = require('../Db/genpactdb');
const { JpmcJob } = require('../Db/jpmcdb');
const { SwiggyJob } = require('../Db/swiggydb');
const { BrowserStackJob } = require('../Db/browserstackdb');
const { BroadcomJob } = require('../Db/broadcomdb');
const { DataDogJob } = require('../Db/datadogdb');
const { AmericanExpressJob } = require('../Db/americanexpressdb');
const { PersistentJob } = require('../Db/persistentdb');
const { UnisysJob } = require('../Db/unisysdb');

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
 * @desc    Fetch live jobs from Capgemini, Coforge, Microsoft, Amazon, Netflix, Salesforce, Zoho, Intel, NVIDIA, Oracle, AMD, Wipro, Meesho, Goldman Sachs, Qualcomm, TCS, Genpact, JPMorgan Chase, or All
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
    const fetchMeesho = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'meesho');
    const fetchCapgemini = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'capgemini' || c.toLowerCase() === 'cg');
    const fetchGoldmanSachs = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'goldmansachs' || c.toLowerCase() === 'goldman sachs' || c.toLowerCase() === 'gs');
    const fetchQualcomm = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'qualcomm' || c.toLowerCase() === 'qc');
    const fetchTcs = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'tcs' || c.toLowerCase() === 'tcsibegin' || c.toLowerCase() === 'tcs ibegin');
    const fetchGenpact = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'genpact');
    const fetchJpmc = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'jpmc' || c.toLowerCase() === 'jpmorgan' || c.toLowerCase() === 'chase');
    const fetchSwiggy = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'swiggy');
    const fetchBrowserStack = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'browserstack' || c.toLowerCase() === 'bs');
    const fetchBroadcom = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'broadcom' || c.toLowerCase() === 'bc');
    const fetchDataDog = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'datadog' || c.toLowerCase() === 'dd');
    const fetchAmex = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'americanexpress' || c.toLowerCase() === 'american express' || c.toLowerCase() === 'amex');
    const fetchPersistent = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'persistent' || c.toLowerCase() === 'persistent systems' || c.toLowerCase() === 'ps');
    const fetchUnisys = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'unisys');

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
    if (fetchMeesho) tasks.push(fetchAllMeeshoJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchCapgemini) tasks.push(fetchAllCapgeminiJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchGoldmanSachs) tasks.push(fetchAllGoldmanSachsJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchQualcomm) tasks.push(fetchAllQualcommJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchTcs) tasks.push(fetchAllTcsJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchGenpact) tasks.push(fetchAllGenpactJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchJpmc) tasks.push(fetchAllJpmcJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchSwiggy) tasks.push(fetchAllSwiggyJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchBrowserStack) tasks.push(fetchAllBrowserStackJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchBroadcom) tasks.push(fetchAllBroadcomJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchDataDog) tasks.push(fetchAllDataDogJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchAmex) tasks.push(fetchAllAmexJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchPersistent) tasks.push(fetchAllPersistentJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchUnisys) tasks.push(fetchAllUnisysJobs({ maxJobs: parseInt(maxJobs, 10) }));

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
    const queryMeesho = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'meesho');
    const queryCapgemini = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'capgemini' || c.toLowerCase() === 'cg');
    const queryGoldmanSachs = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'goldmansachs' || c.toLowerCase() === 'goldman sachs' || c.toLowerCase() === 'gs');
    const queryQualcomm = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'qualcomm' || c.toLowerCase() === 'qc');
    const queryTcs = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'tcs' || c.toLowerCase() === 'tcsibegin' || c.toLowerCase() === 'tcs ibegin');
    const queryGenpact = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'genpact');
    const queryJpmc = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'jpmc' || c.toLowerCase() === 'jpmorgan' || c.toLowerCase() === 'chase');
    const querySwiggy = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'swiggy');
    const queryBrowserStack = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'browserstack' || c.toLowerCase() === 'bs');
    const queryBroadcom = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'broadcom' || c.toLowerCase() === 'bc');
    const queryDataDog = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'datadog' || c.toLowerCase() === 'dd');
    const queryAmex = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'americanexpress' || c.toLowerCase() === 'american express' || c.toLowerCase() === 'amex');
    const queryPersistent = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'persistent' || c.toLowerCase() === 'persistent systems' || c.toLowerCase() === 'ps');
    const queryUnisys = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'unisys');

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
    if (queryMeesho && MeeshoJob) {
      tasks.push(MeeshoJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryCapgemini && CapgeminiJob) {
      tasks.push(CapgeminiJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryGoldmanSachs && GoldmanSachsJob) {
      tasks.push(GoldmanSachsJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryQualcomm && QualcommJob) {
      tasks.push(QualcommJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryTcs && TcsJob) {
      tasks.push(TcsJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryGenpact && GenpactJob) {
      tasks.push(GenpactJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryJpmc && JpmcJob) {
      tasks.push(JpmcJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (querySwiggy && SwiggyJob) {
      tasks.push(SwiggyJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryBrowserStack && BrowserStackJob) {
      tasks.push(BrowserStackJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryBroadcom && BroadcomJob) {
      tasks.push(BroadcomJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryDataDog && DataDogJob) {
      tasks.push(DataDogJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryAmex && AmericanExpressJob) {
      tasks.push(AmericanExpressJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryPersistent && PersistentJob) {
      tasks.push(PersistentJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
    }
    if (queryUnisys && UnisysJob) {
      tasks.push(UnisysJob.find(filter).sort({ createdAt: -1 }).allowDiskUse(true));
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
 * @desc    Trigger live DB sync for Capgemini, Coforge, Microsoft, Amazon, Netflix, Salesforce, Zoho, Intel, NVIDIA, Oracle, AMD, Wipro, Meesho, Goldman Sachs, Qualcomm, or All Companies
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
    const syncMeesho = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'meesho');
    const syncCapgemini = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'capgemini' || c.toLowerCase() === 'cg');
    const syncGoldmanSachs = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'goldmansachs' || c.toLowerCase() === 'goldman sachs' || c.toLowerCase() === 'gs');
    const syncQualcomm = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'qualcomm' || c.toLowerCase() === 'qc');
    const syncTcs = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'tcs' || c.toLowerCase() === 'tcsibegin' || c.toLowerCase() === 'tcs ibegin');
    const syncGenpact = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'genpact');
    const syncJpmc = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'jpmc' || c.toLowerCase() === 'jpmorgan' || c.toLowerCase() === 'chase');
    const syncSwiggy = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'swiggy');
    const syncBrowserStack = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'browserstack' || c.toLowerCase() === 'bs');
    const syncBroadcom = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'broadcom' || c.toLowerCase() === 'bc');
    const syncDataDog = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'datadog' || c.toLowerCase() === 'dd');
    const syncAmex = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'americanexpress' || c.toLowerCase() === 'american express' || c.toLowerCase() === 'amex');
    const syncPersistent = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'persistent' || c.toLowerCase() === 'persistent systems' || c.toLowerCase() === 'ps');
    const syncUnisys = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'unisys');

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
    let meeshoStats = null;
    let capgeminiStats = null;
    let goldmanSachsStats = null;
    let qualcommStats = null;
    let tcsStats = null;
    let genpactStats = null;
    let jpmcStats = null;
    let swiggyStats = null;
    let browserStackStats = null;
    let broadcomStats = null;
    let dataDogStats = null;
    let amexStats = null;
    let persistentStats = null;
    let unisysStats = null;

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
    if (syncMeesho) {
      meeshoStats = await syncMeeshoJobsWithDb(MeeshoJob || CogforceJob, limit);
    }
    if (syncCapgemini) {
      capgeminiStats = await syncCapgeminiJobsWithDb(CapgeminiJob || CogforceJob, limit);
    }
    if (syncGoldmanSachs) {
      goldmanSachsStats = await syncGoldmanSachsJobsWithDb(GoldmanSachsJob || CogforceJob, limit);
    }
    if (syncQualcomm) {
      qualcommStats = await syncQualcommJobsWithDb(QualcommJob || CogforceJob, limit);
    }
    if (syncTcs) {
      tcsStats = await syncTcsJobsWithDb(TcsJob || CogforceJob, limit);
    }
    if (syncGenpact) {
      genpactStats = await syncGenpactJobsWithDb(GenpactJob || CogforceJob, limit);
    }
    if (syncJpmc) {
      jpmcStats = await syncJpmcJobsWithDb(JpmcJob || CogforceJob, limit);
    }
    if (syncSwiggy) {
      swiggyStats = await syncSwiggyJobsWithDb(SwiggyJob || CogforceJob, limit);
    }
    if (syncBrowserStack) {
      browserStackStats = await syncBrowserStackJobsWithDb(BrowserStackJob || CogforceJob, limit);
    }
    if (syncBroadcom) {
      broadcomStats = await syncBroadcomJobsWithDb(BroadcomJob || CogforceJob, limit);
    }
    if (syncDataDog) {
      dataDogStats = await syncDataDogJobsWithDb(DataDogJob || CogforceJob, limit);
    }
    if (syncAmex) {
      amexStats = await syncAmexJobsWithDb(AmericanExpressJob || CogforceJob, limit);
    }
    if (syncPersistent) {
      persistentStats = await syncPersistentJobsWithDb(PersistentJob || CogforceJob, limit);
    }
    if (syncUnisys) {
      unisysStats = await syncUnisysJobsWithDb(UnisysJob || CogforceJob, limit);
    }

    const totalFetchedRaw = (coforgeStats?.stats?.totalFetchedRaw || 0) + (microsoftStats?.stats?.totalFetchedRaw || 0) + (amazonStats?.stats?.totalFetchedRaw || 0) + (netflixStats?.stats?.totalFetchedRaw || 0) + (salesforceStats?.stats?.totalFetchedRaw || 0) + (zohoStats?.stats?.totalFetchedRaw || 0) + (intelStats?.stats?.totalFetchedRaw || 0) + (nvidiaStats?.stats?.totalFetchedRaw || 0) + (oracleStats?.stats?.totalFetchedRaw || 0) + (amdStats?.stats?.totalFetchedRaw || 0) + (wiproStats?.stats?.totalFetchedRaw || 0) + (meeshoStats?.stats?.totalFetchedRaw || 0) + (capgeminiStats?.stats?.totalFetchedRaw || 0) + (goldmanSachsStats?.stats?.totalFetchedRaw || 0) + (qualcommStats?.stats?.totalFetchedRaw || 0) + (tcsStats?.stats?.totalFetchedRaw || 0) + (genpactStats?.stats?.totalFetchedRaw || 0) + (jpmcStats?.stats?.totalFetchedRaw || 0) + (swiggyStats?.stats?.totalFetchedRaw || 0) + (browserStackStats?.stats?.totalFetchedRaw || 0) + (broadcomStats?.stats?.totalFetchedRaw || 0) + (dataDogStats?.stats?.totalFetchedRaw || 0) + (amexStats?.stats?.totalFetchedRaw || 0) + (persistentStats?.stats?.totalFetchedRaw || 0) + (unisysStats?.stats?.totalFetchedRaw || 0);
    const insertedToDb = (coforgeStats?.stats?.insertedToDb || 0) + (microsoftStats?.stats?.insertedToDb || 0) + (amazonStats?.stats?.insertedToDb || 0) + (netflixStats?.stats?.insertedToDb || 0) + (salesforceStats?.stats?.insertedToDb || 0) + (zohoStats?.stats?.insertedToDb || 0) + (intelStats?.stats?.insertedToDb || 0) + (nvidiaStats?.stats?.insertedToDb || 0) + (oracleStats?.stats?.insertedToDb || 0) + (amdStats?.stats?.insertedToDb || 0) + (wiproStats?.stats?.insertedToDb || 0) + (meeshoStats?.stats?.insertedToDb || 0) + (capgeminiStats?.stats?.insertedToDb || 0) + (goldmanSachsStats?.stats?.insertedToDb || 0) + (qualcommStats?.stats?.insertedToDb || 0) + (tcsStats?.stats?.insertedToDb || 0) + (genpactStats?.stats?.insertedToDb || 0) + (jpmcStats?.stats?.insertedToDb || 0) + (swiggyStats?.stats?.insertedToDb || 0) + (browserStackStats?.stats?.insertedToDb || 0) + (broadcomStats?.stats?.insertedToDb || 0) + (dataDogStats?.stats?.insertedToDb || 0) + (amexStats?.stats?.insertedToDb || 0) + (persistentStats?.stats?.insertedToDb || 0) + (unisysStats?.stats?.insertedToDb || 0);
    const updatedOrKeptInDb = (coforgeStats?.stats?.updatedOrKeptInDb || 0) + (microsoftStats?.stats?.updatedOrKeptInDb || 0) + (amazonStats?.stats?.updatedOrKeptInDb || 0) + (netflixStats?.stats?.updatedOrKeptInDb || 0) + (salesforceStats?.stats?.updatedOrKeptInDb || 0) + (zohoStats?.stats?.updatedOrKeptInDb || 0) + (intelStats?.stats?.updatedOrKeptInDb || 0) + (nvidiaStats?.stats?.updatedOrKeptInDb || 0) + (oracleStats?.stats?.updatedOrKeptInDb || 0) + (amdStats?.stats?.updatedOrKeptInDb || 0) + (wiproStats?.stats?.updatedOrKeptInDb || 0) + (meeshoStats?.stats?.updatedOrKeptInDb || 0) + (capgeminiStats?.stats?.updatedOrKeptInDb || 0) + (goldmanSachsStats?.stats?.updatedOrKeptInDb || 0) + (qualcommStats?.stats?.updatedOrKeptInDb || 0) + (tcsStats?.stats?.updatedOrKeptInDb || 0) + (genpactStats?.stats?.updatedOrKeptInDb || 0) + (jpmcStats?.stats?.updatedOrKeptInDb || 0) + (swiggyStats?.stats?.updatedOrKeptInDb || 0) + (browserStackStats?.stats?.updatedOrKeptInDb || 0) + (broadcomStats?.stats?.updatedOrKeptInDb || 0) + (dataDogStats?.stats?.updatedOrKeptInDb || 0) + (amexStats?.stats?.updatedOrKeptInDb || 0) + (persistentStats?.stats?.updatedOrKeptInDb || 0) + (unisysStats?.stats?.updatedOrKeptInDb || 0);

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
    const countMeesho = MeeshoJob ? await MeeshoJob.countDocuments() : 0;
    const countCapgemini = CapgeminiJob ? await CapgeminiJob.countDocuments() : 0;
    const countGoldmanSachs = GoldmanSachsJob ? await GoldmanSachsJob.countDocuments() : 0;
    const countQualcomm = QualcommJob ? await QualcommJob.countDocuments() : 0;
    const countTcs = TcsJob ? await TcsJob.countDocuments() : 0;
    const countGenpact = GenpactJob ? await GenpactJob.countDocuments() : 0;
    const countJpmc = JpmcJob ? await JpmcJob.countDocuments() : 0;
    const countSwiggy = SwiggyJob ? await SwiggyJob.countDocuments() : 0;
    const countBrowserStack = BrowserStackJob ? await BrowserStackJob.countDocuments() : 0;
    const countBroadcom = BroadcomJob ? await BroadcomJob.countDocuments() : 0;
    const countDataDog = DataDogJob ? await DataDogJob.countDocuments() : 0;
    const countAmex = AmericanExpressJob ? await AmericanExpressJob.countDocuments() : 0;
    const countPersistent = PersistentJob ? await PersistentJob.countDocuments() : 0;
    const countUnisys = UnisysJob ? await UnisysJob.countDocuments() : 0;
    const finalDbCount = countCoforge + countMicrosoft + countAmazon + countNetflix + countSalesforce + countZoho + countIntel + countNvidia + countOracle + countAmd + countWipro + countMeesho + countCapgemini + countGoldmanSachs + countQualcomm + countTcs + countGenpact + countJpmc + countSwiggy + countBrowserStack + countBroadcom + countDataDog + countAmex + countPersistent + countUnisys;

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
        wipro: wiproStats?.stats || null,
        meesho: meeshoStats?.stats || null,
        capgemini: capgeminiStats?.stats || null,
        goldmanSachs: goldmanSachsStats?.stats || null,
        qualcomm: qualcommStats?.stats || null,
        tcs: tcsStats?.stats || null,
        genpact: genpactStats?.stats || null,
        jpmc: jpmcStats?.stats || null,
        swiggy: swiggyStats?.stats || null,
        browserstack: browserStackStats?.stats || null,
        broadcom: broadcomStats?.stats || null,
        datadog: dataDogStats?.stats || null,
        americanexpress: amexStats?.stats || null,
        persistent: persistentStats?.stats || null,
        unisys: unisysStats?.stats || null
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
      if (!dbJob && MeeshoJob) {
        dbJob = await MeeshoJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (!dbJob && CapgeminiJob) {
        dbJob = await CapgeminiJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (!dbJob && GoldmanSachsJob) {
        dbJob = await GoldmanSachsJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (!dbJob && QualcommJob) {
        dbJob = await QualcommJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }, { displayJobId: String(id) }] });
      }
      if (!dbJob && TcsJob) {
        dbJob = await TcsJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }, { displayJobId: String(id) }] });
      }
      if (!dbJob && GenpactJob) {
        dbJob = await GenpactJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }, { jobReqId: String(id) }, { displayJobId: String(id) }] });
      }
      if (!dbJob && JpmcJob) {
        dbJob = await JpmcJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }, { reqId: String(id) }, { displayJobId: String(id) }] });
      }
      if (!dbJob && SwiggyJob) {
        dbJob = await SwiggyJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }, { reqId: String(id) }, { displayJobId: String(id) }] });
      }
      if (!dbJob && BrowserStackJob) {
        dbJob = await BrowserStackJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }, { reqId: String(id) }, { displayJobId: String(id) }] });
      }
      if (!dbJob && BroadcomJob) {
        dbJob = await BroadcomJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }, { displayJobId: String(id) }] });
      }
      if (!dbJob && DataDogJob) {
        dbJob = await DataDogJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }, { displayJobId: String(id) }] });
      }
      if (!dbJob && AmericanExpressJob) {
        dbJob = await AmericanExpressJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }, { displayJobId: String(id) }] });
      }
      if (!dbJob && PersistentJob) {
        dbJob = await PersistentJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }, { displayJobId: String(id) }] });
      }
      if (!dbJob && UnisysJob) {
        dbJob = await UnisysJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }, { displayJobId: String(id) }] });
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
