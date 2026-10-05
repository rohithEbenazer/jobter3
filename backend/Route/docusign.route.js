// docusign.route.js - Dedicated Express router for DocuSign Job APIs
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const {
  fetchAllDocuSignJobs,
  syncDocuSignJobsWithDb,
  fetchSimilarDocuSignJobs,
  fetchDocuSignPage,
  mapDocuSignJob
} = require('../api/docusign.api');

const { connectDB, CogforceJob } = require('../Db/cogforcedb');
const { DocuSignJob } = require('../Db/docusigndb');

/**
 * @route   GET /api/jobs/docusign/live
 * @desc    Fetch live DocuSign jobs directly from careers API
 * @access  Public
 */
router.get(['/', '/live'], async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const jobs = await fetchAllDocuSignJobs(limit);
    res.json({
      success: true,
      count: jobs.length,
      jobs: jobs
    });
  } catch (err) {
    console.error('Error fetching live DocuSign jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/docusign/db
 * @desc    Fetch stored DocuSign jobs from MongoDB with filter & pagination
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
    const filter = { source: 'DocuSign' };

    if (title) {
      filter.title = { $regex: title, $options: 'i' };
    }
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let TargetModel = DocuSignJob || CogforceJob;
    let total = await TargetModel.countDocuments(filter);
    if (total === 0 && TargetModel !== CogforceJob) {
      TargetModel = CogforceJob;
      total = await CogforceJob.countDocuments(filter);
    }

    const rawJobs = await TargetModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      jobs: rawJobs
    });
  } catch (err) {
    console.error('Error fetching DocuSign jobs from DB:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/docusign/sync
 * @desc    Trigger sync of live DocuSign jobs into MongoDB
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
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const result = await syncDocuSignJobsWithDb(limit);
    res.json(result);
  } catch (err) {
    console.error('Error syncing DocuSign jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/jobs/docusign/similar-jobs
 * @desc    Fetch similar jobs for a given job slug
 * @access  Public
 */
router.post('/similar-jobs', async (req, res) => {
  try {
    const { slug, language = 'en-us' } = req.body || {};
    if (!slug) {
      return res.status(400).json({ success: false, error: 'Job slug is required' });
    }
    const similarJobs = await fetchSimilarDocuSignJobs(slug, language);
    const mapped = similarJobs.map(mapDocuSignJob).filter(Boolean);
    res.json({
      success: true,
      count: mapped.length,
      similarJobs: mapped,
      rawSimilarJobs: similarJobs
    });
  } catch (err) {
    console.error('Error fetching similar DocuSign jobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/jobs/docusign/:jobId
 * @desc    Fetch specific DocuSign job by ID/slug with similar jobs attached
 * @access  Public
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    await connectDB();

    let TargetModel = DocuSignJob || CogforceJob;
    let job = await TargetModel.findOne({ source: 'DocuSign', $or: [{ jobId }, { id: jobId }] });

    if (!job) {
      // Try live API page scan if not found in DB
      const pageData = await fetchDocuSignPage(1);
      if (pageData && pageData.jobs) {
        const found = pageData.jobs.find(j => (j.data?.slug === jobId || j.data?.req_id === jobId));
        if (found) {
          job = mapDocuSignJob(found);
        }
      }
    }

    if (!job) {
      return res.status(404).json({ success: false, error: `DocuSign job with ID/slug '${jobId}' not found` });
    }

    const similarRaw = await fetchSimilarDocuSignJobs(jobId);
    const similarJobs = similarRaw.map(mapDocuSignJob).filter(Boolean);

    res.json({
      success: true,
      job,
      similarJobs
    });
  } catch (err) {
    console.error('Error fetching DocuSign job detail:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
