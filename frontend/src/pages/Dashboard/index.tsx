import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Typography, Space, Button, Empty, message, Spin } from 'antd';
import { BugOutlined, ExclamationCircleOutlined, SafetyOutlined, CheckCircleOutlined, BarChartOutlined, PlusOutlined } from '@ant-design/icons';
import DataAnalysisModal from '../../components/dashboard/DataAnalysisModal';
import ChartDisplay from '../../components/dashboard/ChartDisplay';
import dashboardService, { DashboardChart, ChartConfig } from '../../services/dashboardService';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const { Title } = Typography;
const ResponsiveGridLayout = WidthProvider(Responsive);

const Dashboard: React.FC = () => {
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
  const [charts, setCharts] = useState<DashboardChart[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取所有图表
  const fetchCharts = async () => {
    setLoading(true);
    try {
      const data = await dashboardService.getDashboardCharts();
      setCharts(data);
    } catch (error) {
      console.error('获取图表失败:', error);
      message.error('获取图表失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取图表数据
  useEffect(() => {
    fetchCharts();
  }, []);

  // 处理图表位置变化
  const handleLayoutChange = (layout: any) => {
    // 更新每个图表的位置
    layout.forEach(async (item: any) => {
      const chartId = parseInt(item.i);
      const position = {
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h
      };
      
      try {
        await dashboardService.updateChartPosition(chartId, position);
      } catch (error) {
        console.error(`更新图表ID=${chartId}位置失败:`, error);
      }
    });
  };

  // 处理添加图表
  const handleAddChart = async (chartConfig: ChartConfig) => {
    try {
      // 创建新图表
      await dashboardService.createDashboardChart({
        name: chartConfig.title,
        description: chartConfig.description,
        chart_config: chartConfig
      });
      
      // 重新获取图表列表
      fetchCharts();
      message.success('图表添加成功');
    } catch (error) {
      console.error('添加图表失败:', error);
      message.error('添加图表失败');
    }
  };

  // 处理删除图表
  const handleDeleteChart = async (chartId: number) => {
    try {
      await dashboardService.deleteDashboardChart(chartId);
      // 更新本地图表列表
      setCharts(charts.filter(chart => chart.id !== chartId));
      message.success('图表删除成功');
    } catch (error) {
      console.error(`删除图表ID=${chartId}失败:`, error);
      message.error('删除图表失败');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Title level={2}>仪表盘</Title>
        <Button
          type="primary"
          icon={<BarChartOutlined />}
          onClick={() => setAnalysisModalVisible(true)}
        >
          数据分析
        </Button>
      </div>
      
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
      
      {/* 图表区域 */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Title level={3}>数据分析图表</Title>
        </div>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>加载图表中...</div>
          </div>
        ) : charts.length > 0 ? (
          <ResponsiveGridLayout
            className="layout"
            layouts={{
              lg: charts.map(chart => ({
                i: chart.id.toString(),
                x: chart.position.x,
                y: chart.position.y,
                w: chart.position.w,
                h: chart.position.h,
                minW: 3,
                minH: 2,
              }))
            }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={150}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".chart-drag-handle"
          >
            {charts.map(chart => (
              <div key={chart.id.toString()}>
                <ChartDisplay 
                  chartConfig={chart.chart_config}
                  title={chart.name}
                  description={chart.description}
                  onDelete={() => handleDeleteChart(chart.id)}
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        ) : (
          <Card>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无图表数据"
            >
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => setAnalysisModalVisible(true)}
              >
                创建图表
              </Button>
            </Empty>
          </Card>
        )}
      </div>
      
      {/* 数据分析模态框 */}
      <DataAnalysisModal
        visible={analysisModalVisible}
        onClose={() => setAnalysisModalVisible(false)}
        onSave={handleAddChart}
      />
    </div>
  );
};

export default Dashboard; 