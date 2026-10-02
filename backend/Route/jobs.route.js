// jobs.route.js - Unified Jobs Router supporting Coforge, Microsoft, or All Companies
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { fetchAllCoforgeJobs, syncCogforceJobsWithDb } = require('../api/cogforce.api');
const { fetchAllMicrosoftJobs, syncMicrosoftJobsWithDb } = require('../api/microsoft.api');
const { fetchAllAmazonJobs, syncAmazonJobsWithDb } = require('../api/amazon.api');
const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { MicrosoftJob } = require('../Db/microsoftdb');
const { AmazonJob } = require('../Db/amazondb');

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
 * @desc    Fetch live jobs from Coforge, Microsoft, or All
 */
router.get(['/live', '/'], async (req, res) => {
  try {
    const { company = 'All', maxJobs = 100 } = req.query;
    const selectedCompanies = parseCompanyFilter(company);

    let jobs = [];

    const fetchCoforge = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'coforge');
    const fetchMicrosoft = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'microsoft');
    const fetchAmazon = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'amazon');

    const tasks = [];
    if (fetchCoforge) tasks.push(fetchAllCoforgeJobs());
    if (fetchMicrosoft) tasks.push(fetchAllMicrosoftJobs({ maxJobs: parseInt(maxJobs, 10) }));
    if (fetchAmazon) tasks.push(fetchAllAmazonJobs({ maxJobs: parseInt(maxJobs, 10) }));

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

    // Company filter (Coforge / Microsoft / All)
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
    const queryCoforge = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'coforge');
    const queryAmazon = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'amazon');

    const tasks = [];
    if (queryCoforge && CogforceJob) {
      tasks.push(CogforceJob.find(filter).sort({ createdAt: -1 }));
    }
    if (queryMicrosoft && MicrosoftJob) {
      tasks.push(MicrosoftJob.find(filter).sort({ createdAt: -1 }));
    }
    if (queryAmazon && AmazonJob) {
      tasks.push(AmazonJob.find(filter).sort({ createdAt: -1 }));
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
 * @desc    Trigger live DB sync for Coforge, Microsoft, or All Companies
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

    const syncCoforge = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'coforge');
    const syncMicrosoft = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'microsoft');
    const syncAmazon = !selectedCompanies || selectedCompanies.some(c => c.toLowerCase() === 'amazon');

    let coforgeStats = null;
    let microsoftStats = null;
    let amazonStats = null;

    if (syncCoforge) {
      coforgeStats = await syncCogforceJobsWithDb(CogforceJob);
    }
    if (syncMicrosoft) {
      microsoftStats = await syncMicrosoftJobsWithDb(MicrosoftJob || CogforceJob, limit);
    }
    if (syncAmazon) {
      amazonStats = await syncAmazonJobsWithDb(AmazonJob || CogforceJob, limit);
    }

    const totalFetchedRaw = (coforgeStats?.stats?.totalFetchedRaw || 0) + (microsoftStats?.stats?.totalFetchedRaw || 0) + (amazonStats?.stats?.totalFetchedRaw || 0);
    const insertedToDb = (coforgeStats?.stats?.insertedToDb || 0) + (microsoftStats?.stats?.insertedToDb || 0) + (amazonStats?.stats?.insertedToDb || 0);
    const updatedOrKeptInDb = (coforgeStats?.stats?.updatedOrKeptInDb || 0) + (microsoftStats?.stats?.updatedOrKeptInDb || 0) + (amazonStats?.stats?.updatedOrKeptInDb || 0);
    const finalDbCount = await CogforceJob.countDocuments();

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
        amazon: amazonStats?.stats || null
      }
    });
  } catch (err) {
    console.error('Error during DB sync:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/:id
 * @desc    Get job details by ID from MongoDB
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (mongoose.connection.readyState === 1) {
      const dbJob = await CogforceJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
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
