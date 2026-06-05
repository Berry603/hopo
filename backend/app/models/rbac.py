"""
RBAC权限模型
Role-Based Access Control

用户 → 角色 → 权限
支持: 部门隔离、数据权限、功能权限
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, DateTime, Boolean, Text, JSON,
    ForeignKey, Table
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


# ============ 关联表 ============

# 角色-权限关联
role_permission = Table(
    "rbac_role_permission",
    Base.metadata,
    Column("role_id", String(36), ForeignKey("rbac_roles.id"), primary_key=True),
    Column("permission_id", String(36), ForeignKey("rbac_permissions.id"), primary_key=True),
)

# 用户-角色关联
user_role = Table(
    "rbac_user_role",
    Base.metadata,
    Column("user_id", String(36), ForeignKey("users.id"), primary_key=True),
    Column("role_id", String(36), ForeignKey("rbac_roles.id"), primary_key=True),
)


# ============ 权限表 ============

class Permission(Base):
    """功能权限"""
    __tablename__ = "rbac_permissions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    code = Column(String(100), unique=True, nullable=False, comment="权限编码")
    name = Column(String(100), nullable=False, comment="权限名称")
    
    # 权限分类
    category = Column(String(50), comment="模块/分类")
    resource = Column(String(100), comment="资源标识")
    action = Column(String(50), comment="操作: read/write/delete/approve")
    
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    
    roles = relationship("Role", secondary=role_permission, back_populates="permissions")


# ============ 角色表 ============

class Role(Base):
    """角色"""
    __tablename__ = "rbac_roles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    code = Column(String(50), unique=True, nullable=False, comment="角色编码")
    name = Column(String(100), nullable=False, comment="角色名称")
    
    # 角色级别 (数字越小权限越高)
    level = Column(Integer, default=100)
    
    # 数据权限范围
    data_scope = Column(String(20), default="self", comment="self/dept/all")
    
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False, comment="系统内置角色")
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    permissions = relationship("Permission", secondary=role_permission, back_populates="roles")
    users = relationship("User", secondary=user_role, back_populates="roles")


# ============ 系统预置权限 ============

PRESET_PERMISSIONS = {
    # 系统管理
    "system:admin":           {"name": "系统管理",   "category": "系统管理", "resource": "system", "action": "admin"},
    "system:settings":        {"name": "系统配置",   "category": "系统管理", "resource": "system", "action": "write"},
    "system:audit_log":       {"name": "查看审计日志","category": "系统管理", "resource": "audit_log", "action": "read"},
    
    # 数据治理
    "data:source:manage":     {"name": "数据源管理",  "category": "数据治理", "resource": "data_source", "action": "write"},
    "data:source:view":       {"name": "查看数据源",  "category": "数据治理", "resource": "data_source", "action": "read"},
    "data:etl:manage":        {"name": "ETL任务管理", "category": "数据治理", "resource": "etl", "action": "write"},
    "data:quality:view":      {"name": "数据质量查看", "category": "数据治理", "resource": "data_quality", "action": "read"},
    
    # 风险预警
    "risk:rule:manage":       {"name": "风险规则管理","category": "风险预警", "resource": "risk_rule", "action": "write"},
    "risk:alert:view":        {"name": "风险预警查看", "category": "风险预警", "resource": "risk_alert", "action": "read"},
    "risk:alert:handle":      {"name": "风险预警处置", "category": "风险预警", "resource": "risk_alert", "action": "write"},
    
    # 审计作业
    "audit:project:manage":   {"name": "项目管理",    "category": "审计作业", "resource": "audit_project", "action": "write"},
    "audit:project:view":     {"name": "项目查看",    "category": "审计作业", "resource": "audit_project", "action": "read"},
    "audit:workpaper:edit":   {"name": "底稿编辑",    "category": "审计作业", "resource": "workpaper", "action": "write"},
    "audit:report:generate":  {"name": "报告生成",    "category": "审计作业", "resource": "report", "action": "write"},
    "audit:report:approve":   {"name": "报告审批",    "category": "审计作业", "resource": "report", "action": "approve"},
    
    # 整改跟踪
    "rect:manage":            {"name": "整改进度管理", "category": "整改跟踪", "resource": "rectification", "action": "write"},
    "rect:verify":            {"name": "整改结果验证", "category": "整改跟踪", "resource": "rectification", "action": "approve"},
    
    # 知识管理
    "knowledge:manage":       {"name": "知识管理",    "category": "知识管理", "resource": "knowledge", "action": "write"},
    "knowledge:view":         {"name": "知识查看",    "category": "知识管理", "resource": "knowledge", "action": "read"},
    
    # 智能查询
    "query:use":              {"name": "智能查询",    "category": "智能查询", "resource": "query", "action": "read"},
    "query:template:manage":  {"name": "查询模板管理", "category": "智能查询", "resource": "query_template", "action": "write"},
}

PRESET_ROLES = [
    {"code": "super_admin", "name": "超级管理员", "level": 1,  "data_scope": "all",  "is_system": True,
     "permissions": list(PRESET_PERMISSIONS.keys())},
    {"code": "audit_manager","name": "审计经理",  "level": 10, "data_scope": "all",  "is_system": True,
     "permissions": ["system:audit_log","data:source:view","data:etl:manage","data:quality:view",
                     "risk:rule:manage","risk:alert:view","risk:alert:handle",
                     "audit:project:manage","audit:project:view","audit:workpaper:edit",
                     "audit:report:generate","audit:report:approve",
                     "rect:manage","rect:verify","knowledge:manage","knowledge:view",
                     "query:use","query:template:manage"]},
    {"code": "auditor",      "name": "审计员",    "level": 20, "data_scope": "dept", "is_system": True,
     "permissions": ["data:source:view","risk:alert:view",
                     "audit:project:view","audit:workpaper:edit","audit:report:generate",
                     "knowledge:view","query:use"]},
    {"code": "viewer",       "name": "查看者",    "level": 50, "data_scope": "self", "is_system": True,
     "permissions": ["data:quality:view","risk:alert:view","audit:project:view",
                     "knowledge:view","query:use"]},
]
