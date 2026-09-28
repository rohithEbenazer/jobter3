import React, { useState } from 'react';
import './AdminControls.css';

const API_BASE = 'http://localhost:5000/api/jobs/cogforce';

const AdminControls = ({ onSyncSuccess, onOpenLivePreview, showToast }) => {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // null | { type: 'loading'|'success'|'error', title: string, desc: string }
  const [stats, setStats] = useState(null);

  const handleTriggerSync = async () => {
    setSyncing(true);
    setSyncStatus({
      type: 'loading',
      title: 'Live Sync In Progress...',
      desc: 'Connecting to Coforge Zwayam Public API & inserting/updating MongoDB collection...'
    });

    try {
      const startTime = Date.now();
      const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
      const data = await res.json();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (data.success && data.stats) {
        setStats(data.stats);
        setSyncStatus({
          type: 'success',
          title: '⚡ DB Sync Completed Successfully!',
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
          <p>Extract live postings from Coforge Careers Public API directly into MongoDB database.</p>
        </div>
        <div className="admin-actions">
          <button className="btn btn-primary" onClick={handleTriggerSync} disabled={syncing}>
            <span className={syncing ? 'sync-spin' : ''}>🔄</span>
            <span>{syncing ? 'Syncing Live Jobs...' : 'Trigger Live DB Sync'}</span>
          </button>
          <button className="btn btn-secondary" onClick={onOpenLivePreview}>
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
