// crowdstrike.route.js - Dedicated Express router for CrowdStrike Job APIs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  fetchAllCrowdStrikeJobs,
  syncCrowdStrikeJobsWithDb,
  fetchCrowdStrikeJobById
} = require('../api/crowdstrike.api');

const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { CrowdStrikeJob } = require('../Db/crowdstrikedb');

/**
 * @route   GET /api/jobs/crowdstrike
 * @desc    Fetch live CrowdStrike jobs directly from Workday API
 * @access  Public
 */
router.get(['/', '/live'], async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const locationCountry = req.query.locationCountry ? [req.query.locationCountry] : null;
    const appliedFacets = locationCountry ? { locationCountry } : {};
    
    const jobs = await fetchAllCrowdStrikeJobs({ maxJobs: limit, appliedFacets });
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching live CrowdStrike jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/crowdstrike/db
 * @desc    Fetch stored CrowdStrike jobs from MongoDB with filter & pagination
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
    const { title, location, limit = 5000, page = 1 } = req.query;
    const filter = { source: 'CrowdStrike' };

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let TargetModel = CrowdStrikeJob || CogforceJob;
    let total = await TargetModel.countDocuments(filter);
    if (total === 0 && TargetModel !== CogforceJob) {
      TargetModel = CogforceJob;
      total = await CogforceJob.countDocuments(filter);
    }

    const rawJobs = await TargetModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .allowDiskUse(true);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      jobs: rawJobs
    });
  } catch (err) {
    console.error('Error fetching CrowdStrike jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/crowdstrike/sync
 * @desc    Trigger sync of live CrowdStrike jobs into MongoDB
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

  try {
    const limit = req.body.limit || req.query.limit || 150;
    const result = await syncCrowdStrikeJobsWithDb({ maxJobs: parseInt(limit) });
    res.json(result);
  } catch (err) {
    console.error('Error during CrowdStrike job sync:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/crowdstrike/:id
 * @desc    Get detailed CrowdStrike job by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const jobId = req.params.id;
    await connectDB();
    
    // Check DB first
    let job = null;
    if (CrowdStrikeJob) {
      job = await CrowdStrikeJob.findOne({ $or: [{ jobId }, { id: jobId }] });
    }
    if (!job && CogforceJob) {
      job = await CogforceJob.findOne({ source: 'CrowdStrike', $or: [{ jobId }, { id: jobId }] });
    }

    if (job) {
      return res.json(job);
    }

    // Fallback to API detail fetch
    const liveJob = await fetchCrowdStrikeJobById(jobId);
    if (liveJob) {
      return res.json(liveJob);
    }

    return res.status(404).json({ success: false, message: 'Job not found' });
  } catch (err) {
    console.error(`Error fetching CrowdStrike job ${req.params.id}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
