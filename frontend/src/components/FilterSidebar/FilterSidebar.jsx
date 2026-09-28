import React from 'react';
import './FilterSidebar.css';

const FilterSidebar = ({
  allJobs = [],
  selectedLocations = [],
  selectedCompanies = [],
  selectedSkills = [],
  selectedExperiences = [],
  selectedWorkmodes = [],
  selectedShifts = [],
  selectedSalaries = [],
  onToggleLocation,
  onToggleCompany,
  onToggleSkill,
  onToggleExperience,
  onToggleWorkmode,
  onToggleShift,
  onToggleSalary,
  onClearAll
}) => {
  // Extract counts
  const locationCounts = {};
  const companyCounts = {};
  const skillCounts = {};
  const expCounts = {
    '0 Years': 0,
    '1 Year': 0,
    '2 Years': 0,
    '3 Years': 0,
    '4 Years': 0,
    '5+ Years': 0
  };
  const workmodeCounts = {
    'Remote': 0,
    'On-site': 0,
    'Hybrid': 0
  };
  const shiftCounts = {
    'Day Shift': 0,
    'Night Shift': 0,
    'Flexible / Rotational': 0
  };
  const salaryCounts = {
    '₹ 3 - 6 LPA': 0,
    '₹ 6 - 10 LPA': 0,
    '₹ 10 - 15 LPA': 0,
    '₹ 15 - 25 LPA': 0,
    '₹ 25+ LPA': 0
  };

  allJobs.forEach(job => {
    // Locations
    const loc = job.location || 'Other';
    const locKey = loc.toLowerCase().includes('remote') ? 'Remote' : (loc.split(';')[0]?.trim() || loc);
    locationCounts[locKey] = (locationCounts[locKey] || 0) + 1;

    // Company
    const comp = job.company || 'Coforge';
    companyCounts[comp] = (companyCounts[comp] || 0) + 1;

    // Workmode (Remote / On-site / Hybrid)
    const modeStr = (String(job.workmode || '') + ' ' + String(job.location || '') + ' ' + String(job.title || '')).toLowerCase();
    if (modeStr.includes('remote') || modeStr.includes('work from home') || modeStr.includes('wfh')) {
      workmodeCounts['Remote']++;
    } else if (modeStr.includes('hybrid')) {
      workmodeCounts['Hybrid']++;
    } else {
      workmodeCounts['On-site']++;
    }

    // Shift (Day Shift / Night Shift / Flexible)
    const shiftVal = job.shift || 'Day Shift';
    if (shiftCounts[shiftVal] !== undefined) {
      shiftCounts[shiftVal]++;
    } else {
      shiftCounts['Day Shift']++;
    }

    // Salary (Rupee Ranges: ₹3-6 LPA, ₹6-10 LPA, ₹10-15 LPA, ₹15-25 LPA, ₹25+ LPA)
    const minExp = Number(job.minYrsOfExperience || job.minYears || 0);
    const salStr = String(job.salary || '');

    if (salStr.includes('4.5') || minExp <= 1) {
      salaryCounts['₹ 3 - 6 LPA']++;
    } else if (salStr.includes('6.0') || salStr.includes('8.5') || minExp <= 3) {
      salaryCounts['₹ 6 - 10 LPA']++;
    } else if (salStr.includes('13.5') || minExp <= 6) {
      salaryCounts['₹ 10 - 15 LPA']++;
    } else if (salStr.includes('20.0') || minExp <= 9) {
      salaryCounts['₹ 15 - 25 LPA']++;
    } else {
      salaryCounts['₹ 25+ LPA']++;
    }

    // Skills (Filtering out 'null' / 'undefined' string values)
    if (Array.isArray(job.skills)) {
      job.skills.forEach(s => {
        if (s && typeof s === 'string') {
          const cleanSkill = s.trim();
          if (
            cleanSkill.length > 1 &&
            cleanSkill.toLowerCase() !== 'null' &&
            cleanSkill.toLowerCase() !== 'undefined'
          ) {
            skillCounts[cleanSkill] = (skillCounts[cleanSkill] || 0) + 1;
          }
        }
      });
    }

    // Single Experience matching
    if (minExp === 0) expCounts['0 Years']++;
    else if (minExp === 1) expCounts['1 Year']++;
    else if (minExp === 2) expCounts['2 Years']++;
    else if (minExp === 3) expCounts['3 Years']++;
    else if (minExp === 4) expCounts['4 Years']++;
    else if (minExp >= 5) expCounts['5+ Years']++;
  });

  const locationsList = Object.keys(locationCounts).slice(0, 10);
  const companiesList = Object.keys(companyCounts);
  const skillsList = Object.keys(skillCounts).sort((a, b) => skillCounts[b] - skillCounts[a]).slice(0, 12);
  const experiencesList = ['0 Years', '1 Year', '2 Years', '3 Years', '4 Years', '5+ Years'];
  const workmodesList = ['Remote', 'On-site', 'Hybrid'];
  const shiftsList = ['Day Shift', 'Night Shift', 'Flexible / Rotational'];
  const salariesList = ['₹ 3 - 6 LPA', '₹ 6 - 10 LPA', '₹ 10 - 15 LPA', '₹ 15 - 25 LPA', '₹ 25+ LPA'];

  const totalActiveFilters =
    selectedLocations.length +
    selectedCompanies.length +
    selectedSkills.length +
    selectedExperiences.length +
    selectedWorkmodes.length +
    selectedShifts.length +
    selectedSalaries.length;

  return (
    <aside className="filter-sidebar">
      <div className="filter-sidebar-header">
        <h3>
          <span>⚙️</span> Filter Jobs
          {totalActiveFilters > 0 && (
            <span className="active-filter-badge">{totalActiveFilters} Active</span>
          )}
        </h3>
        {totalActiveFilters > 0 && (
          <button className="btn-clear-filters" onClick={onClearAll}>
            Clear All
          </button>
        )}
      </div>

      {/* 1. LOCATION CHECKBOXES */}
      <div className="filter-group">
        <div className="filter-group-title">
          <span>📍</span> Location
        </div>
        <div className="filter-options-list">
          {locationsList.map((loc) => {
            const isChecked = selectedLocations.includes(loc);
            return (
              <label key={loc} className={`checkbox-label ${isChecked ? 'checked' : ''}`}>
                <div className="checkbox-left">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={isChecked}
                    onChange={() => onToggleLocation(loc)}
                  />
                  <span>{loc}</span>
                </div>
                <span className="filter-count">{locationCounts[loc]}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 2. SALARY (RUPEE ₹ LPA) CHECKBOXES */}
      <div className="filter-group">
        <div className="filter-group-title">
          <span>💵</span> Salary (Rupees ₹ LPA)
        </div>
        <div className="filter-options-list">
          {salariesList.map((sal) => {
            const isChecked = selectedSalaries.includes(sal);
            return (
              <label key={sal} className={`checkbox-label ${isChecked ? 'checked' : ''}`}>
                <div className="checkbox-left">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={isChecked}
                    onChange={() => onToggleSalary(sal)}
                  />
                  <span>{sal}</span>
                </div>
                <span className="filter-count">{salaryCounts[sal] || 0}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 3. WORK MODE CHECKBOXES (Remote / On-site / Hybrid) */}
      <div className="filter-group">
        <div className="filter-group-title">
          <span>🏠</span> Work Mode
        </div>
        <div className="filter-options-list">
          {workmodesList.map((mode) => {
            const isChecked = selectedWorkmodes.includes(mode);
            return (
              <label key={mode} className={`checkbox-label ${isChecked ? 'checked' : ''}`}>
                <div className="checkbox-left">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={isChecked}
                    onChange={() => onToggleWorkmode(mode)}
                  />
                  <span>{mode}</span>
                </div>
                <span className="filter-count">{workmodeCounts[mode]}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 4. SHIFT CHECKBOXES (Day Shift / Night Shift / Flexible) */}
      <div className="filter-group">
        <div className="filter-group-title">
          <span>☀️</span> Shift Type
        </div>
        <div className="filter-options-list">
          {shiftsList.map((shift) => {
            const isChecked = selectedShifts.includes(shift);
            return (
              <label key={shift} className={`checkbox-label ${isChecked ? 'checked' : ''}`}>
                <div className="checkbox-left">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={isChecked}
                    onChange={() => onToggleShift(shift)}
                  />
                  <span>{shift}</span>
                </div>
                <span className="filter-count">{shiftCounts[shift] || 0}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 5. COMPANY CHECKBOXES */}
      <div className="filter-group">
        <div className="filter-group-title">
          <span>🏢</span> Company
        </div>
        <div className="filter-options-list">
          {companiesList.map((comp) => {
            const isChecked = selectedCompanies.includes(comp);
            return (
              <label key={comp} className={`checkbox-label ${isChecked ? 'checked' : ''}`}>
                <div className="checkbox-left">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={isChecked}
                    onChange={() => onToggleCompany(comp)}
                  />
                  <span>{comp}</span>
                </div>
                <span className="filter-count">{companyCounts[comp]}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 6. EXPERIENCE CHECKBOXES (Single Year Match, Not Range) */}
      <div className="filter-group">
        <div className="filter-group-title">
          <span>💼</span> Experience (Single Year)
        </div>
        <div className="filter-options-list">
          {experiencesList.map((exp) => {
            const isChecked = selectedExperiences.includes(exp);
            return (
              <label key={exp} className={`checkbox-label ${isChecked ? 'checked' : ''}`}>
                <div className="checkbox-left">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={isChecked}
                    onChange={() => onToggleExperience(exp)}
                  />
                  <span>{exp}</span>
                </div>
                <span className="filter-count">{expCounts[exp] || 0}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 7. SKILLS CHECKBOXES */}
      {skillsList.length > 0 && (
        <div className="filter-group">
          <div className="filter-group-title">
            <span>🛠️</span> Skills
          </div>
          <div className="filter-options-list">
            {skillsList.map((skill) => {
              const isChecked = selectedSkills.includes(skill);
              return (
                <label key={skill} className={`checkbox-label ${isChecked ? 'checked' : ''}`}>
                  <div className="checkbox-left">
                    <input
                      type="checkbox"
                      className="checkbox-input"
                      checked={isChecked}
                      onChange={() => onToggleSkill(skill)}
                    />
                    <span>{skill}</span>
                  </div>
                  <span className="filter-count">{skillCounts[skill]}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};

export default FilterSidebar;
