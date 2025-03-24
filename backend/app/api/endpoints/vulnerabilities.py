from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models.vulnerability import Vulnerability, VulnerabilityCreate, VulnerabilityUpdate
import datetime
import logging

# 设置日志
logger = logging.getLogger(__name__)

router = APIRouter()

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
        "remediation_steps": "升级到Log4j 2.15.0或更高版本，或者设置系统属性-Dlog4j2.formatMsgNoLookups=true"
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
        "remediation_steps": "使用参数化查询或预处理语句，避免直接拼接SQL语句"
    }
]

@router.get("/", response_model=List[Vulnerability])
async def get_vulnerabilities(
    risk_level: Optional[str] = Query(None, description="按风险等级筛选"),
    status: Optional[str] = Query(None, description="按状态筛选")
):
    """获取漏洞列表，支持筛选"""
    logger.info(f"获取漏洞列表请求，筛选条件：risk_level={risk_level}, status={status}")
    results = mock_vulnerabilities
    
    if risk_level:
        logger.info(f"按风险等级筛选: {risk_level}")
        results = [v for v in results if v["risk_level"] == risk_level]
    
    if status:
        logger.info(f"按状态筛选: {status}")
        results = [v for v in results if v["status"] == status]
    
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
    
    new_vulnerability = {
        "id": new_id,
        "name": vulnerability.name,
        "cve_id": vulnerability.cve_id,
        "risk_level": vulnerability.risk_level,
        "description": vulnerability.description,
        "affected_assets": [],  # 简化版，不处理资产关联
        "discovery_date": datetime.datetime.now().isoformat(),
        "status": "待修复",
        "remediation_steps": vulnerability.remediation_steps
    }
    
    mock_vulnerabilities.append(new_vulnerability)
    logger.info(f"漏洞创建成功，ID: {new_id}")
    return new_vulnerability

@router.put("/{vulnerability_id}", response_model=Vulnerability)
async def update_vulnerability(vulnerability_id: int, vulnerability: VulnerabilityUpdate):
    """更新现有的漏洞记录"""
    logger.info(f"更新漏洞请求，ID: {vulnerability_id}, 数据: {vulnerability.dict(exclude_unset=True)}")
    for i, vuln in enumerate(mock_vulnerabilities):
        if vuln["id"] == vulnerability_id:
            # 更新非空字段
            for field, value in vulnerability.dict(exclude_unset=True).items():
                if value is not None:
                    mock_vulnerabilities[i][field] = value
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
            logger.info(f"漏洞删除成功，ID: {vulnerability_id}")
            return {"status": "success", "message": "漏洞已删除"}
    
    logger.warning(f"删除漏洞失败，未找到ID: {vulnerability_id}")
    raise HTTPException(status_code=404, detail="漏洞未找到")