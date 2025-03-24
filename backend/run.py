import uvicorn
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(".env")

if __name__ == "__main__":
    print("启动漏洞管理平台API服务...")
    uvicorn.run(
        "app.main:app", 
        host="0.0.0.0", 
        port=int(os.getenv("PORT", "8000")), 
        reload=True
    )