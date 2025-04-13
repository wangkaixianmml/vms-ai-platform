import React, { useState } from 'react';
import { Modal, Button, Spin, Typography, Divider, Card, Tag, List, Result, Space, Progress } from 'antd';
import { RobotOutlined, CheckCircleOutlined, WarningOutlined, LoadingOutlined } from '@ant-design/icons';
import aiService, { RiskAssessmentResult } from '../../services/aiService';
import vulnerabilityService from '../../services/vulnerabilityService';

const { Title, Paragraph, Text } = Typography;

interface RiskAssessmentModalProps {
  visible: boolean;
  vulnerability: any;
  onClose: () => void;
  onApplyResults: (vprScore: number, priority: string) => void;
}

const RiskAssessmentModal: React.FC<RiskAssessmentModalProps> = ({
  visible,
  vulnerability,
  onClose,
  onApplyResults
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<RiskAssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyingResults, setApplyingResults] = useState<boolean>(false);

  // 风险等级对应的颜色
  const riskLevelColors: Record<string, string> = {
    '紧急': 'magenta',
    '高': 'red',
    '中': 'orange',
    '低': 'green',
  };

  // 评分对应的颜色
  const getScoreColor = (score: number): string => {
    if (score >= 8.5) return 'magenta';
    if (score >= 6.5) return 'red';
    if (score >= 4.0) return 'orange';
    return 'green';
  };

  // 开始评估
  const startAssessment = async () => {
    setLoading(true);
    setProgress(0);
    setResult(null);
    setError(null);

    // 模拟进度
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const increment = Math.floor(Math.random() * 10) + 5;
        return prev + increment > 90 ? 90 : prev + increment;
      });
    }, 1000);

    try {
      // 准备完整的漏洞数据，包括关联资产
      // 确保资产数据包含所有必需字段
      const vulnerabilityWithEnhancedAssets = {
        ...vulnerability,
        affected_assets: vulnerability.affected_assets?.map((asset: any) => ({
          ...asset,
          // 确保必要字段存在，如果不存在则设置默认值
          importance_level: asset.importance_level || "中",
          network_type: asset.network_type || "内网",
          exposure: asset.exposure || "低",
          business_system: asset.business_system || "一般业务系统",
          business_impact: asset.business_impact || "一般影响"
        }))
      };
      
      console.log('发送风险评估数据:', vulnerabilityWithEnhancedAssets);
      const assessmentResponse = await aiService.assessVulnerabilityRisk(vulnerabilityWithEnhancedAssets);
      
      clearInterval(progressInterval);
      
      if (assessmentResponse.success && assessmentResponse.result) {
        setResult(assessmentResponse.result);
        setProgress(100);
      } else {
        setError(assessmentResponse.error || '评估失败，请稍后重试');
        setProgress(0);
      }
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : '评估过程发生错误');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  // 应用评估结果
  const applyResults = async () => {
    if (!result) return;
    
    setApplyingResults(true);
    try {
      // 更新漏洞信息
      await vulnerabilityService.updateVulnerability(vulnerability.id, {
        vpr_score: result.vpr_score,
        priority: result.priority
      });
      
      // 通知父组件更新
      onApplyResults(result.vpr_score, result.priority);
      
      // 关闭模态框
      onClose();
    } catch (err) {
      setError('应用评估结果失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setApplyingResults(false);
    }
  };

  // 渲染评估结果
  const renderAssessmentResult = () => {
    if (!result) return null;

    return (
      <div className="assessment-result">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card bordered>
            <Title level={4}>VPR评分</Title>
            <div className="text-center">
              <div className="text-4xl font-bold" style={{ color: getScoreColor(result.vpr_score) }}>
                {result.vpr_score.toFixed(1)}/10
              </div>
              <Tag color={getScoreColor(result.vpr_score)} className="mt-2">
                {result.vpr_score >= 8.5 ? '紧急' : result.vpr_score >= 6.5 ? '严重' : result.vpr_score >= 4.0 ? '中等' : '低危'}
              </Tag>
            </div>
          </Card>
          
          <Card bordered>
            <Title level={4}>优先级</Title>
            <div className="text-center">
              <div className="text-4xl font-bold" style={{ color: riskLevelColors[result.priority] || 'gray' }}>
                {result.priority}
              </div>
              <Tag color={riskLevelColors[result.priority] || 'default'} className="mt-2">
                修复优先级
              </Tag>
            </div>
          </Card>
        </div>
        
        <Card title="评估依据" className="mb-4">
          <Paragraph>{result.assessment_reasoning}</Paragraph>
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card title="技术风险因素" bordered>
            <List
              dataSource={result.technical_risk_factors}
              renderItem={item => (
                <List.Item>
                  <WarningOutlined style={{ color: 'orange', marginRight: 8 }} /> {item}
                </List.Item>
              )}
            />
          </Card>
          
          <Card title="业务风险因素" bordered>
            <List
              dataSource={result.business_risk_factors}
              renderItem={item => (
                <List.Item>
                  <WarningOutlined style={{ color: 'blue', marginRight: 8 }} /> {item}
                </List.Item>
              )}
            />
          </Card>
        </div>
        
        <Card title="修复建议">
          <Paragraph>{result.remediation_priority}</Paragraph>
        </Card>
        
        <div className="flex justify-end mt-4">
          <Button 
            type="primary" 
            onClick={applyResults} 
            loading={applyingResults}
            icon={<CheckCircleOutlined />}
          >
            应用评估结果到漏洞
          </Button>
        </div>
      </div>
    );
  };

  // 渲染加载状态
  const renderLoading = () => (
    <div className="text-center py-8">
      <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} />
      <div className="mt-4">
        <Progress percent={progress} status="active" />
        <Paragraph className="mt-2">AI正在评估漏洞风险，这可能需要一点时间...</Paragraph>
      </div>
    </div>
  );

  // 渲染错误状态
  const renderError = () => (
    <Result
      status="error"
      title="评估失败"
      subTitle={error || '无法完成风险评估'}
      extra={
        <Button type="primary" onClick={startAssessment}>
          重新评估
        </Button>
      }
    />
  );

  // 渲染初始状态
  const renderInitialState = () => (
    <div className="text-center py-8">
      <RobotOutlined style={{ fontSize: 64, color: '#1890ff' }} />
      <Title level={3} className="mt-4">风险评估</Title>
      <Paragraph>
        AI将分析此漏洞的所有可用信息，包括关联资产的属性，评估其风险级别，并提供VPR评分和优先级建议。
      </Paragraph>
      <Paragraph type="secondary">
        评估精度取决于可用数据量。确保漏洞有足够的描述、CVE信息和关联资产以获得最佳结果。
      </Paragraph>
      <Button 
        type="primary" 
        size="large" 
        onClick={startAssessment} 
        className="mt-4"
        icon={<RobotOutlined />}
      >
        开始评估
      </Button>
    </div>
  );

  return (
    <Modal
      title={
        <div className="flex items-center">
          <RobotOutlined className="mr-2 text-blue-500" />
          <span>漏洞风险AI评估</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      centered
    >
      <Divider />
      {loading ? renderLoading() : 
       error ? renderError() : 
       result ? renderAssessmentResult() : 
       renderInitialState()}
    </Modal>
  );
};

export default RiskAssessmentModal; 