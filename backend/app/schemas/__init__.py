"""
Pydantic Schema定义
Pydantic Schemas Definitions
"""

from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional, List


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
    data: Optional[dict] = None


class PaginatedResponse(BaseModel):
    """分页响应Schema"""
    code: int = 200
    message: str = "success"
    data: Optional[dict] = None
    total: int = 0
    page: int = 1
    page_size: int = 20
