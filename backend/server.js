
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
const netflixRouter = require('./Route/netflix.route');
const salesforceRouter = require('./Route/salesforce.route');
const zohoRouter = require('./Route/zoho.route');
const intelRouter = require('./Route/intel.route');
const nvidiaRouter = require('./Route/nvidia.route');
const oracleRouter = require('./Route/oracle.route');
const amdRouter = require('./Route/amd.route');
const wiproRouter = require('./Route/wipro.route');
const meeshoRouter = require('./Route/meesho.route');
const capgeminiRouter = require('./Route/capgemini.route');
const goldmanSachsRouter = require('./Route/goldmansachs.route');
const qualcommRouter = require('./Route/qualcomm.route');
const tcsRouter = require('./Route/tcs.route');
const genpactRouter = require('./Route/genpact.route');
const jpmcRouter = require('./Route/jpmc.route');
const swiggyRouter = require('./Route/swiggy.route');
const browserstackRouter = require('./Route/browserstack.route');
const jobsRouter = require('./Route/jobs.route');

// Dedicated company routes
app.use('/api/jobs/cogforce', cogforceRouter);
app.use('/api/jobs/coforge', cogforceRouter);
app.use('/api/jobs/microsoft', microsoftRouter);
app.use('/api/jobs/amazon', amazonRouter);
app.use('/api/jobs/netflix', netflixRouter);
app.use('/api/jobs/salesforce', salesforceRouter);
app.use('/api/jobs/zoho', zohoRouter);
app.use('/api/jobs/intel', intelRouter);
app.use('/api/jobs/nvidia', nvidiaRouter);
app.use('/api/jobs/oracle', oracleRouter);
app.use('/api/jobs/amd', amdRouter);
app.use('/api/jobs/wipro', wiproRouter);
app.use('/api/jobs/meesho', meeshoRouter);
app.use('/api/jobs/capgemini', capgeminiRouter);
app.use('/api/jobs/goldmansachs', goldmanSachsRouter);
app.use('/api/jobs/gs', goldmanSachsRouter);
app.use('/api/jobs/qualcomm', qualcommRouter);
app.use('/api/jobs/tcs', tcsRouter);
app.use('/api/jobs/tcsibegin', tcsRouter);
app.use('/api/jobs/genpact', genpactRouter);
app.use('/api/jobs/jpmc', jpmcRouter);
app.use('/api/jobs/jpmorgan', jpmcRouter);
app.use('/api/jobs/swiggy', swiggyRouter);
app.use('/api/jobs/browserstack', browserstackRouter);

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