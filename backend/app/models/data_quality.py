"""
数据治理与质量中心模型
Data Governance and Quality Center Models

覆盖需求文档三:
  3.1 数据质量监控 - 空值/异常/一致性/波动检测
  3.2 数据血缘追踪 - 全链路溯源/变更影响分析/字段变更通知
  3.3 数据接入健康度 - 同步监控/异常告警/同步日志与快照
"""

from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, Text, Float, ForeignKey, Integer, JSON, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum as PyEnum
import uuid

from app.core.database import Base
from app.models.base import SoftDeleteMixin


class RuleType(str, PyEnum):
    """规则类型枚举"""
    NULL_RATE = "null_rate"           # 空值率检测
    OUTLIER = "outlier"               # 异常值检测
    CONSISTENCY = "consistency"       # 一致性校验
    VOLATILITY = "volatility"         # 波动检测
    COMPLETENESS = "completeness"     # 完整性检查


class SeverityLevel(str, PyEnum):
    """严重程度枚举"""
    CRITICAL = "critical"             # 严重
    WARNING = "warning"               # 警告
    INFO = "info"                     # 信息


# ==================== 3.1 数据质量监控 ====================

class QualityRule(Base, SoftDeleteMixin):
    """数据质量规则表"""
    __tablename__ = "data_quality_rules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rule_id = Column(String(50), unique=True, nullable=False, comment="规则编号")
    name = Column(String(200), nullable=False, comment="规则名称")
    description = Column(Text, nullable=True, comment="规则描述")

    source_system = Column(String(100), nullable=False, comment="源系统")
    table_name = Column(String(100), nullable=False, comment="表名")
    field_name = Column(String(100), nullable=False, comment="字段名")

    rule_type = Column(SQLEnum(RuleType), nullable=False, comment="规则类型")
    threshold = Column(Float, nullable=True, comment="阈值")
    severity = Column(SQLEnum(SeverityLevel), default=SeverityLevel.WARNING, comment="严重程度")

    # 规则配置 (JSON)
    config = Column(JSON, nullable=True, comment="规则配置详情")

    is_active = Column(String(1), default="1", comment="是否激活")
    last_check_at = Column(DateTime(timezone=True), nullable=True, comment="上次检查时间")
    last_result = Column(JSON, nullable=True, comment="上次检查结果")

    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False, comment="创建人ID")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")

    created_by = relationship("User", backref="created_quality_rules")
    reports = relationship("QualityReport", back_populates="rule")

    def to_dict(self):
        return {
            "id": self.id,
            "rule_id": self.rule_id,
            "name": self.name,
            "description": self.description,
            "source_system": self.source_system,
            "table_name": self.table_name,
            "field_name": self.field_name,
            "rule_type": self.rule_type.value if self.rule_type else None,
            "threshold": self.threshold,
            "severity": self.severity.value if self.severity else None,
            "config": self.config,
            "is_active": self.is_active == "1",
            "last_check_at": self.last_check_at.isoformat() if self.last_check_at else None,
            "last_result": self.last_result,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class QualityReport(Base):
    """数据质量报告表"""
    __tablename__ = "data_quality_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String(50), unique=True, nullable=False, comment="报告编号")
    rule_id = Column(String(36), ForeignKey("data_quality_rules.id"), nullable=False, comment="规则ID")

    report_month = Column(String(7), nullable=False, comment="报告月份（YYYY-MM）")
    department = Column(String(100), nullable=True, comment="部门")

    total_records = Column(Integer, default=0, comment="总记录数")
    passed_records = Column(Integer, default=0, comment="通过记录数")
    failed_records = Column(Integer, default=0, comment="失败记录数")
    quality_score = Column(Float, nullable=True, comment="质量得分(0-100)")

    detail_data = Column(JSON, nullable=True, comment="详细数据")
    status = Column(String(20), default="generated", comment="状态")

    generated_at = Column(DateTime(timezone=True), server_default=func.now(), comment="生成时间")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")

    rule = relationship("QualityRule", back_populates="reports")


class QualityScore(Base):
    """质量评分表 - 按部门/系统/月份的评分排名"""
    __tablename__ = "data_quality_scores"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_month = Column(String(7), nullable=False, comment="报告月份（YYYY-MM）")
    entity_type = Column(String(20), nullable=False, comment="实体类型: department / system")
    entity_name = Column(String(100), nullable=False, comment="实体名称")
    entity_code = Column(String(50), nullable=True, comment="实体编码")

    total_rules = Column(Integer, default=0, comment="规则总数")
    passed_rules = Column(Integer, default=0, comment="通过规则数")
    failed_rules = Column(Integer, default=0, comment="失败规则数")

    quality_score = Column(Float, nullable=False, comment="质量得分(0-100)")
    rank = Column(Integer, nullable=True, comment="排名")
    previous_score = Column(Float, nullable=True, comment="上月得分")
    score_change = Column(Float, nullable=True, comment="得分变化")

    detail_data = Column(JSON, nullable=True, comment="详细数据")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ==================== 跨系统一致性校验 ====================

class CrossSystemCheck(Base):
    """跨系统一致性检查记录"""
    __tablename__ = "cross_system_checks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    check_id = Column(String(50), unique=True, nullable=False, comment="检查编号")

    name = Column(String(200), nullable=False, comment="检查名称")
    description = Column(Text, nullable=True, comment="检查描述")

    source_system = Column(String(100), nullable=False, comment="源系统A")
    source_table = Column(String(100), nullable=False, comment="源表A")
    source_field = Column(String(100), nullable=False, comment="源字段A")

    target_system = Column(String(100), nullable=False, comment="源系统B")
    target_table = Column(String(100), nullable=False, comment="源表B")
    target_field = Column(String(100), nullable=False, comment="源字段B")

    match_key = Column(String(200), nullable=False, comment="关联键（如supplier_id）")

    total_compared = Column(Integer, default=0, comment="比较总数")
    matched = Column(Integer, default=0, comment="一致数")
    mismatched = Column(Integer, default=0, comment="不一致数")
    match_rate = Column(Float, nullable=True, comment="一致率(%)")

    last_check_at = Column(DateTime(timezone=True), nullable=True, comment="上次检查时间")
    is_active = Column(String(1), default="1", comment="是否启用")

    detail_data = Column(JSON, nullable=True, comment="不一致详情")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "check_id": self.check_id,
            "name": self.name,
            "description": self.description,
            "source_system": self.source_system,
            "source_table": self.source_table,
            "source_field": self.source_field,
            "target_system": self.target_system,
            "target_table": self.target_table,
            "target_field": self.target_field,
            "match_key": self.match_key,
            "total_compared": self.total_compared,
            "matched": self.matched,
            "mismatched": self.mismatched,
            "match_rate": self.match_rate,
            "last_check_at": self.last_check_at.isoformat() if self.last_check_at else None,
            "is_active": self.is_active == "1",
            "detail_data": self.detail_data,
        }


