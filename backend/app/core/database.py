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
    from app.models import (user, audit_project, risk, rectification, knowledge,
        etl, data_quality, rbac, sso, audit_log, template, audit,
        audit_procedure, evidence_chain, phase_progress, notification)
    
    logger.info("开始创建数据库表...")
    Base.metadata.create_all(bind=engine)
    logger.info("数据库表创建完成")

    # 执行 SQLite 迁移（软删除列等）
    if settings.USE_SQLITE:
        _run_sqlite_migrations()


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


def _run_sqlite_migrations():
    """
    执行 SQLite 的表结构迁移

    SQLite 不支持 ALTER TABLE DROP COLUMN 和 ADD COLUMN with constraints，
    因此用 PRAGMA table_info 检查列是否存在，然后执行 ALTER TABLE ADD COLUMN。
    """
    import sqlite3
    from pathlib import Path

    db_path = settings.SQLITE_DB_PATH
    if not Path(db_path).exists():
        return

    conn = sqlite3.connect(db_path)
    try:
        # 需要软删除列的表（Category A + B）
        tables_to_migrate = [
            "audit_projects", "audit_findings", "audit_tasks", "audit_worksheets",
            "rectification_orders", "rectification_evidences", "procedure_executions",
            "procedure_rows", "users", "worksheet_templates", "risk_rules",
            "knowledge_items", "data_quality_rules", "ds_configs", "etl_sync_tasks",
            "phase_progress", "evidence_links",
        ]

        for table_name in tables_to_migrate:
            # 检查表是否存在
            cur = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table_name,)
            )
            if not cur.fetchone():
                continue

            # 检查各列是否已存在
            cur = conn.execute(f"PRAGMA table_info('{table_name}')")
            existing_cols = {row[1] for row in cur.fetchall()}

            if "is_deleted" not in existing_cols:
                conn.execute(
                    f"ALTER TABLE {table_name} ADD COLUMN is_deleted BOOLEAN DEFAULT 0"
                )
                logger.info(f"迁移: {table_name}.is_deleted 列已添加")

            if "deleted_at" not in existing_cols:
                conn.execute(
                    f"ALTER TABLE {table_name} ADD COLUMN deleted_at TIMESTAMP"
                )
                logger.info(f"迁移: {table_name}.deleted_at 列已添加")

            if "deleted_by_id" not in existing_cols:
                conn.execute(
                    f"ALTER TABLE {table_name} ADD COLUMN deleted_by_id VARCHAR(36)"
                )
                logger.info(f"迁移: {table_name}.deleted_by_id 列已添加")

        conn.commit()
        logger.info("SQLite 软删除迁移完成")

        # phase_progress 复核机制列（旧表可能缺少）
        pp_cols_to_add = [
            ("reviewer_id", "VARCHAR(36)"),
            ("review_status", "VARCHAR(20) DEFAULT 'none'"),
            ("review_comment", "TEXT"),
            ("reviewed_at", "TIMESTAMP"),
            ("started_at", "TIMESTAMP"),
            ("completed_at", "TIMESTAMP"),
        ]
        cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='phase_progress'")
        if cur.fetchone():
            cur = conn.execute("PRAGMA table_info('phase_progress')")
            existing_cols = {row[1] for row in cur.fetchall()}
            for col_name, col_type in pp_cols_to_add:
                if col_name not in existing_cols:
                    conn.execute(f"ALTER TABLE phase_progress ADD COLUMN {col_name} {col_type}")
                    logger.info(f"迁移: phase_progress.{col_name} 列已添加")

        conn.commit()
    except Exception as e:
        logger.warning(f"SQLite 迁移失败（可能已执行过）: {e}")
    finally:
        conn.close()
