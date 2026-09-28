// Support .env environment variables if present
const mongoose = require('mongoose');
const dotenv = require('dotenv');
try { dotenv.config(); } catch (e) {}

const DEFAULT_ATLAS_URI = 'mongodb+srv://rohithebenazer34_db_user:O2u61ChzAMan3qSP@job777.nwlfd54.mongodb.net/job777?retryWrites=true&w=majority&appName=job777';

/**
 * Connect to MongoDB database
 * @param {string} [customUri] Optional MongoDB URI override
 * @returns {Promise<mongoose.Connection>}
 */
const connectDB = async (customUri) => {
  const mongoURI = customUri || process.env.MONGODB_URI || DEFAULT_ATLAS_URI;
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }
  try {
    const conn = await mongoose.connect(mongoURI);
    console.log(`[Cogforce DB] MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error(`[Cogforce DB] Database connection error: ${error.message}`);
    throw error;
  }
};

/**
 * Mongoose Schema for Cogforce / Coforge Jobs
 */
const cogforceJobSchema = new mongoose.Schema(
  {
    source: { type: String, default: 'Coforge', index: true },
    company: { type: String, default: 'Coforge', index: true },
    jobId: { type: String, required: true, index: true },
    id: { type: String },
    title: { type: String, default: 'Coforge Opening' },
    category: { type: String, default: 'Engineering' },
    location: { type: String, default: 'India' },
    city: { type: [String], default: [] },
    state: { type: [String], default: [] },
    country: { type: [String], default: [] },
    url: { type: String, default: '' },
    jobUrl: { type: String, default: '' },
    workmode: { type: String, default: null },
    postingDate: { type: String, default: '' },
    postedDate: { type: String, default: '' },
    descriptionHtml: { type: String, default: '' },
    description: { type: String, default: '' },
    overview: { type: String, default: '' },
    details: { type: String, default: '' },
    experienceRequired: { type: String, default: 'Not specified' },
    yrsOfExperience: { type: String, default: '' },
    minYears: { type: Number, default: 0 },
    maxYears: { type: Number, default: 99 },
    minYrsOfExperience: { type: Number, default: 0 },
    maxYrsOfExperience: { type: Number, default: 99 },
    skills: { type: [String], default: [] },
    mandateSkills: { type: mongoose.Schema.Types.Mixed, default: null },
    role: { type: String, default: null },
    salary: { type: String, default: 'Competitive Salary' },
    shift: { type: String, default: 'Day Shift' },
    updatedAt: { type: Date, default: Date.now }
  },
  { collection: 'cogforce_jobs', timestamps: true }
);

// Unique index compound on source and jobId
cogforceJobSchema.index({ source: 1, jobId: 1 }, { unique: true });

const CogforceJob = mongoose.models.CogforceJob || mongoose.model('CogforceJob', cogforceJobSchema);

module.exports = {
  connectDB,
  CogforceJob,
  cogforceJobSchema
};
