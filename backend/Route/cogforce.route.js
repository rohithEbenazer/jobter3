// cogforce.route.js - Dedicated Express router for Cogforce / Coforge Job APIs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  fetchAllCoforgeJobs,
  fetchCoforgeJobDetailsUrl,
  syncCogforceJobsWithDb
} = require('../api/cogforce.api');

const { CogforceJob } = require('../Db/cogforcedb');

/**
 * @route   GET /api/jobs/cogforce
 * @desc    Fetch live Coforge jobs directly from careers API
 * @access  Public
 */
router.get(['/', '/live'], async (req, res) => {
  try {
    const jobs = await fetchAllCoforgeJobs();
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching live Cogforce jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/cogforce/db
 * @desc    Fetch stored Cogforce jobs from MongoDB with filter & pagination
 * @access  Public
 */
router.get('/db', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      const liveJobs = await fetchAllCoforgeJobs();
      return res.json({ success: true, total: liveJobs.length, page: 1, limit: liveJobs.length, jobs: liveJobs });
    } catch (err) {
      return res.status(503).json({ success: false, error: 'MongoDB connection is not established.' });
    }
  }
  try {
    const { title, location, days, datePosted, limit = 50, page = 1 } = req.query;
    const filter = { source: 'Coforge' };

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    // Date posted filter (1 day, 7 days, 14 days, 30 days, 30+ days)
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
    const jobs = await CogforceJob.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CogforceJob.countDocuments(filter);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      jobs
    });
  } catch (err) {
    console.error('Error fetching Cogforce jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/cogforce/sync
 * @desc    Trigger sync of live Coforge jobs into MongoDB
 * @access  Public
 */
router.post(['/sync', '/dbsync'], async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, error: 'MongoDB connection is not established.' });
  }
  try {
    const summary = await syncCogforceJobsWithDb(CogforceJob);
    res.json(summary);
  } catch (err) {
    console.error('Error during Coforge DB sync:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/cogforce/:id
 * @desc    Get job details by ID from MongoDB
 * @access  Public
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
