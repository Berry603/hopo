"""
认证中间件
Authentication Middleware
"""

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from loguru import logger
from typing import Optional

from app.core.config import settings

security = HTTPBearer(auto_error=False)


class AuthMiddleware(BaseHTTPMiddleware):
    """JWT认证中间件，校验请求Token并注入用户信息到request.state"""

    async def dispatch(self, request: Request, call_next):
        # 公开路径白名单
        public_paths = {
            "/",
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            f"{settings.API_V1_STR}/openapi.json",
            f"{settings.API_V1_STR}/auth/login",
            f"{settings.API_V1_STR}/auth/register",
            f"{settings.API_V1_STR}/auth/refresh",
        }

        if request.url.path in public_paths:
            return await call_next(request)

        # 模板下载也公开
        if "/templates/" in request.url.path and "/download" in request.url.path:
            return await call_next(request)

        credentials: Optional[HTTPAuthorizationCredentials] = await security(request)
        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="未提供认证凭证",
                headers={"WWW-Authenticate": "Bearer"},
            )

        try:
            payload = jwt.decode(
                credentials.credentials,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
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

        return await call_next(request)
