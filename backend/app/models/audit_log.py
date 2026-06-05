"""
审计操作日志模型
Audit Trail Log

记录所有敏感操作：登录、数据访问、配置变更、审批等
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class AuditLog(Base):
    """操作审计日志"""
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    
    # 操作者
    user_id = Column(String(36), index=True, comment="操作用户ID")
    username = Column(String(50), comment="操作用户名")
    ip_address = Column(String(50), comment="IP地址")
    user_agent = Column(Text, comment="浏览器UA")
    
    # 操作信息
    action = Column(String(50), nullable=False, index=True, comment="操作动作")
    module = Column(String(50), index=True, comment="操作模块")
    resource = Column(String(100), comment="资源标识")
    resource_id = Column(String(50), comment="资源ID")
    
    # 操作详情
    description = Column(Text, comment="操作描述")
    detail = Column(JSON, comment="操作详情JSON")
    
    # 变更记录
    changes = Column(JSON, comment="变更前后对比: {before: {}, after: {}}")
    
    # 操作结果
    status = Column(String(20), default="success", comment="success|failed")
    error_message = Column(Text)
    
    # 耗时
    duration_ms = Column(Integer, comment="操作耗时(毫秒)")
    
    created_at = Column(DateTime, default=datetime.now, index=True)


class SensitiveDataAccess(Base):
    """敏感数据访问记录（满足合规要求）"""
    __tablename__ = "sensitive_data_access"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    
    user_id = Column(String(36), index=True)
    username = Column(String(50))
    
    data_type = Column(String(50), comment="数据类型: salary/contract/budget")
    data_id = Column(String(50), comment="数据记录ID")
    
    action = Column(String(20), comment="view/export/download")
    reason = Column(Text, comment="访问理由（必填）")
    
    # 审批信息
    approved_by = Column(String(50), comment="审批人")
    approved_at = Column(DateTime)
    
    ip_address = Column(String(50))
    created_at = Column(DateTime, default=datetime.now, index=True)
