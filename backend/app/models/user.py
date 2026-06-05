"""
用户模型
User Model - 系统用户
"""

from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from enum import Enum as PyEnum
import uuid

from app.core.database import Base


class UserRole(str, PyEnum):
    """用户角色枚举"""
    SUPER_ADMIN = "super_admin"
    AUDIT_DIRECTOR = "audit_director"
    AUDIT_MANAGER = "audit_manager"
    AUDITOR = "auditor"
    DATA_ADMIN = "data_admin"
    VIEWER = "viewer"


class User(Base):
    """
    用户表模型
    """
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, index=True, nullable=False, comment="用户名")
    email = Column(String(100), unique=True, index=True, nullable=False, comment="邮箱")
    full_name = Column(String(100), nullable=False, comment="姓名")
    hashed_password = Column(String(255), nullable=False, comment="加密密码")
    
    # 角色和权限
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.VIEWER, comment="角色")
    is_active = Column(Boolean, default=True, comment="是否激活")
    is_superuser = Column(Boolean, default=False, comment="是否超级管理员")
    
    # 部门和联系方式
    department = Column(String(100), nullable=True, comment="部门")
    phone = Column(String(20), nullable=True, comment="电话")
    employee_id = Column(String(50), unique=True, nullable=True, comment="员工编号")
    
    # 审计相关
    audit_departments = Column(String(500), nullable=True, comment="可审计部门列表（逗号分隔）")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")
    last_login = Column(DateTime(timezone=True), nullable=True, comment="最后登录时间")
    
    # 云之家OA相关
    yzj_user_id = Column(String(100), nullable=True, comment="云之家用户ID")
    yzj_department_id = Column(String(100), nullable=True, comment="云之家部门ID")
    
    # RBAC多角色关联（延迟引用避免循环导入）
    roles = relationship(
        "Role",
        secondary="rbac_user_role",
        back_populates="users",
        lazy="selectin"
    )
    
    # SSO单点登录
    sso_provider = Column(String(30), nullable=True, comment="SSO来源: yunzhijia/wecom/ldap")
    sso_subject = Column(String(100), nullable=True, comment="SSO唯一标识")
    
    def __repr__(self):
        return f"<User {self.username} - {self.full_name}>"
    
    @property
    def is_auditor(self) -> bool:
        """是否为审计人员"""
        return self.role in [
            UserRole.SUPER_ADMIN,
            UserRole.AUDIT_DIRECTOR,
            UserRole.AUDIT_MANAGER,
            UserRole.AUDITOR,
        ]
    
    @property
    def can_manage_projects(self) -> bool:
        """是否可以管理审计项目"""
        return self.role in [
            UserRole.SUPER_ADMIN,
            UserRole.AUDIT_DIRECTOR,
            UserRole.AUDIT_MANAGER,
        ]
