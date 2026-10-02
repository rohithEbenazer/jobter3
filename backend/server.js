
// ============================================================
// COFORGE / COGFORCE SERVER ROUTES (server.js)
// ============================================================
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

// 1. Import API handler functions from cogforce.api.js
const { 
  fetchAllCoforgeJobs, 
  fetchCoforgeJobDetailsUrl, 
  syncCogforceJobsWithDb 
} = require('./api/cogforce.api');

const app = express();
app.use(express.json());

// Enable CORS for frontend cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// 2. Import DB connection and Cogforce Job model from cogforcedb
const { connectDB, CogforceJob } = require('./Db/cogforcedb');

// Ensure MongoDB is connected before handling any incoming request
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.warn('[MongoDB Middleware Warning]', err.message);
  }
  next();
});

// 3. Import and Mount Routes
const cogforceRouter = require('./Route/cogforce.route');
const microsoftRouter = require('./Route/microsoft.route');
const amazonRouter = require('./Route/amazon.route');
const jobsRouter = require('./Route/jobs.route');

// Dedicated company routes
app.use('/api/jobs/cogforce', cogforceRouter);
app.use('/api/jobs/coforge', cogforceRouter);
app.use('/api/jobs/microsoft', microsoftRouter);
app.use('/api/jobs/amazon', amazonRouter);

// Primary unified jobs route: handles /api/jobs (db, sync, live, :id) with company filtering
app.use('/api/jobs', jobsRouter);

// Server listen for local standalone running
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }).catch(err => {
    console.error('MongoDB connection failed before server start:', err.message);
    app.listen(PORT);
  });
}

module.exports = app;