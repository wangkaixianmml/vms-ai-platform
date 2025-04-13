import logging
from typing import Optional, Dict, Any, List
import json
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
import traceback
from datetime import datetime, timedelta

from app.services.dify_service import DifyService
from app.core.prompt_templates import (
    VULNERABILITY_AUTOCOMPLETE_PROMPT, 
    VULNERABILITY_RISK_ASSESSMENT_PROMPT,
    VULNERABILITY_ANALYSIS_PROMPT,
    VULNERABILITY_REMEDIATION_PROMPT,
    DATA_CHART_GENERATION_PROMPT
)
from app.api.deps import get_dify_service
from app.core.config import settings
from app.api.endpoints.vulnerabilities import mock_vulnerabilities, get_vulnerabilities
from app.api.endpoints.assets import mock_assets, get_assets

router = APIRouter()
logger = logging.getLogger(__name__)

class VulnerabilityAutoCompleteRequest(BaseModel):
    vulnerability_name: str
    cve_id: Optional[str] = None

class VulnerabilityAutoCompleteResponse(BaseModel):
    vulnerability_type: Optional[str] = None
    risk_level: Optional[str] = None
    cvss_score: Optional[float] = None
    description: Optional[str] = None
    remediation_steps: Optional[str] = None
    impact_details: Optional[str] = None
    affected_components: Optional[str] = None

class DataAnalysisRequest(BaseModel):
    """数据分析请求模型"""
    time_range: Optional[str] = "all"  # all, last_week, last_month, last_year, custom
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    vulnerability_ids: Optional[List[int]] = None
    asset_ids: Optional[List[int]] = None
    filter_conditions: Optional[Dict[str, Any]] = None
    user_description: str
    use_advanced_analysis: Optional[bool] = False  # 是否使用高级分析

class ChartData(BaseModel):
    """图表数据模型"""
    chart_type: str
    title: str
    description: str
    data: List[Dict[str, Any]]
    config: Dict[str, Any]
    category: str
    applied_filters: str

