import React, { useState, useEffect } from 'react';
import AdminControls from '../../components/AdminControls/AdminControls';
import LivePreviewModal from '../../components/LivePreviewModal/LivePreviewModal';
import JobCard from '../../components/JobCard/JobCard';
import './AdminPage.css';

import { API_BASE } from '../../utils/apiConfig';

const AdminPage = ({ onViewDetails, showToast }) => {
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalJobs, setTotalJobs] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTitle, setSearchTitle] = useState('');
  const [searchLoc, setSearchLoc] = useState('');

  const fetchDbJobs = async (pageNum = 1) => {
    try {
      setLoading(true);
      const url = new URL(`${API_BASE}/db`, window.location.origin);
      url.searchParams.append('page', pageNum);
      url.searchParams.append('limit', 12);
      if (searchTitle) url.searchParams.append('title', searchTitle);
      if (searchLoc) url.searchParams.append('location', searchLoc);

      const res = await fetch(url);
      if (!res.ok) {
        setJobs([]);
        return;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.jobs)) {
        setJobs(data.jobs);
        setTotalJobs(data.total || 0);
        setTotalPages(Math.ceil((data.total || 0) / 12) || 1);
        setPage(pageNum);
      }
    } catch (err) {
      console.error('Fetch DB error:', err);
      showToast(`Error loading DB jobs: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDbJobs(1);
  }, [searchTitle, searchLoc]);

  const scrollToJobsTop = () => {
    const el = document.querySelector('.jobs-section-bar') || document.querySelector('.admin-page .jobs-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAdminPageChange = (newPage) => {
    fetchDbJobs(newPage);
    scrollToJobsTop();
  };

  return (
    <div className="admin-page">
      <div className="admin-page-hero">
        <div className="role-badge-pill">
          <span className="badge-dot"></span> Super Admin Portal
        </div>
        <h1>Coforge Live Sync & Admin Command Center</h1>
        <p>Trigger live API extractions, execute MongoDB sync operations, and manage stored job listings.</p>
      </div>

      {/* Super Admin Live Sync Controls */}
      <AdminControls
        onSyncSuccess={() => fetchDbJobs(1)}
        onOpenLivePreview={() => setShowLivePreview(true)}
        showToast={showToast}
      />

      {/* Live Stream Preview Modal */}
      {showLivePreview && (
        <LivePreviewModal
          onClose={() => setShowLivePreview(false)}
          showToast={showToast}
        />
      )}

      {/* Stored DB Jobs Section */}
      <section className="jobs-section">
        <div className="jobs-section-bar">
          <div className="section-title-group">
            <h2>💼 Stored MongoDB Career Openings</h2>
            <span className="count-badge">{totalJobs} Jobs</span>
          </div>

          <div className="filter-controls">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search job title..."
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
              />
            </div>
            <div className="search-box">
              <span className="search-icon">📍</span>
              <input
                type="text"
                placeholder="Filter location..."
                value={searchLoc}
                onChange={(e) => setSearchLoc(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading stored jobs from MongoDB...
          </div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
            <h3>No Stored Jobs Found</h3>
            <p style={{ color: 'var(--text-muted)' }}>Click "Trigger Live DB Sync" above to fetch and store live jobs in MongoDB.</p>
          </div>
        ) : (
          <>
            <div className="jobs-grid">
              {jobs.map((j) => (
                <JobCard key={j.jobId || j.id} job={j} onViewDetails={onViewDetails} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination-bar">
                <button
                  className="btn btn-secondary btn-small"
                  disabled={page <= 1}
                  onClick={() => handleAdminPageChange(page - 1)}
                >
                  ← Previous
                </button>
                <span className="page-info">Page {page} of {totalPages}</span>
                <button
                  className="btn btn-secondary btn-small"
                  disabled={page >= totalPages}
                  onClick={() => handleAdminPageChange(page + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default AdminPage;
