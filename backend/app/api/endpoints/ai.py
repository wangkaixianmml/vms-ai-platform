import logging
from typing import Optional
import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import traceback

from app.services.dify_service import DifyService
from app.core.prompt_templates import VULNERABILITY_AUTOCOMPLETE_PROMPT
from app.api.deps import get_dify_service

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