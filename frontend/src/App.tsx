import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import AppHeader from './components/layout/AppHeader';
import AppSidebar from './components/layout/AppSidebar';
import Dashboard from './pages/Dashboard';
import VulnerabilityList from './pages/vulnerability/VulnerabilityList';
import VulnerabilityDetail from './pages/vulnerability/VulnerabilityDetail';
import { AIChatProvider } from './context/AIChatContext';

const { Content } = Layout;

const App: React.FC = () => {
  return (
    <AIChatProvider>
      <Layout style={{ minHeight: '100vh' }}>
        <AppSidebar />
        <Layout>
          <AppHeader />
          <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/vulnerabilities" element={<VulnerabilityList />} />
              <Route path="/vulnerabilities/:id" element={<VulnerabilityDetail />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </AIChatProvider>
  );
};

export default App;