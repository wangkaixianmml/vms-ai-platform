from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import api_router
from app.core.config import settings
import logging
import sys
import uvicorn

# 配置日志
log_level = getattr(logging, settings.LOG_LEVEL)
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# 确保所有子日志记录器也使用相同的配置
for name in logging.root.manager.loggerDict:
    logger = logging.getLogger(name)
    logger.setLevel(log_level)
    # 移除所有现有的处理器
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    # 添加新的处理器
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)
    # 禁用向上传播，防止日志重复
    logger.propagate = False

# 特别设置dify模块的日志级别
dify_logger = logging.getLogger('app.api.endpoints.dify')
dify_logger.setLevel(log_level)
dify_logger.propagate = False  # 禁止日志向上传播，防止重复

logger = logging.getLogger(__name__)
logger.info(f"应用启动中，调试模式：{settings.DEBUG}，日志级别：{settings.LOG_LEVEL}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="漏洞管理平台（VMS）API - 集成Dify AI能力",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    debug=settings.DEBUG
)

# 配置CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中，这应该设置为特定的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 包含API路由
logger.info(f"注册API路由，前缀：{settings.API_V1_STR}")
app.include_router(api_router, prefix=settings.API_V1_STR)

# 调试输出所有注册的路由
@app.on_event("startup")
async def startup_event():
    routes = []
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            methods = ", ".join(route.methods)
            routes.append(f"{methods}: {route.path}")
    
    routes.sort()
    logger.info("已注册的API路由:")
    for route in routes:
        logger.info(f"  {route}")

@app.get("/")
def root():
    logger.info("根路径被访问")
    return {"message": "欢迎使用漏洞管理平台API"}

if __name__ == "__main__":
    logger.info("启动漏洞管理平台API服务")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)