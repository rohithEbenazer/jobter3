// jpmc.route.js - Dedicated Express router for JPMorgan Chase Job APIs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  fetchAllJpmcJobs,
  syncJpmcJobsWithDb,
  fetchJpmcJobById
} = require('../api/jpmc.api');

const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { JpmcJob } = require('../Db/jpmcdb');

/**
 * @route   GET /api/jobs/jpmc
 * @desc    Fetch live JPMC jobs directly from Oracle Cloud Candidate Experience API
 * @access  Public
 */
router.get(['/', '/live'], async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const fetchDetails = req.query.details !== 'false';
    const jobs = await fetchAllJpmcJobs({ maxJobs: limit }, fetchDetails);
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching live JPMC jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/jpmc/db
 * @desc    Fetch stored JPMC jobs from MongoDB with filter & pagination
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
    const filter = { source: 'JPMorgan Chase' };

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let TargetModel = JpmcJob || CogforceJob;
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
    console.error('Error fetching JPMC jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/jpmc/sync
 * @desc    Trigger sync of live JPMC jobs into MongoDB
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
    const summary = await syncJpmcJobsWithDb(JpmcJob || CogforceJob, limit);
    res.json(summary);
  } catch (err) {
    console.error('Error during JPMC DB sync:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/jpmc/:id
 * @desc    Get job details by ID from MongoDB or directly from Oracle Cloud API
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await connectDB();
    const TargetModel = JpmcJob || CogforceJob;
    let job = await TargetModel.findOne({ $or: [{ jobId: id }, { id: id }, { displayJobId: id }] });
    if (!job) {
      const rawApiDetail = await fetchJpmcJobById(id);
      if (rawApiDetail) {
        job = rawApiDetail;
      }
    }
    if (!job) {
      return res.status(404).json({ success: false, message: 'JPMorgan Chase job not found' });
    }
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
