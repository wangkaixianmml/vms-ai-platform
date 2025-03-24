import React from 'react';
import { Layout, Button, Space, Avatar, Dropdown } from 'antd';
import { UserOutlined, BellOutlined, QuestionCircleOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Header } = Layout;

interface AppHeaderProps {
  collapsed?: boolean;
  toggle?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ collapsed, toggle }) => {
  const items: MenuProps['items'] = [
    {
      key: '1',
      label: '个人中心',
    },
    {
      key: '2',
      label: '设置',
    },
    {
      key: '3',
      danger: true,
      label: '退出登录',
    },
  ];

  return (
    <Header style={{ padding: '0 16px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        {toggle && (
          <Button 
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggle}
            style={{ fontSize: '16px', width: 64, height: 64 }}
          />
        )}
      </div>
      
      <Space size={16}>
        <Button type="text" icon={<QuestionCircleOutlined />} />
        <Button type="text" icon={<BellOutlined />} />
        <Dropdown menu={{ items }} placement="bottomRight">
          <Avatar icon={<UserOutlined />} />
        </Dropdown>
      </Space>
    </Header>
  );
};

export default AppHeader; 