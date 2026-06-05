"""
日志配置模块
Logging Configuration Module
"""

import sys
from pathlib import Path
from loguru import logger

from app.core.config import settings


def setup_logging():
    """
    配置Loguru日志系统
    """
    # 移除默认处理器
    logger.remove()
    
    # 控制台输出
    logger.add(
        sys.stdout,
        level=settings.LOG_LEVEL,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        colorize=True,
        enqueue=True,
    )
    
    # 主日志文件 - 按日期轮转
    log_file = Path(settings.LOG_DIR) / "audit_{time:YYYY-MM-DD}.log"
    logger.add(
        log_file,
        rotation="00:00",
        retention="30 days",
        compression="zip",
        level=settings.LOG_LEVEL,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        encoding="utf-8",
        enqueue=True,
    )
    
    # 错误日志文件
    error_log_file = Path(settings.LOG_DIR) / "error_{time:YYYY-MM-DD}.log"
    logger.add(
        error_log_file,
        rotation="00:00",
        retention="90 days",
        compression="zip",
        level="ERROR",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        encoding="utf-8",
        enqueue=True,
        backtrace=True,
        diagnose=True,
    )
    
    logger.info("日志系统初始化完成")


def get_logger(name: str = None):
    """
    获取Logger实例
    
    Args:
        name: 日志记录器名称（可选）
    
    Returns:
        Logger实例
    """
    return logger.bind(name=name)
