"""
FastAPI 认证与权限依赖
Auth & RBAC Dependencies

Usage:
    current_user = Depends(get_current_user)
    _ = Depends(require_permission("risk:rule:manage"))
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from loguru import logger

from app.core.database import get_db
from app.core.auth_utils import decode_token
from app.models.user import User

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """从 JWT 解析当前用户，自动返回 401"""
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="无效的认证凭证")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="用户已被禁用")

    return user


def require_role(*allowed_roles: str):
    """要求用户拥有指定角色之一"""

    def checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
        if user_role not in allowed_roles:
            raise HTTPException(status_code=403, detail="权限不足")
        return current_user

    return checker


def require_permission(permission_code: str):
    """要求用户拥有指定权限（通过 RBAC 角色-权限关联）"""

    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        # super_admin 和 is_superuser 跳过权限检查
        if current_user.is_superuser:
            return current_user
        user_role = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
        if user_role == "super_admin":
            return current_user

        # 通过 RBAC 多对多关联查询权限
        from app.models.rbac import Permission, role_permission, user_role as user_role_table

        has_perm = (
            db.query(Permission)
            .join(role_permission, Permission.id == role_permission.c.permission_id)
            .join(user_role_table, role_permission.c.role_id == user_role_table.c.role_id)
            .filter(
                user_role_table.c.user_id == current_user.id,
                Permission.code == permission_code,
            )
            .first()
        )

        if not has_perm:
            raise HTTPException(status_code=403, detail=f"缺少权限: {permission_code}")

        return current_user

    return checker
