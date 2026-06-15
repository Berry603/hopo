"""
暂存数据服务
Staging Data Service — 动态表创建和数据写入

支持基于 Adapter schema 输出动态创建目标表，并执行批量 UPSERT。
Phase 1 使用通用 staging_data 表（JSON 列）存储所有同步数据。
"""
import uuid
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import create_engine, text, Column, String, DateTime, JSON, Text
from sqlalchemy.orm import Session
from loguru import logger

from app.core.config import settings
from app.core.database import SessionLocal, Base


def _get_engine():
    """获取数据库引擎"""
    from app.core.database import engine
    return engine


def ensure_staging_schema():
    """
    确保 staging 基础设施表存在

    创建 staging_data 通用表（用于存储所有同步数据行）。
    Phase 1：使用通用 JSON staging 表，避免为每个源表动态建表。
    """
    engine = _get_engine()
    # 用原始 SQL 检查并创建（避免 SQLAlchemy ORM 元数据冲突）
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS staging_data (
                id TEXT PRIMARY KEY,
                source_system TEXT NOT NULL,
                table_name TEXT NOT NULL,
                sync_task_id TEXT,
                data JSON NOT NULL,
                checksum TEXT,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_staging_source_table
            ON staging_data(source_system, table_name)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_staging_sync_task
            ON staging_data(sync_task_id)
        """))
        conn.commit()
    logger.info("[Staging] staging_data 表已就绪")


def upsert_rows(
    source_system: str,
    table_name: str,
    rows: List[Dict[str, Any]],
    sync_task_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> Dict[str, int]:
    """
    将数据行写入 staging_data 表（批量 UPSERT）

    每条 row 存为一行，用 checksum 做去重：
    - 新 checksum → INSERT
    - 已有 checksum → 跳过（UPDATE 计数）

    返回 {inserted, updated, skipped} 计数
    """
    if not rows:
        return {"inserted": 0, "updated": 0, "skipped": 0}

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        inserted = 0
        updated = 0
        skipped = 0
        now = datetime.now(timezone.utc).isoformat()

        for row in rows:
            data_json = json.dumps(row, ensure_ascii=False, default=str)
            checksum = hashlib.sha256(data_json.encode()).hexdigest()

            # 检查是否已存在
            existing = db.execute(
                text("SELECT id FROM staging_data WHERE checksum = :cs"),
                {"cs": checksum},
            ).fetchone()

            if existing:
                # UPDATE
                db.execute(
                    text("""
                        UPDATE staging_data
                        SET data = :data, synced_at = :ts
                        WHERE checksum = :cs
                    """),
                    {"data": data_json, "ts": now, "cs": checksum},
                )
                updated += 1
            else:
                # INSERT
                row_id = str(uuid.uuid4())
                db.execute(
                    text("""
                        INSERT INTO staging_data (id, source_system, table_name, sync_task_id, data, checksum, synced_at)
                        VALUES (:id, :src, :tbl, :task, :data, :cs, :ts)
                    """),
                    {
                        "id": row_id, "src": source_system, "tbl": table_name,
                        "task": sync_task_id, "data": data_json, "cs": checksum, "ts": now,
                    },
                )
                inserted += 1

        db.commit()
        logger.debug(f"[Staging] {table_name}: +{inserted} ~{updated} ={skipped}")
        return {"inserted": inserted, "updated": updated, "skipped": skipped}

    except Exception as e:
        db.rollback()
        logger.error(f"[Staging] 写入失败 {table_name}: {e}")
        raise
    finally:
        if should_close:
            db.close()


def get_row_count(source_system: str, table_name: str) -> int:
    """获取某源系统+表的数据行数"""
    engine = _get_engine()
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT COUNT(*) FROM staging_data WHERE source_system = :s AND table_name = :t"),
            {"s": source_system, "t": table_name},
        )
        return result.scalar() or 0


def clear_staging(source_system: str, table_name: str):
    """清空某源系统+表的 staging 数据（FULL模式用）"""
    engine = _get_engine()
    with engine.connect() as conn:
        conn.execute(
            text("DELETE FROM staging_data WHERE source_system = :s AND table_name = :t"),
            {"s": source_system, "t": table_name},
        )
        conn.commit()
    logger.info(f"[Staging] 已清空: {source_system}/{table_name}")
