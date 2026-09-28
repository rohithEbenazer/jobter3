import React, { useState, useEffect } from 'react';
import './LivePreviewModal.css';

const API_BASE = 'http://localhost:5000/api/jobs/cogforce';

const LivePreviewModal = ({ onClose, showToast }) => {
  const [liveJobs, setLiveJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLiveStream = async () => {
      try {
        setLoading(true);
        const res = await fetch(API_BASE);
        const data = await res.json();
        if (Array.isArray(data)) {
          setLiveJobs(data);
          showToast(`Fetched ${data.length} live jobs directly from Coforge API`, 'success');
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
  }, []);

  return (
    <div className="live-jobs-preview">
      <div className="preview-header">
        <h3>🌐 Live API Jobs Preview (Raw Coforge Stream)</h3>
        <button className="btn-close" onClick={onClose}>✕ Close</button>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading live jobs directly from Coforge Zwayam Public API...
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
          Error: {error}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="jobs-table">
            <thead>
              <tr>
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
                <tr key={j.jobId || j.id}>
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
