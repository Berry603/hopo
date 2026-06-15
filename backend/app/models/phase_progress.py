"""
审计项目阶段进度模型
跟踪每个项目在各个审计阶段的进度状态
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, Enum as SQLEnum, UniqueConstraint
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum

from app.core.database import Base


class PhaseStatus(str, PyEnum):
    """阶段状态"""
    PENDING = "pending"          # 待开始
    IN_PROGRESS = "in_progress"  # 进行中
    COMPLETED = "completed"      # 已完成


# 所有阶段代码（按序）
PHASE_CODES = ["00", "01", "02", "03", "04", "05", "06", "99"]


# 阶段依赖关系：前置阶段
PHASE_DEPENDENCIES = {
    "00": [],                    # 立项 - 无前置
    "01": ["00"],                # 制度依据 - 需完成立项
    "02": ["01"],                # 访谈 - 需完成制度依据
    "03": ["02"],                # 收集资料 - 需完成访谈
    "04": ["03"],                # 系统数据 - 需完成资料收集
    "05": ["04"],                # 测试底稿 - 需完成系统数据
    "06": ["05"],                # 报告 - 需完成测试
    "99": ["06"],                # 归档 - 需完成报告
}


class PhaseProgress(Base):
    """阶段进度记录"""
    __tablename__ = "phase_progress"
    __table_args__ = (
        UniqueConstraint("project_id", "stage_code", name="uq_project_stage"),
    )
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("audit_projects.id"), nullable=False, comment="项目ID")
    stage_code = Column(String(4), nullable=False, comment="阶段代码 (00-06,99)")
    status = Column(SQLEnum(PhaseStatus), default=PhaseStatus.PENDING, comment="阶段状态")
    started_at = Column(DateTime(timezone=True), nullable=True, comment="开始时间")
    completed_at = Column(DateTime(timezone=True), nullable=True, comment="完成时间")
    
    # 复核机制
    reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=True, comment="复核人ID")
    review_status = Column(String(20), default="none", comment="复核状态: none/pending/passed/rejected")
    review_comment = Column(Text, nullable=True, comment="复核意见")
    reviewed_at = Column(DateTime(timezone=True), nullable=True, comment="复核时间")
    
    remark = Column(Text, nullable=True, comment="备注")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")
    
    project = relationship("AuditProject", backref="phase_progresses")
    
    def __repr__(self):
        return f"<PhaseProgress {self.stage_code} - {self.status}>"
