"""
审计作业中心模型
Audit Work Center Models
"""

from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, Text, ForeignKey, Float, Integer, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum as PyEnum
import uuid

from app.core.database import Base


class FindingSeverity(str, PyEnum):
    """发现严重程度枚举"""
    HIGH = "high"         # 高
    MEDIUM = "medium"     # 中
    LOW = "low"           # 低


class FindingStatus(str, PyEnum):
    """发现状态枚举"""
    DRAFT = "draft"                 # 草稿
    CONFIRMED = "confirmed"         # 已确认
    PENDING_RECTIFICATION = "pending_rectification"  # 待整改
    RESOLVED = "resolved"           # 已解决
    CLOSED = "closed"              # 已关闭


class TaskStatus(str, PyEnum):
    """任务状态枚举"""
    PENDING = "pending"             # 待处理
    IN_PROGRESS = "in_progress"     # 进行中
    COMPLETED = "completed"         # 已完成
    OVERDUE = "overdue"           # 已逾期
    REJECTED = "rejected"         # 已退回


class WorksheetStatus(str, PyEnum):
    """底稿状态枚举"""
    DRAFT = "draft"                 # 草稿
    SUBMITTED = "submitted"         # 已提交
    UNDER_REVIEW = "under_review"   # 审核中
    APPROVED = "approved"           # 已批准
    REJECTED = "rejected"           # 已退回


class AuditFinding(Base):
    """
    审计发现表
    """
    __tablename__ = "audit_findings"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    finding_id = Column(String(50), unique=True, nullable=False, comment="发现编号")
    
    # 关联项目
    audit_project_id = Column(String(36), ForeignKey("audit_projects.id"), nullable=False, comment="审计项目ID")
    
    # 基本信息
    title = Column(String(500), nullable=False, comment="发现标题")
    description = Column(Text, nullable=False, comment="发现描述")
    
    # 分类
    finding_type = Column(String(100), nullable=True, comment="发现类型")
    severity = Column(SQLEnum(FindingSeverity), default=FindingSeverity.MEDIUM, comment="严重程度")
    status = Column(SQLEnum(FindingStatus), default=FindingStatus.DRAFT, comment="状态")
    
    # 风险评分
    risk_score = Column(Float, nullable=True, comment="风险评分")
    
    # 金额影响
    amount_involved = Column(String(50), nullable=True, comment="涉及金额")
    financial_impact = Column(String(50), nullable=True, comment="财务影响")
    
    # 审计依据
    audit_basis = Column(Text, nullable=True, comment="审计依据")
    
    # 建议
    recommendation = Column(Text, nullable=True, comment="审计建议")
    
    # 责任人
    responsible_person = Column(String(100), nullable=True, comment="责任人")
    responsible_dept = Column(String(100), nullable=True, comment="责任部门")
    
    # 元数据
    discovered_by_id = Column(String(36), ForeignKey("users.id"), nullable=False, comment="发现人ID")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")
    
    # 关系
    project = relationship("AuditProject", back_populates="findings")
    discovered_by = relationship("User", backref="discovered_findings")
    rectification_orders = relationship("RectificationOrder", back_populates="finding")
    worksheets = relationship("AuditWorksheet", back_populates="finding")
    
    def __repr__(self):
        return f"<AuditFinding {self.finding_id} - {self.title}>"


class AuditTask(Base):
    """
    审计任务表
    """
    __tablename__ = "audit_tasks"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String(50), unique=True, nullable=False, comment="任务编号")
    
    # 关联项目
    audit_project_id = Column(String(36), ForeignKey("audit_projects.id"), nullable=False, comment="审计项目ID")
    
    # 基本信息
    task_name = Column(String(500), nullable=False, comment="任务名称")
    task_description = Column(Text, nullable=True, comment="任务描述")
    task_type = Column(String(100), nullable=True, comment="任务类型")
    
    # 状态
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING, comment="状态")
    
    # 人员
    assignee_id = Column(String(36), ForeignKey("users.id"), nullable=True, comment="指派给ID")
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False, comment="创建人ID")
    
    # 时间
    due_date = Column(DateTime(timezone=True), nullable=True, comment="截止日期")
    started_at = Column(DateTime(timezone=True), nullable=True, comment="开始时间")
    completed_at = Column(DateTime(timezone=True), nullable=True, comment="完成时间")
    
    # 优先级
    priority = Column(Integer, default=3, comment="优先级（1-5，1最高）")
    
    # 元数据
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")
    
    # 关系
    project = relationship("AuditProject", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assignee_id], backref="assigned_tasks")
    created_by = relationship("User", foreign_keys=[created_by_id], backref="created_tasks")
    
    def __repr__(self):
        return f"<AuditTask {self.task_id} - {self.task_name}>"


class AuditWorksheet(Base):
    """
    审计底稿表
    """
    __tablename__ = "audit_worksheets"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    worksheet_id = Column(String(50), unique=True, nullable=False, comment="底稿编号")
    
    # 关联
    audit_project_id = Column(String(36), ForeignKey("audit_projects.id"), nullable=False, comment="审计项目ID")
    task_id = Column(String(36), ForeignKey("audit_tasks.id"), nullable=True, comment="任务ID")
    finding_id = Column(String(36), ForeignKey("audit_findings.id"), nullable=True, comment="审计发现ID")
    
    # 基本信息
    worksheet_name = Column(String(500), nullable=False, comment="底稿名称")
    worksheet_type = Column(String(100), nullable=False, comment="底稿类型")
    
    # 状态
    status = Column(SQLEnum(WorksheetStatus), default=WorksheetStatus.DRAFT, comment="状态")
    
    # 内容（JSON格式）
    content = Column(JSON, nullable=True, comment="底稿内容")
    template_id = Column(String(100), nullable=True, comment="模板ID")
    
    # 审核
    reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=True, comment="审核人ID")
    review_comment = Column(Text, nullable=True, comment="审核意见")
    reviewed_at = Column(DateTime(timezone=True), nullable=True, comment="审核时间")
    
    # 人员
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False, comment="创建人ID")
    
    # 元数据
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")
    
    # 关系
    project = relationship("AuditProject", backref="worksheets")
    task = relationship("AuditTask", backref="worksheets")
    finding = relationship("AuditFinding", back_populates="worksheets")
    reviewer = relationship("User", foreign_keys=[reviewer_id], backref="reviewed_worksheets")
    created_by = relationship("User", foreign_keys=[created_by_id], backref="created_worksheets")
    
    def __repr__(self):
        return f"<AuditWorksheet {self.worksheet_id} - {self.worksheet_name}>"
