"""
ETL服务层
ETL Service - 数据抽取、转换、加载

协调适配器 → 同步任务 → 质量检查全流程
"""
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from loguru import logger

from app.adapters.base import (
    BaseDataSourceAdapter, DataSourceConfig, SyncMode, SyncResult
)
from app.adapters.yunzhijia import get_adapter
from app.core.database import SessionLocal
from app.services.staging_service import ensure_staging_schema, upsert_rows, clear_staging


class ETLService:
    """ETL服务"""

    def __init__(self):
        # 确保 staging 基础设施存在
        ensure_staging_schema()

    async def sync_source(
        self,
        source_config: DataSourceConfig,
        tables: Optional[List[str]] = None,
        mode: SyncMode = SyncMode.FULL,
    ) -> List[SyncResult]:
        """
        同步单个数据源的全部/指定表

        Args:
            source_config: 数据源配置
            tables: 要同步的表列表, None=全部
            mode: 同步模式
        """
        results = []
        adapter = get_adapter(source_config)

        async with adapter as adp:
            target_tables = tables or await adp.fetch_tables()

            for table in target_tables:
                logger.info(f"[ETL] 同步: {source_config.name}/{table}")
                result = await self._sync_table(adp, table, mode)
                results.append(result)

        return results

    async def _sync_table(
        self,
        adapter: BaseDataSourceAdapter,
        table: str,
        mode: SyncMode,
    ) -> SyncResult:
        """同步单表 —— 抽取 → 写入 staging → 更新监控表"""
        started = datetime.now()
        source_name = adapter.config.name
        result = SyncResult(
            source_id=adapter.config.id,
            mode=mode,
            started_at=started,
        )

        db = SessionLocal()
        try:
            total = await adapter.fetch_count(table)
            result.total_rows = total

            # FULL 模式：先清空已有 staging 数据
            if mode == SyncMode.FULL:
                clear_staging(source_name, table)

            # 逐批写入 staging
            batch_count = 0
            async for batch in adapter.stream_data(table, batch_size=1000):
                stats = upsert_rows(
                    source_system=source_name,
                    table_name=table,
                    rows=batch,
                    db=db,
                )
                result.inserted += stats["inserted"]
                result.updated += stats["updated"]
                result.skipped += stats["skipped"]
                batch_count += 1

            result.success = True
            self._update_monitoring_tables(db, source_name, table, result)

        except Exception as e:
            result.errors.append(str(e))
            logger.error(f"[ETL] 同步失败 {table}: {e}")
            self._update_monitoring_tables(db, source_name, table, result, failed=True)

        finally:
            result.finished_at = datetime.now()
            db.close()

        logger.info(
            f"[ETL] {table}: total={result.total_rows}, "
            f"inserted={result.inserted}, updated={result.updated}, "
            f"errors={len(result.errors)}, "
            f"duration={result.duration_seconds:.1f}s"
        )
        return result

    def _update_monitoring_tables(
        self, db: Session, source_name: str, table: str,
        result: SyncResult, failed: bool = False,
    ):
        """
        更新监控表：sync_status + etl_sync_logs

        sync_status: 每源系统+表一条记录，反映最新同步状态
        etl_sync_logs: 每次同步一条日志记录
        """
        now = datetime.now(timezone.utc)

        # ---- sync_status (data_quality.py) ----
        try:
            from app.models.data_quality import SyncStatus
            status_record = db.query(SyncStatus).filter(
                SyncStatus.source_system == source_name,
                SyncStatus.table_name == table,
            ).first()

            if not status_record:
                status_record = SyncStatus(
                    source_system=source_name,
                    table_name=table,
                    sync_status="online",
                )
                db.add(status_record)

            if failed:
                status_record.sync_status = "error"
                status_record.error_message = "; ".join(result.errors)[:500]
            else:
                status_record.sync_status = "online"
                status_record.error_message = None
                status_record.last_success_at = now

            status_record.last_sync_at = now
            status_record.records_synced = (status_record.records_synced or 0) + result.inserted
            status_record.records_failed = (status_record.records_failed or 0) + len(result.errors)
            status_record.sync_duration_seconds = result.duration_seconds
            # 简单计算 fail_rate
            total_synced = (status_record.records_synced or 0) + (status_record.records_failed or 0)
            status_record.fail_rate = (
                (status_record.records_failed or 0) / total_synced * 100 if total_synced > 0 else 0
            )

        except Exception as e:
            logger.warning(f"[ETL] 更新 sync_status 失败: {e}")

        # ---- etl_sync_logs ----
        try:
            from app.models.etl import SyncLogModel
            log_entry = SyncLogModel(
                task_id=result.source_id,
                status="failed" if failed else ("success" if result.success else "partial"),
                total_rows=result.total_rows,
                inserted=result.inserted,
                updated=result.updated,
                skipped=result.skipped,
                errors=result.errors if result.errors else None,
                started_at=result.started_at,
                finished_at=result.finished_at,
                duration_seconds=result.duration_seconds,
            )
            db.add(log_entry)
        except Exception as e:
            logger.warning(f"[ETL] 创建 sync_log 失败: {e}")

        db.commit()

    # -- 同步任务管理（通过数据库） --

    def run_sync_tasks(self, mode: str = "full") -> List[Dict]:
        """
        执行数据库中的同步任务

        从 ds_configs + etl_sync_tasks 表读取配置并执行
        """
        logger.info(f"[ETL] 执行 mode={mode} 的所有任务")
        db = SessionLocal()
        results = []

        try:
            from app.models.etl import DataSourceConfigModel, SyncTaskModel

            # 查询启用的数据源
            sources = db.query(DataSourceConfigModel).filter(
                DataSourceConfigModel.enabled == True
            ).all()

            if not sources:
                logger.info("[ETL] 没有启用的数据源，跳过")
                return []

            for source in sources:
                # 构建 DataSourceConfig
                ds_config = DataSourceConfig(
                    id=source.id,
                    name=source.name,
                    source_type=source.source_type,
                    config=source.config_data or {},
                )

                # 查询该数据源的同步任务
                tasks = db.query(SyncTaskModel).filter(
                    SyncTaskModel.source_id == source.id,
                    SyncTaskModel.enabled == True,
                ).all()

                if not tasks:
                    logger.info(f"[ETL] {source.name}: 无启用的同步任务")
                    continue

                tables = [t.source_table for t in tasks]

                # 执行同步（异步 → 同步包装）
                try:
                    loop = asyncio.new_event_loop()
                    sync_results = loop.run_until_complete(
                        self.sync_source(ds_config, tables, SyncMode.FULL if mode == "full" else SyncMode.INCREMENTAL)
                    )
                    loop.close()

                    # 更新 SyncTaskModel 统计
                    for task in tasks:
                        task.last_run_at = datetime.now(timezone.utc)
                        task.last_status = "success"
                        db.commit()

                    results.extend([
                        {
                            "source": source.name,
                            "table": r.source_id,
                            "inserted": r.inserted,
                            "updated": r.updated,
                            "errors": len(r.errors),
                            "duration": r.duration_seconds,
                        }
                        for r in sync_results
                    ])
                except Exception as e:
                    logger.error(f"[ETL] 同步失败 {source.name}: {e}")
                    results.append({"source": source.name, "error": str(e)})

        except Exception as e:
            logger.error(f"[ETL] run_sync_tasks 失败: {e}")
        finally:
            db.close()

        return results

    def execute_sync_task(self, task_id: str) -> Dict:
        """
        执行单个同步任务（按 etl_sync_tasks.id）
        """
        logger.info(f"[ETL] 执行任务: {task_id}")
        db = SessionLocal()

        try:
            from app.models.etl import DataSourceConfigModel, SyncTaskModel

            task = db.query(SyncTaskModel).filter(SyncTaskModel.id == task_id).first()
            if not task:
                return {"task_id": task_id, "status": "failed", "error": "任务不存在"}

            source = db.query(DataSourceConfigModel).filter(
                DataSourceConfigModel.id == task.source_id
            ).first()
            if not source:
                return {"task_id": task_id, "status": "failed", "error": "数据源不存在"}

            ds_config = DataSourceConfig(
                id=source.id,
                name=source.name,
                source_type=source.source_type,
                config=source.config_data or {},
            )

            # 执行同步
            loop = asyncio.new_event_loop()
            sync_results = loop.run_until_complete(
                self.sync_source(ds_config, [task.source_table], SyncMode.FULL)
            )
            loop.close()

            # 更新任务统计
            if sync_results:
                r = sync_results[0]
                task.last_run_at = datetime.now(timezone.utc)
                task.last_status = "success" if r.success else "failed"
                task.total_rows = (task.total_rows or 0) + r.inserted
                db.commit()

                return {
                    "task_id": task_id,
                    "status": "success" if r.success else "failed",
                    "inserted": r.inserted,
                    "updated": r.updated,
                    "errors": len(r.errors),
                    "duration": r.duration_seconds,
                }

            return {"task_id": task_id, "status": "completed", "inserted": 0}

        except Exception as e:
            logger.error(f"[ETL] execute_sync_task 失败: {e}")
            return {"task_id": task_id, "status": "failed", "error": str(e)}
        finally:
            db.close()

    def run_quality_checks(self) -> List[Dict]:
        """执行所有启用的数据质量检查规则"""
        logger.info("[ETL] 执行数据质量检查")
        db = SessionLocal()
        results = []

        try:
            # 检查 staging_data 中的数据质量
            from sqlalchemy import text
            checks = [
                ("空值检查", "SELECT COUNT(*) FROM staging_data WHERE data IS NULL"),
                ("数据量检查", "SELECT source_system, table_name, COUNT(*) as cnt FROM staging_data GROUP BY 1, 2"),
            ]
            for name, sql in checks:
                try:
                    rows = db.execute(text(sql)).fetchall()
                    results.append({
                        "rule": name,
                        "result": "pass",
                        "detail": [dict(r._mapping) for r in rows][:5] if rows else [],
                    })
                except Exception as e:
                    results.append({"rule": name, "result": "error", "error": str(e)})
        finally:
            db.close()

        return results

    # -- 数据转换工具 --
    
    @staticmethod
    def transform_rows(
        rows: List[Dict],
        column_mapping: Dict[str, str],
    ) -> List[Dict]:
        """字段映射转换"""
        return [
            {column_mapping.get(k, k): v for k, v in row.items()}
            for row in rows
        ]

    @staticmethod
    def validate_rows(
        rows: List[Dict],
        required_columns: List[str],
    ) -> tuple[List[Dict], List[Dict]]:
        """验证并分离有效/无效行"""
        valid, invalid = [], []
        for row in rows:
            if all(row.get(col) is not None for col in required_columns):
                valid.append(row)
            else:
                invalid.append(row)
        return valid, invalid
