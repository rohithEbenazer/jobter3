// browserstack.route.js - Express routes for BrowserStack Careers Integration
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { fetchAllBrowserStackJobs, syncBrowserStackJobsWithDb } = require('../api/browserstack.api');
const { connectDB, BrowserStackJob } = require('../Db/browserstackdb');

/**
 * @route   GET /api/jobs/browserstack/live
 * @desc    Stream live jobs directly from BrowserStack Workday API
 */
router.get(['/live', '/'], async (req, res) => {
  try {
    const { maxJobs = 100 } = req.query;
    const jobs = await fetchAllBrowserStackJobs({ maxJobs: parseInt(maxJobs, 10) });
    res.json(jobs);
  } catch (err) {
    console.error('[BrowserStack Route] Error fetching live jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/browserstack/db
 * @desc    Fetch stored jobs from MongoDB for BrowserStack
 */
router.get('/db', async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[BrowserStack DB Route] Connect DB failed:', err.message);
    return res.status(500).json({ success: false, error: `MongoDB Connection Error: ${err.message}` });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, error: 'MongoDB connection is not established.' });
  }

  try {
    const { title, location, limit = 50, page = 1 } = req.query;
    const filter = {};

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const limitNum = parseInt(limit, 10);
    const pageNum = parseInt(page, 10);
    const skip = (pageNum - 1) * limitNum;

    const total = await BrowserStackJob.countDocuments(filter);
    const jobs = await BrowserStackJob.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      jobs
    });
  } catch (err) {
    console.error('[BrowserStack DB Route] Error fetching jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/browserstack/sync
 * @desc    Trigger live fetch & MongoDB sync for BrowserStack
 */
router.post(['/sync', '/dbsync'], async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[BrowserStack Sync Route] Connect DB failed:', err.message);
    return res.status(500).json({ success: false, error: `MongoDB Connection Error: ${err.message}` });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, error: 'MongoDB connection state is not connected.' });
  }

  try {
    const { limit: limitParam } = { ...(req.query || {}), ...(req.body || {}) };
    const limit = limitParam ? parseInt(limitParam, 10) : 200;

    const result = await syncBrowserStackJobsWithDb(BrowserStackJob, limit);
    res.json(result);
  } catch (err) {
    console.error('[BrowserStack Sync Route] Error syncing jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/browserstack/:id
 * @desc    Fetch single BrowserStack job details by ID from DB
 */
router.get('/:id', async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    const job = await BrowserStackJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
    if (job) {
      return res.json({ success: true, job });
    }
    res.status(404).json({ success: false, error: 'BrowserStack job not found' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
