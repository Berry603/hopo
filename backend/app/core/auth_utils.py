"""
认证工具函数
Auth Utility Functions
"""

from jose import jwt, JWTError
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from loguru import logger

from app.core.config import settings


def create_access_token(data: Dict[str, Any], expires_delta: Optional[int] = None) -> str:
    """创建访问Token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes=expires_delta if expires_delta is not None else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """解码Token"""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as e:
        logger.error(f"Token解码失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭证",
        )
