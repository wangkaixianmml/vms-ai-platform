from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ChartConfig(BaseModel):
    """图表配置模型"""
    chart_type: str
    title: str
    description: str
    data: List[Dict[str, Any]]
    config: Dict[str, Any]
    category: str
    applied_filters: str

class DashboardChart(BaseModel):
    """仪表盘图表模型"""
    id: int
    name: str
    description: Optional[str] = None
    chart_config: ChartConfig
    created_at: datetime
    updated_at: Optional[datetime] = None
    position: Dict[str, int] = Field(default_factory=lambda: {"x": 0, "y": 0, "w": 6, "h": 4})
    creator: Optional[str] = None
    
class DashboardChartCreate(BaseModel):
    """创建仪表盘图表的请求模型"""
    name: str
    description: Optional[str] = None
    chart_config: ChartConfig
    position: Optional[Dict[str, int]] = None
    creator: Optional[str] = None

class DashboardChartUpdate(BaseModel):
    """更新仪表盘图表的请求模型"""
    name: Optional[str] = None
    description: Optional[str] = None
    chart_config: Optional[ChartConfig] = None
    position: Optional[Dict[str, int]] = None 