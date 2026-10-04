// swiggy.route.js - Express routes for Swiggy Careers Integration
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { fetchAllSwiggyJobs, syncSwiggyJobsWithDb } = require('../api/swiggy.api');
const { connectDB, SwiggyJob } = require('../Db/swiggydb');

/**
 * @route   GET /api/jobs/swiggy/live
 * @desc    Stream live jobs directly from Swiggy Careers API
 */
router.get(['/live', '/'], async (req, res) => {
  try {
    const { maxJobs = 100 } = req.query;
    const jobs = await fetchAllSwiggyJobs({ maxJobs: parseInt(maxJobs, 10) });
    res.json(jobs);
  } catch (err) {
    console.error('[Swiggy Route] Error fetching live jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/swiggy/db
 * @desc    Fetch Swiggy jobs from MongoDB collection with filters
 */
router.get('/db', async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[Swiggy DB Route] Connect DB failed:', err.message);
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

    const total = await SwiggyJob.countDocuments(filter);
    const jobs = await SwiggyJob.find(filter)
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
    console.error('[Swiggy DB Route] Error fetching jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/swiggy/sync
 * @desc    Trigger live fetch & sync into MongoDB for Swiggy
 */
router.post(['/sync', '/dbsync'], async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[Swiggy Sync Route] Connect DB failed:', err.message);
    return res.status(500).json({ success: false, error: `MongoDB Connection Error: ${err.message}` });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, error: 'MongoDB connection state is not connected.' });
  }

  try {
    const { limit: limitParam } = { ...(req.query || {}), ...(req.body || {}) };
    const limit = limitParam ? parseInt(limitParam, 10) : 200;

    const result = await syncSwiggyJobsWithDb(SwiggyJob, limit);
    res.json(result);
  } catch (err) {
    console.error('[Swiggy Sync Route] Error syncing jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/swiggy/:id
 * @desc    Fetch single Swiggy job details by ID from DB
 */
router.get('/:id', async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    const job = await SwiggyJob.findOne({ $or: [{ jobId: String(id) }, { id: String(id) }] });
    if (job) {
      return res.json({ success: true, job });
    }
    res.status(404).json({ success: false, error: 'Swiggy job not found' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
