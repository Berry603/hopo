import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp, Spin } from 'antd';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/login/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import RiskAlertPage from './pages/risk/RiskAlertPage';
import AuditProjectPage from './pages/audit/AuditProjectPage';
import RectificationPage from './pages/rectification/RectificationPage';
import KnowledgePage from './pages/knowledge/KnowledgePage';
import DataQualityPage from './pages/data-quality/DataQualityPage';
import QueryPage from './pages/query/QueryPage';
import ProcedurePage from './pages/audit-procedure/ProcedurePage';
import ProfilePage from './pages/profile/ProfilePage';
import SettingsPage from './pages/settings/SettingsPage';
import { useAuthStore } from './store/authStore';

function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const initAuth = useAuthStore((s) => s.initAuth);
  const [initializing, setInitializing] = React.useState(true);

  React.useEffect(() => {
    initAuth().finally(() => setInitializing(false));
  }, [initAuth]);

  if (initializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <AntApp>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={isLoggedIn ? <MainLayout /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* 风险预警 */}
          <Route path="risk" element={<Navigate to="/risk/alerts" replace />} />
          <Route path="risk/:tab" element={<RiskAlertPage />} />

          {/* 审计作业 */}
          <Route path="audit" element={<Navigate to="/audit/projects" replace />} />
          <Route path="audit/procedure" element={<ProcedurePage />} />
          <Route path="audit/:tab" element={<AuditProjectPage />} />

          {/* 整改跟踪 */}
          <Route path="rectification" element={<Navigate to="/rectification/orders" replace />} />
          <Route path="rectification/:tab" element={<RectificationPage />} />

          {/* 知识管理 */}
          <Route path="knowledge" element={<Navigate to="/knowledge/search" replace />} />
          <Route path="knowledge/:tab" element={<KnowledgePage />} />

          {/* 数据治理 */}
          <Route path="data-quality" element={<Navigate to="/data-quality/dashboard" replace />} />
          <Route path="data-quality/:tab" element={<DataQualityPage />} />

          {/* 智能查询 */}
          <Route path="query" element={<Navigate to="/query/nl2sql" replace />} />
          <Route path="query/:tab" element={<QueryPage />} />

          {/* 审计程序 — 兼容旧路径重定向 */}
          <Route path="audit-procedure" element={<Navigate to="/audit/procedure" replace />} />

          <Route path="templates" element={<Navigate to="/knowledge/templates" replace />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AntApp>
  );
}

export default App;
