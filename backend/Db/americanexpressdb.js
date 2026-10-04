// americanexpressdb.js - Dedicated Mongoose Schema & DB Connection for American Express Jobs
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
    console.log(`[American Express DB] MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error(`[American Express DB] Database connection error: ${error.message}`);
    throw error;
  } finally {
    isConnectingPromise = null;
  }
};

/**
 * Dedicated Mongoose Schema for American Express Jobs
 */
const americanExpressJobSchema = new mongoose.Schema(
  {
    source: { type: String, default: 'American Express', index: true },
    company: { type: String, default: 'American Express', index: true },
    jobId: { type: String, required: true, index: true },
    id: { type: String, index: true },
    title: { type: String, default: 'American Express Opening' },
    category: { type: String, default: 'Technology & Financial Services' },
    department: { type: String, default: 'Engineering & Technology' },
    businessUnit: { type: String, default: 'American Express' },
    location: { type: String, default: 'Not specified' },
    city: { type: [String], default: [] },
    state: { type: [String], default: [] },
    country: { type: [String], default: [] },
    url: { type: String, default: '' },
    jobUrl: { type: String, default: '' },
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
    role: { type: String, default: 'Engineering & Technology' },
    salary: { type: String, default: 'Competitive Package' },
    shift: { type: String, default: 'Day Shift' },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: 'americanexpress_jobs', timestamps: true }
);

// Compound index for unique American Express job IDs
americanExpressJobSchema.index({ source: 1, jobId: 1 }, { unique: true });
americanExpressJobSchema.index({ createdAt: -1 });
americanExpressJobSchema.index({ postedDate: -1 });
americanExpressJobSchema.index({ source: 1, createdAt: -1 });

const AmericanExpressJob = mongoose.models.AmericanExpressJob || mongoose.model('AmericanExpressJob', americanExpressJobSchema);

module.exports = {
  connectDB,
  AmericanExpressJob,
  americanExpressJobSchema
};
