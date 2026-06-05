import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/login/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import RiskAlertPage from './pages/risk/RiskAlertPage';
import AuditProjectPage from './pages/audit/AuditProjectPage';
import RectificationPage from './pages/rectification/RectificationPage';
import KnowledgePage from './pages/knowledge/KnowledgePage';
import DataQualityPage from './pages/data-quality/DataQualityPage';
import QueryPage from './pages/query/QueryPage';
import ProfilePage from './pages/profile/ProfilePage';
import SettingsPage from './pages/settings/SettingsPage';

function App() {
  // TODO: 检查用户是否已登录
  const isLoggedIn = true; // 临时设置为true

  return (
    <AntApp>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={isLoggedIn ? <MainLayout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="risk" element={<RiskAlertPage />} />
          <Route path="audit" element={<AuditProjectPage />} />
          <Route path="rectification" element={<RectificationPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="data-quality" element={<DataQualityPage />} />
          <Route path="query" element={<QueryPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AntApp>
  );
}

export default App;