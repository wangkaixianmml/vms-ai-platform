from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional, Dict, Any
from app.models.vulnerability import Vulnerability, VulnerabilityCreate, VulnerabilityUpdate
import datetime
import logging
import urllib.parse

from app.api.endpoints.assets import find_asset_by_address, mock_assets, create_asset
from app.models.asset import AssetCreate

# 设置日志
logger = logging.getLogger(__name__)

router = APIRouter()

# 处理日期时间比较函数
def parse_datetime(date_str):
    """解析日期字符串为datetime对象"""
    try:
        return datetime.datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        try:
            # 尝试其他格式
            formats = [
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%d',
                '%Y-%m-%dT%H:%M:%S'
            ]
            for fmt in formats:
                try:
                    return datetime.datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
            raise ValueError(f"无法解析日期格式: {date_str}")
        except Exception as e:
            logger.error(f"日期解析错误: {e}, 日期字符串: {date_str}")
            return None

# 模拟数据库
mock_vulnerabilities = [
    {
        "id": 1,
        "name": "Apache Log4j 远程代码执行漏洞",
        "cve_id": "CVE-2021-44228",
        "risk_level": "高",
        "description": "Apache Log4j2 中存在JNDI注入漏洞，允许攻击者在目标服务器上执行任意代码。",
        "affected_assets": [
            {"id": 1, "name": "Web应用服务器1", "ip": "192.168.1.10", "type": "服务器"},
            {"id": 2, "name": "Web应用服务器2", "ip": "192.168.1.11", "type": "服务器"}
        ],
        "discovery_date": datetime.datetime.now().isoformat(),
        "status": "待修复",
        "remediation_steps": "升级到Log4j 2.15.0或更高版本，或者设置系统属性-Dlog4j2.formatMsgNoLookups=true",
        
        # 新增字段
        "vulnerability_type": "远程代码执行",
        "vulnerability_url": "https://example.com/api/endpoint",
        "responsible_person": "张三",
        "department": "技术部",
        "first_found_date": (datetime.datetime.now() - datetime.timedelta(days=10)).isoformat(),
        "latest_found_date": datetime.datetime.now().isoformat(),
        "cvss_score": 9.8,
        "vpr_score": 9.5,
        "priority": "高",
        "fix_time_hours": 24,
        
        # 详情字段
        "impact_details": "该漏洞允许攻击者在受影响系统上执行任意代码，可能导致敏感数据泄露、系统完全被控制等严重后果。",
        "reproduction_steps": "1. 构造特殊的JNDI查询字符串\n2. 发送到目标系统的Log4j处理的输入点\n3. 系统处理输入时会执行攻击者指定的代码",
        "affected_components": "Apache Log4j 2.0 至 2.14.1版本",
        "impact_scope": "所有使用受影响Log4j版本的Java应用",
        "fix_impact": "需要重启应用服务器，可能短暂影响服务可用性",
        "references": "https://nvd.nist.gov/vuln/detail/CVE-2021-44228\nhttps://logging.apache.org/log4j/2.x/security.html"
    },
    {
        "id": 2,
        "name": "SQL注入漏洞",
        "cve_id": None,
        "risk_level": "中",
        "description": "在用户登录表单中存在SQL注入漏洞，攻击者可以通过构造特殊的输入绕过身份验证或获取敏感数据。",
        "affected_assets": [
            {"id": 3, "name": "内部管理系统", "ip": None, "type": "Web应用"}
        ],
        "discovery_date": datetime.datetime.now().isoformat(),
        "status": "修复中",
        "remediation_steps": "使用参数化查询或预处理语句，避免直接拼接SQL语句",
        
        # 新增字段
        "vulnerability_type": "SQL注入",
        "vulnerability_url": "https://internal.example.com/login",
        "responsible_person": "李四",
        "department": "安全部",
        "first_found_date": (datetime.datetime.now() - datetime.timedelta(days=5)).isoformat(),
        "latest_found_date": datetime.datetime.now().isoformat(),
        "cvss_score": 7.5,
        "vpr_score": 7.2,
        "priority": "中",
        "fix_time_hours": 12,
        
        # 详情字段
        "impact_details": "攻击者可以绕过登录验证，获取系统权限；可以查询数据库中的敏感信息；在某些情况下可以修改或删除数据库数据。",
        "reproduction_steps": "1. 在登录表单的用户名字段输入 ' OR 1=1--\n2. 密码字段输入任意内容\n3. 提交表单\n4. 系统将绕过验证直接登录",
        "affected_components": "内部管理系统登录模块",
        "impact_scope": "所有使用该登录系统的内部管理功能",
        "fix_impact": "修复需要更新代码并重新部署应用，预计停机时间约30分钟",
        "references": "https://owasp.org/www-community/attacks/SQL_Injection"
    }
]

