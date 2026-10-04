// americanexpress.route.js - Dedicated Express router for American Express Job APIs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  fetchAllAmexJobs,
  syncAmexJobsWithDb
} = require('../api/americanexpress.api');

const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { AmericanExpressJob } = require('../Db/americanexpressdb');

/**
 * @route   GET /api/jobs/americanexpress
 * @desc    Fetch live American Express jobs directly from HCM Recruiting API
 * @access  Public
 */
router.get(['/', '/live'], async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const fetchDetails = req.query.details !== 'false';
    const jobs = await fetchAllAmexJobs({ maxJobs: limit }, fetchDetails);
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching live American Express jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/americanexpress/db
 * @desc    Fetch stored American Express jobs from MongoDB with filter & pagination
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
    const filter = { source: 'American Express' };

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let TargetModel = AmericanExpressJob || CogforceJob;
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
    console.error('Error fetching American Express jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/americanexpress/sync
 * @desc    Trigger sync of live American Express jobs into MongoDB
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
    const limit = (req.query.limit || req.body.limit) ? parseInt(req.query.limit || req.body.limit) : null;
    const summary = await syncAmexJobsWithDb(AmericanExpressJob || CogforceJob, limit);
    res.json(summary);
  } catch (err) {
    console.error('Error during American Express DB sync:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/americanexpress/:id
 * @desc    Get job details by ID from MongoDB
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await connectDB();
    const TargetModel = AmericanExpressJob || CogforceJob;
    const job = await TargetModel.findOne({ $or: [{ jobId: id }, { id: id }] });
    if (!job) {
      return res.status(404).json({ success: false, message: 'American Express job not found' });
    }
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
