import React, { useState } from 'react';
import Navbar from './components/Navbar/Navbar';
import HomePage from './pages/HomePage/HomePage';
import JobModal from './components/JobModal/JobModal';
import Toast from './components/Toast/Toast';
import './App.css';

import { API_BASE } from './utils/apiConfig';

function App() {
  const [role, setRole] = useState('super_admin'); // 'super_admin' | 'user'
  const [selectedJob, setSelectedJob] = useState(null);
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleViewDetails = async (jobId) => {
    try {
      const res = await fetch(`${API_BASE}/${jobId}`);
      const data = await res.json();
      if (data.success && data.job) {
        setSelectedJob(data.job);
      } else {
        showToast('Job details not found', 'error');
      }
    } catch (err) {
      showToast(`Error fetching details: ${err.message}`, 'error');
    }
  };

  return (
    <div className="app-container">
      {/* Background Animated Blobs */}
      <div className="bg-glow blob-1"></div>
      <div className="bg-glow blob-2"></div>

      {/* Navigation Header */}
      <Navbar role={role} onSwitchRole={setRole} />

      {/* Main Page View */}
      <HomePage role={role} onViewDetails={handleViewDetails} showToast={showToast} />

      {/* Detail Modal */}
      {selectedJob && (
        <JobModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}

      {/* Toast Notifications */}
      <Toast toasts={toasts} />
    </div>
  );
}

export default App;
