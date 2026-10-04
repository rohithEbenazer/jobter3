// broadcom.route.js - Dedicated Express router for Broadcom Job APIs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  fetchAllBroadcomJobs,
  syncBroadcomJobsWithDb,
  fetchBroadcomJobById
} = require('../api/broadcom.api');

const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { BroadcomJob } = require('../Db/broadcomdb');

/**
 * @route   GET /api/jobs/broadcom
 * @desc    Fetch live Broadcom jobs directly from Workday API
 * @access  Public
 */
router.get(['/', '/live'], async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const jobs = await fetchAllBroadcomJobs({ maxJobs: limit });
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching live Broadcom jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/broadcom/db
 * @desc    Fetch stored Broadcom jobs from MongoDB with filter & pagination
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
    const filter = { source: 'Broadcom' };

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let TargetModel = BroadcomJob || CogforceJob;
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
    console.error('Error fetching Broadcom jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/broadcom/sync
 * @desc    Trigger sync of live Broadcom jobs into MongoDB
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
    const summary = await syncBroadcomJobsWithDb(BroadcomJob || CogforceJob, limit);
    res.json(summary);
  } catch (err) {
    console.error('Error during Broadcom DB sync:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/broadcom/:id
 * @desc    Get job details by ID from MongoDB or directly from Broadcom Workday API
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await connectDB();
    const TargetModel = BroadcomJob || CogforceJob;
    let job = await TargetModel.findOne({ $or: [{ jobId: id }, { id: id }, { displayJobId: id }] });
    if (!job) {
      const rawApiDetail = await fetchBroadcomJobById(id);
      if (rawApiDetail) {
        job = rawApiDetail;
      }
    }
    if (!job) {
      return res.status(404).json({ success: false, message: 'Broadcom job not found' });
    }
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
