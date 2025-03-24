from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field

class AssetComponent(BaseModel):
    """资产组件模型"""
    name: str = Field(..., description="组件名称")
    version: Optional[str] = Field(None, description="组件版本")
    
class AssetPort(BaseModel):
    """资产端口模型"""
    port: int = Field(..., description="端口号")
    protocol: str = Field(..., description="协议，如TCP、UDP")
    service: Optional[str] = Field(None, description="服务，如HTTP、SSH")
    status: str = Field("open", description="状态，如open、closed、filtered")
    component: Optional[str] = Field(None, description="该端口关联的组件")

class Asset(BaseModel):
    """资产基本模型"""
    id: int
    name: str = Field(..., description="资产名称")
    address: str = Field(..., description="资产地址，可以是IP、域名或URL")
    type: str = Field(..., description="资产类型，如服务器、应用、网站等")
    responsible_person: Optional[str] = Field(None, description="资产负责人")
    department: Optional[str] = Field(None, description="资产所属部门")
    asset_group: Optional[str] = Field(None, description="资产组")
    source: Optional[str] = Field(None, description="资产来源，如扫描发现、手动添加等")
    network_type: Optional[str] = Field(None, description="资产网络属性，如内网、外网、DMZ等")
    importance_level: Optional[str] = Field(None, description="资产等级，如重要、一般、低")
    discovery_date: datetime = Field(..., description="资产发现时间")
    update_date: Optional[datetime] = Field(None, description="资产更新时间")
    components: List[AssetComponent] = Field(default_factory=list, description="资产组件列表")
    ports: List[AssetPort] = Field(default_factory=list, description="资产端口列表")
    business_system: Optional[str] = Field(None, description="资产所属业务系统")
    business_impact: Optional[str] = Field(None, description="资产业务影响")
    exposure: Optional[str] = Field(None, description="资产暴露面，如公网可访问、内网可访问等")
    
    # 关联的漏洞统计（按风险等级分组）
    vulnerabilities_summary: Dict[str, int] = Field(default_factory=dict, description="关联漏洞统计，按风险等级分组")
    
class AssetCreate(BaseModel):
    """创建资产的请求模型"""
    name: str
    address: str
    type: str
    responsible_person: Optional[str] = None
    department: Optional[str] = None
    asset_group: Optional[str] = None
    source: Optional[str] = None
    network_type: Optional[str] = None
    importance_level: Optional[str] = None
    components: List[AssetComponent] = Field(default_factory=list)
    ports: List[AssetPort] = Field(default_factory=list)
    business_system: Optional[str] = None
    business_impact: Optional[str] = None
    exposure: Optional[str] = None

class AssetUpdate(BaseModel):
    """更新资产的请求模型"""
    name: Optional[str] = None
    address: Optional[str] = None
    type: Optional[str] = None
    responsible_person: Optional[str] = None
    department: Optional[str] = None
    asset_group: Optional[str] = None
    source: Optional[str] = None
    network_type: Optional[str] = None
    importance_level: Optional[str] = None
    components: Optional[List[AssetComponent]] = None
    ports: Optional[List[AssetPort]] = None
    business_system: Optional[str] = None
    business_impact: Optional[str] = None
    exposure: Optional[str] = None 