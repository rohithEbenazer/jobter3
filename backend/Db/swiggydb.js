// swiggydb.js - Mongoose Model and DB helper for Swiggy Jobs
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
    console.log(`[Swiggy DB] MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error(`[Swiggy DB] Database connection error: ${error.message}`);
    throw error;
  } finally {
    isConnectingPromise = null;
  }
};

const swiggyJobSchema = new mongoose.Schema({
  source: { type: String, default: 'Swiggy', index: true },
  company: { type: String, default: 'Swiggy', index: true },
  id: { type: String, required: true, index: true },
  jobId: { type: String, required: true, index: true },
  displayJobId: { type: String },
  title: { type: String, required: true, index: true },
  category: { type: String, index: true },
  department: { type: String },
  businessUnit: { type: String },
  location: { type: String, index: true },
  city: [{ type: String }],
  state: [{ type: String }],
  country: [{ type: String }],
  minYears: { type: Number, default: 0 },
  maxYears: { type: Number, default: 99 },
  minYrsOfExperience: { type: Number, default: 0 },
  maxYrsOfExperience: { type: Number, default: 99 },
  yrsOfExperience: { type: String, default: 'Not specified' },
  experienceRequired: { type: String, default: 'Not specified' },
  workmode: { type: String, default: 'On-site', index: true },
  jobUrl: { type: String },
  url: { type: String },
  applyJobUrl: { type: String },
  detailsUrl: { type: String },
  skills: [{ type: String }],
  salary: { type: String, default: 'Competitive Package' },
  shift: { type: String, default: 'Day Shift' },
  description: { type: String },
  descriptionHtml: { type: String },
  basicQualifications: { type: String },
  preferredQualifications: { type: String },
  postedDate: { type: String, index: true },
  postingDate: { type: String },
  role: { type: String },
  mandateSkills: { type: String }
}, {
  collection: 'swiggy_jobs',
  timestamps: true
});

swiggyJobSchema.index({ source: 1, jobId: 1 }, { unique: true });
swiggyJobSchema.index({ createdAt: -1 });
swiggyJobSchema.index({ postedDate: -1 });

const SwiggyJob = mongoose.models.SwiggyJob || mongoose.model('SwiggyJob', swiggyJobSchema);

module.exports = {
  connectDB,
  SwiggyJob
};
