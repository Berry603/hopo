"""
用户管理API端点
User Management API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from loguru import logger
from typing import List, Optional

from app.core.database import get_db
from app.core.config import settings
from app.api.v1.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas import (
    UserCreate,
    UserUpdate,
    UserResponse,
    ResponseModel,
    PaginatedResponse,
)

router = APIRouter()


def _user_to_dict(u):
    return {
        "id": u.id, "username": u.username, "email": u.email,
        "full_name": u.full_name, "department": u.department,
        "phone": u.phone, "employee_id": u.employee_id,
        "role": u.role.value if hasattr(u.role, 'value') else u.role,
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_login": u.last_login.isoformat() if u.last_login else None,
    }


# ==================== 获取用户列表 ====================

@router.get("", response_model=PaginatedResponse)
async def get_users(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    role: Optional[str] = Query(None, description="角色筛选"),
    is_active: Optional[bool] = Query(None, description="是否激活"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取用户列表

    Args:
        page: 页码
        page_size: 每页数量
        role: 角色筛选
        is_active: 是否激活
        search: 搜索关键词
        db: 数据库会话

    Returns:
        用户列表
    """
    
    # 构建查询
    query = db.query(User)
    
    # 筛选条件
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (User.username.like(search_filter)) |
            (User.full_name.like(search_filter)) |
            (User.email.like(search_filter))
        )
    
    # 分页
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": [{
            "id": u.id, "username": u.username, "email": u.email,
            "full_name": u.full_name, "department": u.department,
            "phone": u.phone, "employee_id": u.employee_id,
            "role": u.role.value if hasattr(u.role, 'value') else u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login": u.last_login.isoformat() if u.last_login else None,
        } for u in users],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ==================== 获取用户详情 ====================

@router.get("/{user_id}", response_model=ResponseModel)
async def get_user(
    user_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取用户详情

    Args:
        user_id: 用户ID
        db: 数据库会话

    Returns:
        用户详情
    """
    
    # 获取目标用户
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": _user_to_dict(user),
    }


# ==================== 创建用户 ====================

@router.post("", response_model=ResponseModel, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_create: UserCreate,
    current_user = Depends(get_current_user),
    _ = Depends(require_role("super_admin", "audit_director", "audit_manager")),
    db: Session = Depends(get_db),
):
    """
    创建用户

    Args:
        user_create: 用户创建Schema
        db: 数据库会话

    Returns:
        创建结果
    """
    
    # 检查用户名是否已存在
    if db.query(User).filter(User.username == user_create.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在",
        )
    
    # 检查邮箱是否已存在
    if db.query(User).filter(User.email == user_create.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册",
        )
    
    # 创建新用户
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    hashed_password = pwd_context.hash(user_create.password)
    
    db_user = User(
        username=user_create.username,
        email=user_create.email,
        full_name=user_create.full_name,
        hashed_password=hashed_password,
        department=user_create.department,
        phone=user_create.phone,
        employee_id=user_create.employee_id,
        role=UserRole.VIEWER,  # 默认角色
        is_active=True,
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    logger.info(f"用户创建成功: {db_user.username} (创建人: {current_user.username})")
    
    return {
        "code": 201,
        "message": "创建成功",
        "data": _user_to_dict(db_user),
    }


# ==================== 更新用户 ====================

@router.put("/{user_id}", response_model=ResponseModel)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    更新用户

    Args:
        user_id: 用户ID
        user_update: 用户更新Schema
        db: 数据库会话

    Returns:
        更新结果
    """
    
    # 获取目标用户
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )
    
    # 检查权限（只能由管理员或本人更新）
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.AUDIT_DIRECTOR, UserRole.AUDIT_MANAGER] and current_user.id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 更新用户
    update_data = user_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    logger.info(f"用户更新成功: {user.username} (更新人: {current_user.username})")
    
    return {
        "code": 200,
        "message": "更新成功",
        "data": _user_to_dict(user),
    }


# ==================== 删除用户 ====================

@router.delete("/{user_id}", response_model=ResponseModel)
async def delete_user(
    user_id: str,
    current_user = Depends(get_current_user),
    _ = Depends(require_role("super_admin", "audit_director")),
    db: Session = Depends(get_db),
):
    """
    删除用户（软删除）

    Args:
        user_id: 用户ID
        db: 数据库会话

    Returns:
        删除结果
    """

    # 获取目标用户
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    # 软删除（同时保持 is_active=False 兼容）
    user.soft_delete(deleted_by_id=current_user.id)
    user.is_active = False
    db.commit()

    logger.info(f"用户软删除成功: {user.username} (操作人: {current_user.username})")

    return {
        "code": 200,
        "message": "删除成功",
    }
