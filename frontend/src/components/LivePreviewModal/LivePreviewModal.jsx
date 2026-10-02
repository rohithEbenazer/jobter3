import React, { useState, useEffect } from 'react';
import './LivePreviewModal.css';

import { API_BASE, COFORGE_API_BASE, MICROSOFT_API_BASE } from '../../utils/apiConfig';

const LivePreviewModal = ({ initialCompany = 'All', onClose, showToast }) => {
  const [companyTab, setCompanyTab] = useState(initialCompany); // 'All' | 'Coforge' | 'Microsoft'
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
                  <td>{j.yrsOfExperience || 'N/A'}</td>
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
