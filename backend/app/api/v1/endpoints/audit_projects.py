"""
审计项目管理API端点
Audit Project Management API Endpoints
"""

from fastapi import APIRouter, Body, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from loguru import logger
from typing import List, Optional
from datetime import datetime, date

import uuid

from app.core.database import get_db
from app.core.config import settings
from app.api.v1.deps import get_current_user, require_permission, require_role
from app.services.project_dir_service import create_project_directory
from app.models.audit_project import (
    AuditProject,
    AuditType,
    AuditPhase,
    ProjectStatus,
)
from app.models.evidence_chain import EvidenceLink
from app.models.user import UserRole
from app.schemas import (
    ResponseModel,
    PaginatedResponse,
    AuditProjectCreate,
    AuditProjectUpdate,
)

router = APIRouter()


# ==================== 获取审计项目列表 ====================

@router.get("")
async def get_audit_projects(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    project_code: Optional[str] = Query(None, description="项目编号筛选"),
    project_name: Optional[str] = Query(None, description="项目名称筛选"),
    audit_type: Optional[str] = Query(None, description="审计类型筛选"),
    status: Optional[str] = Query(None, description="项目状态筛选"),
    current_user = Depends(get_current_user),
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
        db: 数据库会话

    Returns:
        审计项目列表
    """
    
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


# ========== 底稿模板 & 报告模板（必须在 /{project_id} 前注册，避免路径冲突）==========

@router.get("/worksheet-templates")
async def list_worksheet_templates():
    """获取底稿模板列表"""
    from app.services.audit_workflow import AuditWorkflowService

    service = AuditWorkflowService()
    templates = service.list_worksheet_templates()

    return {"code": 200, "message": "获取成功", "data": templates}


@router.get("/report-templates")
async def list_report_templates():
    """获取报告模板列表"""
    from app.services.audit_workflow import AuditWorkflowService

    service = AuditWorkflowService()
    templates = service.list_report_templates()

    return {"code": 200, "message": "获取成功", "data": templates}


# ==================== 获取审计项目详情 ====================

@router.get("/{project_id}")
async def get_audit_project(
    project_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取审计项目详情

    Args:
        project_id: 项目ID
        db: 数据库会话

    Returns:
        审计项目详情
    """
    
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
    project_data: AuditProjectCreate,
    current_user = Depends(get_current_user),
    _ = Depends(require_permission("audit:project:manage")),
    db: Session = Depends(get_db),
):
    """
    创建审计项目

    Args:
        project_data: 项目数据
        db: 数据库会话

    Returns:
        创建结果
    """

    # 检查项目编号是否已存在
    if db.query(AuditProject).filter(AuditProject.project_code == project_data.project_code).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="项目编号已存在",
        )

    # 创建新项目
    db_project = AuditProject(
        project_code=project_data.project_code,
        project_name=project_data.project_name,
        audit_type=project_data.audit_type,
        current_phase=AuditPhase.PLANNING,
        status=ProjectStatus.DRAFT,
        target_dept_code=project_data.target_dept_code,
        target_dept_name=project_data.target_dept_name,
        start_date=datetime.strptime(project_data.start_date, "%Y-%m-%d").date() if project_data.start_date else None,
        end_date=datetime.strptime(project_data.end_date, "%Y-%m-%d").date() if project_data.end_date else None,
        project_manager_id=project_data.project_manager_id,
        created_by_id=current_user.id,
        audit_objective=project_data.audit_objective,
        audit_scope=project_data.audit_scope,
        audit_criteria=project_data.audit_criteria,
    )
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    # 确保 PhaseProgress 记录存在并同步 current_phase 缓存
    try:
        from app.api.v1.endpoints.project_files import _ensure_phase_records
        _ensure_phase_records(db_project.id, db)
    except ImportError:
        pass

    # 自动创建项目文件夹结构
    try:
        project_dir = create_project_directory(
            project_code=db_project.project_code,
            project_name=db_project.project_name,
        )
        logger.info(f"项目文件夹已创建: {project_dir}")
    except Exception as e:
        logger.error(f"项目文件夹创建失败 (不影响项目本身): {e}")

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
    project_data: AuditProjectUpdate,
    current_user = Depends(get_current_user),
    _ = Depends(require_permission("audit:project:manage")),
    db: Session = Depends(get_db),
):
    """
    更新审计项目

    Args:
        project_id: 项目ID
        project_data: 项目数据
        db: 数据库会话

    Returns:
        更新结果
    """

    # 获取项目
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="审计项目不存在",
        )

    # 更新项目 — 只更新非 None 字段
    update_data = project_data.model_dump(exclude_unset=True)
    date_fields = ["start_date", "end_date", "actual_end_date"]

    for field, value in update_data.items():
        if field in date_fields and value:
            setattr(project, field, datetime.strptime(value, "%Y-%m-%d").date())
        else:
            setattr(project, field, value)
    
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
    current_user = Depends(get_current_user),
    _ = Depends(require_role("super_admin", "audit_director")),
    db: Session = Depends(get_db),
):
    """
    删除审计项目（软删除 + 级联软删除子记录）

    Args:
        project_id: 项目ID
        db: 数据库会话

    Returns:
        删除结果
    """

    # 获取项目
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="审计项目不存在",
        )

    # 软删除项目
    project.soft_delete(deleted_by_id=current_user.id)

    # 级联软删除子记录
    for task in project.tasks:
        task.soft_delete(deleted_by_id=current_user.id)
    for finding in project.findings:
        finding.soft_delete(deleted_by_id=current_user.id)
    for pp in project.phase_progresses:
        pp.soft_delete(deleted_by_id=current_user.id)
    # 级联软删除底稿
    from app.models.audit import AuditWorksheet
    for worksheet in db.query(AuditWorksheet).filter(AuditWorksheet.audit_project_id == project_id).all():
        worksheet.soft_delete(deleted_by_id=current_user.id)

    db.commit()

    logger.info(f"审计项目软删除成功: {project.project_code} - {project.project_name} (操作人: {current_user.username})")

    return {
        "code": 200,
        "message": "删除成功",
    }


