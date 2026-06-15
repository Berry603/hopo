"""
审计程序（穿行测试等）数据模型
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime,
    ForeignKey, JSON, Enum as SQLEnum, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.models.base import SoftDeleteMixin
import enum


class ProcedureType(str, enum.Enum):
    """审计程序类型"""
    WALKTHROUGH = "walkthrough"       # 穿行测试
    CONTROL_TEST = "control_test"     # 控制测试
    SUBSTANTIVE = "substantive"       # 实质性程序
    COMPLIANCE = "compliance"         # 合规审核
    ANALYTICAL = "analytical"         # 分析性复核
    CUSTOM = "custom"                 # 自定义


class ItemDataType(str, enum.Enum):
    """检查节点数据类型"""
    TEXT = "text"                     # 文本
    NUMBER = "number"                 # 数字
    BOOLEAN = "boolean"               # 是/否
    DATE = "date"                     # 日期
    SELECT = "select"                 # 下拉选择
    FILE = "file"                     # 文件/截图
    ERP = "erp"                       # 从ERP获取
    SRM = "srm"                       # 从SRM获取
    YUNZHIJIA = "yunzhijia"           # 从云之家获取
    FORMULA = "formula"               # 计算公式


class ProcedureStatus(str, enum.Enum):
    """审计程序执行状态"""
    PENDING = "pending"               # 待执行
    IN_PROGRESS = "in_progress"       # 执行中
    COMPLETED = "completed"           # 已完成
    REVIEWED = "reviewed"             # 已复核


# ==================== 程序模板 ====================

class AuditProcedure(Base):
    """审计程序模板（可复用的审计程序定义）"""
    __tablename__ = "audit_procedures"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    procedure_code = Column(String(50), unique=True, nullable=False, comment="程序编号")
    name = Column(String(200), nullable=False, comment="程序名称")
    procedure_type = Column(SQLEnum(ProcedureType), nullable=False, default=ProcedureType.WALKTHROUGH, comment="程序类型")
    description = Column(Text, comment="程序描述")
    target_process = Column(String(200), comment="目标业务流程（如门窗销售系统）")
    data_sources = Column(JSON, comment="涉及数据源 [erp, srm, yunzhijia, crm, wms]")
    version = Column(String(20), default="1.0", comment="版本号")
    is_preset = Column(Boolean, default=False, comment="是否为预设模板")
    is_active = Column(Boolean, default=True, comment="是否启用")
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=True, comment="创建人")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联
    items = relationship("ProcedureItem", back_populates="procedure", order_by="ProcedureItem.sort_order",
                         cascade="save-update, merge", lazy="selectin")
    creator = relationship("User", lazy="selectin")


class ProcedureItem(Base):
    """程序检查节点定义"""
    __tablename__ = "procedure_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    procedure_id = Column(String(36), ForeignKey("audit_procedures.id", ondelete="CASCADE"), nullable=False)
    sort_order = Column(Integer, default=0, comment="排序")
    field_name = Column(String(100), nullable=False, comment="字段名（如 客户名称）")
    field_label = Column(String(200), nullable=False, comment="显示标签")
    data_type = Column(SQLEnum(ItemDataType), nullable=False, default=ItemDataType.TEXT, comment="数据类型")
    data_source = Column(String(50), comment="数据来源（ERP/SRM/云之家/人工录入）")
    expected_result = Column(String(500), comment="预期结果/判断标准")
    options = Column(JSON, comment="下拉选项（SELECT类型时使用）")
    is_required = Column(Boolean, default=True, comment="是否必填")
    placeholder = Column(String(200), comment="填写提示")
    remark = Column(Text, comment="备注说明")

    procedure = relationship("AuditProcedure", back_populates="items")


# ==================== 程序执行 ====================

class ProcedureExecution(Base, SoftDeleteMixin):
    """审计程序执行记录（某项目执行某程序）"""
    __tablename__ = "procedure_executions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("audit_projects.id"), nullable=False, comment="所属项目")
    procedure_id = Column(String(36), ForeignKey("audit_procedures.id"), nullable=False, comment="所属程序模板")
    status = Column(SQLEnum(ProcedureStatus), nullable=False, default=ProcedureStatus.PENDING)
    executor_id = Column(String(36), ForeignKey("users.id"), nullable=True, comment="执行人")
    reviewer_id = Column(String(36), ForeignKey("users.id"), nullable=True, comment="复核人")
    sample_count = Column(Integer, default=0, comment="样本数量")
    conclusion = Column(Text, comment="测试结论")
    output_file_path = Column(String(500), comment="生成的Excel文件路径")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联
    project = relationship("AuditProject", lazy="selectin")
    procedure = relationship("AuditProcedure", lazy="selectin")
    executor = relationship("User", foreign_keys=[executor_id], lazy="selectin")
    reviewer = relationship("User", foreign_keys=[reviewer_id], lazy="selectin")
    rows = relationship("ProcedureRow", back_populates="execution",
                        cascade="save-update, merge", lazy="selectin")


class ProcedureRow(Base, SoftDeleteMixin):
    """程序执行的数据行（每个检查样本一行）"""
    __tablename__ = "procedure_rows"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    execution_id = Column(String(36), ForeignKey("procedure_executions.id", ondelete="CASCADE"), nullable=False)
    row_index = Column(Integer, default=0, comment="行号")
    # 所有检查节点的值存储为 JSON，如 {"客户名称": "XX公司", "是否有销售订单": "是"}
    data = Column(JSON, comment="检查数据（键值对）")
    conclusion = Column(String(50), comment="本条结论（正常/异常/待确认）")
    remark = Column(Text, comment="备注")
    created_at = Column(DateTime, default=datetime.utcnow)

    execution = relationship("ProcedureExecution", back_populates="rows")
