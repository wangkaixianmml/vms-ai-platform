import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
import urllib.parse

from app.models.asset import Asset, AssetCreate, AssetUpdate, AssetComponent, AssetPort

# 创建路由
router = APIRouter()
logger = logging.getLogger(__name__)

# 模拟资产数据库
mock_assets = [
    {
        "id": 1,
        "name": "Web应用服务器1",
        "address": "192.168.1.10",
        "type": "服务器",
        "responsible_person": "张三",
        "department": "技术部",
        "asset_group": "生产服务器",
        "source": "IT资产清单",
        "network_type": "内网",
        "importance_level": "高",
        "discovery_date": datetime.now().isoformat(),
        "update_date": datetime.now().isoformat(),
        "components": [
            {"name": "Apache Tomcat", "version": "9.0.56"},
            {"name": "Java", "version": "11.0.14"}
        ],
        "ports": [
            {"port": 22, "protocol": "TCP", "service": "SSH", "status": "open", "component": None},
            {"port": 80, "protocol": "TCP", "service": "HTTP", "status": "open", "component": "Apache Tomcat"},
            {"port": 443, "protocol": "TCP", "service": "HTTPS", "status": "open", "component": "Apache Tomcat"}
        ],
        "business_system": "销售系统",
        "business_impact": "直接影响销售业务",
        "exposure": "内网可访问",
        "vulnerabilities_summary": {"高": 1, "中": 2, "低": 3}
    },
    {
        "id": 2,
        "name": "Web应用服务器2",
        "address": "192.168.1.11",
        "type": "服务器",
        "responsible_person": "李四",
        "department": "技术部",
        "asset_group": "生产服务器",
        "source": "IT资产清单",
        "network_type": "内网",
        "importance_level": "高",
        "discovery_date": datetime.now().isoformat(),
        "update_date": datetime.now().isoformat(),
        "components": [
            {"name": "Apache Tomcat", "version": "9.0.56"},
            {"name": "Java", "version": "11.0.14"}
        ],
        "ports": [
            {"port": 22, "protocol": "TCP", "service": "SSH", "status": "open", "component": None},
            {"port": 80, "protocol": "TCP", "service": "HTTP", "status": "open", "component": "Apache Tomcat"},
            {"port": 443, "protocol": "TCP", "service": "HTTPS", "status": "open", "component": "Apache Tomcat"}
        ],
        "business_system": "销售系统",
        "business_impact": "直接影响销售业务",
        "exposure": "内网可访问",
        "vulnerabilities_summary": {"高": 0, "中": 1, "低": 2}
    },
    {
        "id": 3,
        "name": "内部管理系统",
        "address": "https://internal.example.com",
        "type": "Web应用",
        "responsible_person": "王五",
        "department": "安全部",
        "asset_group": "内部应用",
        "source": "应用清单",
        "network_type": "DMZ",
        "importance_level": "中",
        "discovery_date": datetime.now().isoformat(),
        "update_date": datetime.now().isoformat(),
        "components": [
            {"name": "Django", "version": "3.2.10"},
            {"name": "Python", "version": "3.9.9"}
        ],
        "ports": [
            {"port": 443, "protocol": "TCP", "service": "HTTPS", "status": "open", "component": "Django"}
        ],
        "business_system": "内部管理",
        "business_impact": "影响内部工作效率",
        "exposure": "内网可访问",
        "vulnerabilities_summary": {"高": 0, "中": 1, "低": 0}
    }
]

@router.get("/", response_model=List[Asset])
async def get_assets(
    name: Optional[str] = None,
    address: Optional[str] = None,
    type: Optional[str] = None,
    department: Optional[str] = None,
    asset_group: Optional[str] = None,
    network_type: Optional[str] = None,
    importance_level: Optional[str] = None,
    responsible_person: Optional[str] = None,
    business_system: Optional[str] = None,
    exposure: Optional[str] = None,
    has_vulnerabilities: Optional[bool] = None
):
    """
    获取资产列表，支持多种过滤条件
    """
    logger.info("获取资产列表请求")
    
    # 应用过滤条件
    filtered_assets = mock_assets
    
    if name:
        filtered_assets = [a for a in filtered_assets if name.lower() in a["name"].lower()]
    
    if address:
        filtered_assets = [a for a in filtered_assets if address.lower() in a["address"].lower()]
    
    if type:
        filtered_assets = [a for a in filtered_assets if type.lower() == a["type"].lower()]
    
    if department:
        filtered_assets = [a for a in filtered_assets if a["department"] and department.lower() in a["department"].lower()]
    
    if asset_group:
        filtered_assets = [a for a in filtered_assets if a["asset_group"] and asset_group.lower() in a["asset_group"].lower()]
    
    if network_type:
        filtered_assets = [a for a in filtered_assets if a["network_type"] and network_type.lower() == a["network_type"].lower()]
    
    if importance_level:
        filtered_assets = [a for a in filtered_assets if a["importance_level"] and importance_level.lower() == a["importance_level"].lower()]
    
    if responsible_person:
        filtered_assets = [a for a in filtered_assets if a["responsible_person"] and responsible_person.lower() in a["responsible_person"].lower()]
    
    if business_system:
        filtered_assets = [a for a in filtered_assets if a["business_system"] and business_system.lower() in a["business_system"].lower()]
    
    if exposure:
        filtered_assets = [a for a in filtered_assets if a["exposure"] and exposure.lower() in a["exposure"].lower()]
    
    if has_vulnerabilities is not None:
        if has_vulnerabilities:
            # 筛选有漏洞的资产
            filtered_assets = [a for a in filtered_assets if a["vulnerabilities_summary"] and sum(a["vulnerabilities_summary"].values()) > 0]
        else:
            # 筛选没有漏洞的资产
            filtered_assets = [a for a in filtered_assets if not a["vulnerabilities_summary"] or sum(a["vulnerabilities_summary"].values()) == 0]
    
    logger.info(f"找到 {len(filtered_assets)} 个资产")
    return filtered_assets