# 更新资产的漏洞统计信息
def update_asset_vulnerability_summary():
    """更新所有资产的漏洞统计信息"""
    # 初始化所有资产的漏洞统计
    for asset in mock_assets:
        asset["vulnerabilities_summary"] = {"高": 0, "中": 0, "低": 0}
    
    # 遍历所有漏洞，更新对应资产的统计
    for vuln in mock_vulnerabilities:
        for affected_asset in vuln.get("affected_assets", []):
            asset_id = affected_asset.get("id")
            risk_level = vuln.get("risk_level")
            
            # 查找对应资产并更新统计
            for asset in mock_assets:
                if asset["id"] == asset_id and risk_level in ["高", "中", "低"]:
                    asset["vulnerabilities_summary"][risk_level] += 1

# 自动查找或创建与漏洞URL关联的资产
async def find_or_create_asset_for_vulnerability(vulnerability_url: str) -> Optional[Dict[str, Any]]:
    """
    根据漏洞URL查找或创建关联资产
    """
    if not vulnerability_url:
        return None
    
    # 尝试查找现有资产
    asset = await find_asset_by_address(vulnerability_url)
    if asset:
        logger.info(f"找到与URL {vulnerability_url} 匹配的资产: {asset['name']} (ID: {asset['id']})")
        return asset
    
    # 如果未找到资产，自动创建一个新资产
    try:
        # 解析URL获取基本信息
        parsed_url = urllib.parse.urlparse(vulnerability_url)
        hostname = parsed_url.netloc
        
        # 如果不是URL，直接使用原始值
        if not hostname:
            hostname = vulnerability_url
        
        # 确定资产类型
        asset_type = "Web应用"
        if ":" in hostname:  # 如果包含端口号，可能是服务器
            hostname, port = hostname.split(":", 1)
            asset_type = "服务器"
        
        # 创建新资产
        new_asset = AssetCreate(
            name=f"自动发现: {hostname}",
            address=vulnerability_url,
            type=asset_type,
            source="漏洞自动关联",
            network_type="未知",
            importance_level="中"
        )
        
        # 调用创建资产API
        created_asset = await create_asset(new_asset)
        logger.info(f"自动创建资产成功: {created_asset['name']} (ID: {created_asset['id']})")
        
        return created_asset
    except Exception as e:
        logger.error(f"自动创建资产失败: {str(e)}")
        return None

