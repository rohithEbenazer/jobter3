// apiConfig.js - Dynamic API endpoint resolver for Localhost & Vercel deployment
export const API_BASE = import.meta.env.VITE_API_BASE || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000/api/jobs/cogforce'
    : '/api/jobs/cogforce');
