"""
Celery定时任务定义
Background Task Definitions

数据同步、风险扫描、质量检查、报告生成
"""
from datetime import datetime
from loguru import logger

from app.scheduler import celery_app


# ===================== 数据同步任务 =====================

@celery_app.task(name="app.scheduler.tasks.run_daily_sync")
def run_daily_sync():
    """每日全量数据同步"""
    logger.info("[ETL] 开始每日全量同步...")
    started = datetime.now()
    try:
        from app.services.etl_service import ETLService
        service = ETLService()
        # 获取所有启用的全量同步任务
        results = service.run_sync_tasks(mode="full")
        duration = (datetime.now() - started).total_seconds()
        logger.info(f"[ETL] 每日全量同步完成: {len(results)}个任务, 耗时{duration:.1f}秒")
        return {"status": "success", "task_count": len(results), "duration": duration}
    except Exception as e:
        logger.error(f"[ETL] 每日全量同步失败: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="app.scheduler.tasks.run_incremental_sync")
def run_incremental_sync():
    """增量数据同步"""
    logger.info("[ETL] 开始增量同步...")
    try:
        from app.services.etl_service import ETLService
        service = ETLService()
        results = service.run_sync_tasks(mode="inc")
        return {"status": "success", "task_count": len(results)}
    except Exception as e:
        logger.error(f"[ETL] 增量同步失败: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="app.scheduler.tasks.run_single_sync")
def run_single_sync(task_id: str):
    """执行单个同步任务"""
    logger.info(f"[ETL] 执行单个同步: task_id={task_id}")
    try:
        from app.services.etl_service import ETLService
        service = ETLService()
        result = service.execute_sync_task(task_id)
        return result
    except Exception as e:
        logger.error(f"[ETL] 单个同步失败: {e}")
        return {"status": "failed", "error": str(e)}


# ===================== 风险扫描任务 =====================

@celery_app.task(name="app.scheduler.tasks.run_risk_scan")
def run_risk_scan():
    """每日风险扫描"""
    logger.info("[风险] 开始每日风险扫描...")
    started = datetime.now()
    try:
        from app.services.risk_engine import RiskEngineService
        engine = RiskEngineService()
        results = engine.run_all_rules()
        duration = (datetime.now() - started).total_seconds()
        logger.info(f"[风险] 扫描完成: {len(results)}个风险项, 耗时{duration:.1f}秒")
        return {"status": "success", "risk_count": len(results), "duration": duration}
    except Exception as e:
        logger.error(f"[风险] 扫描失败: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="app.scheduler.tasks.run_single_rule")
def run_single_rule(rule_id: str):
    """执行单条规则扫描"""
    logger.info(f"[风险] 单规则扫描: rule_id={rule_id}")
    try:
        from app.services.risk_engine import RiskEngineService
        engine = RiskEngineService()
        results = engine.run_rule(rule_id)
        return {"status": "success", "results": len(results)}
    except Exception as e:
        logger.error(f"[风险] 单规则扫描失败: {e}")
        return {"status": "failed", "error": str(e)}


# ===================== 数据质量检查 =====================

@celery_app.task(name="app.scheduler.tasks.run_quality_check")
def run_quality_check():
    """数据质量检查"""
    logger.info("[质量] 开始数据质量检查...")
    try:
        from app.services.etl_service import ETLService
        service = ETLService()
        results = service.run_quality_checks()
        passed = sum(1 for r in results if r.get("result") == "pass")
        failed = len(results) - passed
        logger.info(f"[质量] 检查完成: 通过{passed}, 异常{failed}")
        return {"status": "success", "passed": passed, "failed": failed}
    except Exception as e:
        logger.error(f"[质量] 检查失败: {e}")
        return {"status": "failed", "error": str(e)}


# ===================== 报告生成 =====================

@celery_app.task(name="app.scheduler.tasks.generate_weekly_report")
def generate_weekly_report():
    """生成周报"""
    logger.info("[报告] 开始生成周报...")
    try:
        # TODO: 汇总本周审计作业、风险、整改数据，生成PDF报告
        return {"status": "success", "report_url": ""}
    except Exception as e:
        logger.error(f"[报告] 周报生成失败: {e}")
        return {"status": "failed", "error": str(e)}
