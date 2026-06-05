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


class AuditType(str, PyEnum):
    """审计类型枚举"""
    FINANCIAL = "financial"           # 财务审计
    COMPLIANCE = "compliance"         # 合规审计
    OPERATIONAL = "operational"       # 运营审计
    IT = "it"                         # IT审计
    SPECIAL = "special"               # 专项审计
    FOLLOW_UP = "follow_up"           # 后续审计


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


class AuditProject(Base):
    """
    审计项目表模型
    """
    __tablename__ = "audit_projects"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_code = Column(String(50), unique=True, index=True, nullable=False, comment="项目编号")
    project_name = Column(String(200), nullable=False, comment="项目名称")
    
    # 审计类型和阶段
    audit_type = Column(SQLEnum(AuditType), nullable=False, comment="审计类型")
    current_phase = Column(SQLEnum(AuditPhase), default=AuditPhase.PLANNING, comment="当前阶段")
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
    tasks = relationship("AuditTask", back_populates="project", cascade="all, delete-orphan")
    findings = relationship("AuditFinding", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<AuditProject {self.project_code} - {self.project_name}>"