@router.post("/autocomplete/vulnerability", response_model=VulnerabilityAutoCompleteResponse)
async def autocomplete_vulnerability(
    request: VulnerabilityAutoCompleteRequest,
    dify_service: DifyService = Depends(get_dify_service)
):
    """
    使用AI自动补全漏洞详情
    """
    logger.info(f"收到漏洞自动补全请求: {request.vulnerability_name}, CVE: {request.cve_id}")
    
    try:
        # 准备提示词
        prompt = VULNERABILITY_AUTOCOMPLETE_PROMPT.format(
            vulnerability_name=request.vulnerability_name,
            cve_id=request.cve_id or "无"
        )
        
        logger.debug(f"构造的提示词: {prompt[:100]}...")
        
        # 发送首条消息并创建新对话
        try:
            response = await dify_service.send_first_message(
                message=prompt
            )
            logger.debug(f"得到AI响应: {response}")
        except Exception as e:
            logger.error(f"调用DifyService.send_first_message失败: {str(e)}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"AI服务调用失败: {str(e)}")
        
        # 解析响应内容
        ai_message = response.get("answer", "")
        logger.debug(f"AI原始回答: {ai_message}")
        
        # 提取JSON部分
        try:
            # 尝试找到JSON部分并解析
            json_start = ai_message.find("{")
            json_end = ai_message.rfind("}") + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = ai_message[json_start:json_end]
                logger.debug(f"提取的JSON字符串: {json_str}")
                
                try:
                    result = json.loads(json_str)
                    
                    # 处理remediation_steps列表转字符串问题
                    if 'remediation_steps' in result and isinstance(result['remediation_steps'], list):
                        logger.info(f"将remediation_steps从列表转换为字符串: {result['remediation_steps']}")
                        result['remediation_steps'] = "\n".join(result['remediation_steps'])
                    
                    # 转换为响应模型
                    return VulnerabilityAutoCompleteResponse(**result)
                except json.JSONDecodeError as je:
                    logger.error(f"JSON解析错误: {str(je)}, JSON字符串: {json_str}")
                    # 尝试修复可能的JSON格式问题
                    fixed_json_str = json_str.replace("\n", "").replace("  ", " ")
                    try:
                        result = json.loads(fixed_json_str)
                        
                        # 处理remediation_steps列表转字符串问题
                        if 'remediation_steps' in result and isinstance(result['remediation_steps'], list):
                            logger.info(f"将remediation_steps从列表转换为字符串: {result['remediation_steps']}")
                            result['remediation_steps'] = "\n".join(result['remediation_steps'])
                        
                        return VulnerabilityAutoCompleteResponse(**result)
                    except Exception as fix_e:
                        logger.error(f"修复JSON后仍然解析失败: {str(fix_e)}")
                        raise HTTPException(status_code=500, detail="无法解析AI响应为有效的JSON格式")
            else:
                # 如果没有找到JSON结构，返回错误
                logger.error(f"AI响应中未找到JSON结构: {ai_message}")
                raise ValueError("AI响应中未找到JSON结构")
        except (ValueError, Exception) as e:
            logger.error(f"解析AI响应失败: {e}, 原始响应: {ai_message}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"无法解析AI响应: {str(e)}")
    
    except Exception as e:
        logger.error(f"AI漏洞补全过程发生错误: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"AI补全失败: {str(e)}")

@router.post("/vulnerabilities/risk-assessment")
async def assess_vulnerability_risk(
    vulnerability_data: Dict[str, Any],
    dify_service: DifyService = Depends(get_dify_service)
):
    """
    使用AI评估漏洞风险并生成VPR评分和优先级
    """
    try:
        logger.info(f"收到漏洞风险评估请求: {vulnerability_data.get('name', '未知漏洞')}")
        
        # 准备资产信息
        asset_info = "无关联资产"
        if vulnerability_data.get("affected_assets"):
            assets = vulnerability_data.get("affected_assets", [])
            asset_details = []
            for index, asset in enumerate(assets):
                # 严格按照5个关键属性构建资产信息
                asset_detail = f"资产 {index+1}：\n"
                asset_detail += f"- 资产名称: {asset.get('name', '未知')}\n"
                asset_detail += f"- 资产类型: {asset.get('type', '未知')}\n"
                
                # 确保资产等级使用中文表示
                importance_level = asset.get('importance_level', '未知')
                # 如果资产等级不是中文的"高"、"中"、"低"，则转换或默认为"未知"
                if importance_level not in ['高', '中', '低', '未知']:
                    logger.warning(f"资产等级 '{importance_level}' 格式不正确，应该是'高'、'中'或'低'")
                    importance_level = '未知'
                
                asset_detail += f"- 资产等级: {importance_level}\n"
                asset_detail += f"- 资产网络属性: {asset.get('network_type', '未知')}\n"
                asset_detail += f"- 资产暴露面: {asset.get('exposure', '未知')}\n"
                asset_detail += f"- 业务系统: {asset.get('business_system', '未知')}\n"
                asset_detail += f"- 业务影响: {asset.get('business_impact', '未知')}"
                asset_details.append(asset_detail)
            
            # 记录日志，便于调试
            logger.debug(f"构建的资产信息示例 (第一个资产): {asset_details[0] if asset_details else '无'}")
            
            asset_info = "\n\n".join(asset_details)
            # 添加提示，确保评估过程考虑所有资产
            if len(assets) > 1:
                asset_info += "\n\n请注意：以上多个资产都与此漏洞关联，评估时需考虑所有资产的综合风险。"
        
        # 构建提示词
        prompt = VULNERABILITY_RISK_ASSESSMENT_PROMPT.format(
            name=vulnerability_data.get("name", "未知漏洞"),
            cve_id=vulnerability_data.get("cve_id", "无CVE编号"),
            vulnerability_type=vulnerability_data.get("vulnerability_type", "未知"),
            risk_level=vulnerability_data.get("risk_level", "未知"),
            description=vulnerability_data.get("description", "无描述"),
            impact_details=vulnerability_data.get("impact_details", "无危害信息"),
            impact_scope=vulnerability_data.get("impact_scope", "无影响范围信息"),
            affected_components=vulnerability_data.get("affected_components", "无影响组件信息"),
            asset_info=asset_info
        )
        
        logger.debug(f"构造的风险评估提示词: {prompt[:200]}...")
        
        # 发送到AI服务获取评估结果
        response = await dify_service.send_first_message(
            message=prompt
        )
        
        # 解析JSON响应
        if response and response.get("answer"):
            content = response.get("answer")
            # 提取JSON部分
            try:
                json_start = content.find('```json') + 7
                json_end = content.rfind('```')
                if json_start > 6 and json_end > json_start:
                    json_str = content[json_start:json_end].strip()
                    assessment_result = json.loads(json_str)
                    
                    logger.info(f"风险评估结果: VPR评分 = {assessment_result.get('vpr_score')}, 优先级 = {assessment_result.get('priority')}")
                    
                    return {
                        "success": True,
                        "result": assessment_result,
                        "raw_response": content
                    }
                else:
                    # 尝试直接解析整个响应
                    assessment_result = json.loads(content)
                    
                    # 不再应用VPR评分和优先级映射规则
                    
                    return {
                        "success": True,
                        "result": assessment_result,
                        "raw_response": content
                    }
            except Exception as e:
                logger.error(f"解析AI评估结果失败: {str(e)}")
                return {
                    "success": False,
                    "error": "解析评估结果失败",
                    "raw_response": content
                }
        else:
            logger.error("AI评估服务未返回有效响应")
            return {
                "success": False,
                "error": "未获得有效的评估结果"
            }
    except Exception as e:
        logger.exception(f"执行漏洞风险评估时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"评估过程中发生错误: {str(e)}")

@router.post("/vulnerabilities/analysis")
async def analyze_vulnerability(
    vulnerability_data: Dict[str, Any],
    dify_service: DifyService = Depends(get_dify_service)
):
    """
    使用AI对漏洞进行深入分析
    """
    try:
        logger.info(f"收到漏洞分析请求: {vulnerability_data.get('name', '未知漏洞')}")
        
        # 构建提示词
        prompt = VULNERABILITY_ANALYSIS_PROMPT.format(
            name=vulnerability_data.get("name", "未知漏洞"),
            cve_id=vulnerability_data.get("cve_id", "无CVE编号"),
            vulnerability_type=vulnerability_data.get("vulnerability_type", "未知"),
            risk_level=vulnerability_data.get("risk_level", "未知"),
            description=vulnerability_data.get("description", "无描述"),
            impact_details=vulnerability_data.get("impact_details", "无危害信息"),
            affected_components=vulnerability_data.get("affected_components", "无影响组件信息"),
            discovery_date=vulnerability_data.get("discovery_date", "未知"),
            status=vulnerability_data.get("status", "未知")
        )
        
        logger.debug(f"构造的漏洞分析提示词: {prompt[:200]}...")
        
        # 发送到AI服务获取分析结果
        response = await dify_service.send_first_message(
            message=prompt
        )
        
        # 处理响应
        if response and response.get("answer"):
            content = response.get("answer")
            return {
                "success": True,
                "result": content,
                "conversation_id": response.get("conversation_id")
            }
        else:
            logger.error("AI分析服务未返回有效响应")
            return {
                "success": False,
                "error": "未获得有效的分析结果"
            }
    except Exception as e:
        logger.exception(f"执行漏洞分析时出错: {str(e)}")
        return {
            "success": False,
            "error": f"分析过程中发生错误: {str(e)}"
        }

@router.post("/vulnerabilities/remediation")
async def get_vulnerability_remediation(
    vulnerability_data: Dict[str, Any],
    dify_service: DifyService = Depends(get_dify_service)
):
    """
    使用AI获取漏洞的修复建议
    """
    try:
        logger.info(f"收到漏洞修复建议请求: {vulnerability_data.get('name', '未知漏洞')}")
        
        # 构建提示词
        prompt = VULNERABILITY_REMEDIATION_PROMPT.format(
            name=vulnerability_data.get("name", "未知漏洞"),
            cve_id=vulnerability_data.get("cve_id", "无CVE编号"),
            vulnerability_type=vulnerability_data.get("vulnerability_type", "未知"),
            risk_level=vulnerability_data.get("risk_level", "未知"),
            description=vulnerability_data.get("description", "无描述"),
            affected_components=vulnerability_data.get("affected_components", "无影响组件信息"),
            status=vulnerability_data.get("status", "未知")
        )
        
        logger.debug(f"构造的漏洞修复建议提示词: {prompt[:200]}...")
        
        # 发送到AI服务获取修复建议
        response = await dify_service.send_first_message(
            message=prompt
        )
        
        # 处理响应
        if response and response.get("answer"):
            content = response.get("answer")
            return {
                "success": True,
                "result": content,
                "conversation_id": response.get("conversation_id")
            }
        else:
            logger.error("AI修复建议服务未返回有效响应")
            return {
                "success": False,
                "error": "未获得有效的修复建议"
            }
    except Exception as e:
        logger.exception(f"获取漏洞修复建议时出错: {str(e)}")
        return {
            "success": False,
            "error": f"获取修复建议过程中发生错误: {str(e)}"
        }

@router.post("/data-analysis/chart", response_model=ChartData)
async def generate_chart(
    request: DataAnalysisRequest,
    dify_service: DifyService = Depends(get_dify_service)
):
    """
    根据用户描述和数据范围生成图表
    """
    try:
        logger.info(f"收到数据分析请求: 描述={request.user_description}, 时间范围={request.time_range}, 高级分析={request.use_advanced_analysis}")
        
        # 获取漏洞数据
        vulnerabilities = []
        if request.vulnerability_ids:
            # 如果指定了具体的漏洞ID列表
            vulnerabilities = [v for v in mock_vulnerabilities if v.get("id") in request.vulnerability_ids]
        else:
            # 否则获取所有漏洞（后续会根据filter_conditions过滤）
            vulnerabilities = mock_vulnerabilities
        
        # 获取资产数据
        assets = []
        if request.asset_ids:
            # 如果指定了具体的资产ID列表
            assets = [a for a in mock_assets if a.get("id") in request.asset_ids]
        else:
            # 否则获取所有资产
            assets = mock_assets
        
        # 处理时间范围
        time_range_str = "所有时间"
        if request.time_range != "all":
            now = datetime.now()
            
            if request.time_range == "last_week":
                start_date = now - timedelta(days=7)
                time_range_str = "最近一周"
            elif request.time_range == "last_month":
                start_date = now - timedelta(days=30)
                time_range_str = "最近一个月"
            elif request.time_range == "last_year":
                start_date = now - timedelta(days=365)
                time_range_str = "最近一年"
            elif request.time_range == "custom" and request.start_date and request.end_date:
                try:
                    start_date = datetime.fromisoformat(request.start_date.replace('Z', '+00:00'))
                    end_date = datetime.fromisoformat(request.end_date.replace('Z', '+00:00'))
                    time_range_str = f"{start_date.strftime('%Y-%m-%d')}至{end_date.strftime('%Y-%m-%d')}"
                except ValueError:
                    logger.error(f"日期格式错误: start_date={request.start_date}, end_date={request.end_date}")
                    raise HTTPException(status_code=400, detail="日期格式错误，请使用ISO格式，例如: 2023-01-01")
            
            # 如果设置了时间范围，过滤漏洞数据
            if request.time_range != "custom":
                vulnerabilities = [v for v in vulnerabilities if datetime.fromisoformat(v.get("discovery_date").replace('Z', '+00:00')) >= start_date]
            else:
                vulnerabilities = [
                    v for v in vulnerabilities 
                    if datetime.fromisoformat(v.get("discovery_date").replace('Z', '+00:00')) >= start_date
                    and datetime.fromisoformat(v.get("discovery_date").replace('Z', '+00:00')) <= end_date
                ]
        
        # 应用其他过滤条件
        filter_conditions_str = "无额外筛选条件"
        if request.filter_conditions:
            filter_conditions_str = ", ".join([f"{k}={v}" for k, v in request.filter_conditions.items()])
            # 这里可以实现更复杂的过滤逻辑
        
        # 准备高级分析说明
        advanced_analysis_instructions = ""
        if request.use_advanced_analysis:
            advanced_analysis_instructions = """
            由于启用了高级分析，请执行以下额外步骤：
            1. 进行多维度的数据关联分析，包括：
               - 漏洞与资产的关联分析
               - 时间序列趋势分析
               - 风险等级分布分析
               - 漏洞类型与资产类型的关联分析
            2. 生成更复杂的图表配置：
               - 使用组合图表展示多个维度的数据
               - 添加交互式数据筛选功能
               - 实现数据钻取功能
               - 优化图表布局和视觉效果
            3. 提供更深入的分析结论：
               - 识别数据中的异常模式
               - 预测潜在的安全风险趋势
               - 提供基于数据的优化建议
            """
        
        # 准备提示词
        prompt = DATA_CHART_GENERATION_PROMPT.format(
            vulnerability_data=json.dumps(vulnerabilities[:10], ensure_ascii=False),  # 限制数据量
            asset_data=json.dumps(assets[:10], ensure_ascii=False),  # 限制数据量
            time_range=time_range_str,
            filter_conditions=filter_conditions_str,
            user_description=request.user_description,
            use_advanced_analysis="是" if request.use_advanced_analysis else "否",
            advanced_analysis_instructions=advanced_analysis_instructions
        )
        
        logger.debug(f"构造的数据分析提示词: {prompt[:200]}...")
        
        # 发送到AI服务获取图表配置
        response = await dify_service.send_first_message(
            message=prompt
        )
        
        # 解析响应
        if response and response.get("answer"):
            content = response.get("answer")
            
            # 提取JSON部分
            try:
                json_start = content.find('```json') + 7
                json_end = content.rfind('```')
                
                if json_start > 6 and json_end > json_start:
                    json_str = content[json_start:json_end].strip()
                    logger.debug(f"提取的JSON字符串: {json_str[:200]}...")
                    
                    chart_config = json.loads(json_str)
                    
                    # 确保数据字段完整
                    required_fields = ["chart_type", "title", "description", "data", "config", "category", "applied_filters"]
                    for field in required_fields:
                        if field not in chart_config:
                            chart_config[field] = "" if field != "data" and field != "config" else {}
                    
                    return chart_config
                else:
                    # 尝试整体解析
                    logger.warning("未找到JSON标记，尝试直接解析整个响应")
                    try:
                        chart_config = json.loads(content)
                        return chart_config
                    except:
                        raise ValueError("响应中未找到有效的JSON结构，无法解析图表配置")
            except Exception as e:
                logger.error(f"解析AI生成的图表配置失败: {str(e)}")
                raise HTTPException(status_code=500, detail=f"解析图表配置失败: {str(e)}")
        else:
            logger.error("AI服务未返回有效响应")
            raise HTTPException(status_code=500, detail="未获得有效的图表配置")
    
    except Exception as e:
        logger.exception(f"生成图表配置时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=f"生成图表配置失败: {str(e)}") 