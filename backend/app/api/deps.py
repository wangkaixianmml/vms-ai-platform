from fastapi import Depends
from app.services.dify_service import dify_service

def get_dify_service():
    """
    依赖项注入函数，返回 DifyService 实例
    """
    return dify_service 