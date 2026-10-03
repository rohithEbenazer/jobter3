import React, { useState } from 'react';
import './AdminControls.css';

import { API_BASE } from '../../utils/apiConfig';

const AdminControls = ({ selectedCompany = 'All', onSelectCompany, onSyncSuccess, onOpenLivePreview, showToast }) => {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // null | { type: 'loading'|'success'|'error', title: string, desc: string }
  const [stats, setStats] = useState(null);

  const handleCompanyChange = (comp) => {
    if (onSelectCompany) onSelectCompany(comp);
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    setSyncStatus({
      type: 'loading',
      title: 'Live Sync In Progress...',
      desc: `Connecting to ${selectedCompany === 'All' ? 'Coforge, Microsoft, Amazon & Netflix Careers APIs' : selectedCompany + ' Careers API'} & updating MongoDB collection...`
    });

    try {
      const startTime = Date.now();
      const res = await fetch(`${API_BASE}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: selectedCompany })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Server returned error status ${res.status}`);
      }
      const data = await res.json();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (data.success && data.stats) {
        setStats(data.stats);
        setSyncStatus({
          type: 'success',
          title: `⚡ DB Sync Completed for ${selectedCompany}!`,
          desc: `Synced ${data.stats.totalFetchedRaw} live jobs into MongoDB in ${duration}s. (Inserted: ${data.stats.insertedToDb}, Updated: ${data.stats.updatedOrKeptInDb})`
        });
        showToast(`Live DB Sync completed! DB total: ${data.stats.finalDbCount}`, 'success');
        if (onSyncSuccess) onSyncSuccess();
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (err) {
      setSyncStatus({
        type: 'error',
        title: '❌ Sync Failed',
        desc: `Error: ${err.message}`
      });
      showToast(`Sync Failed: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="admin-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <h2>⚡ Super Admin Live Sync Controls</h2>
          <p>Extract live postings from Coforge, Microsoft, Amazon, Netflix, Salesforce, Zoho, Intel & NVIDIA Careers APIs directly into MongoDB database.</p>
        </div>

        {/* Company Selector Checkboxes */}
        <div className="company-sync-selector">
          <span className="selector-label">Select Target Company:</span>
          <div className="company-checkboxes">
            <label className={`company-chip ${selectedCompany === 'All' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="All"
                checked={selectedCompany === 'All'}
                onChange={() => handleCompanyChange('All')}
              />
              🏢 All Companies
            </label>
            <label className={`company-chip ${selectedCompany === 'Coforge' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="Coforge"
                checked={selectedCompany === 'Coforge'}
                onChange={() => handleCompanyChange('Coforge')}
              />
              🔶 Coforge
            </label>
            <label className={`company-chip ${selectedCompany === 'Microsoft' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="Microsoft"
                checked={selectedCompany === 'Microsoft'}
                onChange={() => handleCompanyChange('Microsoft')}
              />
              🟦 Microsoft
            </label>
            <label className={`company-chip ${selectedCompany === 'Amazon' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="Amazon"
                checked={selectedCompany === 'Amazon'}
                onChange={() => handleCompanyChange('Amazon')}
              />
              🟠 Amazon
            </label>
            <label className={`company-chip ${selectedCompany === 'Netflix' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="Netflix"
                checked={selectedCompany === 'Netflix'}
                onChange={() => handleCompanyChange('Netflix')}
              />
              🔴 Netflix
            </label>
            <label className={`company-chip ${selectedCompany === 'Salesforce' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="Salesforce"
                checked={selectedCompany === 'Salesforce'}
                onChange={() => handleCompanyChange('Salesforce')}
              />
              ☁️ Salesforce
            </label>
            <label className={`company-chip ${selectedCompany === 'Zoho' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="Zoho"
                checked={selectedCompany === 'Zoho'}
                onChange={() => handleCompanyChange('Zoho')}
              />
              🟢 Zoho
            </label>
            <label className={`company-chip ${selectedCompany === 'Intel' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="Intel"
                checked={selectedCompany === 'Intel'}
                onChange={() => handleCompanyChange('Intel')}
              />
              🔷 Intel
            </label>
            <label className={`company-chip ${selectedCompany === 'NVIDIA' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="NVIDIA"
                checked={selectedCompany === 'NVIDIA'}
                onChange={() => handleCompanyChange('NVIDIA')}
              />
              💚 NVIDIA
            </label>
            <label className={`company-chip ${selectedCompany === 'Oracle' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="Oracle"
                checked={selectedCompany === 'Oracle'}
                onChange={() => handleCompanyChange('Oracle')}
              />
              🔴 Oracle
            </label>
            <label className={`company-chip ${selectedCompany === 'AMD' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="AMD"
                checked={selectedCompany === 'AMD'}
                onChange={() => handleCompanyChange('AMD')}
              />
              🟥 AMD
            </label>
            <label className={`company-chip ${selectedCompany === 'Wipro' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="Wipro"
                checked={selectedCompany === 'Wipro'}
                onChange={() => handleCompanyChange('Wipro')}
              />
              🟣 Wipro
            </label>
            <label className={`company-chip ${selectedCompany === 'Meesho' ? 'active' : ''}`}>
              <input
                type="radio"
                name="companySync"
                value="Meesho"
                checked={selectedCompany === 'Meesho'}
                onChange={() => handleCompanyChange('Meesho')}
              />
              🛍️ Meesho
            </label>
          </div>
        </div>

        <div className="admin-actions">
          <button className="btn btn-primary" onClick={handleTriggerSync} disabled={syncing}>
            <span className={syncing ? 'sync-spin' : ''}>🔄</span>
            <span>{syncing ? `Syncing ${selectedCompany}...` : `Trigger ${selectedCompany} DB Sync`}</span>
          </button>
          <button className="btn btn-secondary" onClick={() => onOpenLivePreview(selectedCompany)}>
            <span>🌐</span>
            <span>Fetch Live API Jobs</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div className={`sync-banner ${syncStatus.type}`}>
          {syncStatus.type === 'loading' && <div className="sync-spinner"></div>}
          <div className="sync-details">
            <h4>{syncStatus.title}</h4>
            <p>{syncStatus.desc}</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Live API Jobs</div>
            <div className="stat-value">{stats.totalFetchedRaw || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Inserted to DB</div>
            <div className="stat-value success">{stats.insertedToDb || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Updated / Kept in DB</div>
            <div className="stat-value info">{stats.updatedOrKeptInDb || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Final DB Count</div>
            <div className="stat-value primary">{stats.finalDbCount || 0}</div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminControls;
