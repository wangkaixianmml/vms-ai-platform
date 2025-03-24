import React from 'react';
import { Row, Col, Card, Statistic, Typography, Space } from 'antd';
import { BugOutlined, ExclamationCircleOutlined, SafetyOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  return (
    <div>
      <Title level={2}>仪表盘</Title>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总漏洞数"
              value={42}
              prefix={<BugOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="高危漏洞"
              value={7}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待修复"
              value={15}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已修复"
              value={27}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>
      
      <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
        <Col span={24}>
          <Card title="平台说明">
            <Space direction="vertical">
              <p>欢迎使用集成AI能力的漏洞管理平台。本平台通过集成Dify AI能力，帮助您更高效地管理、分析和处理漏洞。</p>
              <p>平台主要功能：</p>
              <ul>
                <li>漏洞录入、管理和跟踪</li>
                <li>自动生成修复建议和安全措施</li>
                <li>与AI智能体对话获取专业解答</li>
                <li>漏洞严重程度和影响分析</li>
              </ul>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard; 