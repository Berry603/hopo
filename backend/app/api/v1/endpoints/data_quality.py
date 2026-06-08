"""
数据治理与质量中心API端点
Data Governance and Quality Center API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from loguru import logger
from typing import List, Optional
import json

from app.core.database import get_db
from app.core.config import settings
from app.core.auth_utils import decode_token
from app.models.data_quality import (
    QualityRule,
    QualityReport,
    SyncStatus,
    DataLineage,
    RuleType as DataQualityRuleType,
    SeverityLevel as DataQualitySeverityLevel,
)
from app.models.user import User, UserRole
from app.schemas import (
    ResponseModel,
    PaginatedResponse,
)

router = APIRouter()
security = HTTPBearer()


# ==================== 数据质量规则管理 ====================

@router.get("/rules", response_model=PaginatedResponse)
async def get_quality_rules(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    source_system: Optional[str] = Query(None, description="源系统筛选"),
    table_name: Optional[str] = Query(None, description="表名筛选"),
    is_active: Optional[bool] = Query(True, description="是否激活"),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    获取数据质量规则列表
    
    Args:
        page: 页码
        page_size: 每页数量
        source_system: 源系统筛选
        table_name: 表名筛选
        is_active: 是否激活
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        数据质量规则列表
    """
    # 验证Token
    payload = decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if not current_user or not current_user.is_auditor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 构建查询
    query = db.query(QualityRule)
    
    # 筛选条件
    if source_system:
        query = query.filter(QualityRule.source_system == source_system)
    if table_name:
        query = query.filter(QualityRule.table_name == table_name)
    if is_active is not None:
        query = query.filter(QualityRule.is_active == ("1" if is_active else "0"))
    
    # 分页
    total = query.count()
    rules = query.order_by(QualityRule.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    # 构建响应数据
    rules_data = []
    for rule in rules:
        rules_data.append({
            "id": rule.id,
            "rule_id": rule.rule_id,
            "name": rule.name,
            "description": rule.description,
            "source_system": rule.source_system,
            "table_name": rule.table_name,
            "field_name": rule.field_name,
            "rule_type": rule.rule_type,
            "threshold": rule.threshold,
            "severity": rule.severity,
            "is_active": rule.is_active == "1",
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
async def create_quality_rule(
    rule_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    创建数据质量规则
    
    Args:
        rule_data: 规则数据
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        创建结果
    """
    # 验证Token
    payload = decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # 检查权限
    if not current_user or current_user.role not in [UserRole.SUPER_ADMIN, UserRole.AUDIT_DIRECTOR, UserRole.AUDIT_MANAGER, UserRole.DATA_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 创建新规则
    db_rule = QualityRule(
        rule_id=rule_data.get("rule_id"),
        name=rule_data.get("name"),
        description=rule_data.get("description"),
        source_system=rule_data.get("source_system"),
        table_name=rule_data.get("table_name"),
        field_name=rule_data.get("field_name"),
        rule_type=rule_data.get("rule_type"),
        threshold=rule_data.get("threshold"),
        severity=rule_data.get("severity", DataQualitySeverityLevel.WARNING),
        is_active="1" if rule_data.get("is_active", True) else "0",
        created_by_id=current_user.id,
    )
    
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    
    logger.info(f"数据质量规则创建成功: {db_rule.rule_id} - {db_rule.name} (创建人: {current_user.username})")
    
    return {
        "code": 201,
        "message": "创建成功",
        "data": {
            "id": db_rule.id,
            "rule_id": db_rule.rule_id,
            "name": db_rule.name,
        }
    }


# ==================== 数据质量报告 ====================

@router.get("/reports", response_model=PaginatedResponse)
async def get_quality_reports(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    month: Optional[str] = Query(None, description="月份筛选（YYYY-MM）"),
    department: Optional[str] = Query(None, description="部门筛选"),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    获取数据质量报告列表
    
    Args:
        page: 页码
        page_size: 每页数量
        month: 月份筛选
        department: 部门筛选
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        数据质量报告列表
    """
    # 验证Token
    payload = decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if not current_user or not current_user.is_auditor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 构建查询
    query = db.query(QualityReport)
    
    # 筛选条件
    if month:
        query = query.filter(QualityReport.report_month == month)
    if department:
        query = query.filter(QualityReport.department == department)
    
    # 分页
    total = query.count()
    reports = query.order_by(QualityReport.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    # 构建响应数据
    reports_data = []
    for report in reports:
        reports_data.append({
            "id": report.id,
            "report_id": report.report_id,
            "rule_id": report.rule_id,
            "rule_name": report.rule.name if report.rule else None,
            "report_month": report.report_month,
            "department": report.department,
            "total_records": report.total_records,
            "passed_records": report.passed_records,
            "failed_records": report.failed_records,
            "quality_score": report.quality_score,
            "status": report.status,
            "generated_at": report.generated_at.isoformat() if report.generated_at else None,
            "created_at": report.created_at.isoformat(),
        })
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": reports_data,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ==================== 同步状态监控 ====================

@router.get("/sync-status", response_model=ResponseModel)
async def get_sync_status(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    获取所有源系统同步状态
    
    Args:
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        同步状态列表
    """
    # 验证Token
    payload = decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if not current_user or not current_user.is_auditor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 获取所有同步状态
    sync_statuses = db.query(SyncStatus).order_by(SyncStatus.source_system).all()
    
    # 构建响应数据
    sync_data = []
    for status in sync_statuses:
        sync_data.append({
            "id": status.id,
            "source_system": status.source_system,
            "table_name": status.table_name,
            "sync_status": status.sync_status,
            "last_sync_at": status.last_sync_at.isoformat() if status.last_sync_at else None,
            "last_success_at": status.last_success_at.isoformat() if status.last_success_at else None,
            "records_synced": status.records_synced,
            "sync_duration_seconds": status.sync_duration_seconds,
            "error_message": status.error_message,
            "is_connected": status.is_connected == "1",
            "latency_ms": status.latency_ms,
            "created_at": status.created_at.isoformat(),
            "updated_at": status.updated_at.isoformat() if status.updated_at else None,
        })
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": sync_data,
    }
