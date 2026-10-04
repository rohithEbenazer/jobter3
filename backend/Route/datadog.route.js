// datadog.route.js - Dedicated Express router for DataDog Job APIs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  fetchAllDataDogJobs,
  syncDataDogJobsWithDb,
  fetchDataDogJobById
} = require('../api/datadog.api');

const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { DataDogJob } = require('../Db/datadogdb');

/**
 * @route   GET /api/jobs/datadog
 * @desc    Fetch live DataDog jobs directly from Typesense API
 * @access  Public
 */
router.get(['/', '/live'], async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const jobs = await fetchAllDataDogJobs({ maxJobs: limit });
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching live DataDog jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/datadog/db
 * @desc    Fetch stored DataDog jobs from MongoDB with filter & pagination
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
    const filter = { source: 'DataDog' };

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let TargetModel = DataDogJob || CogforceJob;
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
    console.error('Error fetching DataDog jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/datadog/sync
 * @desc    Trigger sync of live DataDog jobs into MongoDB
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
    const summary = await syncDataDogJobsWithDb(DataDogJob || CogforceJob, limit);
    res.json(summary);
  } catch (err) {
    console.error('Error during DataDog DB sync:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/datadog/:id
 * @desc    Get job details by ID from MongoDB or directly from Greenhouse/Typesense API
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await connectDB();
    const TargetModel = DataDogJob || CogforceJob;
    let job = await TargetModel.findOne({ $or: [{ jobId: id }, { id: id }, { displayJobId: id }] });
    if (!job) {
      const rawApiDetail = await fetchDataDogJobById(id);
      if (rawApiDetail) {
        job = rawApiDetail;
      }
    }
    if (!job) {
      return res.status(404).json({ success: false, message: 'DataDog job not found' });
    }
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
