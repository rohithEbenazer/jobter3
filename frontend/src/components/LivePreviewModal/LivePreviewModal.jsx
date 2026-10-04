import React, { useState, useEffect } from 'react';
import './LivePreviewModal.css';
import { API_BASE, COFORGE_API_BASE, MICROSOFT_API_BASE, AMAZON_API_BASE, NETFLIX_API_BASE, SALESFORCE_API_BASE, ZOHO_API_BASE, INTEL_API_BASE, NVIDIA_API_BASE, ORACLE_API_BASE, AMD_API_BASE, WIPRO_API_BASE, MEESHO_API_BASE, CAPGEMINI_API_BASE, GOLDMAN_SACHS_API_BASE, QUALCOMM_API_BASE, TCS_API_BASE, GENPACT_API_BASE, JPMC_API_BASE, SWIGGY_API_BASE, BROWSERSTACK_API_BASE, BROADCOM_API_BASE, DATADOG_API_BASE } from '../../utils/apiConfig';

const LivePreviewModal = ({ initialCompany = 'All', onClose, showToast }) => {
  const [companyTab, setCompanyTab] = useState(initialCompany); // 'All' | 'Coforge' | 'Microsoft' | 'Amazon' | 'Netflix' | 'Salesforce' | 'Zoho' | 'Intel' | 'NVIDIA' | 'Oracle' | 'AMD' | 'Wipro' | 'Meesho' | 'Capgemini' | 'GoldmanSachs' | 'Qualcomm' | 'TCS' | 'Genpact' | 'Broadcom' | 'DataDog'
  const [liveJobs, setLiveJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLiveStream = async () => {
      try {
        setLoading(true);
        setError(null);

        let url = `${API_BASE}/live`;
        if (companyTab === 'Coforge') {
          url = `${COFORGE_API_BASE}/live`;
        } else if (companyTab === 'Microsoft') {
          url = `${MICROSOFT_API_BASE}/live`;
        } else if (companyTab === 'Amazon') {
          url = `${AMAZON_API_BASE}/live`;
        } else if (companyTab === 'Netflix') {
          url = `${NETFLIX_API_BASE}/live`;
        } else if (companyTab === 'Salesforce') {
          url = `${SALESFORCE_API_BASE}/live`;
        } else if (companyTab === 'Zoho') {
          url = `${ZOHO_API_BASE}/live`;
        } else if (companyTab === 'Intel') {
          url = `${INTEL_API_BASE}/live`;
        } else if (companyTab === 'NVIDIA') {
          url = `${NVIDIA_API_BASE}/live`;
        } else if (companyTab === 'Oracle') {
          url = `${ORACLE_API_BASE}/live`;
        } else if (companyTab === 'AMD') {
          url = `${AMD_API_BASE}/live`;
        } else if (companyTab === 'Wipro') {
          url = `${WIPRO_API_BASE}/live`;
        } else if (companyTab === 'Meesho') {
          url = `${MEESHO_API_BASE}/live`;
        } else if (companyTab === 'Capgemini') {
          url = `${CAPGEMINI_API_BASE}/live`;
        } else if (companyTab === 'GoldmanSachs' || companyTab === 'Goldman Sachs') {
          url = `${GOLDMAN_SACHS_API_BASE}/live`;
        } else if (companyTab === 'Qualcomm') {
          url = `${QUALCOMM_API_BASE}/live`;
        } else if (companyTab === 'TCS') {
          url = `${TCS_API_BASE}/live`;
        } else if (companyTab === 'Genpact') {
          url = `${GENPACT_API_BASE}/live`;
        } else if (companyTab === 'JPMC' || companyTab === 'JPMorgan') {
          url = `${JPMC_API_BASE}/live`;
        } else if (companyTab === 'Swiggy') {
          url = `${SWIGGY_API_BASE}/live`;
        } else if (companyTab === 'BrowserStack') {
          url = `${BROWSERSTACK_API_BASE}/live`;
        } else if (companyTab === 'Broadcom') {
          url = `${BROADCOM_API_BASE}/live`;
        } else if (companyTab === 'DataDog' || companyTab === 'Datadog') {
          url = `${DATADOG_API_BASE}/live`;
        }

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to fetch live stream`);
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setLiveJobs(data);
          showToast(`Fetched ${data.length} live jobs directly from ${companyTab} API`, 'success');
        } else {
          throw new Error('Invalid format returned');
        }
      } catch (err) {
        setError(err.message);
        showToast(`Failed to fetch live API: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchLiveStream();
  }, [companyTab]);

  return (
    <div className="live-jobs-preview">
      <div className="preview-header">
        <div className="preview-title-group">
          <h3>🌐 Live API Jobs Preview</h3>
          <div className="modal-company-tabs">
            <button
              className={`modal-tab ${companyTab === 'All' ? 'active' : ''}`}
              onClick={() => setCompanyTab('All')}
            >
              All Companies
            </button>
            <button
              className={`modal-tab ${companyTab === 'Coforge' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Coforge')}
            >
              Coforge
            </button>
            <button
              className={`modal-tab ${companyTab === 'Microsoft' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Microsoft')}
            >
              Microsoft
            </button>
            <button
              className={`modal-tab ${companyTab === 'Amazon' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Amazon')}
            >
              Amazon
            </button>
            <button
              className={`modal-tab ${companyTab === 'Netflix' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Netflix')}
            >
              Netflix
            </button>
            <button
              className={`modal-tab ${companyTab === 'Salesforce' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Salesforce')}
            >
              Salesforce
            </button>
            <button
              className={`modal-tab ${companyTab === 'Zoho' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Zoho')}
            >
              Zoho
            </button>
            <button
              className={`modal-tab ${companyTab === 'Intel' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Intel')}
            >
              Intel
            </button>
            <button
              className={`modal-tab ${companyTab === 'NVIDIA' ? 'active' : ''}`}
              onClick={() => setCompanyTab('NVIDIA')}
            >
              NVIDIA
            </button>
            <button
              className={`modal-tab ${companyTab === 'Oracle' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Oracle')}
            >
              Oracle
            </button>
            <button
              className={`modal-tab ${companyTab === 'AMD' ? 'active' : ''}`}
              onClick={() => setCompanyTab('AMD')}
            >
              AMD
            </button>
            <button
              className={`modal-tab ${companyTab === 'Wipro' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Wipro')}
            >
              Wipro
            </button>
            <button
              className={`modal-tab ${companyTab === 'Meesho' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Meesho')}
            >
              Meesho
            </button>
            <button
              className={`modal-tab ${companyTab === 'Capgemini' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Capgemini')}
            >
              Capgemini
            </button>
            <button
              className={`modal-tab ${companyTab === 'GoldmanSachs' || companyTab === 'Goldman Sachs' ? 'active' : ''}`}
              onClick={() => setCompanyTab('GoldmanSachs')}
            >
              Goldman Sachs
            </button>
            <button
              className={`modal-tab ${companyTab === 'Qualcomm' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Qualcomm')}
            >
              Qualcomm
            </button>
            <button
              className={`modal-tab ${companyTab === 'TCS' ? 'active' : ''}`}
              onClick={() => setCompanyTab('TCS')}
            >
              TCS iBegin
            </button>
            <button
              className={`modal-tab ${companyTab === 'Genpact' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Genpact')}
            >
              Genpact
            </button>
            <button
              className={`modal-tab ${companyTab === 'JPMC' || companyTab === 'JPMorgan' ? 'active' : ''}`}
              onClick={() => setCompanyTab('JPMC')}
            >
              JPMorgan Chase
            </button>
            <button
              className={`modal-tab ${companyTab === 'Swiggy' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Swiggy')}
            >
              Swiggy
            </button>
            <button
              className={`modal-tab ${companyTab === 'BrowserStack' ? 'active' : ''}`}
              onClick={() => setCompanyTab('BrowserStack')}
            >
              BrowserStack
            </button>
            <button
              className={`modal-tab ${companyTab === 'Broadcom' ? 'active' : ''}`}
              onClick={() => setCompanyTab('Broadcom')}
            >
              Broadcom
            </button>
            <button
              className={`modal-tab ${companyTab === 'DataDog' || companyTab === 'Datadog' ? 'active' : ''}`}
              onClick={() => setCompanyTab('DataDog')}
            >
              DataDog
            </button>
          </div>
        </div>
        <button className="btn-close" onClick={onClose}>✕ Close</button>
      </div>

      {loading ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading live jobs directly from {companyTab} Public API...
        </div>
      ) : error ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--danger)' }}>
          Error: {error}
        </div>
      ) : liveJobs.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No live jobs found for {companyTab}.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="jobs-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Job ID</th>
                <th>Title</th>
                <th>Location</th>
                <th>Experience</th>
                <th>Workmode</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {liveJobs.map((j) => (
                <tr key={`${j.source}-${j.jobId || j.id}`}>
                  <td>
                    <span className={`company-tag ${String(j.company || j.source).toLowerCase()}`}>
                      {j.company || j.source}
                    </span>
                  </td>
                  <td><code>{j.jobId || j.id}</code></td>
                  <td><strong>{j.title}</strong></td>
                  <td>{j.location || 'Not specified'}</td>
                  <td>{j.yrsOfExperience || 'Not specified'}</td>
                  <td><span className="tag">{j.workmode || 'On-site'}</span></td>
                  <td>
                    <a href={j.jobUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-small">
                      Link ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LivePreviewModal;
