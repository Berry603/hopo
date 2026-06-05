"""
风险预警模型
Risk Early Warning Model
"""

from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, Text, JSON, Integer, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum as PyEnum
import uuid

from app.core.database import Base


class RiskType(str, PyEnum):
    """风险类型枚举"""
    FINANCIAL = "financial"           # 财务风险
    COMPLIANCE = "compliance"         # 合规风险
    OPERATIONAL = "operational"       # 运营风险
    PROCUREMENT = "procurement"       # 采购风险
    SALES = "sales"                   # 销售风险
    INVENTORY = "inventory"           # 库存风险
    CASH = "cash"                     # 资金风险
    IT = "it"                         # IT风险


class SeverityLevel(str, PyEnum):
    """严重程度枚举"""
    HIGH = "high"                     # 高
    MEDIUM = "medium"                 # 中
    LOW = "low"                       # 低


class AlertStatus(str, PyEnum):
    """预警状态枚举"""
    OPEN = "open"                     # 打开
    CONFIRMED = "confirmed"           # 已确认
    FALSE_ALARM = "false_alarm"       # 误报
    RESOLVED = "resolved"             # 已解决


class RuleType(str, PyEnum):
    """规则类型枚举"""
    NULL_RATE = "null_rate"           # 空值率检测
    OUTLIER = "outlier"               # 异常值检测
    CONSISTENCY = "consistency"       # 一致性校验
    VOLATILITY = "volatility"         # 波动检测


class RiskRule(Base):
    """
    风险规则表
    """
    __tablename__ = "risk_rules"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rule_id = Column(String(50), unique=True, nullable=False, comment="规则编号")
    name = Column(String(200), nullable=False, comment="规则名称")
    description = Column(Text, nullable=True, comment="规则描述")
    
    # 规则配置
    risk_type = Column(SQLEnum(RiskType), nullable=False, comment="风险类型")
    severity = Column(SQLEnum(SeverityLevel), default=SeverityLevel.MEDIUM, comment="严重程度")
    rule_type = Column(SQLEnum(RuleType), nullable=False, comment="规则类型")
    
    # 规则条件（JSON格式）
    conditions = Column(JSON, nullable=False, comment="规则条件")
    threshold = Column(Float, nullable=True, comment="阈值")
    
    # 扫描配置
    scan_schedule = Column(String(100), nullable=True, comment="扫描计划（Cron表达式）")
    is_active = Column(String(1), default="1", comment="是否激活")
    
    # 动作配置
    actions = Column(JSON, nullable=True, comment="触发动作")
    
    # 元数据
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False, comment="创建人ID")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")
    
    # 关系
    created_by = relationship("User", backref="created_risk_rules")
    alerts = relationship("RiskAlert", back_populates="rule")
    
    def __repr__(self):
        return f"<RiskRule {self.rule_id} - {self.name}>"


class RiskAlert(Base):
    """
    风险预警事件表
    """
    __tablename__ = "risk_alerts"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id = Column(String(50), unique=True, nullable=False, comment="预警编号")
    
    # 关联规则
    rule_id = Column(String(36), ForeignKey("risk_rules.id"), nullable=False, comment="规则ID")
    
    # 预警详情
    risk_type = Column(SQLEnum(RiskType), nullable=False, comment="风险类型")
    severity = Column(SQLEnum(SeverityLevel), nullable=False, comment="严重程度")
    title = Column(String(500), nullable=False, comment="预警标题")
    description = Column(Text, nullable=True, comment="预警描述")
    
    # 业务数据
    dept_code = Column(String(50), nullable=True, comment="部门代码")
    dept_name = Column(String(200), nullable=True, comment="部门名称")
    business_area = Column(String(100), nullable=True, comment="业务领域")
    
    # 详细数据（JSON格式）
    detail_data = Column(JSON, nullable=True, comment="详细数据")
    
    # 状态
    status = Column(SQLEnum(AlertStatus), default=AlertStatus.OPEN, comment="状态")
    
    # 确认信息
    confirmed_by_id = Column(String(36), ForeignKey("users.id"), nullable=True, comment="确认人ID")
    confirmed_at = Column(DateTime(timezone=True), nullable=True, comment="确认时间")
    confirmation_note = Column(Text, nullable=True, comment="确认备注")
    
    # 标签
    labels = Column(JSON, nullable=True, comment="标签列表")
    
    # 时间戳
    alert_time = Column(DateTime(timezone=True), server_default=func.now(), comment="预警时间")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")
    
    # 关系
    rule = relationship("RiskRule", back_populates="alerts")
    confirmed_by = relationship("User", backref="confirmed_alerts")
    
    def __repr__(self):
        return f"<RiskAlert {self.alert_id} - {self.title}>"