# ==================== 3.2 数据血缘追踪 ====================

class DataLineage(Base):
    """数据血缘追踪表"""
    __tablename__ = "data_lineage"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    lineage_id = Column(String(50), unique=True, nullable=True, comment="血缘编号")

    source_node = Column(String(500), nullable=False, comment="源节点")
    target_node = Column(String(500), nullable=False, comment="目标节点")
    relation_type = Column(String(50), nullable=False, comment="关系类型: transform/derive/aggregate/reference")

    transform_sql = Column(Text, nullable=True, comment="转换SQL")
    transform_description = Column(Text, nullable=True, comment="转换描述")

    node_level = Column(Integer, default=0, comment="节点层级(0=源系统, 1=数据仓库, 2=数据集市, 3=应用)")
    source_system = Column(String(100), nullable=True, comment="所属源系统")
    table_name = Column(String(100), nullable=True, comment="表名")
    field_name = Column(String(100), nullable=True, comment="字段名")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "lineage_id": self.lineage_id,
            "source_node": self.source_node,
            "target_node": self.target_node,
            "relation_type": self.relation_type,
            "transform_description": self.transform_description,
            "node_level": self.node_level,
            "source_system": self.source_system,
            "table_name": self.table_name,
            "field_name": self.field_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class FieldChangeLog(Base):
    """字段变更日志 - 追踪源系统字段变更"""
    __tablename__ = "field_change_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    change_id = Column(String(50), unique=True, nullable=False, comment="变更编号")

    source_system = Column(String(100), nullable=False, comment="源系统")
    table_name = Column(String(100), nullable=False, comment="表名")
    field_name = Column(String(100), nullable=False, comment="字段名")

    change_type = Column(String(20), nullable=False, comment="变更类型: added/modified/removed")
    old_value = Column(Text, nullable=True, comment="变更前")
    new_value = Column(Text, nullable=True, comment="变更后")
    change_description = Column(Text, nullable=True, comment="变更描述")

    impacted_downstream = Column(JSON, nullable=True, comment="影响的下游节点")
    impact_level = Column(String(20), nullable=True, comment="影响级别: high/medium/low")
    notified = Column(String(1), default="0", comment="是否已通知")

    changed_by = Column(String(100), nullable=True, comment="变更人")
    changed_at = Column(DateTime(timezone=True), server_default=func.now(), comment="变更时间")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "change_id": self.change_id,
            "source_system": self.source_system,
            "table_name": self.table_name,
            "field_name": self.field_name,
            "change_type": self.change_type,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "change_description": self.change_description,
            "impacted_downstream": self.impacted_downstream,
            "impact_level": self.impact_level,
            "notified": self.notified == "1",
            "changed_by": self.changed_by,
            "changed_at": self.changed_at.isoformat() if self.changed_at else None,
        }


