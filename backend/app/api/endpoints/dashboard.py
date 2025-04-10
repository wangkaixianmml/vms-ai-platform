import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime

from app.models.dashboard import DashboardChart, DashboardChartCreate, DashboardChartUpdate

# 设置日志
logger = logging.getLogger(__name__)

router = APIRouter()

# 模拟数据库
mock_dashboard_charts = []

@router.get("/charts", response_model=List[DashboardChart])
async def get_dashboard_charts():
    """
    获取所有仪表盘图表
    """
    logger.info("获取所有仪表盘图表")
    return mock_dashboard_charts

@router.post("/charts", response_model=DashboardChart)
async def create_dashboard_chart(chart: DashboardChartCreate):
    """
    创建新的仪表盘图表
    """
    logger.info(f"创建新的仪表盘图表: {chart.name}")
    
    # 生成新ID
    new_id = 1
    if mock_dashboard_charts:
        new_id = max(c["id"] for c in mock_dashboard_charts) + 1
    
    # 创建新图表
    now = datetime.now()
    new_chart = {
        "id": new_id,
        "name": chart.name,
        "description": chart.description,
        "chart_config": chart.chart_config.dict(),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "position": chart.position or {"x": 0, "y": 0, "w": 6, "h": 4},
        "creator": chart.creator or "系统用户"
    }
    
    # 添加到模拟数据库
    mock_dashboard_charts.append(new_chart)
    
    logger.info(f"图表创建成功，ID: {new_id}")
    return new_chart

@router.get("/charts/{chart_id}", response_model=DashboardChart)
async def get_dashboard_chart(chart_id: int):
    """
    获取单个仪表盘图表
    """
    logger.info(f"获取图表详情，ID: {chart_id}")
    
    # 查找图表
    for chart in mock_dashboard_charts:
        if chart["id"] == chart_id:
            return chart
    
    # 未找到图表
    logger.warning(f"未找到ID为 {chart_id} 的图表")
    raise HTTPException(status_code=404, detail=f"未找到ID为 {chart_id} 的图表")

@router.put("/charts/{chart_id}", response_model=DashboardChart)
async def update_dashboard_chart(chart_id: int, chart_update: DashboardChartUpdate):
    """
    更新仪表盘图表
    """
    logger.info(f"更新图表，ID: {chart_id}")
    
    # 查找图表
    for i, chart in enumerate(mock_dashboard_charts):
        if chart["id"] == chart_id:
            # 更新非空字段
            update_data = chart_update.dict(exclude_unset=True)
            
            # 如果更新了chart_config字段，需要转换为字典
            if "chart_config" in update_data:
                update_data["chart_config"] = chart_update.chart_config.dict()
            
            # 更新图表
            mock_dashboard_charts[i].update(update_data)
            mock_dashboard_charts[i]["updated_at"] = datetime.now().isoformat()
            
            logger.info(f"图表更新成功，ID: {chart_id}")
            return mock_dashboard_charts[i]
    
    # 未找到图表
    logger.warning(f"未找到ID为 {chart_id} 的图表")
    raise HTTPException(status_code=404, detail=f"未找到ID为 {chart_id} 的图表")

@router.delete("/charts/{chart_id}")
async def delete_dashboard_chart(chart_id: int):
    """
    删除仪表盘图表
    """
    logger.info(f"删除图表，ID: {chart_id}")
    
    # 查找图表
    for i, chart in enumerate(mock_dashboard_charts):
        if chart["id"] == chart_id:
            # 删除图表
            deleted_chart = mock_dashboard_charts.pop(i)
            
            logger.info(f"图表删除成功，ID: {chart_id}")
            return {"status": "success", "message": f"图表 '{deleted_chart['name']}' 已删除"}
    
    # 未找到图表
    logger.warning(f"未找到ID为 {chart_id} 的图表")
    raise HTTPException(status_code=404, detail=f"未找到ID为 {chart_id} 的图表")

@router.put("/charts/{chart_id}/position")
async def update_chart_position(chart_id: int, position: Dict[str, int]):
    """
    更新图表位置
    """
    logger.info(f"更新图表位置，ID: {chart_id}")
    
    # 查找图表
    for i, chart in enumerate(mock_dashboard_charts):
        if chart["id"] == chart_id:
            # 更新位置
            mock_dashboard_charts[i]["position"] = position
            mock_dashboard_charts[i]["updated_at"] = datetime.now().isoformat()
            
            logger.info(f"图表位置更新成功，ID: {chart_id}")
            return {"status": "success", "message": "图表位置已更新"}
    
    # 未找到图表
    logger.warning(f"未找到ID为 {chart_id} 的图表")
    raise HTTPException(status_code=404, detail=f"未找到ID为 {chart_id} 的图表") 