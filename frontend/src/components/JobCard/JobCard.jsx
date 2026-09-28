import React from 'react';
import { formatJobDate } from '../../utils/locationUtils';
import './JobCard.css';

const JobCard = ({ job, onViewDetails }) => {
  const isRemote = String(job.workmode || '').toLowerCase().includes('remote') || String(job.location || '').toLowerCase().includes('remote');
  const skillsList = Array.isArray(job.skills)
    ? job.skills.filter(s => s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined').slice(0, 4)
    : [];

  const shiftText = job.shift || 'Day Shift';
  const shiftIcon = shiftText.includes('Night') ? '🌙' : (shiftText.includes('Flexible') ? '🔄' : '☀️');
  const hasSalary = job.salary && job.salary !== 'Not Disclosed' && job.salary !== 'Competitive Salary' && job.salary !== 'null';
  const formattedDate = formatJobDate(job.postedDate || job.postingDate || job.createdAt);

  return (
    <div className="job-card">
      <div>
        <div className="job-card-header">
          <span className="job-company">{job.company || 'Coforge'}</span>
          <span className="job-id">ID: {job.jobId || job.id}</span>
        </div>
        <h3 className="job-title">{job.title}</h3>
        
        <div className="job-tags">
          <span className="tag date-tag">🗓️ {formattedDate}</span>
          <span className="tag">📍 {job.location || 'India'}</span>
          <span className="tag">💼 {job.yrsOfExperience || 'Not specified'}</span>
          <span className="tag">{shiftIcon} {shiftText}</span>
          {hasSalary && <span className="tag">💵 {job.salary}</span>}
          {isRemote && <span className="tag remote">🏠 Remote</span>}
        </div>

        {skillsList.length > 0 && (
          <div className="job-skills">
            {skillsList.map((skill, index) => (
              <span key={index} className="skill-pill">{skill}</span>
            ))}
          </div>
        )}
      </div>

      <div className="job-card-footer">
        <button className="btn btn-secondary btn-small" onClick={() => onViewDetails(job.jobId || job.id)}>
          View Details
        </button>
        <a href={job.jobUrl || job.url || '#'} target="_blank" rel="noreferrer" className="btn btn-primary btn-small">
          Apply ↗
        </a>
      </div>
    </div>
  );
};

export default JobCard;
