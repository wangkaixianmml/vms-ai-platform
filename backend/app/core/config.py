import os
from typing import List, Union, Dict
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "漏洞管理平台"
    
    # 调试配置
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # CORS配置
    CORS_ORIGINS: List[Union[str, AnyHttpUrl]] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000", 
        "http://127.0.0.1:8000"
    ]
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        return v
    
    # Dify API配置
    DIFY_API_URL: str = os.getenv("DIFY_API_URL", "https://api.dify.ai/v1")
    DIFY_API_KEY: str = os.getenv("DIFY_API_KEY", "")
    
    # 数据库配置
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "sqlite:///./app.db"
    )
    
    # 安全配置
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7天
    
    # VPR评分和优先级映射配置
    # 根据VPR评分范围映射到相应的优先级（紧急、高、中、低）
    VPR_PRIORITY_MAPPING: Dict[str, List[float]] = {
        "紧急": [8.5, 10.0],  # VPR评分在8.5-10.0之间为紧急优先级
        "高": [6.5, 8.4],     # VPR评分在6.5-8.4之间为高优先级
        "中": [4.0, 6.4],     # VPR评分在4.0-6.4之间为中优先级
        "低": [0.0, 3.9]      # VPR评分在0.0-3.9之间为低优先级
    }
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()