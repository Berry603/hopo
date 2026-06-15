"""
审计操作日志装饰器
自动记录关键操作的审计日志
"""
import time
import functools
from typing import Optional, Callable
from fastapi import Request
from loguru import logger

from app.models.audit_log import AuditLog
from app.core.database import SessionLocal


def log_operation(
    module: str,
    action: str,
    resource_func: Optional[Callable] = None,
    get_detail: Optional[Callable] = None,
):
    """
    审计操作日志装饰器
    
    用法:
        @router.post("/projects/{id}/files/upload")
        @log_operation(module="文件管理", action="上传文件",
                       resource_func=lambda *a, **kw: kw.get('project_id'))
        async def upload_file(project_id: str, ...):
            ...
    
    Args:
        module: 操作模块名称（如 "文件管理", "阶段进度"）
        action: 操作动作（如 "上传文件", "删除文件"）
        resource_func: 从请求参数中提取资源标识的函数
        get_detail: 从响应中提取详情描述的函数
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.time()
            request: Optional[Request] = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if not request and 'request' in kwargs:
                request = kwargs['request']
            
            # 提取用户信息（从依赖注入或 request.state）
            user_id = None
            username = "system"
            if hasattr(request, 'state') and hasattr(request.state, 'user'):
                try:
                    user_id = request.state.user.id
                    username = request.state.user.username
                except (AttributeError, ValueError):
                    pass
            
            # 执行原始函数
            try:
                result = await func(*args, **kwargs)
                duration = int((time.time() - start) * 1000)
                status = "success"
                
                # 查询参数中提取资源标识
                resource = None
                if resource_func:
                    try:
                        resource = resource_func(*args, **kwargs)
                    except Exception:
                        resource = str(kwargs)
                
                # 详情
                detail = None
                if get_detail:
                    try:
                        detail = get_detail(result)
                    except Exception:
                        detail = None
                
                # 写日志（异步不影响主流程）
                try:
                    db = SessionLocal()
                    log = AuditLog(
                        user_id=user_id,
                        username=username,
                        ip_address=request.client.host if request and request.client else None,
                        action=action,
                        module=module,
                        resource=resource,
                        description=detail or action,
                        status="success",
                        duration_ms=duration,
                    )
                    db.add(log)
                    db.commit()
                    db.close()
                except Exception as e:
                    logger.warning(f"审计日志写入失败: {e}")
                
                return result
                
            except Exception as e:
                duration = int((time.time() - start) * 1000)
                # 记录失败日志
                try:
                    db = SessionLocal()
                    log = AuditLog(
                        user_id=user_id,
                        username=username,
                        action=action,
                        module=module,
                        description=f"{action}失败: {str(e)[:200]}",
                        status="failed",
                        error_message=str(e)[:500],
                        duration_ms=duration,
                    )
                    db.add(log)
                    db.commit()
                    db.close()
                except Exception:
                    pass
                raise
        
        return wrapper
    return decorator