@router.get("/", response_model=List[Vulnerability])
async def get_vulnerabilities(
    risk_level: Optional[str] = Query(None, description="按风险等级筛选"),
    status: Optional[str] = Query(None, description="按状态筛选"),
    vulnerability_type: Optional[str] = Query(None, description="按漏洞类型筛选"),
    priority: Optional[str] = Query(None, description="按优先级筛选"),
    department: Optional[str] = Query(None, description="按部门筛选"),
    responsible_person: Optional[str] = Query(None, description="按负责人筛选"),
    min_cvss: Optional[float] = Query(None, description="最小CVSS评分"),
    max_cvss: Optional[float] = Query(None, description="最大CVSS评分"),
    min_vpr: Optional[float] = Query(None, description="最小VPR评分"),
    max_vpr: Optional[float] = Query(None, description="最大VPR评分"),
    first_found_from: Optional[str] = Query(None, description="首次发现时间范围起始"),
    first_found_to: Optional[str] = Query(None, description="首次发现时间范围结束"),
    latest_found_from: Optional[str] = Query(None, description="最近发现时间范围起始"),
    latest_found_to: Optional[str] = Query(None, description="最近发现时间范围结束"),
    affected_asset_id: Optional[int] = Query(None, description="按关联资产ID过滤")
):
    """获取漏洞列表，支持筛选"""
    logger.info(f"获取漏洞列表请求，筛选条件：risk_level={risk_level}, status={status}, "
                f"vulnerability_type={vulnerability_type}, priority={priority}, "
                f"department={department}, responsible_person={responsible_person}, "
                f"min_cvss={min_cvss}, max_cvss={max_cvss}, "
                f"min_vpr={min_vpr}, max_vpr={max_vpr}, "
                f"first_found_from={first_found_from}, first_found_to={first_found_to}, "
                f"latest_found_from={latest_found_from}, latest_found_to={latest_found_to}, "
                f"affected_asset_id={affected_asset_id}")
    results = mock_vulnerabilities
    
    # 根据资产ID过滤
    if affected_asset_id is not None:
        logger.info(f"按关联资产ID筛选: {affected_asset_id}")
        results = [v for v in results if any(asset.get('id') == affected_asset_id for asset in v.get('affected_assets', []))]
    
    if risk_level:
        logger.info(f"按风险等级筛选: {risk_level}")
        results = [v for v in results if v["risk_level"] == risk_level]
    
    if status:
        logger.info(f"按状态筛选: {status}")
        results = [v for v in results if v["status"] == status]
    
    if vulnerability_type:
        logger.info(f"按漏洞类型筛选: {vulnerability_type}")
        results = [v for v in results if v.get("vulnerability_type") == vulnerability_type]
    
    if priority:
        logger.info(f"按优先级筛选: {priority}")
        results = [v for v in results if v.get("priority") == priority]
    
    if department:
        logger.info(f"按部门筛选: {department}")
        results = [v for v in results if v.get("department") == department]
    
    if responsible_person:
        logger.info(f"按负责人筛选: {responsible_person}")
        results = [v for v in results if v.get("responsible_person") == responsible_person]
    
    if min_cvss is not None:
        logger.info(f"按最小CVSS评分筛选: {min_cvss}")
        results = [v for v in results if v.get("cvss_score") is not None and v.get("cvss_score") >= min_cvss]
    
    if max_cvss is not None:
        logger.info(f"按最大CVSS评分筛选: {max_cvss}")
        results = [v for v in results if v.get("cvss_score") is not None and v.get("cvss_score") <= max_cvss]
    
    if min_vpr is not None:
        logger.info(f"按最小VPR评分筛选: {min_vpr}")
        results = [v for v in results if v.get("vpr_score") is not None and v.get("vpr_score") >= min_vpr]
    
    if max_vpr is not None:
        logger.info(f"按最大VPR评分筛选: {max_vpr}")
        results = [v for v in results if v.get("vpr_score") is not None and v.get("vpr_score") <= max_vpr]
    
    # 处理首次发现时间过滤
    if first_found_from:
        logger.info(f"按首次发现时间起始筛选: {first_found_from}")
        from_date = parse_datetime(first_found_from)
        if from_date:
            results = [v for v in results if v.get("first_found_date") and parse_datetime(v.get("first_found_date")) >= from_date]
    
    if first_found_to:
        logger.info(f"按首次发现时间结束筛选: {first_found_to}")
        to_date = parse_datetime(first_found_to)
        if to_date:
            results = [v for v in results if v.get("first_found_date") and parse_datetime(v.get("first_found_date")) <= to_date]
    
    # 处理最近发现时间过滤
    if latest_found_from:
        logger.info(f"按最近发现时间起始筛选: {latest_found_from}")
        from_date = parse_datetime(latest_found_from)
        if from_date:
            results = [v for v in results if v.get("latest_found_date") and parse_datetime(v.get("latest_found_date")) >= from_date]
    
    if latest_found_to:
        logger.info(f"按最近发现时间结束筛选: {latest_found_to}")
        to_date = parse_datetime(latest_found_to)
        if to_date:
            results = [v for v in results if v.get("latest_found_date") and parse_datetime(v.get("latest_found_date")) <= to_date]
    
    # 在返回结果前更新资产的漏洞统计
    update_asset_vulnerability_summary()
    
    logger.info(f"返回 {len(results)} 条漏洞记录")
    return results

