// synchrony.route.js - Dedicated Express router for Synchrony Financial Job APIs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  fetchAllSynchronyJobs,
  syncSynchronyJobsWithDb,
  fetchSynchronyJobById
} = require('../api/synchrony.api');

const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { SynchronyJob } = require('../Db/synchronydb');

/**
 * @route   GET /api/jobs/synchrony
 * @desc    Fetch live Synchrony Financial jobs directly from Workday API
 * @access  Public
 */
router.get(['/', '/live'], async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const jobs = await fetchAllSynchronyJobs({ maxJobs: limit });
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching live Synchrony Financial jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/synchrony/db
 * @desc    Fetch stored Synchrony Financial jobs from MongoDB with filter & pagination
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
    const filter = { source: 'Synchrony Financial' };

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let TargetModel = SynchronyJob || CogforceJob;
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
    console.error('Error fetching Synchrony Financial jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/synchrony/sync
 * @desc    Trigger sync of live Synchrony Financial jobs into MongoDB
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
    const result = await syncSynchronyJobsWithDb({ maxJobs: parseInt(limit) });
    res.json(result);
  } catch (err) {
    console.error('Error syncing Synchrony Financial jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/synchrony/details/*
 * @desc    Fetch details of a single Synchrony Financial job by external path
 * @access  Public
 */
router.get(['/details/*', '/job/*'], async (req, res) => {
  try {
    const externalPath = req.params[0];
    const job = await fetchSynchronyJobById(externalPath);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job details not found' });
    }
    res.json(job);
  } catch (err) {
    console.error('Error fetching Synchrony Financial job details:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
