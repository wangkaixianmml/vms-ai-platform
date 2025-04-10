import api from './api';

export interface ChartConfig {
  chart_type: string;
  title: string;
  description: string;
  data: any[];
  config: any;
  category: string;
  applied_filters: string;
}

export interface DashboardChart {
  id: number;
  name: string;
  description?: string;
  chart_config: ChartConfig;
  created_at: string;
  updated_at?: string;
  position: { x: number; y: number; w: number; h: number };
  creator?: string;
}

export interface DashboardChartCreate {
  name: string;
  description?: string;
  chart_config: ChartConfig;
  position?: { x: number; y: number; w: number; h: number };
  creator?: string;
}

export interface DashboardChartUpdate {
  name?: string;
  description?: string;
  chart_config?: ChartConfig;
  position?: { x: number; y: number; w: number; h: number };
}

export interface DataAnalysisRequest {
  time_range?: string;
  start_date?: string;
  end_date?: string;
  vulnerability_ids?: number[];
  asset_ids?: number[];
  filter_conditions?: any;
  user_description: string;
}

const dashboardService = {
  /**
   * 获取所有仪表盘图表
   * @returns 所有图表列表
   */
  getDashboardCharts: async (): Promise<DashboardChart[]> => {
    try {
      const response = await api.get('/api/v1/dashboard/charts');
      return response.data;
    } catch (error) {
      console.error('获取仪表盘图表失败:', error);
      throw error;
    }
  },

  /**
   * 获取单个仪表盘图表
   * @param id 图表ID
   * @returns 图表详情
   */
  getDashboardChart: async (id: number): Promise<DashboardChart> => {
    try {
      const response = await api.get(`/api/v1/dashboard/charts/${id}`);
      return response.data;
    } catch (error) {
      console.error(`获取图表ID=${id}失败:`, error);
      throw error;
    }
  },

  /**
   * 创建新的仪表盘图表
   * @param chart 图表数据
   * @returns 创建的图表
   */
  createDashboardChart: async (chart: DashboardChartCreate): Promise<DashboardChart> => {
    try {
      const response = await api.post('/api/v1/dashboard/charts', chart);
      return response.data;
    } catch (error) {
      console.error('创建仪表盘图表失败:', error);
      throw error;
    }
  },

  /**
   * 更新仪表盘图表
   * @param id 图表ID
   * @param chart 图表更新数据
   * @returns 更新后的图表
   */
  updateDashboardChart: async (id: number, chart: DashboardChartUpdate): Promise<DashboardChart> => {
    try {
      const response = await api.put(`/api/v1/dashboard/charts/${id}`, chart);
      return response.data;
    } catch (error) {
      console.error(`更新图表ID=${id}失败:`, error);
      throw error;
    }
  },

  /**
   * 删除仪表盘图表
   * @param id 图表ID
   * @returns 操作结果
   */
  deleteDashboardChart: async (id: number): Promise<any> => {
    try {
      const response = await api.delete(`/api/v1/dashboard/charts/${id}`);
      return response.data;
    } catch (error) {
      console.error(`删除图表ID=${id}失败:`, error);
      throw error;
    }
  },

  /**
   * 更新图表位置
   * @param id 图表ID
   * @param position 新位置
   * @returns 操作结果
   */
  updateChartPosition: async (id: number, position: { x: number; y: number; w: number; h: number }): Promise<any> => {
    try {
      const response = await api.put(`/api/v1/dashboard/charts/${id}/position`, position);
      return response.data;
    } catch (error) {
      console.error(`更新图表ID=${id}位置失败:`, error);
      throw error;
    }
  },

  /**
   * 生成数据分析图表
   * @param request 分析请求
   * @returns 生成的图表配置
   */
  generateDataAnalysisChart: async (request: DataAnalysisRequest): Promise<ChartConfig> => {
    try {
      const response = await api.post('/api/v1/ai/data-analysis/chart', request);
      return response.data;
    } catch (error) {
      console.error('生成数据分析图表失败:', error);
      throw error;
    }
  }
};

export default dashboardService; 