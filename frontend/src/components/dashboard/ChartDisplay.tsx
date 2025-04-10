import React, { useEffect, useRef } from 'react';
import { Card, Spin, Tag, Typography, Popconfirm, Button, Space } from 'antd';
import { DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import * as echarts from 'echarts';
import { ChartConfig } from '../../services/dashboardService';

const { Title, Paragraph } = Typography;

interface ChartDisplayProps {
  chartConfig: ChartConfig;
  title?: string;
  description?: string;
  loading?: boolean;
  height?: number | string;
  showControls?: boolean;
  onDelete?: () => void;
}

const ChartDisplay: React.FC<ChartDisplayProps> = ({
  chartConfig,
  title,
  description,
  loading = false,
  height = 400,
  showControls = true,
  onDelete
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 初始化图表
  useEffect(() => {
    if (!loading && chartRef.current && chartConfig) {
      // 如果已有图表实例，销毁它
      if (chartInstance.current) {
        chartInstance.current.dispose();
      }
      
      // 创建新的图表实例
      const chart = echarts.init(chartRef.current);
      chartInstance.current = chart;
      
      try {
        // 合并配置并设置
        const config = {
          ...chartConfig.config,
          dataset: {
            source: chartConfig.data
          }
        };
        
        // 应用配置
        chart.setOption(config);
        
        // 窗口大小变化时自动调整图表大小
        const handleResize = () => {
          chart.resize();
        };
        
        window.addEventListener('resize', handleResize);
        
        // 组件卸载时清理
        return () => {
          window.removeEventListener('resize', handleResize);
          chart.dispose();
        };
      } catch (error) {
        console.error('图表渲染失败:', error);
      }
    }
  }, [chartConfig, loading]);

  return (
    <Card
      title={
        <div className="chart-drag-handle" style={{ cursor: 'move', userSelect: 'none' }}>
          <span>{title || chartConfig?.title || '数据图表'}</span>
          {chartConfig?.category && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {chartConfig.category}
            </Tag>
          )}
        </div>
      }
      bodyStyle={{ padding: '12px' }}
      extra={
        showControls && onDelete && (
          <Space>
            <Popconfirm
              title="确定要删除此图表吗？"
              okText="确定"
              cancelText="取消"
              onConfirm={(e) => {
                e?.stopPropagation();
                onDelete();
              }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
                size="small" 
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
            <Button 
              type="text" 
              icon={<InfoCircleOutlined />} 
              size="small" 
              onClick={(e) => e.stopPropagation()}
            />
          </Space>
        )
      }
    >
      {loading ? (
        <div style={{ height, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin tip="加载中..." />
        </div>
      ) : (
        <>
          <div ref={chartRef} style={{ width: '100%', height: height }} />
          {(description || chartConfig?.description) && (
            <Paragraph
              className="mt-4 text-gray-600"
              style={{ fontSize: '13px', marginTop: '12px' }}
            >
              {description || chartConfig?.description}
            </Paragraph>
          )}
          {chartConfig?.applied_filters && (
            <div className="mt-2">
              <Tag color="purple">筛选: {chartConfig.applied_filters}</Tag>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default ChartDisplay; 