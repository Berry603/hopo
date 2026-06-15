"""
审计任务管理 API
Audit Task Management API Endpoints
"""
import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from loguru import logger

from app.core.database import get_db
from app.api.v1.deps import get_current_user, require_permission
from app.models.audit import AuditTask, TaskStatus
from app.models.audit_project import AuditProject
from app.models.user import User
from app.models.audit_log import AuditLog
from app.core.database import SessionLocal

router = APIRouter(prefix="/tasks")


@router.get("")
async def list_tasks(
    project_id: Optional[str] = Query(None, description="项目ID筛选"),
    assignee_id: Optional[str] = Query(None, description="负责人ID筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取审计任务列表"""
    q = db.query(AuditTask)
    if project_id:
        q = q.filter(AuditTask.audit_project_id == project_id)
    if assignee_id:
        q = q.filter(AuditTask.assignee_id == assignee_id)
    if status:
        q = q.filter(AuditTask.status == status)
    
    total = q.count()
    tasks = q.order_by(AuditTask.created_at.desc()).offset(
        (page - 1) * page_size).limit(page_size).all()
    
    return {
        "code": 200, "message": "获取成功",
        "data": [_task_to_dict(t) for t in tasks],
        "total": total, "page": page, "page_size": page_size,
    }


@router.get("/{task_id}")
async def get_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取任务详情"""
    task = db.query(AuditTask).filter(AuditTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"code": 200, "message": "获取成功", "data": _task_to_dict(task)}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建审计任务"""
    project = db.query(AuditProject).filter(AuditProject.id == data.get("audit_project_id")).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    task = AuditTask(
        task_id=data.get("task_id", f"TASK-{uuid.uuid4().hex[:6].upper()}"),
        audit_project_id=data["audit_project_id"],
        task_name=data["task_name"],
        task_description=data.get("task_description"),
        task_type=data.get("task_type", "其他"),
        status=TaskStatus.PENDING,
        assignee_id=data.get("assignee_id"),
        created_by_id=current_user.id,
        due_date=_parse_date(data.get("due_date")),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    logger.info(f"审计任务创建成功: {task.task_id} - {task.task_name}")
    _write_task_log(current_user, "创建任务", task.task_id, f"创建任务: {task.task_name} [{task.task_type}]")
    return {"code": 201, "message": "创建成功", "data": _task_to_dict(task)}


@router.put("/{task_id}")
async def update_task(
    task_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新审计任务（分配/改状态/修改信息）"""
    task = db.query(AuditTask).filter(AuditTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # 可更新字段
    updatable = ["task_name", "task_description", "task_type", "assignee_id", "due_date"]
    for field in updatable:
        if field in data:
            setattr(task, field, data[field])
    
    # 状态变更
    if "status" in data:
        new_status = data["status"]
        if new_status in [s.value for s in TaskStatus]:
            task.status = new_status
            if new_status == "in_progress" and not task.started_at:
                task.started_at = datetime.utcnow()
            if new_status == "completed":
                task.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    logger.info(f"审计任务更新成功: {task.task_id} - status={task.status}")
    _write_task_log(current_user, "更新任务", task.task_id, f"更新任务: {task.task_name} status->{task.status}")
    return {"code": 200, "message": "更新成功", "data": _task_to_dict(task)}


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除审计任务（软删除）"""
    task = db.query(AuditTask).filter(AuditTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    task.soft_delete(deleted_by_id=current_user.id)
    db.commit()
    logger.info(f"审计任务已软删除: {task.task_id} by {current_user.username}")
    _write_task_log(current_user, "删除任务", task.task_id, f"删除任务: {task.task_name}")
    return {"code": 200, "message": "删除成功"}


def _task_to_dict(task: AuditTask) -> dict:
    return {
        "id": task.id,
        "task_id": task.task_id,
        "project_id": task.audit_project_id,
        "task_name": task.task_name,
        "task_description": task.task_description,
        "task_type": task.task_type,
        "status": task.status.value if task.status else None,
        "assignee_id": task.assignee_id,
        "created_by_id": task.created_by_id,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "started_at": task.started_at.isoformat() if task.started_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "created_at": task.created_at.isoformat() if task.created_at else None,
    }


def _write_task_log(user: User, action: str, resource: str, description: str):
    """写入任务相关的审计日志"""
    try:
        db = SessionLocal()
        log = AuditLog(
            user_id=user.id,
            username=user.username,
            action=action,
            module="审计任务",
            resource=resource,
            description=description,
            status="success",
        )
        db.add(log)
        db.commit()
        db.close()
    except Exception as e:
        logger.warning(f"审计日志写入失败: {e}")


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str)
    except (ValueError, TypeError):
        return None
