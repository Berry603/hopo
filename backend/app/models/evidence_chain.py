"""
证据链关联模型
Evidence Chain Model — 审计发现 ↔ 证据来源 ↔ 穿行测试 三方关联
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import SoftDeleteMixin


class EvidenceLink(Base, SoftDeleteMixin):
    """证据链关联表"""
    __tablename__ = "evidence_links"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    finding_id = Column(String(36), ForeignKey("audit_findings.id", ondelete="CASCADE"), nullable=False, comment="审计发现ID")

    # 证据来源类型: risk_alert / procedure_row / voucher / manual / attachment
    source_type = Column(String(50), nullable=False, comment="证据来源类型")
    source_id = Column(String(200), nullable=False, comment="来源记录ID")

    # 关联的穿行测试
    procedure_execution_id = Column(String(36), ForeignKey("procedure_executions.id", ondelete="SET NULL"), nullable=True)
    procedure_row_index = Column(Integer, nullable=True, comment="关联的穿行测试行号")

    # 证据内容
    evidence_description = Column(Text, comment="证据描述")
    evidence_data = Column(JSON, comment="证据快照数据（JSON）")

    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # 关系
    finding = relationship("AuditFinding", backref="evidence_links")
    procedure_execution = relationship("ProcedureExecution", backref="evidence_links")
    created_by = relationship("User")
