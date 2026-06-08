"""
认证API端点
Authentication API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from loguru import logger
from typing import Dict, Any

from app.core.database import get_db
from app.core.config import settings
from app.core.auth_utils import create_access_token, decode_token
from app.models.user import User, UserRole
from app.schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    ResponseModel,
)

router = APIRouter()
security = HTTPBearer()

# ==================== 用户注册 ====================

@router.post("/register", response_model=ResponseModel, status_code=status.HTTP_201_CREATED)
async def register(user_create: UserCreate, db: Session = Depends(get_db)):
    """
    用户注册
    
    Args:
        user_create: 用户创建Schema
        db: 数据库会话
    
    Returns:
        注册结果
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
    
    logger.info(f"用户注册成功: {db_user.username}")
    
    return {
        "code": 201,
        "message": "注册成功",
        "data": {
            "user_id": db_user.id,
            "username": db_user.username,
        }
    }


# ==================== 用户登录 ====================

@router.post("/login", response_model=ResponseModel)
async def login(user_login: UserLogin, db: Session = Depends(get_db)):
    """
    用户登录
    
    Args:
        user_login: 用户登录Schema
        db: 数据库会话
    
    Returns:
        登录结果（包含Token）
    """
    # 查找用户
    user = db.query(User).filter(User.username == user_login.username).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    
    # 验证密码
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    if not pwd_context.verify(user_login.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    
    # 检查用户是否激活
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户未激活，请联系管理员",
        )
    
    # 更新最后登录时间
    from datetime import datetime
    user.last_login = datetime.utcnow()
    db.commit()
    
    # 创建Token
    access_token = create_access_token(
        data={"sub": user.id, "username": user.username, "role": user.role}
    )
    refresh_token = create_access_token(
        data={"sub": user.id, "type": "refresh"},
        expires_delta=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60,  # 转换为分钟
    )
    
    logger.info(f"用户登录成功: {user.username}")
    
    return {
        "code": 200,
        "message": "登录成功",
        "data": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # 转换为秒
            "user": UserResponse.from_orm(user).dict(),
        }
    }


# ==================== 刷新Token ====================

@router.post("/refresh", response_model=ResponseModel)
async def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    刷新访问Token
    
    Args:
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        新的Token
    """
    # 解码Token
    payload = decode_token(credentials.credentials)
    
    # 检查是否为刷新Token
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的刷新Token",
        )
    
    # 获取用户
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或未激活",
        )
    
    # 创建新的访问Token
    access_token = create_access_token(
        data={"sub": user.id, "username": user.username, "role": user.role}
    )
    
    return {
        "code": 200,
        "message": "Token刷新成功",
        "data": {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }
    }


# ==================== 获取当前用户信息 ====================

@router.get("/me", response_model=ResponseModel)
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    获取当前登录用户信息
    
    Args:
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        用户信息
    """
    # 解码Token
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    
    # 获取用户
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": UserResponse.from_orm(user).dict(),
    }