@router.get("/{asset_id}", response_model=Asset)
async def get_asset(asset_id: int):
    """
    获取单个资产详情
    """
    logger.info(f"获取资产详情请求，ID: {asset_id}")
    
    # 查找资产
    for asset in mock_assets:
        if asset["id"] == asset_id:
            return asset
    
    # 未找到资产
    logger.warning(f"未找到ID为 {asset_id} 的资产")
    raise HTTPException(status_code=404, detail=f"未找到ID为 {asset_id} 的资产")

@router.post("/", response_model=Asset)
async def create_asset(asset: AssetCreate):
    """
    创建新资产
    """
    logger.info(f"创建资产请求: {asset.name}")
    
    # 生成新ID
    new_id = max(a["id"] for a in mock_assets) + 1
    
    # 创建新资产
    new_asset = {
        "id": new_id,
        "name": asset.name,
        "address": asset.address,
        "type": asset.type,
        "responsible_person": asset.responsible_person,
        "department": asset.department,
        "asset_group": asset.asset_group,
        "source": asset.source,
        "network_type": asset.network_type,
        "importance_level": asset.importance_level,
        "discovery_date": datetime.now().isoformat(),
        "update_date": datetime.now().isoformat(),
        "components": [comp.dict() for comp in asset.components],
        "ports": [port.dict() for port in asset.ports],
        "business_system": asset.business_system,
        "business_impact": asset.business_impact,
        "exposure": asset.exposure,
        "vulnerabilities_summary": {}
    }
    
    # 添加到模拟数据库
    mock_assets.append(new_asset)
    
    logger.info(f"资产创建成功，ID: {new_id}")
    return new_asset

@router.put("/{asset_id}", response_model=Asset)
async def update_asset(asset_id: int, asset_update: AssetUpdate):
    """
    更新资产信息
    """
    logger.info(f"更新资产请求，ID: {asset_id}")
    
    # 查找资产
    for i, asset in enumerate(mock_assets):
        if asset["id"] == asset_id:
            # 更新非空字段
            update_data = asset_update.dict(exclude_unset=True)
            
            if "components" in update_data:
                update_data["components"] = [comp.dict() for comp in asset_update.components]
            
            if "ports" in update_data:
                update_data["ports"] = [port.dict() for port in asset_update.ports]
            
            # 更新资产
            mock_assets[i].update(update_data)
            mock_assets[i]["update_date"] = datetime.now().isoformat()
            
            logger.info(f"资产更新成功，ID: {asset_id}")
            return mock_assets[i]
    
    # 未找到资产
    logger.warning(f"未找到ID为 {asset_id} 的资产")
    raise HTTPException(status_code=404, detail=f"未找到ID为 {asset_id} 的资产")

@router.delete("/{asset_id}", response_model=dict)
async def delete_asset(asset_id: int):
    """
    删除资产
    """
    logger.info(f"删除资产请求，ID: {asset_id}")
    
    # 查找资产
    for i, asset in enumerate(mock_assets):
        if asset["id"] == asset_id:
            # 从模拟数据库中删除
            del mock_assets[i]
            
            logger.info(f"资产删除成功，ID: {asset_id}")
            return {"message": f"已删除ID为 {asset_id} 的资产"}
    
    # 未找到资产
    logger.warning(f"未找到ID为 {asset_id} 的资产")
    raise HTTPException(status_code=404, detail=f"未找到ID为 {asset_id} 的资产")

@router.get("/lookup/by-address", response_model=Optional[Asset])
async def find_asset_by_address(address: str):
    """
    根据地址查找资产，用于漏洞与资产的自动关联
    """
    logger.info(f"根据地址查找资产请求: {address}")
    
    # 标准化URL格式
    normalized_address = address.lower()
    if normalized_address.startswith("http"):
        try:
            parsed_url = urllib.parse.urlparse(normalized_address)
            host = parsed_url.netloc
        except:
            host = normalized_address
    else:
        host = normalized_address
    
    # 查找匹配的资产
    for asset in mock_assets:
        asset_address = asset["address"].lower()
        
        # 完全匹配
        if asset_address == normalized_address:
            return asset
        
        # 主机名匹配
        if host in asset_address or asset_address in host:
            return asset
        
        # IP匹配
        if host == asset_address:
            return asset
    
    # 未找到匹配的资产
    logger.info(f"未找到地址为 {address} 的资产")
    return None 