"""
日志记录中间件
Logging Middleware
"""

from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from loguru import logger
import time
import json


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    日志记录中间件
    记录请求和响应信息
    """
    
    async def dispatch(self, request: Request, call_next):
        """处理请求"""
        start_time = time.time()
        
        logger.debug(f"请求: {request.method} {request.url.path}")
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        logger.debug(f"响应: {request.method} {request.url.path} - {response.status_code} - {process_time:.3f}s")
        
        return response
