import React from 'react';
import AdminPage from '../AdminPage/AdminPage';
import UserPage from '../UserPage/UserPage';
import './HomePage.css';

const HomePage = ({ role, onViewDetails, showToast }) => {
  return (
    <div className="home-page">
      <main className="container main-container">
        {role === 'super_admin' ? (
          <AdminPage onViewDetails={onViewDetails} showToast={showToast} />
        ) : (
          <UserPage onViewDetails={onViewDetails} showToast={showToast} />
        )}
      </main>
    </div>
  );
};

export default HomePage;
