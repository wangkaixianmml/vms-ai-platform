import logging
from typing import Optional, Dict, Any
import json
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
import traceback

from app.services.dify_service import DifyService
from app.core.prompt_templates import VULNERABILITY_AUTOCOMPLETE_PROMPT, VULNERABILITY_RISK_ASSESSMENT_PROMPT
from app.api.deps import get_dify_service
from app.core.config import settings

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
                    # 转换为响应模型
                    return VulnerabilityAutoCompleteResponse(**result)
                except json.JSONDecodeError as je:
                    logger.error(f"JSON解析错误: {str(je)}, JSON字符串: {json_str}")
                    # 尝试修复可能的JSON格式问题
                    fixed_json_str = json_str.replace("\n", "").replace("  ", " ")
                    try:
                        result = json.loads(fixed_json_str)
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