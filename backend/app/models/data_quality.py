"""
数据治理与质量中心模型
Data Governance and Quality Center Models
"""

from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, Text, Float, ForeignKey, Integer, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum as PyEnum
import uuid

from app.core.database import Base


class RuleType(str, PyEnum):
    """规则类型枚举"""
    NULL_RATE = "null_rate"           # 空值率检测
    OUTLIER = "outlier"               # 异常值检测
    CONSISTENCY = "consistency"       # 一致性校验
    VOLATILITY = "volatility"         # 波动检测


class SeverityLevel(str, PyEnum):
    """严重程度枚举"""
    CRITICAL = "critical"             # 严重
    WARNING = "warning"               # 警告
    INFO = "info"                     # 信息


class QualityRule(Base):
    """
    数据质量规则表
    """
    __tablename__ = "data_quality_rules"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rule_id = Column(String(50), unique=True, nullable=False, comment="规则编号")
    
    # 基本信息
    name = Column(String(200), nullable=False, comment="规则名称")
    description = Column(Text, nullable=True, comment="规则描述")
    
    # 数据源信息
    source_system = Column(String(100), nullable=False, comment="源系统")
    table_name = Column(String(100), nullable=False, comment="表名")
    field_name = Column(String(100), nullable=False, comment="字段名")
    
    # 规则配置
    rule_type = Column(SQLEnum(RuleType), nullable=False, comment="规则类型")
    threshold = Column(Float, nullable=True, comment="阈值")
    severity = Column(SQLEnum(SeverityLevel), default=SeverityLevel.WARNING, comment="严重程度")
    
    # 规则状态
    is_active = Column(String(1), default="1", comment="是否激活")
    
    # 元数据
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False, comment="创建人ID")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")
    
    # 关系
    created_by = relationship("User", backref="created_quality_rules")
    reports = relationship("QualityReport", back_populates="rule")
    
    def __repr__(self):
        return f"<QualityRule {self.rule_id} - {self.name}>"


class QualityReport(Base):
    """
    数据质量报告表
    """
    __tablename__ = "data_quality_reports"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String(50), unique=True, nullable=False, comment="报告编号")
    
    # 关联规则
    rule_id = Column(String(36), ForeignKey("data_quality_rules.id"), nullable=False, comment="规则ID")
    
    # 报告信息
    report_month = Column(String(7), nullable=False, comment="报告月份（YYYY-MM）")
    department = Column(String(100), nullable=True, comment="部门")
    
    # 质量指标
    total_records = Column(Integer, default=0, comment="总记录数")
    passed_records = Column(Integer, default=0, comment="通过记录数")
    failed_records = Column(Integer, default=0, comment="失败记录数")
    quality_score = Column(Float, nullable=True, comment="质量得分")
    
    # 详细信息（JSON格式）
    detail_data = Column(JSON, nullable=True, comment="详细数据")
    
    # 状态
    status = Column(String(20), default="generated", comment="状态")
    
    # 时间戳
    generated_at = Column(DateTime(timezone=True), server_default=func.now(), comment="生成时间")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    
    # 关系
    rule = relationship("QualityRule", back_populates="reports")
    
    def __repr__(self):
        return f"<QualityReport {self.report_id} - {self.report_month}>"


class SyncStatus(Base):
    """
    数据同步状态表
    """
    __tablename__ = "sync_status"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # 源系统信息
    source_system = Column(String(100), nullable=False, comment="源系统")
    table_name = Column(String(100), nullable=True, comment="表名")
    
    # 同步状态
    sync_status = Column(String(20), nullable=False, comment="同步状态")
    last_sync_at = Column(DateTime(timezone=True), nullable=True, comment="最后同步时间")
    last_success_at = Column(DateTime(timezone=True), nullable=True, comment="最后成功时间")
    
    # 同步详情
    records_synced = Column(Integer, default=0, comment="已同步记录数")
    sync_duration_seconds = Column(Integer, nullable=True, comment="同步耗时（秒）")
    error_message = Column(Text, nullable=True, comment="错误信息")
    
    # 连接状态
    is_connected = Column(String(1), default="1", comment="是否连接")
    latency_ms = Column(Integer, nullable=True, comment="延迟（毫秒）")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")
    
    def __repr__(self):
        return f"<SyncStatus {self.source_system} - {self.sync_status}>"


class DataLineage(Base):
    """
    数据血缘追踪表
    """
    __tablename__ = "data_lineage"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # 节点信息
    source_node = Column(String(500), nullable=False, comment="源节点ID")
    target_node = Column(String(500), nullable=False, comment="目标节点ID")
    
    # 关系类型
    relation_type = Column(String(50), nullable=False, comment="关系类型")
    
    # 转换信息
    transform_sql = Column(Text, nullable=True, comment="转换SQL")
    transform_description = Column(Text, nullable=True, comment="转换描述")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    
    def __repr__(self):
        return f"<DataLineage {self.source_node} -> {self.target_node}>"