@router.get("/{vulnerability_id}", response_model=Vulnerability)
async def get_vulnerability(vulnerability_id: int):
    """获取单个漏洞的详细信息"""
    logger.info(f"获取漏洞详情请求，ID: {vulnerability_id}")
    for vuln in mock_vulnerabilities:
        if vuln["id"] == vulnerability_id:
            return vuln
    
    logger.warning(f"未找到漏洞，ID: {vulnerability_id}")
    raise HTTPException(status_code=404, detail="漏洞未找到")

@router.post("/", response_model=Vulnerability)
async def create_vulnerability(vulnerability: VulnerabilityCreate):
    """创建新的漏洞记录"""
    logger.info(f"创建漏洞请求：{vulnerability.dict()}")
    # 模拟创建新记录
    new_id = max([v["id"] for v in mock_vulnerabilities]) + 1
    
    # 处理资产关联
    affected_assets = []
    
    # 1. 处理通过ID直接关联的资产
    if vulnerability.affected_assets:
        for asset_id in vulnerability.affected_assets:
            # 查找对应的资产
            for asset in mock_assets:
                if asset["id"] == asset_id:
                    affected_assets.append({
                        "id": asset["id"],
                        "name": asset["name"],
                        "ip": asset["address"] if asset["type"] == "服务器" else None,
                        "type": asset["type"]
                    })
                    break
    
    # 2. 如果提供了漏洞URL，自动查找或创建关联资产
    if vulnerability.vulnerability_url and not affected_assets:
        asset = await find_or_create_asset_for_vulnerability(vulnerability.vulnerability_url)
        if asset:
            affected_assets.append({
                "id": asset["id"],
                "name": asset["name"],
                "ip": asset["address"] if asset["type"] == "服务器" else None,
                "type": asset["type"]
            })
    
    new_vulnerability = {
        "id": new_id,
        "name": vulnerability.name,
        "cve_id": vulnerability.cve_id,
        "risk_level": vulnerability.risk_level,
        "description": vulnerability.description,
        "affected_assets": affected_assets,  # 使用关联的资产
        "discovery_date": datetime.datetime.now().isoformat(),
        "status": "待修复",
        "remediation_steps": vulnerability.remediation_steps,
        
        # 新增字段
        "vulnerability_type": vulnerability.vulnerability_type,
        "vulnerability_url": vulnerability.vulnerability_url,
        "responsible_person": vulnerability.responsible_person,
        "department": vulnerability.department,
        "first_found_date": vulnerability.first_found_date.isoformat() if vulnerability.first_found_date else datetime.datetime.now().isoformat(),
        "latest_found_date": vulnerability.latest_found_date.isoformat() if vulnerability.latest_found_date else datetime.datetime.now().isoformat(),
        "cvss_score": vulnerability.cvss_score,
        "vpr_score": vulnerability.vpr_score,
        "priority": vulnerability.priority,
        "fix_time_hours": vulnerability.fix_time_hours,
        
        # 详情字段
        "impact_details": vulnerability.impact_details,
        "reproduction_steps": vulnerability.reproduction_steps,
        "affected_components": vulnerability.affected_components,
        "impact_scope": vulnerability.impact_scope,
        "fix_impact": vulnerability.fix_impact,
        "references": vulnerability.references
    }
    
    mock_vulnerabilities.append(new_vulnerability)
    
    # 更新资产的漏洞统计信息
    update_asset_vulnerability_summary()
    
    logger.info(f"漏洞创建成功，ID: {new_id}，关联资产数: {len(affected_assets)}")
    return new_vulnerability