# ==================== 3.3 数据接入健康度 ====================

class SyncStatus(Base):
    """数据同步状态表"""
    __tablename__ = "sync_status"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    source_system = Column(String(100), nullable=False, comment="源系统")
    table_name = Column(String(100), nullable=True, comment="表名")
    sync_status = Column(String(20), nullable=False, comment="同步状态: online/syncing/error/offline")

    last_sync_at = Column(DateTime(timezone=True), nullable=True, comment="最后同步时间")
    last_success_at = Column(DateTime(timezone=True), nullable=True, comment="最后成功时间")
    next_sync_at = Column(DateTime(timezone=True), nullable=True, comment="下次同步时间")

    records_synced = Column(Integer, default=0, comment="已同步记录数")
    records_failed = Column(Integer, default=0, comment="失败记录数")
    sync_duration_seconds = Column(Integer, nullable=True, comment="同步耗时（秒）")
    error_message = Column(Text, nullable=True, comment="错误信息")

    is_connected = Column(String(1), default="1", comment="是否连接")
    latency_ms = Column(Integer, nullable=True, comment="延迟（毫秒）")
    sync_interval_minutes = Column(Integer, default=60, comment="同步间隔（分钟）")

    # 数据量波动监控
    expected_records = Column(Integer, nullable=True, comment="预期记录数")
    record_volume_change_pct = Column(Float, nullable=True, comment="记录数变化百分比")

    # 失败率
    today_sync_count = Column(Integer, default=0, comment="今日同步次数")
    today_fail_count = Column(Integer, default=0, comment="今日失败次数")
    fail_rate = Column(Float, nullable=True, comment="失败率(%)")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")

    def to_dict(self):
        return {
            "id": self.id,
            "source_system": self.source_system,
            "table_name": self.table_name,
            "sync_status": self.sync_status,
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
            "last_success_at": self.last_success_at.isoformat() if self.last_success_at else None,
            "next_sync_at": self.next_sync_at.isoformat() if self.next_sync_at else None,
            "records_synced": self.records_synced,
            "records_failed": self.records_failed,
            "sync_duration_seconds": self.sync_duration_seconds,
            "error_message": self.error_message,
            "is_connected": self.is_connected == "1",
            "latency_ms": self.latency_ms,
            "sync_interval_minutes": self.sync_interval_minutes,
            "expected_records": self.expected_records,
            "record_volume_change_pct": self.record_volume_change_pct,
            "today_sync_count": self.today_sync_count,
            "today_fail_count": self.today_fail_count,
            "fail_rate": self.fail_rate,
        }


class SyncSnapshot(Base):
    """同步快照表 - 保存每次同步的完整快照，支持回滚和比对"""
    __tablename__ = "sync_snapshots"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    snapshot_id = Column(String(50), unique=True, nullable=False, comment="快照编号")

    source_system = Column(String(100), nullable=False, comment="源系统")
    table_name = Column(String(100), nullable=False, comment="表名")
    sync_status_id = Column(String(36), ForeignKey("sync_status.id"), nullable=True, comment="关联同步状态")

    records_count = Column(Integer, default=0, comment="快照记录数")
    snapshot_data_checksum = Column(String(64), nullable=True, comment="数据校验和(SHA256)")
    snapshot_file_path = Column(String(500), nullable=True, comment="快照文件路径")

    sync_mode = Column(String(20), nullable=True, comment="同步模式: full/incremental")
    sync_started_at = Column(DateTime(timezone=True), nullable=True, comment="同步开始时间")
    sync_finished_at = Column(DateTime(timezone=True), nullable=True, comment="同步完成时间")
    duration_seconds = Column(Integer, nullable=True, comment="耗时(秒)")

    is_success = Column(String(1), default="1", comment="是否成功")
    error_message = Column(Text, nullable=True, comment="错误信息")

    diff_summary = Column(JSON, nullable=True, comment="与上一快照的差异摘要")
    can_rollback = Column(String(1), default="1", comment="是否支持回滚")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "snapshot_id": self.snapshot_id,
            "source_system": self.source_system,
            "table_name": self.table_name,
            "records_count": self.records_count,
            "snapshot_data_checksum": self.snapshot_data_checksum,
            "sync_mode": self.sync_mode,
            "sync_started_at": self.sync_started_at.isoformat() if self.sync_started_at else None,
            "sync_finished_at": self.sync_finished_at.isoformat() if self.sync_finished_at else None,
            "duration_seconds": self.duration_seconds,
            "is_success": self.is_success == "1",
            "error_message": self.error_message,
            "diff_summary": self.diff_summary,
            "can_rollback": self.can_rollback == "1",
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
