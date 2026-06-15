"""
Pydantic Schema定义
Pydantic Schemas Definitions
"""

from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional, List, Any


# ==================== 用户相关Schema ====================

class UserBase(BaseModel):
    """用户基础Schema"""
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    email: EmailStr = Field(..., description="邮箱")
    full_name: str = Field(..., min_length=2, max_length=100, description="姓名")
    department: Optional[str] = Field(None, description="部门")
    phone: Optional[str] = Field(None, description="电话")
    employee_id: Optional[str] = Field(None, description="员工编号")


class UserCreate(UserBase):
    """创建用户Schema"""
    password: str = Field(..., min_length=6, max_length=50, description="密码")


class UserUpdate(BaseModel):
    """更新用户Schema"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None


class UserLogin(BaseModel):
    """用户登录Schema"""
    username: str = Field(..., description="用户名")
    password: str = Field(..., description="密码")


class UserResponse(UserBase):
    """用户响应Schema"""
    id: str
    role: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        orm_mode = True


class TokenResponse(BaseModel):
    """Token响应Schema"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


# ==================== 通用响应Schema ====================

class ResponseModel(BaseModel):
    """通用响应Schema"""
    code: int = 200
    message: str = "success"
    data: Optional[Any] = None


class PaginatedResponse(BaseModel):
    """分页响应Schema"""
    code: int = 200
    message: str = "success"
    data: Optional[Any] = None
    total: int = 0
    page: int = 1
    page_size: int = 20


# ==================== 审计项目相关Schema ====================

class AuditProjectCreate(BaseModel):
    """创建审计项目Schema"""
    project_code: str = Field(..., description="项目编号")
    project_name: str = Field(..., description="项目名称")
    audit_type: str = Field(default="financial", description="审计类型")
    target_dept_code: Optional[str] = Field(None, description="被审计部门编码")
    target_dept_name: Optional[str] = Field(None, description="被审计部门名称")
    start_date: Optional[str] = Field(None, description="开始日期 (yyyy-mm-dd)")
    end_date: Optional[str] = Field(None, description="结束日期 (yyyy-mm-dd)")
    project_manager_id: Optional[str] = Field(None, description="项目经理ID")
    audit_objective: Optional[str] = Field(None, description="审计目标")
    audit_scope: Optional[str] = Field(None, description="审计范围")
    audit_criteria: Optional[str] = Field(None, description="审计标准")


class AuditProjectUpdate(BaseModel):
    """更新审计项目Schema"""
    project_name: Optional[str] = Field(None, description="项目名称")
    audit_type: Optional[str] = Field(None, description="审计类型")
    status: Optional[str] = Field(None, description="项目状态")
    target_dept_code: Optional[str] = Field(None, description="被审计部门编码")
    target_dept_name: Optional[str] = Field(None, description="被审计部门名称")
    start_date: Optional[str] = Field(None, description="开始日期")
    end_date: Optional[str] = Field(None, description="结束日期")
    actual_end_date: Optional[str] = Field(None, description="实际结束日期")
    project_manager_id: Optional[str] = Field(None, description="项目经理ID")
    audit_objective: Optional[str] = Field(None, description="审计目标")
    audit_scope: Optional[str] = Field(None, description="审计范围")
    audit_criteria: Optional[str] = Field(None, description="审计标准")
