// flextronics.route.js - Dedicated Express router for Flextronics Job APIs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  fetchAllFlextronicsJobs,
  syncFlextronicsJobsWithDb,
  fetchFlextronicsJobById
} = require('../api/flextronics.api');

const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { FlextronicsJob } = require('../Db/flextronicsdb');

/**
 * @route   GET /api/jobs/flextronics
 * @desc    Fetch live Flextronics jobs directly from Workday API
 * @access  Public
 */
router.get(['/', '/live'], async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const jobs = await fetchAllFlextronicsJobs({ maxJobs: limit });
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching live Flextronics jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/flextronics/db
 * @desc    Fetch stored Flextronics jobs from MongoDB with filter & pagination
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
    const filter = { source: 'Flextronics' };

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let TargetModel = FlextronicsJob || CogforceJob;
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
    console.error('Error fetching Flextronics jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/flextronics/sync
 * @desc    Trigger sync of live Flextronics jobs into MongoDB
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
    const result = await syncFlextronicsJobsWithDb({ maxJobs: parseInt(limit) });
    res.json(result);
  } catch (err) {
    console.error('Error syncing Flextronics jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/flextronics/details/*
 * @desc    Fetch details of a single Flextronics job by external path
 * @access  Public
 */
router.get(['/details/*', '/job/*'], async (req, res) => {
  try {
    const externalPath = req.params[0];
    const job = await fetchFlextronicsJobById(externalPath);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job details not found' });
    }
    res.json(job);
  } catch (err) {
    console.error('Error fetching Flextronics job details:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
