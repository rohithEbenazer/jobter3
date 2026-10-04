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
export const INTEL_API_BASE = `${API_HOST}/api/jobs/intel`;
export const NVIDIA_API_BASE = `${API_HOST}/api/jobs/nvidia`;
export const ORACLE_API_BASE = `${API_HOST}/api/jobs/oracle`;
export const AMD_API_BASE = `${API_HOST}/api/jobs/amd`;
export const WIPRO_API_BASE = `${API_HOST}/api/jobs/wipro`;
export const MEESHO_API_BASE = `${API_HOST}/api/jobs/meesho`;
export const CAPGEMINI_API_BASE = `${API_HOST}/api/jobs/capgemini`;
export const GOLDMAN_SACHS_API_BASE = `${API_HOST}/api/jobs/goldmansachs`;
export const QUALCOMM_API_BASE = `${API_HOST}/api/jobs/qualcomm`;
export const TCS_API_BASE = `${API_HOST}/api/jobs/tcs`;
export const GENPACT_API_BASE = `${API_HOST}/api/jobs/genpact`;
export const JPMC_API_BASE = `${API_HOST}/api/jobs/jpmc`;
export const SWIGGY_API_BASE = `${API_HOST}/api/jobs/swiggy`;
export const BROWSERSTACK_API_BASE = `${API_HOST}/api/jobs/browserstack`;
export const BROADCOM_API_BASE = `${API_HOST}/api/jobs/broadcom`;
export const DATADOG_API_BASE = `${API_HOST}/api/jobs/datadog`;
export const AMERICAN_EXPRESS_API_BASE = `${API_HOST}/api/jobs/americanexpress`;
export const PERSISTENT_API_BASE = `${API_HOST}/api/jobs/persistent`;
export const UNISYS_API_BASE = `${API_HOST}/api/jobs/unisys`;
export const FLEXTRONICS_API_BASE = `${API_HOST}/api/jobs/flextronics`;
