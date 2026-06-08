"""
数据库配置和会话管理
Database Configuration and Session Management
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from loguru import logger

from app.core.config import settings

# 创建数据库引擎
if settings.USE_SQLITE:
    # SQLite配置（开发环境）
    engine = create_engine(
        settings.SQLALCHEMY_DATABASE_URI_BUILD,
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
    )
    logger.info(f"使用SQLite数据库: {settings.SQLITE_DB_PATH}")
else:
    # PostgreSQL配置（生产环境）
    engine = create_engine(
        settings.SQLALCHEMY_DATABASE_URI_BUILD,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        echo=settings.DEBUG,
    )
    logger.info(f"使用PostgreSQL数据库: {settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")

# 创建SessionLocal类
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建Base类
Base = declarative_base()


def get_db():
    """
    获取数据库会话
    Dependency for FastAPI endpoints
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    初始化数据库
    创建所有表
    """
    from app.models import user, audit_project, risk, rectification, knowledge, etl, rbac, sso, audit_log, template
    
    logger.info("开始创建数据库表...")
    Base.metadata.create_all(bind=engine)
    logger.info("数据库表创建完成")


def drop_db():
    """
    删除所有数据库表
    警告：会丢失所有数据！
    """
    if settings.ENVIRONMENT == "production":
        logger.error("生产环境不允许删除数据库！")
        return
    
    logger.warning("开始删除所有数据库表...")
    Base.metadata.drop_all(bind=engine)
    logger.warning("所有数据库表已删除")
