// apiConfig.js - Dynamic API endpoint resolver for Localhost & Vercel deployment
const getBaseHost = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000';
  }
  return '';
};

export const API_HOST = import.meta.env.VITE_API_HOST || getBaseHost();
export const API_BASE = `${API_HOST}/api/jobs`;
export const COFORGE_API_BASE = `${API_HOST}/api/jobs/cogforce`;
export const MICROSOFT_API_BASE = `${API_HOST}/api/jobs/microsoft`;
export const AMAZON_API_BASE = `${API_HOST}/api/jobs/amazon`;
export const NETFLIX_API_BASE = `${API_HOST}/api/jobs/netflix`;
export const SALESFORCE_API_BASE = `${API_HOST}/api/jobs/salesforce`;
export const ZOHO_API_BASE = `${API_HOST}/api/jobs/zoho`;
