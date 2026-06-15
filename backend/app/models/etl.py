"""
ETL数据通道模型
ETL Pipeline Models

数据源配置 → 同步任务 → 同步日志 → 数据质量检查
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, DateTime, Boolean, 
    Text, JSON, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base
from app.models.base import SoftDeleteMixin


def generate_uuid() -> str:
    return str(uuid.uuid4())


class SyncStatus(str, enum.Enum):
    """同步状态"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL = "partial"     # 部分成功
    FAILED = "failed"
    CANCELLED = "cancelled"


class QualityCheckResult(str, enum.Enum):
    """质量检查结果"""
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"


class DataSourceTypeEnum(str, enum.Enum):
    KINGDEE_ERP = "kingdee_erp"
    YUNZHIJIA_OA = "yunzhijia_oa"
    MYSQL = "mysql"
    POSTGRESQL = "postgresql"
    API_HTTP = "api_http"
    FILE_CSV = "file_csv"
    FILE_EXCEL = "file_excel"


# --- 数据源配置表 ---
class DataSourceConfigModel(Base, SoftDeleteMixin):
    """数据源配置"""
    __tablename__ = "ds_configs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False, comment="数据源名称")
    source_type = Column(String(30), nullable=False, comment="数据源类型")
    description = Column(Text, comment="描述")
    
    # 连接配置 (JSON: {host,port,user,password,database} 或 {api_base,api_key})
    config = Column(JSON, nullable=False, default=dict)
    
    sync_mode = Column(String(20), default="full", comment="full|inc|cdc")
    schedule = Column(String(50), comment="Cron表达式")
    
    enabled = Column(Boolean, default=True)
    last_sync_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # 关联同步任务
    sync_tasks = relationship("SyncTaskModel", back_populates="source", cascade="all, delete-orphan")


# --- 同步任务表 ---
class SyncTaskModel(Base, SoftDeleteMixin):
    """ETL同步任务"""
    __tablename__ = "etl_sync_tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_id = Column(String(36), ForeignKey("ds_configs.id"), nullable=False)
    task_name = Column(String(100), nullable=False, comment="任务名称")
    
    # 同步目标
    source_table = Column(String(100), nullable=False, comment="源表名")
    target_table = Column(String(100), nullable=False, comment="目标表名")
    
    # 字段映射
    column_mapping = Column(JSON, comment='字段映射 {"src_col":"target_col"}')
    
    # 过滤条件
    where_condition = Column(Text, comment="过滤SQL WHERE子句")
    
    # 同步配置
    sync_mode = Column(String(20), default="full")
    batch_size = Column(Integer, default=1000)
    timeout_seconds = Column(Integer, default=3600)
    
    # 状态
    status = Column(String(20), default="pending")
    enabled = Column(Boolean, default=True)
    
    # 统计
    total_rows = Column(Integer, default=0)
    success_rows = Column(Integer, default=0)
    error_rows = Column(Integer, default=0)
    last_run_at = Column(DateTime)
    last_duration = Column(Float, comment="上次耗时(秒)")
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    source = relationship("DataSourceConfigModel", back_populates="sync_tasks")
    logs = relationship("SyncLogModel", back_populates="task", cascade="all, delete-orphan")


# --- 同步日志表 ---
class SyncLogModel(Base):
    """同步执行日志"""
    __tablename__ = "etl_sync_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    task_id = Column(String(36), ForeignKey("etl_sync_tasks.id"), nullable=False)
    
    status = Column(String(20), default="pending")
    
    # 执行统计
    total_rows = Column(Integer, default=0)
    inserted = Column(Integer, default=0)
    updated = Column(Integer, default=0)
    skipped = Column(Integer, default=0)
    errors = Column(JSON, default=list)
    
    started_at = Column(DateTime)
    finished_at = Column(DateTime)
    duration_seconds = Column(Float)
    
    # 错误信息
    error_message = Column(Text)
    
    created_at = Column(DateTime, default=datetime.now)
    
    task = relationship("SyncTaskModel", back_populates="logs")


# --- 数据质量检查规则表 ---
class QualityRuleModel(Base):
    """数据质量检查规则"""
    __tablename__ = "dq_rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False, comment="规则名称")
    target_table = Column(String(100), nullable=False, comment="目标表")
    target_column = Column(String(100), comment="目标列")
    
    rule_type = Column(String(30), nullable=False, comment="not_null|unique|range|regex|custom")
    rule_config = Column(JSON, comment='规则配置 {"min":0,"max":100}')
    
    severity = Column(String(20), default="warn", comment="pass时报警级别: warn|error")
    
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    
    results = relationship("QualityCheckResultModel", back_populates="rule", cascade="all, delete-orphan")


# --- 数据质量检查结果表 ---
class QualityCheckResultModel(Base):
    """数据质量检查结果"""
    __tablename__ = "dq_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    rule_id = Column(String(36), ForeignKey("dq_rules.id"), nullable=False)
    task_id = Column(String(36), comment="关联的同步任务ID")
    
    check_result = Column(String(20), default="pass")
    checked_rows = Column(Integer, default=0)
    failed_rows = Column(Integer, default=0)
    fail_rate = Column(Float)
    
    details = Column(JSON, default=list, comment="不合格样本详情")
    
    checked_at = Column(DateTime, default=datetime.now)
    
    rule = relationship("QualityRuleModel", back_populates="results")
