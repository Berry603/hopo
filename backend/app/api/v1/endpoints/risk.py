"""
风险预警中心API端点
Risk Early Warning Center API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from loguru import logger
from typing import List, Optional
from datetime import datetime
import json

from app.core.database import get_db
from app.core.config import settings
from app.api.v1.deps import get_current_user, require_role
from app.models.risk import (
    RiskRule,
    RiskAlert,
    RiskType,
    SeverityLevel,
    AlertStatus,
    RuleType,
)
from app.schemas import (
    ResponseModel,
    PaginatedResponse,
)

router = APIRouter()


# ==================== 风险规则管理 ====================

@router.get("/rules", response_model=PaginatedResponse)
async def get_risk_rules(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    risk_type: Optional[str] = Query(None, description="风险类型筛选"),
    severity: Optional[str] = Query(None, description="严重程度筛选"),
    is_active: Optional[bool] = Query(True, description="是否激活"),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取风险规则列表

    Args:
        page: 页码
        page_size: 每页数量
        risk_type: 风险类型筛选
        severity: 严重程度筛选
        is_active: 是否激活
        db: 数据库会话

    Returns:
        风险规则列表
    """
    
    # 构建查询
    query = db.query(RiskRule)
    
    # 筛选条件
    if risk_type:
        query = query.filter(RiskRule.risk_type == risk_type)
    if severity:
        query = query.filter(RiskRule.severity == severity)
    if is_active is not None:
        query = query.filter(RiskRule.is_active == ("1" if is_active else "0"))
    
    # 分页
    total = query.count()
    rules = query.order_by(RiskRule.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    # 构建响应数据
    rules_data = []
    for rule in rules:
        rules_data.append({
            "id": rule.id,
            "rule_id": rule.rule_id,
            "name": rule.name,
            "description": rule.description,
            "risk_type": rule.risk_type,
            "severity": rule.severity,
            "rule_type": rule.rule_type,
            "threshold": rule.threshold,
            "scan_schedule": rule.scan_schedule,
            "is_active": rule.is_active == "1",
            "actions": json.loads(rule.actions) if rule.actions else None,
            "created_by_name": rule.created_by.full_name if rule.created_by else None,
            "created_at": rule.created_at.isoformat(),
            "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
        })
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": rules_data,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/rules", status_code=status.HTTP_201_CREATED)
async def create_risk_rule(
    rule_data: dict,
    current_user = Depends(get_current_user),
    _ = Depends(require_role("super_admin", "audit_director", "audit_manager")),
    db: Session = Depends(get_db),
):
    """
    创建风险规则

    Args:
        rule_data: 规则数据
        db: 数据库会话

    Returns:
        创建结果
    """
    
    # 检查规则编号是否已存在
    if db.query(RiskRule).filter(RiskRule.rule_id == rule_data.get("rule_id")).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="规则编号已存在",
        )
    
    # 创建新规则
    db_rule = RiskRule(
        rule_id=rule_data.get("rule_id"),
        name=rule_data.get("name"),
        description=rule_data.get("description"),
        risk_type=rule_data.get("risk_type"),
        severity=rule_data.get("severity", SeverityLevel.MEDIUM),
        rule_type=rule_data.get("rule_type"),
        conditions=json.dumps(rule_data.get("conditions", {}), ensure_ascii=False),
        threshold=rule_data.get("threshold"),
        scan_schedule=rule_data.get("scan_schedule"),
        is_active="1" if rule_data.get("is_active", True) else "0",
        actions=json.dumps(rule_data.get("actions", {}), ensure_ascii=False),
        created_by_id=current_user.id,
    )
    
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    
    logger.info(f"风险规则创建成功: {db_rule.rule_id} - {db_rule.name} (创建人: {current_user.username})")
    
    return {
        "code": 201,
        "message": "创建成功",
        "data": {
            "id": db_rule.id,
            "rule_id": db_rule.rule_id,
            "name": db_rule.name,
        }
    }


# ==================== 风险预警事件管理 ====================

