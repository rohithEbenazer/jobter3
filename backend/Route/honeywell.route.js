// honeywell.route.js - Dedicated Express router for Honeywell Job APIs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  fetchAllHoneywellJobs,
  syncHoneywellJobsWithDb,
  fetchHoneywellJobById
} = require('../api/honeywell.api');

const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { HoneywellJob } = require('../Db/honeywelldb');

/**
 * @route   GET /api/jobs/honeywell
 * @desc    Fetch live Honeywell jobs directly from Oracle HCM API
 * @access  Public
 */
router.get(['/', '/live'], async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 150;
    const fetchDetails = req.query.details !== 'false';
    const jobs = await fetchAllHoneywellJobs({ maxJobs: limit, fetchDetails });
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching live Honeywell jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/honeywell/db
 * @desc    Fetch stored Honeywell jobs from MongoDB with filter & pagination
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
    const filter = { source: 'Honeywell' };

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let TargetModel = HoneywellJob || CogforceJob;
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
    console.error('Error fetching Honeywell jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/honeywell/sync
 * @desc    Trigger sync of live Honeywell jobs into MongoDB
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
    const limit = req.body?.limit || req.query?.limit ? parseInt(req.body?.limit || req.query?.limit) : 150;
    const fetchDetails = req.body?.fetchDetails !== false;
    const result = await syncHoneywellJobsWithDb({ maxJobs: limit, fetchDetails });
    res.json(result);
  } catch (err) {
    console.error('Error syncing Honeywell jobs with DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/honeywell/details/:reqId
 * @desc    Fetch single Honeywell job details by requisition ID
 * @access  Public
 */
router.get('/details/:reqId', async (req, res) => {
  try {
    const { reqId } = req.params;
    const detail = await fetchHoneywellJobById(reqId);
    if (!detail) {
      return res.status(404).json({ success: false, error: 'Honeywell job details not found' });
    }
    res.json({ success: true, details: detail });
  } catch (err) {
    console.error('Error fetching Honeywell job details:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
