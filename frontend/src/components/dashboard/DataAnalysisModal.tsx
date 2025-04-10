import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, Button, Spin, Row, Col, Alert, message, Divider, Space, Tag, Collapse, Switch, Tooltip } from 'antd';
import { BarChartOutlined, RobotOutlined, FilterOutlined, InfoCircleOutlined } from '@ant-design/icons';
import moment from 'moment';
import 'moment/locale/zh-cn';
import ChartDisplay from './ChartDisplay';
import dashboardService, { ChartConfig, DataAnalysisRequest } from '../../services/dashboardService';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

interface DataAnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (chartConfig: ChartConfig) => void;
}

// 漏洞筛选条件类型
interface VulnerabilityFilterConditions {
  risk_levels?: string[];
  statuses?: string[];
  vulnerability_types?: string[];
  priority_levels?: string[];
  departments?: string[];
  min_cvss?: number;
  max_cvss?: number;
  start_date?: string;
  end_date?: string;
}

// 资产筛选条件类型
interface AssetFilterConditions {
  types?: string[];
  importance_levels?: string[];
  network_types?: string[];
  start_date?: string;
  end_date?: string;
}

const DataAnalysisModal: React.FC<DataAnalysisModalProps> = ({
  visible,
  onClose,
  onSave
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [generatedChart, setGeneratedChart] = useState<ChartConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 筛选选项
  const [riskLevels] = useState(['高', '中', '低']);
  const [vulnerabilityStatuses] = useState(['待修复', '修复中', '已修复', '已忽略']);
  const [vulnerabilityTypes] = useState(['SQL注入', '跨站脚本', '远程代码执行', '拒绝服务', '信息泄露', '权限提升']);
  const [priorityLevels] = useState(['紧急', '高', '中', '低']);
  const [assetTypes] = useState(['服务器', 'Web应用', '数据库', '网络设备', '移动应用']);
  const [importanceLevels] = useState(['关键', '高', '中', '低']);
  const [networkTypes] = useState(['内网', '外网', '混合']);
  
  // 漏洞筛选条件
  const [vulnerabilityFilters, setVulnerabilityFilters] = useState<VulnerabilityFilterConditions>({});
  
  // 资产筛选条件
  const [assetFilters, setAssetFilters] = useState<AssetFilterConditions>({});
  
  // 是否使用高级分析
  const [useAdvancedAnalysis, setUseAdvancedAnalysis] = useState(false);
  
  // 关闭模态框时重置状态
  useEffect(() => {
    if (!visible) {
      setGeneratedChart(null);
      setError(null);
      form.resetFields();
      setVulnerabilityFilters({});
      setAssetFilters({});
      setUseAdvancedAnalysis(false);
    }
  }, [visible, form]);

  // 生成图表
  const handleGenerateChart = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();
      
      setLoading(true);
      setError(null);
      
      // 合并筛选条件
      const filterConditions = {
        vulnerability: vulnerabilityFilters,
        asset: assetFilters,
        use_advanced_analysis: useAdvancedAnalysis
      };
      
      // 构建请求
      const request: DataAnalysisRequest = {
        filter_conditions: filterConditions,
        user_description: values.description
      };
      
      console.log('发送分析请求:', request);
      
      // 发送请求
      const chartConfig = await dashboardService.generateDataAnalysisChart(request);
      
      // 设置生成的图表配置
      setGeneratedChart(chartConfig);
    } catch (error) {
      console.error('生成图表失败:', error);
      setError(typeof error === 'string' ? error : '生成图表失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 保存图表
  const handleSaveChart = () => {
    if (generatedChart) {
      onSave(generatedChart);
      onClose();
    }
  };
  
  // 处理漏洞筛选条件变化
  const handleVulnerabilityFilterChange = (key: string, value: any) => {
    setVulnerabilityFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // 处理资产筛选条件变化
  const handleAssetFilterChange = (key: string, value: any) => {
    setAssetFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // 获取已设置的筛选条件数量
  const getActiveFilterCount = () => {
    let count = 0;
    
    // 计算漏洞筛选条件
    Object.values(vulnerabilityFilters).forEach(value => {
      if (Array.isArray(value) ? value.length > 0 : value !== undefined) {
        count++;
      }
    });
    
    // 计算资产筛选条件
    Object.values(assetFilters).forEach(value => {
      if (Array.isArray(value) ? value.length > 0 : value !== undefined) {
        count++;
      }
    });
    
    return count;
  };

  return (
    <Modal
      title={<span><BarChartOutlined /> 数据分析</span>}
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Row gutter={24}>
          <Col span={generatedChart ? 12 : 24}>
            <Collapse 
              defaultActiveKey={['vulnerability']}
              expandIconPosition="end"
            >
              <Panel 
                header={
                  <Space>
                    <FilterOutlined />
                    <span>漏洞筛选条件</span>
                    {Object.keys(vulnerabilityFilters).length > 0 && (
                      <Tag color="blue">{Object.keys(vulnerabilityFilters).length} 个条件</Tag>
                    )}
                  </Space>
                } 
                key="vulnerability"
              >
                <Form.Item label="风险等级">
                  <Select
                    mode="multiple"
                    placeholder="选择风险等级"
                    style={{ width: '100%' }}
                    value={vulnerabilityFilters.risk_levels || []}
                    onChange={(value) => handleVulnerabilityFilterChange('risk_levels', value)}
                    allowClear
                  >
                    {riskLevels.map(level => (
                      <Option key={level} value={level}>{level}</Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label="漏洞状态">
                  <Select
                    mode="multiple"
                    placeholder="选择漏洞状态"
                    style={{ width: '100%' }}
                    value={vulnerabilityFilters.statuses || []}
                    onChange={(value) => handleVulnerabilityFilterChange('statuses', value)}
                    allowClear
                  >
                    {vulnerabilityStatuses.map(status => (
                      <Option key={status} value={status}>{status}</Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label="漏洞类型">
                  <Select
                    mode="multiple"
                    placeholder="选择漏洞类型"
                    style={{ width: '100%' }}
                    value={vulnerabilityFilters.vulnerability_types || []}
                    onChange={(value) => handleVulnerabilityFilterChange('vulnerability_types', value)}
                    allowClear
                  >
                    {vulnerabilityTypes.map(type => (
                      <Option key={type} value={type}>{type}</Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label="优先级">
                  <Select
                    mode="multiple"
                    placeholder="选择优先级"
                    style={{ width: '100%' }}
                    value={vulnerabilityFilters.priority_levels || []}
                    onChange={(value) => handleVulnerabilityFilterChange('priority_levels', value)}
                    allowClear
                  >
                    {priorityLevels.map(level => (
                      <Option key={level} value={level}>{level}</Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="最低CVSS评分">
                      <Select
                        placeholder="选择最低CVSS评分"
                        style={{ width: '100%' }}
                        value={vulnerabilityFilters.min_cvss}
                        onChange={(value) => handleVulnerabilityFilterChange('min_cvss', value)}
                        allowClear
                      >
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
                          <Option key={score} value={score}>{score}.0</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="最高CVSS评分">
                      <Select
                        placeholder="选择最高CVSS评分"
                        style={{ width: '100%' }}
                        value={vulnerabilityFilters.max_cvss}
                        onChange={(value) => handleVulnerabilityFilterChange('max_cvss', value)}
                        allowClear
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                          <Option key={score} value={score}>{score}.0</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="漏洞发现时间范围">
                  <RangePicker
                    style={{ width: '100%' }}
                    onChange={(dates) => {
                      if (dates) {
                        handleVulnerabilityFilterChange('start_date', dates[0]?.format('YYYY-MM-DD'));
                        handleVulnerabilityFilterChange('end_date', dates[1]?.format('YYYY-MM-DD'));
                      } else {
                        handleVulnerabilityFilterChange('start_date', undefined);
                        handleVulnerabilityFilterChange('end_date', undefined);
                      }
                    }}
                  />
                </Form.Item>
              </Panel>
              
              <Panel 
                header={
                  <Space>
                    <FilterOutlined />
                    <span>资产筛选条件</span>
                    {Object.keys(assetFilters).length > 0 && (
                      <Tag color="green">{Object.keys(assetFilters).length} 个条件</Tag>
                    )}
                  </Space>
                } 
                key="asset"
              >
                <Form.Item label="资产类型">
                  <Select
                    mode="multiple"
                    placeholder="选择资产类型"
                    style={{ width: '100%' }}
                    value={assetFilters.types || []}
                    onChange={(value) => handleAssetFilterChange('types', value)}
                    allowClear
                  >
                    {assetTypes.map(type => (
                      <Option key={type} value={type}>{type}</Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label="重要性等级">
                  <Select
                    mode="multiple"
                    placeholder="选择重要性等级"
                    style={{ width: '100%' }}
                    value={assetFilters.importance_levels || []}
                    onChange={(value) => handleAssetFilterChange('importance_levels', value)}
                    allowClear
                  >
                    {importanceLevels.map(level => (
                      <Option key={level} value={level}>{level}</Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label="网络类型">
                  <Select
                    mode="multiple"
                    placeholder="选择网络类型"
                    style={{ width: '100%' }}
                    value={assetFilters.network_types || []}
                    onChange={(value) => handleAssetFilterChange('network_types', value)}
                    allowClear
                  >
                    {networkTypes.map(type => (
                      <Option key={type} value={type}>{type}</Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item label="资产发现时间范围">
                  <RangePicker
                    style={{ width: '100%' }}
                    onChange={(dates) => {
                      if (dates) {
                        handleAssetFilterChange('start_date', dates[0]?.format('YYYY-MM-DD'));
                        handleAssetFilterChange('end_date', dates[1]?.format('YYYY-MM-DD'));
                      } else {
                        handleAssetFilterChange('start_date', undefined);
                        handleAssetFilterChange('end_date', undefined);
                      }
                    }}
                  />
                </Form.Item>
              </Panel>
            </Collapse>
            
            <Divider />
            
            <Form.Item
              name="description"
              label="描述您需要的图表"
              rules={[{ required: true, message: '请输入图表需求描述' }]}
            >
              <TextArea 
                rows={4} 
                placeholder="例如：请生成一个柱状图，显示不同风险等级的漏洞数量分布"
              />
            </Form.Item>

            <Form.Item>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <Space>
                  <Switch
                    checked={useAdvancedAnalysis}
                    onChange={setUseAdvancedAnalysis}
                  />
                  <span>使用高级分析</span>
                  <Tooltip title="启用后将进行更深入的数据分析，可能会消耗更多资源和时间">
                    <InfoCircleOutlined style={{ color: '#1677ff' }} />
                  </Tooltip>
                </Space>
                
                <Tag color={getActiveFilterCount() > 0 ? 'blue' : 'default'}>
                  已设置 {getActiveFilterCount()} 个筛选条件
                </Tag>
              </div>
              
              <Button 
                type="primary" 
                onClick={handleGenerateChart} 
                loading={loading}
                icon={<RobotOutlined />}
                block
              >
                生成图表
              </Button>
            </Form.Item>

            {error && (
              <Alert
                message="错误"
                description={error}
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
          </Col>

          {generatedChart && (
            <Col span={12}>
              <div style={{ marginBottom: 16 }}>
                <h3>生成的图表</h3>
                <ChartDisplay chartConfig={generatedChart} height={400} />
                <Button 
                  type="primary" 
                  onClick={handleSaveChart} 
                  style={{ marginTop: 16 }}
                  block
                >
                  保存图表
                </Button>
              </div>
            </Col>
          )}
        </Row>
      </Form>
    </Modal>
  );
};

export default DataAnalysisModal; 