@router.get("/alerts", response_model=PaginatedResponse)
async def get_risk_alerts(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    risk_type: Optional[str] = Query(None, description="风险类型筛选"),
    severity: Optional[str] = Query(None, description="严重程度筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    department: Optional[str] = Query(None, description="部门筛选"),
    start_date: Optional[str] = Query(None, description="开始日期"),
    end_date: Optional[str] = Query(None, description="结束日期"),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取风险预警事件列表

    Args:
        page: 页码
        page_size: 每页数量
        risk_type: 风险类型筛选
        severity: 严重程度筛选
        status: 状态筛选
        department: 部门筛选
        start_date: 开始日期
        end_date: 结束日期
        db: 数据库会话

    Returns:
        风险预警事件列表
    """
    
    # 构建查询
    query = db.query(RiskAlert)
    
    # 筛选条件
    if risk_type:
        query = query.filter(RiskAlert.risk_type == risk_type)
    if severity:
        query = query.filter(RiskAlert.severity == severity)
    if status:
        query = query.filter(RiskAlert.status == status)
    if department:
        query = query.filter(RiskAlert.dept_code == department)
    if start_date:
        query = query.filter(RiskAlert.alert_time >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        query = query.filter(RiskAlert.alert_time <= datetime.strptime(end_date, "%Y-%m-%d"))
    
    # 分页
    total = query.count()
    alerts = query.order_by(RiskAlert.alert_time.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    # 构建响应数据
    alerts_data = []
    for alert in alerts:
        alerts_data.append({
            "id": alert.id,
            "alert_id": alert.alert_id,
            "rule_id": alert.rule_id,
            "rule_name": alert.rule.name if alert.rule else None,
            "risk_type": alert.risk_type,
            "severity": alert.severity,
            "title": alert.title,
            "description": alert.description,
            "dept_code": alert.dept_code,
            "dept_name": alert.dept_name,
            "business_area": alert.business_area,
            "detail_data": alert.detail_data if isinstance(alert.detail_data, dict) else (json.loads(alert.detail_data) if isinstance(alert.detail_data, str) else None),
            "status": alert.status,
            "confirmed_by_name": alert.confirmed_by.full_name if alert.confirmed_by else None,
            "confirmed_at": alert.confirmed_at.isoformat() if alert.confirmed_at else None,
            "labels": alert.labels if isinstance(alert.labels, list) else (json.loads(alert.labels) if isinstance(alert.labels, str) else []),
            "alert_time": alert.alert_time.isoformat(),
            "created_at": alert.created_at.isoformat(),
        })
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": alerts_data,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/alerts/{alert_id}/confirm")
async def confirm_risk_alert(
    alert_id: str,
    confirm_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    确认风险预警事件

    Args:
        alert_id: 预警事件ID
        confirm_data: 确认数据
        db: 数据库会话

    Returns:
        确认结果
    """
    
    # 获取预警事件
    alert = db.query(RiskAlert).filter(RiskAlert.id == alert_id).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="预警事件不存在",
        )
    
    # 更新预警事件
    alert.status = AlertStatus.CONFIRMED
    alert.confirmed_by_id = current_user.id
    alert.confirmed_at = datetime.utcnow()
    alert.confirmation_note = confirm_data.get("note")
    
    db.commit()
    
    logger.info(f"风险预警事件确认成功: {alert.alert_id} - {alert.title} (确认人: {current_user.username})")
    
    return {
        "code": 200,
        "message": "确认成功",
    }


# ========== 风险扫描引擎 ==========

@router.post("/scan")
async def trigger_risk_scan(
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    触发风险扫描（调用规则引擎）
    """
    from app.services.risk_engine import RiskEngineService

    try:
        engine = RiskEngineService()
        results = engine.run_all_rules()
        
        return {
            "code": 200,
            "message": f"扫描完成，发现 {len(results)} 条预警",
            "data": {"alert_count": len(results), "alerts": results},
        }
    except Exception as e:
        logger.error(f"风险扫描失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scan/{rule_id}")
async def trigger_single_rule(
    rule_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """执行单条规则扫描"""
    from app.services.risk_engine import RiskEngineService
    
    try:
        engine = RiskEngineService()
        results = engine.run_rule(rule_id)
        return {
            "code": 200,
            "message": f"规则执行完成，发现 {len(results)} 条预警",
            "data": results,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/preset-rules")
async def list_preset_rules():
    """获取预设风险规则模板"""
    from app.services.risk_engine import PRESET_RISK_RULES
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": [
            {
                "rule_id": r["rule_id"],
                "name": r["name"],
                "description": r["description"],
                "risk_type": r["risk_type"].value,
                "severity": r["severity"].value,
                "rule_type": r["rule_type"].value if hasattr(r["rule_type"], "value") else r["rule_type"],
            }
            for r in PRESET_RISK_RULES
        ],
    }
