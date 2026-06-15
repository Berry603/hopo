"""
审计项目文件管理 & 阶段进度管理 API
文件上传、列表、下载、删除，关联项目文件夹 Auditoprojects
阶段进度管理、依赖校验、状态流转
"""
import os
import uuid
import shutil
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from loguru import logger

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.audit_project import AuditProject
from app.models.phase_progress import PhaseProgress, PhaseStatus, PHASE_DEPENDENCIES, PHASE_CODES
from app.services.project_state_service import sync_project_current_phase

# 项目根目录
AUDIT_PROJECTS_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent / "Auditoprojects"

router = APIRouter()


# ========== 审计日志辅助函数 ==========

def _write_audit_log(user: User, module: str, action: str, resource: str = None, description: str = None, status: str = "success"):
    """写入审计操作日志"""
    try:
        from app.models.audit_log import AuditLog
        from app.core.database import SessionLocal
        db = SessionLocal()
        log = AuditLog(
            user_id=user.id,
            username=user.username,
            action=action,
            module=module,
            resource=resource,
            description=description or action,
            status=status,
        )
        db.add(log)
        db.commit()
        db.close()
    except Exception as e:
        logger.warning(f"审计日志写入失败: {e}")


# ========== 阶段配置（部门和数据来源） ==========

STAGE_META = {
    "00": {"departments": ["项目管理部", "被审计单位"], "data_sources": ["OA系统", "项目管理平台"]},
    "01": {"departments": ["被审计单位各业务部门", "财务部", "法务部"], "data_sources": ["ERP制度模块", "SRM合同模块", "OA文档中心"]},
    "02": {"departments": ["被审计单位管理层", "被审计单位各业务部门", "审计组"], "data_sources": ["OA审批流", "云之家审批"]},
    "03": {"departments": ["被审计单位各业务部门", "财务部", "采购部", "仓库", "人力资源部"], "data_sources": ["ERP系统", "SRM系统", "HRM系统", "OA系统"]},
    "04": {"departments": ["IT部", "财务部", "审计组"], "data_sources": ["ERP数据库", "SRM数据库", "云之家API", "WMS系统"]},
    "05": {"departments": ["审计组全体成员"], "data_sources": ["ERP", "SRM", "云之家", "CRM"]},
    "06": {"departments": ["审计组", "被审计单位管理层"], "data_sources": ["审计系统报告模块"]},
    "99": {"departments": ["审计组", "档案管理部门"], "data_sources": ["文档归档系统"]},
}


