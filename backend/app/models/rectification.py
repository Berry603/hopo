"""
整改跟踪模型
Rectification Tracking Model
"""

from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, Text, Date, ForeignKey, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime, date
from enum import Enum as PyEnum
import uuid

from app.core.database import Base


class OrderStatus(str, PyEnum):
    """工单状态枚举"""
    PENDING = "pending"               # 待整改
    IN_PROGRESS = "in_progress"       # 整改中
    SUBMITTED = "submitted"           # 已提交
    VERIFIED = "verified"             # 已验证
    REJECTED = "rejected"             # 退回重改
    ARCHIVED = "archived"             # 已归档


class RectificationOrder(Base):
    """
    整改工单表
    """
    __tablename__ = "rectification_orders"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(50), unique=True, nullable=False, comment="工单编号")
    
    # 关联审计发现
    finding_id = Column(String(36), ForeignKey("audit_findings.id"), nullable=False, comment="审计发现ID")
    audit_project_id = Column(String(36), ForeignKey("audit_projects.id"), nullable=False, comment="审计项目ID")
    
    # 基本信息
    title = Column(String(500), nullable=False, comment="整改标题")
    description = Column(Text, nullable=True, comment="整改描述")
    risk_level = Column(String(10), nullable=False, comment="风险等级")
    
    # 金额（可选）
    amount_involved = Column(String(50), nullable=True, comment="涉及金额")
    
    # 责任信息
    responsible_dept_id = Column(String(50), nullable=False, comment="责任部门ID")
    responsible_dept_name = Column(String(200), nullable=False, comment="责任部门名称")
    responsible_person_id = Column(String(100), nullable=False, comment="责任人ID")
    responsible_person_name = Column(String(100), nullable=True, comment="责任人姓名")
    
    # 时间计划
    suggested_deadline_days = Column(Integer, default=30, comment="建议整改天数")
    deadline = Column(Date, nullable=False, comment="截止日期")
    
    # 状态
    status = Column(SQLEnum(OrderStatus), default=OrderStatus.PENDING, comment="状态")
    escalated_level = Column(Integer, default=0, comment="升级级别")
    
    # 云之家OA集成
    yzj_oa_ticket_id = Column(String(100), nullable=True, comment="云之家OA工单ID")
    yzj_sync_status = Column(String(20), nullable=True, comment="云之家同步状态")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")
    
    # 关系
    finding = relationship("AuditFinding", back_populates="rectification_orders")
    project = relationship("AuditProject", back_populates="rectification_orders")
    evidences = relationship("RectificationEvidence", back_populates="order", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<RectificationOrder {self.order_id} - {self.title}>"
    
    @property
    def is_overdue(self) -> bool:
        """是否逾期"""
        if self.status in [OrderStatus.VERIFIED, OrderStatus.ARCHIVED]:
            return False
        return date.today() > self.deadline
    
    @property
    def days_remaining(self) -> int:
        """剩余天数"""
        return (self.deadline - date.today()).days


class RectificationEvidence(Base):
    """
    整改证据表
    """
    __tablename__ = "rectification_evidences"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(36), ForeignKey("rectification_orders.id"), nullable=False, comment="整改工单ID")
    
    # 证据信息
    evidence_type = Column(String(50), nullable=False, comment="证据类型")
    file_name = Column(String(500), nullable=False, comment="文件名")
    file_path = Column(String(1000), nullable=False, comment="文件路径")
    file_size = Column(Integer, nullable=True, comment="文件大小（字节）")
    
    # 说明
    description = Column(Text, nullable=True, comment="说明")
    submitted_by_id = Column(String(36), ForeignKey("users.id"), nullable=False, comment="提交人ID")
    
    # 验证结果
    verified = Column(String(1), default="0", comment="是否已验证")
    verified_by_id = Column(String(36), ForeignKey("users.id"), nullable=True, comment="验证人ID")
    verified_at = Column(DateTime(timezone=True), nullable=True, comment="验证时间")
    verification_note = Column(Text, nullable=True, comment="验证备注")
    
    # 时间戳
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), comment="提交时间")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    
    # 关系
    order = relationship("RectificationOrder", back_populates="evidences")
    submitted_by = relationship("User", foreign_keys=[submitted_by_id], backref="submitted_evidences")
    verified_by = relationship("User", foreign_keys=[verified_by_id], backref="verified_evidences")
    
    def __repr__(self):
        return f"<RectificationEvidence {self.file_name}>"
