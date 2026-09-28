import React from 'react';
import { formatJobDate } from '../../utils/locationUtils';
import './JobModal.css';

const JobModal = ({ job, onClose }) => {
  if (!job) return null;

  const skills = Array.isArray(job.skills) ? job.skills : [];
  const formattedDate = formatJobDate(job.postedDate || job.postingDate || job.createdAt);

  return (
    <div className="modal-overlay" onClick={(e) => e.target.className === 'modal-overlay' && onClose()}>
      <div className="modal-card">
        <button className="modal-close" onClick={onClose}>✕</button>
        
        <div className="modal-header">
          <span className="modal-company">{job.company || 'Coforge'}</span>
          <h2>{job.title}</h2>
          <div className="modal-meta">
            <span className="meta-tag">🗓️ Posted: {formattedDate}</span>
            <span className="meta-tag">📍 {job.location || 'Not specified'}</span>
            <span className="meta-tag">💼 {job.yrsOfExperience || 'Not specified'}</span>
            <span className="meta-tag">🏠 {job.workmode || 'On-site'}</span>
            <span className="meta-tag">ID: {job.jobId || job.id}</span>
          </div>
        </div>

        <div className="modal-body">
          <h4 style={{ marginBottom: '0.5rem' }}>Skills Required</h4>
          <div className="skills-list">
            {skills.length > 0 ? (
              skills.map((s, i) => (
                <span key={i} className="skill-pill">{s}</span>
              ))
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Standard Coforge Engineering Skills</span>
            )}
          </div>

          <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Job Description</h4>
          <div
            className="job-description-box"
            dangerouslySetInnerHTML={{
              __html: job.descriptionHtml || job.description || job.overview || 'Detailed description available on Coforge application portal.'
            }}
          />
        </div>

        <div className="modal-footer">
          <a href={job.jobUrl || job.url || '#'} target="_blank" rel="noreferrer" className="btn btn-primary">
            Apply on Coforge Careers ↗
          </a>
        </div>
      </div>
    </div>
  );
};

export default JobModal;
