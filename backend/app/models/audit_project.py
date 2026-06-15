"""
审计项目模型
Audit Project Model
"""

from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, Text, Date, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime, date
from enum import Enum as PyEnum
import uuid

from app.core.database import Base
from app.models.base import SoftDeleteMixin


class AuditType(str, PyEnum):
    """审计类型枚举"""
    FINANCIAL = "financial"           # 财务审计
    COMPLIANCE = "compliance"         # 合规审计
    OPERATIONAL = "operational"       # 运营审计
    IT = "it"                         # IT审计
    SPECIAL = "special"               # 专项审计
    FOLLOW_UP = "follow_up"           # 后续审计
    PROCUREMENT = "procurement"       # 采购审计


class AuditPhase(str, PyEnum):
    """审计阶段枚举"""
    PLANNING = "planning"             # 计划
    NOTIFICATION = "notification"       # 通知
    DATA_COLLECTION = "data_collection"  # 资料收集
    FIELD_WORK = "field_work"           # 现场审计
    WORKSHEET = "worksheet"             # 底稿编写
    REVIEW = "review"                   # 复核
    REPORT = "report"                   # 报告
    ARCHIVE = "archive"                 # 归档


class ProjectStatus(str, PyEnum):
    """项目状态枚举"""
    DRAFT = "draft"                   # 草稿
    IN_PROGRESS = "in_progress"         # 进行中
    COMPLETED = "completed"             # 已完成
    ARCHIVED = "archived"              # 已归档
    CANCELLED = "cancelled"            # 已取消


class AuditProject(Base, SoftDeleteMixin):
    """
    审计项目表模型
    """
    __tablename__ = "audit_projects"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_code = Column(String(50), unique=True, index=True, nullable=False, comment="项目编号")
    project_name = Column(String(200), nullable=False, comment="项目名称")
    
    # 审计类型和阶段
    audit_type = Column(SQLEnum(AuditType), nullable=False, comment="审计类型")
    # 遗留缓存列（由 project_state_service.sync_project_current_phase 自动同步）
    # 外部不应直接写入此列；应通过 PhaseProgress 更新后自动同步
    _current_phase = Column("current_phase", SQLEnum(AuditPhase), default=AuditPhase.PLANNING, comment="当前阶段（缓存，由PhaseProgress派生）")
    status = Column(SQLEnum(ProjectStatus), default=ProjectStatus.DRAFT, comment="项目状态")
    
    # 目标部门
    target_dept_code = Column(String(50), nullable=True, comment="目标部门代码")
    target_dept_name = Column(String(200), nullable=True, comment="目标部门名称")
    
    # 日期
    start_date = Column(Date, nullable=True, comment="开始日期")
    end_date = Column(Date, nullable=True, comment="结束日期")
    actual_end_date = Column(Date, nullable=True, comment="实际结束日期")
    
    # 人员
    project_manager_id = Column(String(36), ForeignKey("users.id"), nullable=True, comment="项目经理ID")
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False, comment="创建人ID")
    
    # 审计目标和范围
    audit_objective = Column(Text, nullable=True, comment="审计目标")
    audit_scope = Column(Text, nullable=True, comment="审计范围")
    audit_criteria = Column(Text, nullable=True, comment="审计依据")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")
    
    # 关系
    project_manager = relationship("User", foreign_keys=[project_manager_id], backref="managed_projects")
    created_by = relationship("User", foreign_keys=[created_by_id], backref="created_projects")
    tasks = relationship("AuditTask", back_populates="project", cascade="save-update, merge")
    findings = relationship("AuditFinding", back_populates="project", cascade="save-update, merge")
    rectification_orders = relationship("RectificationOrder", back_populates="project")

    @property
    def current_phase(self) -> AuditPhase:
        """
        从 PhaseProgress 派生的当前阶段（单一数据源）

        优先读取缓存列 _current_phase，它由 project_state_service 在每次
        PhaseProgress 更新后自动同步。如果缓存未设置（旧数据），fallback 返回 PLANNING。
        外部代码不应直接写入 _current_phase，应通过 PhaseProgress 更新触发同步。
        """
        if self._current_phase:
            return self._current_phase
        return AuditPhase.PLANNING

    @current_phase.setter
    def current_phase(self, value):
        """兼容旧代码的 setter — 实际写入缓存列"""
        self._current_phase = value

    def __repr__(self):
        return f"<AuditProject {self.project_code} - {self.project_name}>"
