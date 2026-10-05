// walmart.route.js - Dedicated Express router for Walmart Job APIs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  fetchAllWalmartJobs,
  syncWalmartJobsWithDb,
  fetchWalmartJobById
} = require('../api/walmart.api');

const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { WalmartJob } = require('../Db/walmartdb');

/**
 * @route   GET /api/jobs/walmart
 * @desc    Fetch live Walmart jobs directly from Walmart GraphQL API
 * @access  Public
 */
router.get(['/', '/live'], async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 150;
    const fetchDetails = req.query.details !== 'false';
    const jobs = await fetchAllWalmartJobs({ maxJobs: limit, fetchDetails });
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching live Walmart jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/walmart/db
 * @desc    Fetch stored Walmart jobs from MongoDB with filter & pagination
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
    const filter = { source: 'Walmart' };

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let TargetModel = WalmartJob || CogforceJob;
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
    console.error('Error fetching Walmart jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/walmart/sync
 * @desc    Trigger sync of live Walmart jobs into MongoDB
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
    const result = await syncWalmartJobsWithDb({ maxJobs: limit, fetchDetails });
    res.json(result);
  } catch (err) {
    console.error('Error syncing Walmart jobs with DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/walmart/details/:jobId
 * @desc    Fetch single Walmart job details by job ID
 * @access  Public
 */
router.get('/details/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const detail = await fetchWalmartJobById(jobId);
    if (!detail) {
      return res.status(404).json({ success: false, error: 'Walmart job details not found' });
    }
    res.json({ success: true, details: detail });
  } catch (err) {
    console.error('Error fetching Walmart job details:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
