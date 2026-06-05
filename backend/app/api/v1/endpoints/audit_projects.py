"""
审计项目管理API端点
Audit Project Management API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from loguru import logger
from typing import List, Optional
from datetime import datetime, date

from app.core.database import get_db
from app.core.config import settings
from app.middleware.auth import AuthMiddleware
from app.models.audit_project import (
    AuditProject,
    AuditType,
    AuditPhase,
    ProjectStatus,
)
from app.models.user import User, UserRole
from app.schemas import (
    ResponseModel,
    PaginatedResponse,
)

router = APIRouter()
security = HTTPBearer()
auth_middleware = AuthMiddleware()


# ==================== 获取审计项目列表 ====================

@router.get("")
async def get_audit_projects(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    project_code: Optional[str] = Query(None, description="项目编号筛选"),
    project_name: Optional[str] = Query(None, description="项目名称筛选"),
    audit_type: Optional[str] = Query(None, description="审计类型筛选"),
    status: Optional[str] = Query(None, description="项目状态筛选"),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    获取审计项目列表
    
    Args:
        page: 页码
        page_size: 每页数量
        project_code: 项目编号筛选
        project_name: 项目名称筛选
        audit_type: 审计类型筛选
        status: 项目状态筛选
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        审计项目列表
    """
    # 验证Token
    payload = auth_middleware.decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if not current_user or not current_user.is_auditor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 构建查询
    query = db.query(AuditProject)
    
    # 筛选条件
    if project_code:
        query = query.filter(AuditProject.project_code.like(f"%{project_code}%"))
    if project_name:
        query = query.filter(AuditProject.project_name.like(f"%{project_name}%"))
    if audit_type:
        query = query.filter(AuditProject.audit_type == audit_type)
    if status:
        query = query.filter(AuditProject.status == status)
    
    # 权限筛选（非管理员只能看自己的项目）
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.AUDIT_DIRECTOR]:
        query = query.filter(
            (AuditProject.project_manager_id == current_user.id) |
            (AuditProject.created_by_id == current_user.id)
        )
    
    # 分页
    total = query.count()
    projects = query.order_by(AuditProject.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    # 构建响应数据
    projects_data = []
    for project in projects:
        projects_data.append({
            "id": project.id,
            "project_code": project.project_code,
            "project_name": project.project_name,
            "audit_type": project.audit_type,
            "current_phase": project.current_phase,
            "status": project.status,
            "target_dept_name": project.target_dept_name,
            "start_date": project.start_date.isoformat() if project.start_date else None,
            "end_date": project.end_date.isoformat() if project.end_date else None,
            "project_manager_name": project.project_manager.full_name if project.project_manager else None,
            "created_by_name": project.created_by.full_name if project.created_by else None,
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat() if project.updated_at else None,
        })
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": projects_data,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ==================== 获取审计项目详情 ====================

@router.get("/{project_id}")
async def get_audit_project(
    project_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    获取审计项目详情
    
    Args:
        project_id: 项目ID
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        审计项目详情
    """
    # 验证Token
    payload = auth_middleware.decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if not current_user or not current_user.is_auditor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 获取项目
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="审计项目不存在",
        )
    
    # 构建响应数据
    project_data = {
        "id": project.id,
        "project_code": project.project_code,
        "project_name": project.project_name,
        "audit_type": project.audit_type,
        "current_phase": project.current_phase,
        "status": project.status,
        "target_dept_code": project.target_dept_code,
        "target_dept_name": project.target_dept_name,
        "start_date": project.start_date.isoformat() if project.start_date else None,
        "end_date": project.end_date.isoformat() if project.end_date else None,
        "actual_end_date": project.actual_end_date.isoformat() if project.actual_end_date else None,
        "project_manager_id": project.project_manager_id,
        "project_manager_name": project.project_manager.full_name if project.project_manager else None,
        "created_by_id": project.created_by_id,
        "created_by_name": project.created_by.full_name if project.created_by else None,
        "audit_objective": project.audit_objective,
        "audit_scope": project.audit_scope,
        "audit_criteria": project.audit_criteria,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
    }
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": project_data,
    }


# ==================== 创建审计项目 ====================

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_audit_project(
    project_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    创建审计项目
    
    Args:
        project_data: 项目数据
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        创建结果
    """
    # 验证Token
    payload = auth_middleware.decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # 检查权限
    if not current_user or not current_user.can_manage_projects:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 检查项目编号是否已存在
    if db.query(AuditProject).filter(AuditProject.project_code == project_data.get("project_code")).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="项目编号已存在",
        )
    
    # 创建新项目
    db_project = AuditProject(
        project_code=project_data.get("project_code"),
        project_name=project_data.get("project_name"),
        audit_type=project_data.get("audit_type", AuditType.FINANCIAL),
        current_phase=project_data.get("current_phase", AuditPhase.PLANNING),
        status=project_data.get("status", ProjectStatus.DRAFT),
        target_dept_code=project_data.get("target_dept_code"),
        target_dept_name=project_data.get("target_dept_name"),
        start_date=datetime.strptime(project_data.get("start_date"), "%Y-%m-%d").date() if project_data.get("start_date") else None,
        end_date=datetime.strptime(project_data.get("end_date"), "%Y-%m-%d").date() if project_data.get("end_date") else None,
        project_manager_id=project_data.get("project_manager_id"),
        created_by_id=current_user.id,
        audit_objective=project_data.get("audit_objective"),
        audit_scope=project_data.get("audit_scope"),
        audit_criteria=project_data.get("audit_criteria"),
    )
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    logger.info(f"审计项目创建成功: {db_project.project_code} - {db_project.project_name} (创建人: {current_user.username})")
    
    return {
        "code": 201,
        "message": "创建成功",
        "data": {
            "id": db_project.id,
            "project_code": db_project.project_code,
            "project_name": db_project.project_name,
        }
    }


# ==================== 更新审计项目 ====================

@router.put("/{project_id}")
async def update_audit_project(
    project_id: str,
    project_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    更新审计项目
    
    Args:
        project_id: 项目ID
        project_data: 项目数据
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        更新结果
    """
    # 验证Token
    payload = auth_middleware.decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if not current_user or not current_user.can_manage_projects:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 获取项目
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="审计项目不存在",
        )
    
    # 更新项目
    update_fields = [
        "project_name", "audit_type", "current_phase", "status",
        "target_dept_code", "target_dept_name",
        "start_date", "end_date", "actual_end_date",
        "project_manager_id", "audit_objective", "audit_scope", "audit_criteria"
    ]
    
    for field in update_fields:
        if field in project_data:
            if field in ["start_date", "end_date", "actual_end_date"] and project_data.get(field):
                setattr(project, field, datetime.strptime(project_data.get(field), "%Y-%m-%d").date())
            else:
                setattr(project, field, project_data.get(field))
    
    db.commit()
    db.refresh(project)
    
    logger.info(f"审计项目更新成功: {project.project_code} - {project.project_name} (更新人: {current_user.username})")
    
    return {
        "code": 200,
        "message": "更新成功",
        "data": {
            "id": project.id,
            "project_code": project.project_code,
            "project_name": project.project_name,
        }
    }


# ==================== 删除审计项目 ====================

@router.delete("/{project_id}")
async def delete_audit_project(
    project_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    删除审计项目
    
    Args:
        project_id: 项目ID
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        删除结果
    """
    # 验证Token
    payload = auth_middleware.decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # 检查权限
    if not current_user or current_user.role not in [UserRole.SUPER_ADMIN, UserRole.AUDIT_DIRECTOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 获取项目
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="审计项目不存在",
        )
    
    # 删除项目（级联删除相关任务和发现）
    db.delete(project)
    db.commit()
    
    logger.info(f"审计项目删除成功: {project.project_code} - {project.project_name} (删除人: {current_user.username})")
    
    return {
        "code": 200,
        "message": "删除成功",
    }


# ========== 审计作业工作流 ==========

@router.put("/{project_id}/phase")
async def update_project_phase(
    project_id: str,
    request: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """推进项目阶段"""
    from app.services.audit_workflow import AuditWorkflowService, ProjectPhase
    
    service = AuditWorkflowService()
    new_phase = ProjectPhase(request.get("phase"))
    
    try:
        result = service.update_phase(project_id, new_phase)
        return {"code": 200, "message": f"阶段已推进到 {new_phase.value}", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{project_id}/overview")
async def get_project_overview(
    project_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """获取项目概览（驾驶舱数据）"""
    from app.services.audit_workflow import AuditWorkflowService
    
    service = AuditWorkflowService()
    overview = service.get_project_overview(project_id)
    
    return {"code": 200, "message": "获取成功", "data": overview}


# ========== 底稿模板 ==========

@router.get("/worksheet-templates")
async def list_worksheet_templates():
    """获取底稿模板列表"""
    from app.services.audit_workflow import AuditWorkflowService
    
    service = AuditWorkflowService()
    templates = service.list_worksheet_templates()
    
    return {"code": 200, "message": "获取成功", "data": templates}


# ========== 报告模板 ==========

@router.get("/report-templates")
async def list_report_templates():
    """获取报告模板列表"""
    from app.services.audit_workflow import AuditWorkflowService
    
    service = AuditWorkflowService()
    templates = service.list_report_templates()
    
    return {"code": 200, "message": "获取成功", "data": templates}


@router.post("/{project_id}/reports")
async def generate_audit_report(
    project_id: str,
    request: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """生成审计报告"""
    from app.services.audit_workflow import AuditWorkflowService
    
    template_id = request.get("template_id", "RPT-001")
    
    service = AuditWorkflowService()
    report = service.generate_report(project_id, template_id, "current_user")
    
    return {"code": 200, "message": "报告生成成功", "data": report}


# ========== 整改闭环 ==========

@router.post("/{project_id}/rectifications")
async def create_rectification(
    project_id: str,
    request: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """创建整改通知单"""
    from app.services.audit_workflow import AuditWorkflowService
    
    finding_id = request.get("finding_id", "")
    
    service = AuditWorkflowService()
    order = service.create_rectification_order(finding_id, request)
    
    return {"code": 200, "message": "整改单已创建", "data": order}
