"""
日志记录中间件
Logging Middleware
"""

from fastapi import Request
from loguru import logger
import time
import json


class LoggingMiddleware:
    """
    日志记录中间件
    记录请求和响应信息
    """
    
    async def __call__(self, request: Request):
        """
        中间件调用方法
        
        Args:
            request: FastAPI请求对象
        """
        # 记录请求开始
        start_time = time.time()
        
        # 获取请求信息
        request_info = {
            "method": request.method,
            "url": str(request.url),
            "client_host": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", "unknown"),
        }
        
        logger.debug(f"请求开始: {json.dumps(request_info, ensure_ascii=False)}")
        
        # 继续处理请求
        response = None
        
        # 记录响应
        process_time = time.time() - start_time
        if response:
            logger.debug(f"请求结束: {request.method} {request.url.path} - 状态: {response.status_code} - 耗时: {process_time:.3f}s")
        
        return
