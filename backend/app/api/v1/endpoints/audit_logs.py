"""
审计日志查看 API
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/audit-logs")


@router.get("")
async def list_audit_logs(
    module: Optional[str] = Query(None, description="模块筛选"),
    action: Optional[str] = Query(None, description="动作筛选"),
    username: Optional[str] = Query(None, description="用户名筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取审计操作日志列表"""
    q = db.query(AuditLog)
    if module:
        q = q.filter(AuditLog.module == module)
    if action:
        q = q.filter(AuditLog.action == action)
    if username:
        q = q.filter(AuditLog.username.like(f"%{username}%"))
    
    total = q.count()
    logs = q.order_by(desc(AuditLog.created_at)).offset(
        (page - 1) * page_size).limit(page_size).all()
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": [_log_to_dict(log) for log in logs],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/modules")
async def list_log_modules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取有日志记录的模块列表（用于筛选）"""
    results = db.query(AuditLog.module).distinct().order_by(AuditLog.module).all()
    modules = [r[0] for r in results if r[0]]
    return {"code": 200, "data": modules}


@router.get("/actions")
async def list_log_actions(
    module: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取指定模块的操作类型列表（用于筛选）"""
    q = db.query(AuditLog.action).distinct()
    if module:
        q = q.filter(AuditLog.module == module)
    results = q.order_by(AuditLog.action).all()
    actions = [r[0] for r in results if r[0]]
    return {"code": 200, "data": actions}


def _log_to_dict(log: AuditLog) -> dict:
    return {
        "id": log.id,
        "user_id": log.user_id,
        "username": log.username,
        "ip_address": log.ip_address,
        "action": log.action,
        "module": log.module,
        "resource": log.resource,
        "description": log.description,
        "status": log.status,
        "error_message": log.error_message,
        "duration_ms": log.duration_ms,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }
