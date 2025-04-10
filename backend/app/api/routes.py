from fastapi import APIRouter
from app.api.endpoints import vulnerabilities, assets, dify, ai, dashboard

api_router = APIRouter()

# 添加各个模块的路由
api_router.include_router(vulnerabilities.router, prefix="/vulnerabilities", tags=["vulnerabilities"])
api_router.include_router(assets.router, prefix="/assets", tags=["assets"])
api_router.include_router(dify.router, prefix="/dify", tags=["dify"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])