# ========== 审计作业工作流 ==========

@router.put("/{project_id}/phase")
async def update_project_phase(
    project_id: str,
    request: dict = Body(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    推进项目阶段（兼容旧接口）

    接受 stage_code（如 "00"-"99"）或 AuditPhase 值（如 "planning", "field_work"）。
    内部通过 PhaseProgress 统一管理，校验前置依赖。
    """
    from app.services.project_state_service import sync_project_current_phase
    from app.api.v1.endpoints.project_files import _ensure_phase_records, PHASE_CODES
    from app.models.phase_progress import PhaseProgress, PhaseStatus

    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 解析目标阶段：接受 stage_code 或 AuditPhase 值
    phase_input = request.get("phase", "")
    audit_phase_to_stage = {
        "planning": "00", "notification": "01", "data_collection": "03",
        "field_work": "04", "worksheet": "05", "review": "06",
        "report": "06", "archive": "99",
    }

    if phase_input in PHASE_CODES:
        target_stage_code = phase_input
    elif phase_input in audit_phase_to_stage:
        target_stage_code = audit_phase_to_stage[phase_input]
    else:
        valid_values = list(PHASE_CODES) + list(audit_phase_to_stage.keys())
        raise HTTPException(status_code=400, detail=f"无效阶段: {phase_input}，有效值: {valid_values}")

    # 确保 PhaseProgress 记录存在
    _ensure_phase_records(project_id, db)

    # 标记目标阶段及所有前序阶段为已完成（逐级推进）
    stage_order = PHASE_CODES
    target_idx = stage_order.index(target_stage_code)
    for i in range(target_idx + 1):
        code = stage_order[i]
        record = db.query(PhaseProgress).filter(
            PhaseProgress.project_id == project_id,
            PhaseProgress.stage_code == code,
        ).first()
        if record and record.status != PhaseStatus.COMPLETED:
            # 校验前置依赖
            if i > 0:
                deps = [stage_order[i - 1]]
                dep_records = db.query(PhaseProgress).filter(
                    PhaseProgress.project_id == project_id,
                    PhaseProgress.stage_code.in_(deps),
                ).all()
                if not all(d.status == PhaseStatus.COMPLETED for d in dep_records):
                    raise HTTPException(
                        status_code=400,
                        detail=f"前置阶段未完成，请先完成前置阶段再推进到 {code}",
                    )
            record.status = PhaseStatus.COMPLETED
            if not record.completed_at:
                record.completed_at = datetime.now(timezone.utc)
            if not record.started_at:
                record.started_at = datetime.now(timezone.utc)

    # 将目标阶段设为 IN_PROGRESS（除非目标已全部完成则启动下一阶段）
    if target_stage_code != "99":
        target_record = db.query(PhaseProgress).filter(
            PhaseProgress.project_id == project_id,
            PhaseProgress.stage_code == target_stage_code,
        ).first()
        if target_record and target_record.status == PhaseStatus.COMPLETED:
            if target_idx < len(stage_order) - 1:
                next_code = stage_order[target_idx + 1]
                next_rec = db.query(PhaseProgress).filter(
                    PhaseProgress.project_id == project_id,
                    PhaseProgress.stage_code == next_code,
                ).first()
                if next_rec and next_rec.status == PhaseStatus.PENDING:
                    next_rec.status = PhaseStatus.IN_PROGRESS
                    next_rec.started_at = datetime.now(timezone.utc)

    # 更新项目状态
    if project.status == ProjectStatus.DRAFT or project.status == "draft":
        project.status = ProjectStatus.IN_PROGRESS
    if target_stage_code == "99":
        project.status = ProjectStatus.COMPLETED

    db.commit()
    db.refresh(project)

    # 同步 current_phase 缓存
    sync_project_current_phase(project_id, db)
    db.commit()

    return {
        "code": 200,
        "message": "项目阶段已更新",
        "data": {
            "project_id": project_id,
            "stage_code": target_stage_code,
            "phase": project._current_phase,
            "status": project.status.value if hasattr(project.status, 'value') else project.status,
        }
    }


@router.get("/{project_id}/overview")
async def get_project_overview(
    project_id: str,
    current_user = Depends(get_current_user),
):
    """获取项目概览（驾驶舱数据）"""
    from app.services.audit_workflow import AuditWorkflowService
    
    service = AuditWorkflowService()
    overview = service.get_project_overview(project_id)
    
    return {"code": 200, "message": "获取成功", "data": overview}





@router.post("/{project_id}/reports")
async def generate_audit_report(
    project_id: str,
    request: dict = Body(...),
    current_user = Depends(get_current_user),
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
    request: dict = Body(...),
    current_user = Depends(get_current_user),
):
    """创建整改通知单"""
    from app.services.audit_workflow import AuditWorkflowService

    finding_id = request.get("finding_id", "")

    service = AuditWorkflowService()
    try:
        order = service.create_rectification_order(finding_id, request)
        return {"code": 200, "message": "整改单已创建", "data": order}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 审计发现管理 ====================

@router.get("/{project_id}/findings")
async def get_project_findings(
    project_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取项目的审计发现列表（含证据链计数）"""
    from app.models.audit import AuditFinding

    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    findings = db.query(AuditFinding).filter(
        AuditFinding.audit_project_id == project_id
    ).order_by(AuditFinding.created_at.desc()).all()

    result = []
    for f in findings:
        evidence_count = db.query(EvidenceLink).filter(
            EvidenceLink.finding_id == f.id
        ).count() if hasattr(f, 'evidence_links') else 0
        result.append({
            "id": f.id,
            "finding_id": f.finding_id,
            "title": f.title,
            "description": f.description,
            "finding_type": f.finding_type,
            "severity": f.severity.value if hasattr(f.severity, 'value') else f.severity,
            "status": f.status.value if hasattr(f.status, 'value') else f.status,
            "risk_score": f.risk_score,
            "amount_involved": f.amount_involved,
            "responsible_dept": f.responsible_dept,
            "responsible_person": f.responsible_person,
            "source_alert_id": f.source_alert_id,
            "evidence_count": evidence_count or len(f.evidence_links) if f.evidence_links else 0,
            "recommendation": f.recommendation,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })

    return {"code": 200, "message": "获取成功", "data": result}


@router.post("/findings/from-alert")
async def create_finding_from_alert(
    request: dict = Body(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """将风险预警转换为审计发现"""
    from app.services.audit_finding_service import AuditFindingService

    alert_id = request.get("alert_id")
    project_id = request.get("project_id")

    if not alert_id or not project_id:
        raise HTTPException(status_code=400, detail="alert_id 和 project_id 为必填项")

    try:
        finding = AuditFindingService.convert_alert_to_finding(
            alert_id=alert_id,
            project_id=project_id,
            user_id=current_user.id,
            db=db,
        )
        return {
            "code": 200,
            "message": f"审计发现 {finding.finding_id} 已创建",
            "data": {
                "id": finding.id,
                "finding_id": finding.finding_id,
                "title": finding.title,
                "severity": finding.severity.value if hasattr(finding.severity, 'value') else finding.severity,
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{project_id}/findings/auto-generate")
async def auto_generate_findings(
    project_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """自动为项目批量生成审计发现（从关联预警）"""
    from app.services.audit_finding_service import AuditFindingService

    try:
        findings = AuditFindingService.auto_generate_findings_for_project(
            project_id=project_id,
            user_id=current_user.id,
            db=db,
        )
        return {
            "code": 200,
            "message": f"已自动生成 {len(findings)} 条审计发现",
            "data": [{"id": f.id, "finding_id": f.finding_id, "title": f.title} for f in findings],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 证据链管理 ====================

@router.get("/findings/{finding_id}/evidence")
async def get_evidence_chain(
    finding_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取审计发现的证据链"""
    from app.services.audit_finding_service import AuditFindingService

    try:
        evidence_links = AuditFindingService.get_evidence_chain(finding_id, db)
        result = []
        for e in evidence_links:
            result.append({
                "id": e.id,
                "source_type": e.source_type,
                "source_id": e.source_id,
                "evidence_description": e.evidence_description,
                "evidence_data": e.evidence_data,
                "procedure_execution_id": e.procedure_execution_id,
                "procedure_row_index": e.procedure_row_index,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            })
        return {"code": 200, "message": "获取成功", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/findings/{finding_id}/evidence")
async def add_evidence_link(
    finding_id: str,
    request: dict = Body(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """添加证据链关联"""
    from app.services.audit_finding_service import AuditFindingService

    source_type = request.get("source_type", "manual")
    source_id = request.get("source_id", "")
    description = request.get("description", "")
    evidence_data = request.get("evidence_data")
    procedure_execution_id = request.get("procedure_execution_id")
    procedure_row_index = request.get("procedure_row_index")

    try:
        evidence = AuditFindingService.add_manual_evidence(
            finding_id=finding_id,
            source_type=source_type,
            source_id=source_id or str(uuid.uuid4()),
            description=description,
            evidence_data=evidence_data,
            user_id=current_user.id,
            db=db,
        )
        # 如果有穿行测试关联，更新
        if procedure_execution_id is not None:
            evidence.procedure_execution_id = procedure_execution_id
            evidence.procedure_row_index = procedure_row_index
            db.commit()

        return {"code": 200, "message": "证据已关联", "data": {"id": evidence.id}}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
