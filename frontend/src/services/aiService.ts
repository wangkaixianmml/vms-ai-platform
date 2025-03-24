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
 * 风险评估结果接口
 */
export interface RiskAssessmentResult {
  vpr_score: number;
  priority: string;
  assessment_reasoning: string;
  technical_risk_factors: string[];
  business_risk_factors: string[];
  remediation_priority: string;
}

/**
 * 风险评估响应接口
 */
export interface RiskAssessmentResponse {
  success: boolean;
  result?: RiskAssessmentResult;
  error?: string;
  raw_response?: string;
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

/**
 * 使用AI评估漏洞风险
 * @param vulnerabilityData 漏洞数据
 * @returns 评估结果
 */
export const assessVulnerabilityRisk = async (vulnerabilityData: any): Promise<RiskAssessmentResponse> => {
  try {
    console.log('发送漏洞风险评估请求:', vulnerabilityData);
    const response = await api.post('/api/v1/ai/vulnerabilities/risk-assessment', vulnerabilityData);
    console.log('获取到风险评估结果:', response.data);
    return response.data;
  } catch (error) {
    console.error('风险评估请求失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
};

export default aiService; 