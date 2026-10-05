// walmartdb.js - Dedicated Mongoose Schema & DB Connection for Walmart Jobs
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
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4
    });
    const conn = await isConnectingPromise;
    console.log(`[Walmart DB] MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error(`[Walmart DB] Database connection error: ${error.message}`);
    throw error;
  } finally {
    isConnectingPromise = null;
  }
};

/**
 * Dedicated Mongoose Schema for Walmart Jobs
 */
const walmartJobSchema = new mongoose.Schema(
  {
    source: { type: String, default: 'Walmart', index: true },
    company: { type: String, default: 'Walmart', index: true },
    jobId: { type: String, required: true, index: true },
    id: { type: String, index: true },
    displayJobId: { type: String, default: '' },
    title: { type: String, default: 'Walmart Opening' },
    category: { type: String, default: 'Software Engineering & Technology' },
    department: { type: String, default: 'Global Tech & eCommerce' },
    businessUnit: { type: String, default: 'Walmart Inc.' },
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
    role: { type: String, default: 'Software Engineer' },
    qualifications: { type: String, default: '' },
    applyBy: { type: String, default: '' },
    salary: { type: String, default: 'Competitive Package' },
    minPay: { type: Number, default: 0 },
    maxPay: { type: Number, default: 0 },
    payFrequency: { type: String, default: 'Annual' },
    shift: { type: String, default: 'Day Shift' },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: 'walmart_jobs', timestamps: true }
);

// Indexes for fast lookup & sorting without memory limit errors
walmartJobSchema.index({ source: 1, jobId: 1 }, { unique: true });
walmartJobSchema.index({ createdAt: -1 });
walmartJobSchema.index({ postedDate: -1 });
walmartJobSchema.index({ source: 1, createdAt: -1 });

const WalmartJob = mongoose.models.WalmartJob || mongoose.model('WalmartJob', walmartJobSchema);

module.exports = {
  connectDB,
  WalmartJob,
  walmartJobSchema
};
