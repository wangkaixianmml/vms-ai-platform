from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List

class DifyRequestModel(BaseModel):
    """用于Dify请求的数据模型"""
    message: str = Field(..., description="用户消息")
    conversation_id: Optional[str] = Field(None, description="会话ID")
    user_id: Optional[str] = Field(None, description="用户ID")
    inputs: Optional[Dict[str, Any]] = Field(None, description="输入参数")
    vulnerability_data: Optional[Dict[str, Any]] = Field(None, description="漏洞数据")
    stream: Optional[bool] = Field(False, description="是否使用流式响应") 