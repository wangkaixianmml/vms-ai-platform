import { message } from 'antd';
import api, { aiApi } from './api';

// AI自动补全漏洞详情的请求参数
export interface AutocompleteVulnerabilityParams {
  vulnerability_name: string;
  cve_id?: string;
}

// AI自动补全漏洞详情的响应结果
export interface AutocompleteVulnerabilityResult {
  vulnerability_type?: string;
  risk_level?: string;
  cvss_score?: number;
  description?: string;
  remediation_steps?: string;
  impact_details?: string;
  affected_components?: string;
}

/**
 * AI服务接口
 */
const aiService = {
  /**
   * 自动补全漏洞详情
   * @param params 漏洞名称和CVE编号
   * @returns 补全的漏洞详情
   */
  autocompleteVulnerability: async (params: AutocompleteVulnerabilityParams): Promise<AutocompleteVulnerabilityResult> => {
    try {
      const response = await aiApi.post('/api/v1/ai/autocomplete/vulnerability', params);
      return response.data;
    } catch (error) {
      message.error('获取AI补全信息失败');
      console.error('获取AI补全信息失败:', error);
      throw error;
    }
  },
};

export default aiService; 