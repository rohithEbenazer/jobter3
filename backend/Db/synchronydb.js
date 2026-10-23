// synchronydb.js - Dedicated Mongoose Schema & DB Connection for Synchrony Financial Jobs
const mongoose = require('mongoose');
const dotenv = require('dotenv');
try { dotenv.config(); } catch (e) {}

const DEFAULT_ATLAS_URI = 'mongodb+srv://rohithebenazer34_db_user:kaJXBrC82BKNyZuK@job777.nwlfd54.mongodb.net/job777?retryWrites=true&w=majority&appName=job777';

let isConnectingPromise = null;

/**
 * Connect to MongoDB database
 * @param {string} [customUri] Optional MongoDB URI override
 * @returns {Promise<mongoose.Connection>}
 */
const connectDB = async (customUri) => {
  const mongoURI = customUri || process.env.MONGODB_URI || DEFAULT_ATLAS_URI;
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (isConnectingPromise) {
    await isConnectingPromise;
    return mongoose.connection;
  }
  try {
    isConnectingPromise = mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      family: 4
    });
    const conn = await isConnectingPromise;
    console.log(`[Synchrony DB] MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error(`[Synchrony DB] Database connection error: ${error.message}`);
    throw error;
  } finally {
    isConnectingPromise = null;
  }
};

/**
 * Dedicated Mongoose Schema for Synchrony Financial Jobs
 */
const synchronyJobSchema = new mongoose.Schema(
  {
    source: { type: String, default: 'Synchrony Financial', index: true },
    company: { type: String, default: 'Synchrony Financial', index: true },
    jobId: { type: String, required: true, index: true },
    id: { type: String, index: true },
    displayJobId: { type: String, default: '' },
    title: { type: String, default: 'Synchrony Financial Opening' },
    category: { type: String, default: 'Financial Services & Technology' },
    department: { type: String, default: 'Technology & Digital' },
    businessUnit: { type: String, default: 'Synchrony Financial' },
    location: { type: String, default: 'Not specified' },
    city: { type: [String], default: [] },
    state: { type: [String], default: [] },
    country: { type: [String], default: [] },
    url: { type: String, default: '' },
    jobUrl: { type: String, default: '' },
    applyJobUrl: { type: String, default: '' },
    detailsUrl: { type: String, default: '' },
    workmode: { type: String, default: 'On-site' },
    postingDate: { type: String, default: '' },
    postedDate: { type: String, default: '' },
    descriptionHtml: { type: String, default: '' },
    description: { type: String, default: '' },
    basicQualifications: { type: String, default: '' },
    preferredQualifications: { type: String, default: '' },
    experienceRequired: { type: String, default: 'Not specified' },
    yrsOfExperience: { type: String, default: 'Not specified' },
    minYears: { type: Number, default: 0 },
    maxYears: { type: Number, default: 99 },
    minYrsOfExperience: { type: Number, default: 0 },
    maxYrsOfExperience: { type: Number, default: 99 },
    skills: { type: [String], default: [] },
    mandateSkills: { type: mongoose.Schema.Types.Mixed, default: null },
    role: { type: String, default: 'Technology / Financial Specialist' },
    qualifications: { type: String, default: '' },
    applyBy: { type: String, default: '' },
    salary: { type: String, default: 'Competitive Package' },
    shift: { type: String, default: 'Day Shift' },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: 'synchrony_jobs', timestamps: true }
);

// Indexes for fast lookup & sorting without memory limit errors
synchronyJobSchema.index({ source: 1, jobId: 1 }, { unique: true });
synchronyJobSchema.index({ createdAt: -1 });
synchronyJobSchema.index({ postedDate: -1 });
synchronyJobSchema.index({ source: 1, createdAt: -1 });

const SynchronyJob = mongoose.models.SynchronyJob || mongoose.model('SynchronyJob', synchronyJobSchema);

module.exports = {
  connectDB,
  SynchronyJob,
  synchronyJobSchema
};
