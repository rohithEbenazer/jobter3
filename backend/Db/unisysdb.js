// unisysdb.js - Dedicated Mongoose Schema & DB Connection for Unisys Jobs
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
    console.log(`[Unisys DB] MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error(`[Unisys DB] Database connection error: ${error.message}`);
    throw error;
  } finally {
    isConnectingPromise = null;
  }
};

/**
 * Dedicated Mongoose Schema for Unisys Jobs
 */
const unisysJobSchema = new mongoose.Schema(
  {
    source: { type: String, default: 'Unisys', index: true },
    company: { type: String, default: 'Unisys', index: true },
    jobId: { type: String, required: true, index: true },
    id: { type: String, index: true },
    title: { type: String, default: 'Unisys Opening' },
    category: { type: String, default: 'IT Services & Cloud Solutions' },
    department: { type: String, default: 'Engineering & Technology' },
    businessUnit: { type: String, default: 'Unisys' },
    location: { type: String, default: 'Global' },
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
    role: { type: String, default: 'IT Services & Cloud Solutions' },
    salary: { type: String, default: 'Competitive Package' },
    shift: { type: String, default: 'Day Shift' },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: 'unisys_jobs', timestamps: true }
);

// Compound index for unique Unisys job IDs
unisysJobSchema.index({ source: 1, jobId: 1 }, { unique: true });
unisysJobSchema.index({ createdAt: -1 });
unisysJobSchema.index({ postedDate: -1 });
unisysJobSchema.index({ source: 1, createdAt: -1 });

const UnisysJob = mongoose.models.UnisysJob || mongoose.model('UnisysJob', unisysJobSchema);

module.exports = {
  connectDB,
  UnisysJob,
  unisysJobSchema
};
