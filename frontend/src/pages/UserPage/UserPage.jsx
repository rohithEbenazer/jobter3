import React, { useState, useEffect, useMemo } from 'react';
import FilterSidebar from '../../components/FilterSidebar/FilterSidebar';
import JobCard from '../../components/JobCard/JobCard';
import { checkLocationMatch, checkDateMatch } from '../../utils/locationUtils';
import './UserPage.css';

import { API_BASE } from '../../utils/apiConfig';

const UserPage = ({ onViewDetails, showToast }) => {
  const [allDbJobs, setAllDbJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTitle, setSearchTitle] = useState('');

  // Combined Checkbox Filter States
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedExperiences, setSelectedExperiences] = useState([]);
  const [selectedWorkmodes, setSelectedWorkmodes] = useState([]);
  const [selectedShifts, setSelectedShifts] = useState([]);
  const [selectedSalaries, setSelectedSalaries] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // Fetch stored jobs with live fallback
  const fetchAllJobs = async () => {
    try {
      setLoading(true);
      const url = new URL(`${API_BASE}/db`, window.location.origin);
      url.searchParams.append('limit', 10000);

      const res = await fetch(url);
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        console.warn('DB endpoint returned non-JSON, falling back to live jobs...');
        const liveRes = await fetch(new URL(`${API_BASE}/live`, window.location.origin));
        const liveText = await liveRes.text();
        try {
          const liveData = JSON.parse(liveText);
          if (Array.isArray(liveData) && liveData.length > 0) {
            setAllDbJobs(liveData);
            return;
          }
        } catch (e) { }
      }

      if (data.success && Array.isArray(data.jobs) && data.jobs.length > 0) {
        setAllDbJobs(data.jobs);
      } else {
        // Fallback: Fetch live jobs if DB is empty
        const liveRes = await fetch(new URL(`${API_BASE}/live`, window.location.origin));
        const liveText = await liveRes.text();
        try {
          const liveData = JSON.parse(liveText);
          if (Array.isArray(liveData) && liveData.length > 0) {
            setAllDbJobs(liveData);
          }
        } catch (e) { }
      }
    } catch (err) {
      console.error('Fetch DB jobs error:', err);
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

  const handleToggleDate = (dateTag) => {
    setSelectedDates(prev =>
      prev.includes(dateTag) ? prev.filter(d => d !== dateTag) : [...prev, dateTag]
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

  const handleToggleShift = (shift) => {
    setSelectedShifts(prev =>
      prev.includes(shift) ? prev.filter(s => s !== shift) : [...prev, shift]
    );
    setPage(1);
  };

  const handleToggleSalary = (sal) => {
    setSelectedSalaries(prev =>
      prev.includes(sal) ? prev.filter(s => s !== sal) : [...prev, sal]
    );
    setPage(1);
  };

  const handleClearAllFilters = () => {
    setSelectedLocations([]);
    setSelectedDates([]);
    setSelectedCompanies([]);
    setSelectedSkills([]);
    setSelectedExperiences([]);
    setSelectedWorkmodes([]);
    setSelectedShifts([]);
    setSelectedSalaries([]);
    setSearchTitle('');
    setPage(1);
  };

  // COMBINED MULTI-FILTER LOGIC
  const filteredJobs = useMemo(() => {
    return allDbJobs.filter(job => {
      // 1. Text Search Filter (Title / Role / Description / Company)
      if (searchTitle.trim()) {
        const q = searchTitle.toLowerCase().trim();
        const matchesTitle = String(job.title || '').toLowerCase().includes(q);
        const matchesRole = String(job.role || '').toLowerCase().includes(q);
        const matchesDesc = String(job.description || '').toLowerCase().includes(q);
        const matchesComp = String(job.company || job.source || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesRole && !matchesDesc && !matchesComp) return false;
      }

      // 2. Location Checkbox Filter
      if (selectedLocations.length > 0) {
        const matchesLoc = checkLocationMatch(job, selectedLocations);
        if (!matchesLoc) return false;
      }

      // 3. Date Posted Checkbox Filter
      if (selectedDates.length > 0) {
        const matchesDate = checkDateMatch(job, selectedDates);
        if (!matchesDate) return false;
      }

      // 4. Work Mode Checkbox Filter (Remote / On-site / Hybrid)
      if (selectedWorkmodes.length > 0) {
        const modeStr = (String(job.workmode || '') + ' ' + String(job.location || '') + ' ' + String(job.title || '')).toLowerCase();
        let jobMode = 'On-site';
        if (modeStr.includes('remote') || modeStr.includes('work from home') || modeStr.includes('wfh')) {
          jobMode = 'Remote';
        } else if (modeStr.includes('hybrid') || modeStr.includes('50%')) {
          jobMode = 'Hybrid';
        }
        if (!selectedWorkmodes.includes(jobMode)) return false;
      }

      // 5. Shift Checkbox Filter (Day Shift / Night Shift / Flexible)
      if (selectedShifts.length > 0) {
        const jobShift = job.shift || 'Day Shift';
        if (!selectedShifts.includes(jobShift)) return false;
      }

      // 6. Salary Checkbox Filter (Disclosed Salary vs Not Disclosed)
      if (selectedSalaries.length > 0) {
        const salStr = String(job.salary || '');
        const isDisclosed = salStr && salStr !== 'Not Disclosed' && salStr !== 'Competitive Industry Package' && salStr !== 'Competitive Package';

        const matchesSal = selectedSalaries.some(s => {
          if (s === 'Disclosed Salary') return isDisclosed;
          if (s === 'Not Disclosed') return !isDisclosed;
          return true;
        });
        if (!matchesSal) return false;
      }

      // 7. Company Checkbox Filter (Coforge / Microsoft)
      if (selectedCompanies.length > 0) {
        const compStr = String(job.company || job.source || 'Coforge').toLowerCase();
        const matchesComp = selectedCompanies.some(c => compStr.includes(c.toLowerCase()));
        if (!matchesComp) return false;
      }

      // 8. Skills Checkbox Filter
      if (selectedSkills.length > 0) {
        const jobSkills = Array.isArray(job.skills) ? job.skills.map(s => String(s).toLowerCase()) : [];
        const matchesSkill = selectedSkills.some(s => jobSkills.some(js => js.includes(s.toLowerCase())));
        if (!matchesSkill) return false;
      }

      // 9. Single Experience Checkbox Filter (0 Years, 1 Year, 2 Years, 3 Years, 4 Years, 5+ Years)
      if (selectedExperiences.length > 0) {
        const minExp = Number(job.minYrsOfExperience ?? job.minYears ?? 0);
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
  }, [allDbJobs, searchTitle, selectedLocations, selectedDates, selectedCompanies, selectedSkills, selectedExperiences, selectedWorkmodes, selectedShifts, selectedSalaries]);

  const scrollToJobsTop = () => {
    const el = document.querySelector('.user-search-header') || document.querySelector('.portal-main-content');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    scrollToJobsTop();
  };

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
        <h1>Explore Verified Openings (Coforge, Microsoft, Amazon, Netflix, Salesforce & Zoho)</h1>
        <p>Use the combined multi-select filters on the left to filter openings by Company, Location, Date Posted, Salary, Work Mode, Shift, Skills, and Experience.</p>
      </div>

      {/* 2-Column Portal Layout */}
      <div className="portal-layout">
        {/* LEFT COLUMN: MULTI-SELECT CHECKBOX SIDEBAR */}
        <FilterSidebar
          allJobs={allDbJobs}
          selectedLocations={selectedLocations}
          selectedDates={selectedDates}
          selectedCompanies={selectedCompanies}
          selectedSkills={selectedSkills}
          selectedExperiences={selectedExperiences}
          selectedWorkmodes={selectedWorkmodes}
          selectedShifts={selectedShifts}
          selectedSalaries={selectedSalaries}
          onToggleLocation={handleToggleLocation}
          onToggleDate={handleToggleDate}
          onToggleCompany={handleToggleCompany}
          onToggleSkill={handleToggleSkill}
          onToggleExperience={handleToggleExperience}
          onToggleWorkmode={handleToggleWorkmode}
          onToggleShift={handleToggleShift}
          onToggleSalary={handleToggleSalary}
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
                placeholder="Search job title, keywords, company or technology..."
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
                    <JobCard key={`${j.source}-${j.jobId || j.id}`} job={j} onViewDetails={onViewDetails} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="pagination-bar">
                    <button
                      className="btn btn-secondary btn-small"
                      disabled={page <= 1}
                      onClick={() => handlePageChange(page - 1)}
                    >
                      ← Previous
                    </button>
                    <span className="page-info">Page {page} of {totalPages}</span>
                    <button
                      className="btn btn-secondary btn-small"
                      disabled={page >= totalPages}
                      onClick={() => handlePageChange(page + 1)}
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
