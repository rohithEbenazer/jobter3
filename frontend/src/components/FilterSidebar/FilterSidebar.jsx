import React, { useState, useMemo, useEffect } from 'react';
import { checkLocationMatch, buildLocationTree, parseJobDate } from '../../utils/locationUtils';
import './FilterSidebar.css';

const FilterSidebar = ({
  allJobs = [],
  selectedLocations = [],
  selectedDates = [],
  selectedCompanies = [],
  selectedSkills = [],
  selectedExperiences = [],
  selectedWorkmodes = [],
  selectedShifts = [],
  selectedSalaries = [],
  onToggleLocation,
  onToggleDate,
  onToggleCompany,
  onToggleSkill,
  onToggleExperience,
  onToggleWorkmode,
  onToggleShift,
  onToggleSalary,
  onClearAll
}) => {
  // Hierarchical Location Navigation State
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');
  const [searchLocation, setSearchLocation] = useState('');

  // Reset local location nav state if all filters cleared
  useEffect(() => {
    if (selectedLocations.length === 0) {
      setSelectedCity('');
    }
  }, [selectedLocations]);

  const handleClearAllWithNav = () => {
    setSelectedCountry(null);
    setSelectedState(null);
    setSelectedCity('');
    setSearchLocation('');
    if (onClearAll) onClearAll();
  };

  // Build dynamic location tree from allJobs
  const locationTree = useMemo(() => buildLocationTree(allJobs), [allJobs]);

  const countriesList = useMemo(() => Object.keys(locationTree), [locationTree]);

  const statesList = useMemo(() => {
    return selectedCountry && locationTree[selectedCountry]
      ? Object.keys(locationTree[selectedCountry])
      : [];
  }, [selectedCountry, locationTree]);

  const citiesList = useMemo(() => {
    return selectedCountry && selectedState && locationTree[selectedCountry]?.[selectedState]
      ? locationTree[selectedCountry][selectedState]
      : [];
  }, [selectedCountry, selectedState, locationTree]);

  // Compute live job counts for location items
  const getItemCount = (itemName) => {
    return allJobs.filter(job => checkLocationMatch(job, [itemName])).length;
  };

  // Active level items for checkbox list display
  const displayItems = useMemo(() => {
    const q = searchLocation.toLowerCase().trim();

    if (!selectedCountry) {
      // Level 1: Countries
      return countriesList
        .filter(c => !q || c.toLowerCase().includes(q))
        .map(c => ({
          name: c,
          level: 'country',
          canDrill: true,
          count: getItemCount(c)
        }));
    } else if (!selectedState) {
      // Level 2: States of selectedCountry
      return statesList
        .filter(s => !q || s.toLowerCase().includes(q))
        .map(s => ({
          name: s,
          level: 'state',
          canDrill: true,
          count: getItemCount(s)
        }));
    } else {
      // Level 3: Cities of selectedState
      return citiesList
        .filter(ci => !q || ci.toLowerCase().includes(q))
        .map(ci => ({
          name: ci,
          level: 'city',
          canDrill: false,
          count: getItemCount(ci)
        }));
    }
  }, [selectedCountry, selectedState, searchLocation, countriesList, statesList, citiesList, allJobs]);

  // Other Filter Counts
  const dateCounts = {
    'Last 24 Hours': 0,
    'Last 7 Days': 0,
    'Last 14 Days': 0,
    'Last 30 Days': 0,
    'More than 30 Days': 0
  };
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
    'Disclosed Salary': 0,
    'Not Disclosed': 0
  };

  allJobs.forEach(job => {
    // Date Posted counts
    const rawDate = job.postedDate || job.postingDate || job.createdAt;
    const jobDate = parseJobDate(rawDate);
    if (jobDate) {
      const now = new Date();
      const diffDays = (now.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 0 && diffDays <= 1) dateCounts['Last 24 Hours']++;
      if (diffDays >= 0 && diffDays <= 7) dateCounts['Last 7 Days']++;
      if (diffDays >= 0 && diffDays <= 14) dateCounts['Last 14 Days']++;
      if (diffDays >= 0 && diffDays <= 30) dateCounts['Last 30 Days']++;
      if (diffDays > 30 || diffDays < 0) dateCounts['More than 30 Days']++;
    }

    // Company
    let comp = job.company || job.source || 'Coforge';
    if (/coforge|cogforce/i.test(comp)) comp = 'Coforge';
    else if (/microsoft/i.test(comp)) comp = 'Microsoft';
    else if (/amazon/i.test(comp)) comp = 'Amazon';
    else if (/netflix/i.test(comp)) comp = 'Netflix';
    else if (/salesforce|sf/i.test(comp)) comp = 'Salesforce';
    else if (/zoho/i.test(comp)) comp = 'Zoho';
    else if (/intel/i.test(comp)) comp = 'Intel';
    else if (/nvidia/i.test(comp)) comp = 'NVIDIA';
    else if (/oracle/i.test(comp)) comp = 'Oracle';
    else if (/amd/i.test(comp)) comp = 'AMD';
    else if (/wipro/i.test(comp)) comp = 'Wipro';
    else if (/meesho/i.test(comp)) comp = 'Meesho';
    else if (/capgemini/i.test(comp)) comp = 'Capgemini';
    else if (/goldman/i.test(comp)) comp = 'Goldman Sachs';
    else if (/qualcomm/i.test(comp)) comp = 'Qualcomm';
    else if (/tcs/i.test(comp)) comp = 'TCS';
    else if (/genpact/i.test(comp)) comp = 'Genpact';
    else if (/jpmc|jpmorgan|chase/i.test(comp)) comp = 'JPMorgan Chase';
    else if (/swiggy/i.test(comp)) comp = 'Swiggy';
    else if (/browserstack|bs/i.test(comp)) comp = 'BrowserStack';
    else if (/broadcom|bc/i.test(comp)) comp = 'Broadcom';
    companyCounts[comp] = (companyCounts[comp] || 0) + 1;

    // Workmode
    const modeStr = (String(job.workmode || '') + ' ' + String(job.location || '') + ' ' + String(job.title || '')).toLowerCase();
    if (modeStr.includes('remote') || modeStr.includes('work from home') || modeStr.includes('wfh')) {
      workmodeCounts['Remote']++;
    } else if (modeStr.includes('hybrid')) {
      workmodeCounts['Hybrid']++;
    } else {
      workmodeCounts['On-site']++;
    }

    // Shift
    const shiftVal = job.shift || 'Day Shift';
    if (shiftCounts[shiftVal] !== undefined) {
      shiftCounts[shiftVal]++;
    } else {
      shiftCounts['Day Shift']++;
    }

    // Salary
    const salStr = String(job.salary || '');
    if (salStr && salStr !== 'Not Disclosed' && salStr !== 'Competitive Industry Package') {
      salaryCounts['Disclosed Salary']++;
    } else {
      salaryCounts['Not Disclosed']++;
    }

    // Skills
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

    // Experience
    const minExp = Number(job.minYrsOfExperience || job.minYears || 0);
    if (minExp === 0) expCounts['0 Years']++;
    else if (minExp === 1) expCounts['1 Year']++;
    else if (minExp === 2) expCounts['2 Years']++;
    else if (minExp === 3) expCounts['3 Years']++;
    else if (minExp === 4) expCounts['4 Years']++;
    else if (minExp >= 5) expCounts['5+ Years']++;
  });

  const datesList = ['Last 24 Hours', 'Last 7 Days', 'Last 14 Days', 'Last 30 Days', 'More than 30 Days'];
  const defaultCompanies = ['Broadcom', 'BrowserStack', 'Swiggy', 'JPMorgan Chase', 'Genpact', 'TCS', 'Qualcomm', 'Goldman Sachs', 'Capgemini', 'Coforge', 'Microsoft', 'Amazon', 'Netflix', 'Salesforce', 'Zoho', 'Intel', 'NVIDIA', 'Oracle', 'AMD', 'Wipro', 'Meesho'];
  const companiesList = Array.from(new Set([...defaultCompanies, ...Object.keys(companyCounts)]));
  const skillsList = Object.keys(skillCounts).sort((a, b) => skillCounts[b] - skillCounts[a]).slice(0, 12);
  const experiencesList = ['0 Years', '1 Year', '2 Years', '3 Years', '4 Years', '5+ Years'];
  const workmodesList = ['Remote', 'On-site', 'Hybrid'];
  const shiftsList = ['Day Shift', 'Night Shift', 'Flexible / Rotational'];
  const salariesList = ['Disclosed Salary', 'Not Disclosed'];

  const [mobileExpanded, setMobileExpanded] = useState(false);

  const totalActiveFilters =
    selectedLocations.length +
    selectedDates.length +
    selectedCompanies.length +
    selectedSkills.length +
    selectedExperiences.length +
    selectedWorkmodes.length +
    selectedShifts.length +
    selectedSalaries.length;

  return (
    <aside className={`filter-sidebar ${mobileExpanded ? 'mobile-expanded' : ''}`}>
      <div className="filter-sidebar-header" onClick={() => setMobileExpanded(prev => !prev)}>
        <h3>
          <span>⚙️</span> Filter Jobs
          {totalActiveFilters > 0 && (
            <span className="active-filter-badge">{totalActiveFilters} Active</span>
          )}
        </h3>
        <div className="filter-header-right">
          {totalActiveFilters > 0 && (
            <button
              className="btn-clear-filters"
              onClick={(e) => {
                e.stopPropagation();
                handleClearAllWithNav();
              }}
            >
              Clear All
            </button>
          )}
          <span className="mobile-toggle-icon">{mobileExpanded ? '▲ Hide' : '▼ Expand'}</span>
        </div>
      </div>

      <div className={`filter-body-content ${mobileExpanded ? 'is-open' : ''}`}>
        {/* 1. HIERARCHICAL LOCATION FILTER */}
        <div className="filter-group location-filter-group">
          <div className="filter-group-title">
            <span>📍</span> Location
          </div>

          {/* Search input at top of Location */}
          <div className="location-search-box">
            <span className="location-search-icon">🔍</span>
            <input
              type="text"
              placeholder={
                selectedCountry && selectedState
                  ? "Search city..."
                  : selectedCountry
                    ? "Search state..."
                    : "Search location..."
              }
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              className="location-search-input"
            />
            {searchLocation && (
              <button className="clear-search-btn" onClick={() => setSearchLocation('')}>
                ×
              </button>
            )}
          </div>

          {/* Country -> State -> City Dropdowns */}
          <div className="location-dropdowns-wrapper">
            {/* Country Dropdown */}
            <div className="location-dropdown-field">
              <label className="dropdown-label">Country</label>
              <div className="select-wrapper">
                <select
                  value={selectedCountry || ''}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    setSelectedCountry(val);
                    setSelectedState(null);
                    setSelectedCity('');
                    setSearchLocation('');
                  }}
                  className="location-select"
                >
                  <option value="">Select Country</option>
                  {countriesList.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span className="dropdown-arrow">▼</span>
              </div>
            </div>

            {/* State Dropdown */}
            <div className="location-dropdown-field">
              <label className="dropdown-label">State</label>
              <div className="select-wrapper">
                <select
                  value={selectedState || ''}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    setSelectedState(val);
                    setSelectedCity('');
                    setSearchLocation('');
                  }}
                  disabled={!selectedCountry}
                  className={`location-select ${!selectedCountry ? 'disabled' : ''}`}
                >
                  <option value="">Select State</option>
                  {statesList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="dropdown-arrow">▼</span>
              </div>
            </div>

            {/* City Dropdown */}
            <div className="location-dropdown-field">
              <label className="dropdown-label">City</label>
              <div className="select-wrapper">
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCity(val);
                    if (val) {
                      if (!selectedLocations.includes(val)) {
                        onToggleLocation(val);
                      }
                    }
                  }}
                  disabled={!selectedCountry || !selectedState}
                  className={`location-select ${(!selectedCountry || !selectedState) ? 'disabled' : ''}`}
                >
                  <option value="">Select City</option>
                  {citiesList.map(ci => (
                    <option key={ci} value={ci}>{ci}</option>
                  ))}
                </select>
                <span className="dropdown-arrow">▼</span>
              </div>
            </div>
          </div>

          {/* Location Navigation Breadcrumbs / Level Header */}
          <div className="location-level-nav">
            {selectedCountry ? (
              <div className="location-breadcrumbs">
                <button
                  type="button"
                  className="btn-back-location"
                  onClick={() => {
                    if (selectedState) {
                      setSelectedState(null);
                    } else {
                      setSelectedCountry(null);
                    }
                  }}
                >
                  ← Back
                </button>
                <span className="breadcrumb-path">
                  {selectedCountry}{selectedState ? ` / ${selectedState}` : ''}
                </span>
              </div>
            ) : (
              <div className="location-level-title">Select Country to view States</div>
            )}
          </div>

          {/* Active Level Checkboxes List with Counts */}
          <div className="filter-options-list location-options-list">
            {displayItems.length === 0 ? (
              <div className="empty-location-msg">No matching locations found</div>
            ) : (
              displayItems.map((item) => {
                const isChecked = selectedLocations.includes(item.name);
                return (
                  <div
                    key={item.name}
                    className={`checkbox-label ${isChecked ? 'checked' : ''}`}
                  >
                    <div className="checkbox-left">
                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={isChecked}
                        onChange={() => onToggleLocation(item.name)}
                      />
                      <span
                        className="location-item-name"
                        onClick={() => {
                          if (item.canDrill) {
                            if (item.level === 'country') {
                              setSelectedCountry(item.name);
                            } else if (item.level === 'state') {
                              setSelectedState(item.name);
                            }
                          }
                        }}
                      >
                        {item.name}
                      </span>
                    </div>
                    <div className="checkbox-right">
                      <span className="filter-count">{item.count}</span>
                      {item.canDrill && (
                        <button
                          type="button"
                          className="drill-arrow-btn"
                          title={`View ${item.level === 'country' ? 'states' : 'cities'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.level === 'country') {
                              setSelectedCountry(item.name);
                            } else if (item.level === 'state') {
                              setSelectedState(item.name);
                            }
                          }}
                        >
                          ›
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2. DATE POSTED CHECKBOXES */}
        <div className="filter-group">
          <div className="filter-group-title">
            <span>🗓️</span> Date Posted
          </div>
          <div className="filter-options-list">
            {datesList.map((dt) => {
              const isChecked = selectedDates.includes(dt);
              return (
                <label key={dt} className={`checkbox-label ${isChecked ? 'checked' : ''}`}>
                  <div className="checkbox-left">
                    <input
                      type="checkbox"
                      className="checkbox-input"
                      checked={isChecked}
                      onChange={() => onToggleDate && onToggleDate(dt)}
                    />
                    <span>{dt}</span>
                  </div>
                  <span className="filter-count">{dateCounts[dt] || 0}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 3. SALARY CHECKBOXES */}
        <div className="filter-group">
          <div className="filter-group-title">
            <span>💵</span> Salary Info
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

        {/* 3. WORK MODE CHECKBOXES */}
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

        {/* 4. SHIFT CHECKBOXES */}
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
                  <span className="filter-count">{companyCounts[comp] || 0}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* 6. EXPERIENCE CHECKBOXES */}
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

        {/* Mobile Apply & Hide Filter Button */}
        <div className="mobile-apply-bar">
          <button
            type="button"
            className="btn btn-primary btn-mobile-apply"
            onClick={() => {
              setMobileExpanded(false);
              const mainEl = document.querySelector('.portal-main-content');
              if (mainEl) {
                mainEl.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            ✓ Apply & Show Jobs
          </button>
        </div>
      </div>
    </aside>
  );
};

export default FilterSidebar;

