import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30秒超时（普通请求）
});

// 为AI相关请求创建一个特殊的实例，超时时间更长
export const aiApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120秒（2分钟）超时，AI请求可能需要更长时间
});

// 请求拦截器
// @ts-ignore - 忽略TypeScript错误，这些错误是由Axios类型定义变更引起的
const setupInterceptors = (instance) => {
  instance.interceptors.request.use(
    // @ts-ignore
    (config) => {
      // 从localStorage获取token并添加到请求头
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      console.log(`API请求: ${config.method?.toUpperCase()} ${config.url}`, config.params || config.data);
      return config;
    },
    // @ts-ignore
    (error) => {
      console.error('API请求错误:', error);
      return Promise.reject(error);
    }
  );

  // 响应拦截器
  instance.interceptors.response.use(
    // @ts-ignore
    (response) => {
      console.log(`API响应: ${response.config.method?.toUpperCase()} ${response.config.url}`, response.status);
      return response;
    },
    // @ts-ignore
    (error) => {
      const { response } = error;
      console.error('API响应错误:', response?.status, response?.data || error.message);
      
      if (response) {
        // 401: 未登录或token过期
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
};

// 为两个实例设置拦截器
setupInterceptors(api);
setupInterceptors(aiApi);

export default api;