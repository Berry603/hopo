"""
项目阶段状态服务
Project State Service

统一阶段管理 —— PhaseProgress 为唯一数据源
通过此服务同步 AuditProject._current_phase（遗留缓存列）
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from loguru import logger

from app.models.phase_progress import PhaseProgress, PhaseStatus, PHASE_CODES, PHASE_DEPENDENCIES
from app.models.audit_project import AuditProject, AuditPhase


# stage_code → AuditPhase 映射（与前端保持一致）
STAGE_TO_AUDIT_PHASE = {
    "00": AuditPhase.PLANNING,
    "01": AuditPhase.NOTIFICATION,
    "02": AuditPhase.NOTIFICATION,       # 访谈 → 通知阶段
    "03": AuditPhase.DATA_COLLECTION,
    "04": AuditPhase.FIELD_WORK,
    "05": AuditPhase.WORKSHEET,
    "06": AuditPhase.REPORT,
    "99": AuditPhase.ARCHIVE,
}

# 粗粒度阶段分组（用于兼容旧的6阶段 ProjectPhase 视角）
STAGE_TO_BROAD_PHASE = {
    "00": "init",
    "01": "planning",
    "02": "planning",
    "03": "fieldwork",
    "04": "fieldwork",
    "05": "fieldwork",
    "06": "reporting",
    "99": "closed",
}

# 粗粒度阶段顺序（用于进度计算）
BROAD_PHASE_ORDER = ["init", "planning", "fieldwork", "reporting", "review", "closed"]


def get_current_stage_code(project_id: str, db: Session) -> str:
    """
    从 PhaseProgress 记录推导当前阶段码

    优先级：
    1. 最高序号的 IN_PROGRESS 阶段
    2. 序号最低的 PENDING 阶段
    3. "99"（全部完成）
    4. "00"（无记录时默认）
    """
    records = db.query(PhaseProgress).filter(
        PhaseProgress.project_id == project_id
    ).order_by(PhaseProgress.stage_code).all()

    if not records:
        return "00"

    in_progress = None
    first_pending = None

    for r in records:
        if r.status == PhaseStatus.IN_PROGRESS:
            in_progress = r.stage_code
        if r.status == PhaseStatus.PENDING and first_pending is None:
            first_pending = r.stage_code

    # 优先返回进行中的阶段
    if in_progress:
        return in_progress

    # 其次返回最早的待开始阶段
    if first_pending:
        return first_pending

    # 如果全部完成，返回最后阶段
    if all(r.status == PhaseStatus.COMPLETED for r in records):
        return "99"

    return "00"


def get_current_audit_phase(project_id: str, db: Session) -> AuditPhase:
    """从 PhaseProgress 推导当前 AuditPhase"""
    stage_code = get_current_stage_code(project_id, db)
    return STAGE_TO_AUDIT_PHASE.get(stage_code, AuditPhase.PLANNING)


def get_broad_phase(project_id: str, db: Session) -> str:
    """获取粗粒度阶段名（兼容旧 6-stage 视角）"""
    stage_code = get_current_stage_code(project_id, db)
    return STAGE_TO_BROAD_PHASE.get(stage_code, "init")


def get_progress_percent(project_id: str, db: Session) -> int:
    """
    基于 PhaseProgress 计算项目进度百分比
    按粗粒度阶段序号计算
    """
    broad = get_broad_phase(project_id, db)
    try:
        idx = BROAD_PHASE_ORDER.index(broad)
    except ValueError:
        idx = 0
    total = len(BROAD_PHASE_ORDER) - 1
    return round(idx / total * 100) if total > 0 else 0


def sync_project_current_phase(project_id: str, db: Session) -> Optional[AuditPhase]:
    """
    同步 AuditProject._current_phase 缓存列到与 PhaseProgress 一致

    在每次 PhaseProgress 更新后调用此函数。
    返回更新后的 AuditPhase 或 None（项目不存在时）
    """
    project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
    if not project:
        logger.warning(f"sync_project_current_phase: 项目不存在 {project_id}")
        return None

    phase = get_current_audit_phase(project_id, db)
    project._current_phase = phase.value if phase else AuditPhase.PLANNING.value
    logger.debug(f"[PhaseSync] 项目 {project_id[:8]}: current_phase → {phase.value}")
    return phase


def validate_phase_transition(project_id: str, target_stage_code: str, db: Session) -> bool:
    """
    校验阶段推进是否合法 —— 检查所有前置阶段是否已完成

    返回 True 表示可以推进，False 表示前置未完成时会抛出 HTTPException
    """
    from fastapi import HTTPException

    deps = PHASE_DEPENDENCIES.get(target_stage_code, [])
    if not deps:
        return True

    dep_records = db.query(PhaseProgress).filter(
        PhaseProgress.project_id == project_id,
        PhaseProgress.stage_code.in_(deps),
    ).all()

    deps_completed = all(d.status == PhaseStatus.COMPLETED for d in dep_records)
    if not deps_completed:
        dep_names = []
        for d in deps:
            stage_map = {
                "00": "立项", "01": "制度依据", "02": "访谈与沟通",
                "03": "收集资料", "04": "系统关联数据",
                "05": "测试与底稿", "06": "报告与沟通", "99": "归档",
            }
            dep_names.append(stage_map.get(d, d))
        raise HTTPException(
            status_code=400,
            detail=f"前置阶段未完成: {', '.join(dep_names)}，请先完成前置阶段",
        )

    return True
