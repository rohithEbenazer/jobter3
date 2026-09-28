import React, { useState, useEffect, useMemo } from 'react';
import FilterSidebar from '../../components/FilterSidebar/FilterSidebar';
import JobCard from '../../components/JobCard/JobCard';
import './UserPage.css';

const API_BASE = 'http://localhost:5000/api/jobs/cogforce';

const UserPage = ({ onViewDetails, showToast }) => {
  const [allDbJobs, setAllDbJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTitle, setSearchTitle] = useState('');

  // Combined Checkbox Filter States
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedExperiences, setSelectedExperiences] = useState([]);
  const [selectedWorkmodes, setSelectedWorkmodes] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // Fetch all stored DB jobs from MongoDB
  const fetchAllJobs = async () => {
    try {
      setLoading(true);
      const url = new URL(`${API_BASE}/db`);
      url.searchParams.append('limit', 1000); // Fetch stored jobs for client multi-filtering

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.jobs)) {
        setAllDbJobs(data.jobs);
      }
    } catch (err) {
      console.error('Fetch DB jobs error:', err);
      showToast(`Error loading jobs: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllJobs();
  }, []);

  // Filter Toggle Handlers
  const handleToggleLocation = (loc) => {
    setSelectedLocations(prev =>
      prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]
    );
    setPage(1);
  };

  const handleToggleCompany = (comp) => {
    setSelectedCompanies(prev =>
      prev.includes(comp) ? prev.filter(c => c !== comp) : [...prev, comp]
    );
    setPage(1);
  };

  const handleToggleSkill = (skill) => {
    setSelectedSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
    setPage(1);
  };

  const handleToggleExperience = (exp) => {
    setSelectedExperiences(prev =>
      prev.includes(exp) ? prev.filter(e => e !== exp) : [...prev, exp]
    );
    setPage(1);
  };

  const handleToggleWorkmode = (mode) => {
    setSelectedWorkmodes(prev =>
      prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]
    );
    setPage(1);
  };

  const handleClearAllFilters = () => {
    setSelectedLocations([]);
    setSelectedCompanies([]);
    setSelectedSkills([]);
    setSelectedExperiences([]);
    setSelectedWorkmodes([]);
    setSearchTitle('');
    setPage(1);
  };

  // COMBINED MULTI-FILTER LOGIC
  const filteredJobs = useMemo(() => {
    return allDbJobs.filter(job => {
      // 1. Text Search Filter (Title / Role / Description)
      if (searchTitle.trim()) {
        const q = searchTitle.toLowerCase().trim();
        const matchesTitle = String(job.title || '').toLowerCase().includes(q);
        const matchesRole = String(job.role || '').toLowerCase().includes(q);
        const matchesDesc = String(job.description || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesRole && !matchesDesc) return false;
      }

      // 2. Location Checkbox Filter
      if (selectedLocations.length > 0) {
        const locStr = String(job.location || '').toLowerCase();
        const matchesLoc = selectedLocations.some(l => {
          if (l === 'Remote') return locStr.includes('remote');
          return locStr.includes(l.toLowerCase());
        });
        if (!matchesLoc) return false;
      }

      // 3. Work Mode Checkbox Filter (Remote / On-site / Hybrid)
      if (selectedWorkmodes.length > 0) {
        const modeStr = (String(job.workmode || '') + ' ' + String(job.location || '') + ' ' + String(job.title || '')).toLowerCase();
        let jobMode = 'On-site';
        if (modeStr.includes('remote') || modeStr.includes('work from home') || modeStr.includes('wfh')) {
          jobMode = 'Remote';
        } else if (modeStr.includes('hybrid')) {
          jobMode = 'Hybrid';
        }
        if (!selectedWorkmodes.includes(jobMode)) return false;
      }

      // 4. Company Checkbox Filter
      if (selectedCompanies.length > 0) {
        const compStr = String(job.company || 'Coforge').toLowerCase();
        const matchesComp = selectedCompanies.some(c => compStr.includes(c.toLowerCase()));
        if (!matchesComp) return false;
      }

      // 5. Skills Checkbox Filter
      if (selectedSkills.length > 0) {
        const jobSkills = Array.isArray(job.skills) ? job.skills.map(s => String(s).toLowerCase()) : [];
        const matchesSkill = selectedSkills.some(s => jobSkills.some(js => js.includes(s.toLowerCase())));
        if (!matchesSkill) return false;
      }

      // 6. Single Experience Checkbox Filter (Not range, single year matching)
      if (selectedExperiences.length > 0) {
        const minExp = Number(job.minYrsOfExperience || job.minYears || 0);
        let expTag = '0 Years';
        if (minExp === 0) expTag = '0 Years';
        else if (minExp === 1) expTag = '1 Year';
        else if (minExp === 2) expTag = '2 Years';
        else if (minExp === 3) expTag = '3 Years';
        else if (minExp === 4) expTag = '4 Years';
        else if (minExp >= 5) expTag = '5+ Years';

        if (!selectedExperiences.includes(expTag)) return false;
      }

      return true;
    });
  }, [allDbJobs, searchTitle, selectedLocations, selectedCompanies, selectedSkills, selectedExperiences, selectedWorkmodes]);

  // Paginated Results
  const totalPages = Math.ceil(filteredJobs.length / pageSize) || 1;
  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, page, pageSize]);

  return (
    <div className="user-page">
      <div className="user-page-hero">
        <div className="user-role-badge">
          <span className="badge-dot-green"></span> Candidate Career Portal
        </div>
        <h1>Explore Verified Coforge Openings</h1>
        <p>Use the combined multi-select filters on the left to filter openings by Location, Work Mode (Remote/On-site/Hybrid), Company, Skills, and Experience.</p>
      </div>

      {/* 2-Column Portal Layout */}
      <div className="portal-layout">
        {/* LEFT COLUMN: MULTI-SELECT CHECKBOX SIDEBAR */}
        <FilterSidebar
          allJobs={allDbJobs}
          selectedLocations={selectedLocations}
          selectedCompanies={selectedCompanies}
          selectedSkills={selectedSkills}
          selectedExperiences={selectedExperiences}
          selectedWorkmodes={selectedWorkmodes}
          onToggleLocation={handleToggleLocation}
          onToggleCompany={handleToggleCompany}
          onToggleSkill={handleToggleSkill}
          onToggleExperience={handleToggleExperience}
          onToggleWorkmode={handleToggleWorkmode}
          onClearAll={handleClearAllFilters}
        />

        {/* RIGHT COLUMN: JOBS GRID & SEARCH BAR */}
        <div className="portal-main-content">
          {/* Header Search Bar */}
          <div className="user-search-header">
            <div className="search-box-large">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search job title, keywords or technology..."
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
              />
            </div>
            <span className="count-badge-green">{filteredJobs.length} Openings Found</span>
          </div>

          {/* Stored DB Jobs Grid */}
          <section className="jobs-section">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                Loading verified career openings...
              </div>
            ) : paginatedJobs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
                <h3>No Matching Openings Found</h3>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '1.25rem' }}>
                  No stored jobs match your combined checkbox filter selection.
                </p>
                <button className="btn btn-primary btn-small" onClick={handleClearAllFilters}>
                  Clear All Filters
                </button>
              </div>
            ) : (
              <>
                <div className="jobs-grid">
                  {paginatedJobs.map((j) => (
                    <JobCard key={j.jobId || j.id} job={j} onViewDetails={onViewDetails} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="pagination-bar">
                    <button
                      className="btn btn-secondary btn-small"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      ← Previous
                    </button>
                    <span className="page-info">Page {page} of {totalPages}</span>
                    <button
                      className="btn btn-secondary btn-small"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default UserPage;
