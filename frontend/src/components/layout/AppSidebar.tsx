import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
import { 
  DashboardOutlined, 
  BugOutlined, 
  SecurityScanOutlined, 
  AppstoreOutlined, 
  SettingOutlined, 
  RobotOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Sider } = Layout;

const AppSidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // 从路径中获取当前选中的菜单项
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return ['1'];
    if (path.includes('/vulnerabilities')) return ['2'];
    if (path.includes('/assets')) return ['3'];
    return ['1'];
  };

  const items = [
    {
      key: '1',
      icon: <DashboardOutlined />,
      label: '仪表盘',
      onClick: () => navigate('/dashboard')
    },
    {
      key: '2',
      icon: <BugOutlined />,
      label: '漏洞管理',
      onClick: () => navigate('/vulnerabilities')
    },
    {
      key: '3',
      icon: <SecurityScanOutlined />,
      label: '资产管理',
      onClick: () => navigate('/assets')
    },
    {
      key: '4',
      icon: <RobotOutlined />,
      label: 'AI 智能体'
    },
    {
      key: '5',
      icon: <AppstoreOutlined />,
      label: '知识库'
    },
    {
      key: '6',
      icon: <SettingOutlined />,
      label: '系统设置'
    }
  ];

  return (
    <Sider 
      collapsible 
      collapsed={collapsed} 
      onCollapse={value => setCollapsed(value)}
      style={{ 
        overflow: 'auto', 
        height: '100vh', 
        position: 'sticky', 
        top: 0, 
        left: 0 
      }}
    >
      <div className="logo" style={{ 
        height: '64px', 
        margin: '16px', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        color: 'white',
        fontSize: collapsed ? '16px' : '18px',
        fontWeight: 'bold'
      }}>
        {collapsed ? 'VMS' : '漏洞管理平台'}
      </div>
      <Menu 
        theme="dark" 
        mode="inline" 
        defaultSelectedKeys={getSelectedKey()}
        items={items}
      />
    </Sider>
  );
};

export default AppSidebar; 