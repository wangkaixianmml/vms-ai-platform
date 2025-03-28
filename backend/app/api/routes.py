from fastapi import APIRouter
from app.api.endpoints import dify, vulnerabilities, ai, assets

api_router = APIRouter()

# 添加各个模块的路由
api_router.include_router(dify.router, prefix="/dify", tags=["Dify AI"])
api_router.include_router(vulnerabilities.router, prefix="/vulnerabilities", tags=["漏洞管理"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI辅助功能"])
api_router.include_router(assets.router, prefix="/assets", tags=["资产管理"])