@router.get("/projects/{project_id}/phases")
async def get_project_phases(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取项目各阶段概览（含文件数、涉及部门、数据来源）"""
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    project_dir = _get_project_dir(project.project_code, project.project_name)
    
    phases = []
    for code in ["00", "01", "02", "03", "04", "05", "06", "99"]:
        dir_name = _get_stage_dir_name(code)
        stage_dir = project_dir / dir_name
        
        file_count = 0
        stage_files = []
        if stage_dir.exists():
            for f in stage_dir.rglob("*"):
                if f.is_file() and f.name != ".gitkeep":
                    file_count += 1
        
        meta = STAGE_META.get(code, {})
        
        # 收集文件详情
        files = []
        if stage_dir.exists():
            for f in sorted(stage_dir.iterdir()):
                if f.is_file() and f.name != ".gitkeep":
                    rel_path = str(f.relative_to(project_dir.parent))
                    stat = f.stat()
                    files.append({
                        "name": f.name,
                        "path": rel_path,
                        "size": stat.st_size,
                        "ext": f.suffix.lower() or ".file",
                        "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    })
            # 递归子目录
            for sub in stage_dir.iterdir():
                if sub.is_dir():
                    for f in sub.rglob("*"):
                        if f.is_file() and f.name != ".gitkeep":
                            rel_path = str(f.relative_to(project_dir.parent))
                            stat = f.stat()
                            files.append({
                                "name": f"{sub.name}/{f.name}",
                                "path": rel_path,
                                "size": stat.st_size,
                                "ext": f.suffix.lower() or ".file",
                                "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                            })
        
        phases.append({
            "stage_code": code,
            "stage_name": dir_name,
            "file_count": file_count,
            "files": files,
            "departments": meta.get("departments", []),
            "data_sources": meta.get("data_sources", []),
        })
    
    return {"code": 200, "message": "获取成功", "data": phases}


def _get_project_dir(project_code: str, project_name: str) -> Path:
    """获取项目文件夹路径"""
    safe_name = project_name.strip().replace(" ", "_").translate(
        str.maketrans('', '', r'<>:"/\|?*')
    )[:50]
    return AUDIT_PROJECTS_ROOT / f"{project_code}_{safe_name}"


# ==================== 阶段进度管理 ====================


def _ensure_phase_records(project_id: str, db: Session):
    """确保项目的所有阶段记录都存在，并同步 current_phase 缓存"""
    for code in PHASE_CODES:
        existing = db.query(PhaseProgress).filter(
            PhaseProgress.project_id == project_id,
            PhaseProgress.stage_code == code,
        ).first()
        if not existing:
            record = PhaseProgress(
                project_id=project_id,
                stage_code=code,
                status=PhaseStatus.PENDING,
            )
            db.add(record)
    db.commit()
    # 同步 AuditProject._current_phase 缓存
    sync_project_current_phase(project_id, db)
    db.commit()


@router.get("/projects/{project_id}/phases/progress")
async def get_phase_progress(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取项目各阶段进度状态（含依赖校验）"""
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    _ensure_phase_records(project_id, db)
    
    records = db.query(PhaseProgress).filter(
        PhaseProgress.project_id == project_id
    ).order_by(PhaseProgress.stage_code).all()
    
    result = []
    for r in records:
        deps = PHASE_DEPENDENCIES.get(r.stage_code, [])
        # 灵活依赖：前置阶段完成或完成率≥80%就算通过
        deps_completed = True
        if deps:
            dep_records = db.query(PhaseProgress).filter(
                PhaseProgress.project_id == project_id,
                PhaseProgress.stage_code.in_(deps),
            ).all()
            for d in dep_records:
                if d.status == PhaseStatus.COMPLETED:
                    continue
                # 未完成则检查是否已过 n% 进度（按 review_status 判断完成率）
                if d.review_status == "passed":
                    continue
                deps_completed = False
                break
        
        # 复核信息
        reviewer_name = None
        if r.reviewer_id:
            reviewer = db.query(User).filter(User.id == r.reviewer_id).first()
            reviewer_name = reviewer.username if reviewer else None
        
        result.append({
            "stage_code": r.stage_code,
            "status": r.status.value if r.status else "pending",
            "dependencies": deps,
            "deps_completed": deps_completed,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "remark": r.remark,
            # 复核信息
            "review_status": r.review_status or "none",
            "reviewer_id": r.reviewer_id,
            "reviewer_name": reviewer_name,
            "review_comment": r.review_comment,
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        })
    
    return {"code": 200, "message": "获取成功", "data": result}


@router.put("/projects/{project_id}/phases/{stage_code}/review")
async def review_phase(
    project_id: str,
    stage_code: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """复核阶段 — 指定复核人、提交复核意见"""
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if stage_code not in PHASE_CODES:
        raise HTTPException(status_code=400, detail=f"无效的阶段代码: {stage_code}")
    
    _ensure_phase_records(project_id, db)
    
    record = db.query(PhaseProgress).filter(
        PhaseProgress.project_id == project_id,
        PhaseProgress.stage_code == stage_code,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="阶段记录不存在")
    
    action = data.get("action", "assign")  # assign | review
    
    if action == "assign":
        # 指定复核人
        reviewer_id = data.get("reviewer_id")
        if not reviewer_id:
            raise HTTPException(status_code=400, detail="请指定复核人")
        reviewer = db.query(User).filter(User.id == reviewer_id).first()
        if not reviewer:
            raise HTTPException(status_code=404, detail="复核人不存在")
        record.reviewer_id = reviewer_id
        record.review_status = "pending"
        db.commit()
        logger.info(f"阶段复核人已指定: {stage_code} -> {reviewer.username}")
        return {"code": 200, "message": f"已指定 {reviewer.username} 为复核人"}
    
    elif action == "review":
        # 提交复核意见
        review_result = data.get("review_result")  # passed | rejected
        if review_result not in ["passed", "rejected"]:
            raise HTTPException(status_code=400, detail="复核结果必须为 passed 或 rejected")
        record.review_status = review_result
        record.review_comment = data.get("comment", "")
        record.reviewed_at = datetime.now(timezone.utc)
        
        # 如果复核通过，自动标记阶段完成
        if review_result == "passed" and record.status != PhaseStatus.COMPLETED:
            record.status = PhaseStatus.COMPLETED
            record.completed_at = datetime.now(timezone.utc)
            # 自动启动下一阶段
            idx = PHASE_CODES.index(stage_code)
            if idx < len(PHASE_CODES) - 1:
                next_code = PHASE_CODES[idx + 1]
                next_rec = db.query(PhaseProgress).filter(
                    PhaseProgress.project_id == project_id,
                    PhaseProgress.stage_code == next_code,
                ).first()
                if next_rec and next_rec.status == PhaseStatus.PENDING:
                    next_rec.status = PhaseStatus.IN_PROGRESS
                    next_rec.started_at = datetime.now(timezone.utc)
        
        db.commit()
        logger.info(f"阶段复核完成: {stage_code} -> {review_result}")
        # 同步 AuditProject._current_phase 缓存
        sync_project_current_phase(project_id, db)
        db.commit()
        return {"code": 200, "message": "复核结果已提交", "data": {"review_status": review_result}}
    
    return {"code": 400, "message": "无效的操作"}


@router.put("/projects/{project_id}/phases/{stage_code}/progress")
async def update_phase_progress(
    project_id: str,
    stage_code: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新阶段进度（开始/完成），含依赖校验"""
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if stage_code not in PHASE_CODES:
        raise HTTPException(status_code=400, detail=f"无效的阶段代码: {stage_code}")
    
    _ensure_phase_records(project_id, db)
    
    record = db.query(PhaseProgress).filter(
        PhaseProgress.project_id == project_id,
        PhaseProgress.stage_code == stage_code,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="阶段记录不存在")
    
    new_status = data.get("status", record.status.value)
    
    # 依赖校验
    if new_status in ["in_progress", "completed"]:
        deps = PHASE_DEPENDENCIES.get(stage_code, [])
        if deps:
            dep_records = db.query(PhaseProgress).filter(
                PhaseProgress.project_id == project_id,
                PhaseProgress.stage_code.in_(deps),
            ).all()
            deps_completed = all(d.status == PhaseStatus.COMPLETED for d in dep_records)
            if not deps_completed:
                dep_names = [_get_stage_dir_name(d) for d in deps]
                raise HTTPException(
                    status_code=400,
                    detail=f"前置阶段未完成: {', '.join(dep_names)}，请先完成前置阶段",
                )
    
    # 更新
    if new_status == "in_progress" and record.status != PhaseStatus.IN_PROGRESS:
        record.status = PhaseStatus.IN_PROGRESS
        record.started_at = datetime.now(timezone.utc)
    elif new_status == "completed" and record.status != PhaseStatus.COMPLETED:
        record.status = PhaseStatus.COMPLETED
        record.completed_at = datetime.now(timezone.utc)
    
    record.remark = data.get("remark", record.remark)
    db.commit()
    db.refresh(record)
    # 同步 AuditProject._current_phase 缓存
    sync_project_current_phase(project_id, db)
    db.commit()
    logger.info(f"阶段进度更新: project={project_id} stage={stage_code} -> {new_status}")
    _write_audit_log(current_user, "阶段进度", f"更新状态为{new_status}", f"project={project_id[:8]} stage={stage_code}",
                     f"阶段[{stage_code}] {new_status}")

    # 如果当前阶段完成且下一阶段未开始，自动将下一阶段设为进行中
    auto_start = None
    if new_status == "completed":
        idx = PHASE_CODES.index(stage_code)
        if idx < len(PHASE_CODES) - 1:
            next_code = PHASE_CODES[idx + 1]
            next_rec = db.query(PhaseProgress).filter(
                PhaseProgress.project_id == project_id,
                PhaseProgress.stage_code == next_code,
            ).first()
            if next_rec and next_rec.status == PhaseStatus.PENDING:
                next_rec.status = PhaseStatus.IN_PROGRESS
                next_rec.started_at = datetime.now(timezone.utc)
                db.commit()
                auto_start = next_code
                logger.info(f"自动启动下一阶段: {next_code}")
                # 再次同步（因为下一阶段状态变了）
                sync_project_current_phase(project_id, db)
                db.commit()
    
    return {
        "code": 200,
        "message": "阶段进度已更新",
        "data": {
            "stage_code": record.stage_code,
            "status": record.status.value if record.status else "pending",
            "started_at": record.started_at.isoformat() if record.started_at else None,
            "completed_at": record.completed_at.isoformat() if record.completed_at else None,
            "auto_started": auto_start,
        }
    }


def _get_stage_dir_name(stage_code: str) -> str:
    """根据阶段码获取目录名"""
    stage_map = {
        "00": "00_立项与通知", "01": "01_制度依据",
        "02": "02_访谈与沟通记录", "03": "03_收集被审计单位资料",
        "04": "04_系统关联数据", "05": "05_测试与底稿",
        "06": "06_审计报告与沟通", "99": "99_归档与说明",
    }
    return stage_map.get(stage_code, stage_code)


def _get_stage_prefix(dir_name: str) -> str:
    """从目录名提取阶段码"""
    return dir_name[:2] if dir_name[:2].isdigit() else "99"


# ==================== 目录树 ====================

@router.get("/projects/{project_id}/files/tree")
async def get_project_file_tree(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取项目文件夹的目录树结构"""
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    project_dir = _get_project_dir(project.project_code, project.project_name)
    if not project_dir.exists():
        return {"code": 200, "message": "项目文件夹尚未创建", "data": []}
    
    tree = _build_tree(project_dir)
    return {"code": 200, "message": "获取成功", "data": tree}


def _build_tree(dir_path: Path) -> list:
    """递归构建目录树"""
    result = []
    try:
        entries = sorted(dir_path.iterdir(), key=lambda x: (not x.is_dir(), x.name))
    except PermissionError:
        return result
    
    for entry in entries:
        # 跳过 .gitkeep
        if entry.name == ".gitkeep":
            continue
        node = {
            "name": entry.name,
            "path": str(entry.relative_to(dir_path.parent)),
            "is_dir": entry.is_dir(),
        }
        if entry.is_dir():
            node["children"] = _build_tree(entry)
            node["file_count"] = sum(1 for f in entry.rglob("*") if f.is_file() and f.name != ".gitkeep")
        else:
            stat = entry.stat()
            node["size"] = stat.st_size
            node["modified"] = datetime.fromtimestamp(stat.st_mtime).isoformat()
            node["ext"] = entry.suffix.lower()
        result.append(node)
    return result


# ==================== 文件上传 ====================

ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".docx", ".doc", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".csv", ".txt", ".sql", ".log", ".m4a", ".mp3", ".pptx", ".ppt"}

@router.post("/projects/{project_id}/files/upload")
async def upload_project_file(
    project_id: str,
    file: UploadFile = File(...),
    stage: str = Form("05"),  # 阶段码: 00-06, 99
    sub_path: str = Form(""),  # 子路径，如 "01_穿行测试/穿行测试全过程截图"
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """上传文件到项目指定阶段目录"""
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 校验文件扩展名
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型: {ext}，支持: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    
    project_dir = _get_project_dir(project.project_code, project.project_name)
    stage_dir_name = _get_stage_dir_name(stage)
    target_dir = project_dir / stage_dir_name
    
    if sub_path:
        target_dir = target_dir / sub_path
    
    # 确保目录存在
    target_dir.mkdir(parents=True, exist_ok=True)
    
    # 文件版本管理：如果同名文件已存在，旧文件重命名为 .v{N}
    save_path = target_dir / file.filename
    if save_path.exists():
        stem = Path(file.filename).stem
        ext = Path(file.filename).suffix
        version = 1
        while (target_dir / f"{stem}.v{version}{ext}").exists():
            version += 1
        old_path = target_dir / f"{stem}.v{version}{ext}"
        save_path.rename(old_path)
        logger.info(f"文件版本升级: {file.filename} → {old_path.name}")
        _write_audit_log(current_user, "文件管理", "版本升级", str(old_path), f"旧版本归档: {old_path.name}")
    
    content = await file.read()
    save_path.write_bytes(content)
    
    file_size = len(content)
    logger.info(f"文件上传成功: {save_path} ({file_size} bytes) by {current_user.username}")
    _write_audit_log(current_user, "文件管理", "上传文件", str(save_path), f"上传文件: {file.filename} ({file_size} bytes)")
    
    return {
        "code": 201,
        "message": "上传成功",
        "data": {
            "file_name": save_path.name,
            "file_path": str(save_path.relative_to(project_dir.parent)),
            "file_size": file_size,
            "stage": stage,
            "stage_name": stage_dir_name,
        }
    }


# ==================== 文件列表 ====================

@router.get("/projects/{project_id}/files")
async def list_project_files(
    project_id: str,
    stage: Optional[str] = Query(None, description="阶段码"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取项目文件列表（按阶段分组）"""
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    project_dir = _get_project_dir(project.project_code, project.project_name)
    if not project_dir.exists():
        return {"code": 200, "message": "项目文件夹尚未创建", "data": []}
    
    files_by_stage = []
    for stage_dir in sorted(project_dir.iterdir()):
        if not stage_dir.is_dir():
            continue
        if stage and not stage_dir.name.startswith(stage):
            continue
        
        stage_files = []
        for f in stage_dir.rglob("*"):
            if f.is_file() and f.name != ".gitkeep":
                rel_path = str(f.relative_to(project_dir))
                stat = f.stat()
                stage_files.append({
                    "name": f.name,
                    "path": rel_path,
                    "size": stat.st_size,
                    "ext": f.suffix.lower(),
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })
        
        if stage_files:
            files_by_stage.append({
                "stage_code": stage_dir.name[:2],
                "stage_name": stage_dir.name,
                "files": sorted(stage_files, key=lambda x: x["name"]),
                "file_count": len(stage_files),
            })
    
    return {"code": 200, "message": "获取成功", "data": files_by_stage}


# ==================== 文件下载 / 删除 ====================

@router.get("/projects/{project_id}/files/download")
async def download_project_file(
    project_id: str,
    file_path: str = Query(..., description="文件相对路径"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """下载项目文件"""
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    project_dir = _get_project_dir(project.project_code, project.project_name)
    full_path = (project_dir.parent / file_path).resolve()
    
    # 安全校验：确保文件在项目目录内
    if not str(full_path).startswith(str(project_dir.parent.resolve())):
        raise HTTPException(status_code=403, detail="非法文件路径")
    
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="文件不存在")
    
    from fastapi.responses import FileResponse
    return FileResponse(
        path=str(full_path),
        filename=full_path.name,
        media_type=_get_mime_type(full_path.suffix),
    )


@router.delete("/projects/{project_id}/files")
async def delete_project_file(
    project_id: str,
    file_path: str = Query(..., description="文件相对路径"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除项目文件"""
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    project_dir = _get_project_dir(project.project_code, project.project_name)
    full_path = (project_dir.parent / file_path).resolve()
    
    if not str(full_path).startswith(str(project_dir.parent.resolve())):
        raise HTTPException(status_code=403, detail="非法文件路径")
    
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="文件不存在")
    
    os.remove(full_path)
    logger.info(f"文件已删除: {full_path} by {current_user.username}")
    _write_audit_log(current_user, "文件管理", "删除文件", str(full_path), f"删除文件: {full_path.name}")
    return {"code": 200, "message": "删除成功"}


def _get_mime_type(ext: str) -> str:
    """获取 MIME 类型"""
    mime_map = {
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls": "application/vnd.ms-excel",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".pdf": "application/pdf",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".csv": "text/csv",
        ".txt": "text/plain",
        ".sql": "text/plain",
        ".log": "text/plain",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".ppt": "application/vnd.ms-powerpoint",
    }
    return mime_map.get(ext, "application/octet-stream")