@router.put("/{vulnerability_id}", response_model=Vulnerability)
async def update_vulnerability(vulnerability_id: int, vulnerability: VulnerabilityUpdate):
    """更新现有的漏洞记录"""
    logger.info(f"更新漏洞请求，ID: {vulnerability_id}, 数据: {vulnerability.dict(exclude_unset=True)}")
    try:
        logger.info(f"原始请求数据JSON: {vulnerability.json()}")
    except Exception as e:
        logger.error(f"打印JSON失败: {str(e)}")
    
    logger.info(f"当前漏洞数据（修改前）: {[v for v in mock_vulnerabilities if v['id'] == vulnerability_id]}")
    
    for i, vuln in enumerate(mock_vulnerabilities):
        if vuln["id"] == vulnerability_id:
            update_data = vulnerability.dict(exclude_unset=True)
            
            # 处理资产关联更新
            if "affected_assets" in update_data and update_data["affected_assets"] is not None:
                logger.info(f"处理资产关联更新，资产IDs: {update_data['affected_assets']}")
                logger.info(f"资产IDs类型: {type(update_data['affected_assets'])}, 是否为列表: {isinstance(update_data['affected_assets'], list)}")
                affected_assets = []
                for asset_id in update_data["affected_assets"]:
                    logger.info(f"查找资产ID: {asset_id}, 类型: {type(asset_id)}")
                    # 查找对应的资产
                    found_asset = False
                    for asset in mock_assets:
                        if asset["id"] == asset_id:
                            found_asset = True
                            logger.info(f"找到匹配资产: {asset['name']}")
                            affected_assets.append({
                                "id": asset["id"],
                                "name": asset["name"],
                                "ip": asset["address"] if asset["type"] == "服务器" else None,
                                "type": asset["type"]
                            })
                            break
                    if not found_asset:
                        logger.warning(f"未找到资产ID: {asset_id}")
                
                logger.info(f"关联资产处理完成，找到 {len(affected_assets)} 个资产")
                update_data["affected_assets"] = affected_assets
            
            # 如果修改了漏洞URL且没有明确设置关联资产，尝试自动关联
            if "vulnerability_url" in update_data and not "affected_assets" in update_data:
                asset = await find_or_create_asset_for_vulnerability(update_data["vulnerability_url"])
                if asset:
                    mock_vulnerabilities[i]["affected_assets"] = [{
                        "id": asset["id"],
                        "name": asset["name"],
                        "ip": asset["address"] if asset["type"] == "服务器" else None,
                        "type": asset["type"]
                    }]
            
            # 更新非空字段
            for field, value in update_data.items():
                if value is not None:
                    mock_vulnerabilities[i][field] = value
            
            # 更新资产的漏洞统计信息
            update_asset_vulnerability_summary()
            
            logger.info(f"漏洞更新成功，ID: {vulnerability_id}")
            return mock_vulnerabilities[i]
    
    logger.warning(f"更新漏洞失败，未找到ID: {vulnerability_id}")
    raise HTTPException(status_code=404, detail="漏洞未找到")

@router.delete("/{vulnerability_id}")
async def delete_vulnerability(vulnerability_id: int):
    """删除漏洞记录"""
    logger.info(f"删除漏洞请求，ID: {vulnerability_id}")
    for i, vuln in enumerate(mock_vulnerabilities):
        if vuln["id"] == vulnerability_id:
            del mock_vulnerabilities[i]
            
            # 更新资产的漏洞统计信息
            update_asset_vulnerability_summary()
            
            logger.info(f"漏洞删除成功，ID: {vulnerability_id}")
            return {"status": "success", "message": "漏洞已删除"}
    
    logger.warning(f"删除漏洞失败，未找到ID: {vulnerability_id}")
    raise HTTPException(status_code=404, detail="漏洞未找到")