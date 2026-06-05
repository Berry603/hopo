"""
认证中间件
Authentication Middleware
"""

from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from loguru import logger
from typing import Optional, Dict, Any

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# HTTP Bearer认证
security = HTTPBearer(auto_error=False)


class AuthMiddleware:
    """
    认证中间件类
    """
    
    def __init__(self):
        self.security = security
    
    async def __call__(self, request: Request):
        """
        中间件调用方法
        
        Args:
            request: FastAPI请求对象
        """
        # 排除不需要认证的路径
        public_paths = {
            "/",
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            f"{settings.API_V1_STR}/auth/login",
            f"{settings.API_V1_STR}/auth/register",
            f"{settings.API_V1_STR}/auth/refresh",
        }
        
        # 如果是公开路径，直接返回
        if request.url.path in public_paths:
            return
        
        # 获取认证凭证
        credentials: Optional[HTTPAuthorizationCredentials] = await self.security(request)
        
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="未提供认证凭证",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 验证Token
        try:
            payload = jwt.decode(
                credentials.credentials,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
            user_id: str = payload.get("sub")
            if user_id is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="无效的认证凭证",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            request.state.user_id = user_id
            request.state.payload = payload
        except JWTError as e:
            logger.error(f"JWT验证失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证凭证",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[int] = None) -> str:
        """
        创建访问Token
        
        Args:
            data: 要编码的数据
            expires_delta: 过期时间（分钟）
        
        Returns:
            编码后的JWT Token
        """
        from datetime import datetime, timedelta
        
        to_encode = data.copy()
        if expires_delta is not None:
            expire = datetime.utcnow() + timedelta(minutes=expires_delta)
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def decode_token(token: str) -> Dict[str, Any]:
        """
        解码Token
        
        Args:
            token: JWT Token
        
        Returns:
            解码后的数据
        """
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM]
            )
            return payload
        except JWTError as e:
            logger.error(f"Token解码失败: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证凭证",
            )
