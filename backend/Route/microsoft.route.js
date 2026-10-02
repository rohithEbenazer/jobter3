// microsoft.route.js - Dedicated Express router for Microsoft Job APIs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  fetchAllMicrosoftJobs,
  fetchMicrosoftJobDetails,
  syncMicrosoftJobsWithDb,
  extractSalary
} = require('../api/microsoft.api');

const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { MicrosoftJob } = require('../Db/microsoftdb');

/**
 * @route   GET /api/jobs/microsoft
 * @desc    Fetch live Microsoft jobs directly from careers API
 * @access  Public
 */
router.get(['/', '/live'], async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const jobs = await fetchAllMicrosoftJobs(limit);
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching live Microsoft jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/microsoft/db
 * @desc    Fetch stored Microsoft jobs from MongoDB with filter & pagination
 * @access  Public
 */
router.get('/db', async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[DB Route] Connect DB failed:', err.message);
    return res.status(500).json({ success: false, error: `MongoDB Connection Error: ${err.message}` });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, error: 'MongoDB connection is not established.' });
  }
  try {
    const { title, location, days, datePosted, limit = 50, page = 1 } = req.query;
    const filter = { source: 'Microsoft' };

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const daysParam = days || datePosted;
    if (daysParam) {
      const now = new Date();
      if (daysParam === '1' || daysParam === '1day' || daysParam === '24h' || daysParam === 'Last 24 Hours') {
        const d1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        filter.$or = [
          { postedDate: { $gte: d1.toISOString() } },
          { createdAt: { $gte: d1 } }
        ];
      } else if (daysParam === '7' || daysParam === '7days' || daysParam === 'Last 7 Days') {
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filter.$or = [
          { postedDate: { $gte: d7.toISOString() } },
          { createdAt: { $gte: d7 } }
        ];
      } else if (daysParam === '14' || daysParam === '14days' || daysParam === 'Last 14 Days') {
        const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        filter.$or = [
          { postedDate: { $gte: d14.toISOString() } },
          { createdAt: { $gte: d14 } }
        ];
      } else if (daysParam === '30' || daysParam === '30days' || daysParam === 'Last 30 Days') {
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filter.$or = [
          { postedDate: { $gte: d30.toISOString() } },
          { createdAt: { $gte: d30 } }
        ];
      } else if (daysParam === 'older' || daysParam === '30+' || daysParam === 'More than 30 Days') {
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filter.$or = [
          { postedDate: { $lt: d30.toISOString() } },
          { createdAt: { $lt: d30 } }
        ];
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Check MicrosoftJob collection first; fallback to CogforceJob if empty
    let TargetModel = MicrosoftJob || CogforceJob;
    let total = await TargetModel.countDocuments(filter);
    if (total === 0 && TargetModel !== CogforceJob) {
      TargetModel = CogforceJob;
      total = await CogforceJob.countDocuments(filter);
    }

    const rawJobs = await TargetModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const jobs = rawJobs.map(j => {
      const jobObj = j.toObject ? j.toObject() : { ...j };
      if (!jobObj.salary || /^(not disclosed|competitive salary|competitive industry package|null|undefined)$/i.test(String(jobObj.salary))) {
        const extracted = extractSalary(jobObj, jobObj.description || jobObj.descriptionHtml || jobObj.overview || '');
        if (extracted && extracted !== 'Not Disclosed') {
          jobObj.salary = extracted;
        }
      }
      return jobObj;
    });

    res.json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      jobs
    });
  } catch (err) {
    console.error('Error fetching Microsoft jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/microsoft/sync
 * @desc    Trigger sync of live Microsoft jobs into MongoDB
 * @access  Public
 */
router.post(['/sync', '/dbsync'], async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[Sync Route] DB connection error:', err.message);
    return res.status(500).json({
      success: false,
      error: `MongoDB Connection Error: ${err.message}`
    });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: `MongoDB connection state is ${mongoose.connection.readyState} (Expected 1=Connected).`
    });
  }
  try {
    const summary = await syncMicrosoftJobsWithDb(MicrosoftJob || CogforceJob);
    res.json(summary);
  } catch (err) {
    console.error('Error during Microsoft DB sync:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/microsoft/:id
 * @desc    Get job details by ID from MongoDB
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (mongoose.connection.readyState === 1) {
      let dbJob = await MicrosoftJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
      if (!dbJob) {
        dbJob = await CogforceJob.findOne({ source: 'Microsoft', $or: [{ jobId: String(id) }, { id: String(id) }] });
      }
      if (dbJob) {
        return res.json({ success: true, job: dbJob });
      }
    }
    res.status(404).json({ success: false, error: 'Microsoft Job not found in database.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
