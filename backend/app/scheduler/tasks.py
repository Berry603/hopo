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


# ===================== 数据质量检查任务 =====================

@celery_app.task(name="app.scheduler.tasks.run_quality_check")
def run_quality_check():
    """每日数据质量检查 - 空值率/异常值/波动检测"""
    logger.info("[质量] 开始每日数据质量检查...")
    started = datetime.now()
    try:
        from app.services.data_quality_service import DataQualityService
        from app.core.database import SessionLocal
        from app.models.data_quality import QualityRule

        service = DataQualityService()
        db = SessionLocal()
        rules = db.query(QualityRule).filter(QualityRule.is_active == "1").all()

        passed = 0
        failed = 0
        for rule in rules:
            result = service._check_rule(rule)
            if result.get("passed"):
                passed += 1
            else:
                failed += 1

        db.close()
        duration = (datetime.now() - started).total_seconds()
        logger.info(f"[质量] 检查完成: 通过{passed}, 异常{failed}, 耗时{duration:.1f}秒")
        return {"status": "success", "total": len(rules), "passed": passed, "failed": failed, "duration": duration}
    except Exception as e:
        logger.error(f"[质量] 检查失败: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="app.scheduler.tasks.run_cross_system_check")
def run_cross_system_check():
    """跨系统一致性校验 - 每日执行"""
    logger.info("[质量] 开始跨系统一致性校验...")
    started = datetime.now()
    try:
        from app.services.data_quality_service import DataQualityService, PRESET_CROSS_SYSTEM_CHECKS
        from app.core.database import SessionLocal
        from app.models.data_quality import CrossSystemCheck

        service = DataQualityService()
        db = SessionLocal()

        checks = db.query(CrossSystemCheck).filter(CrossSystemCheck.is_active == "1").all()
        results = []

        if checks:
            for check in checks:
                result = service.check_cross_system_consistency(check)
                check.last_check_at = datetime.now()
                check.total_compared = result["total_compared"]
                check.matched = result["matched"]
                check.mismatched = result["mismatched"]
                check.match_rate = result["match_rate"]
                results.append(result)
            db.commit()
        else:
            for preset in PRESET_CROSS_SYSTEM_CHECKS:
                results.append({"check_id": preset["check_id"], "name": preset["name"], "passed": True})

        db.close()
        duration = (datetime.now() - started).total_seconds()
        logger.info(f"[质量] 跨系统校验完成: {len(results)}项, 耗时{duration:.1f}秒")
        return {"status": "success", "check_count": len(results), "duration": duration}
    except Exception as e:
        logger.error(f"[质量] 跨系统校验失败: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="app.scheduler.tasks.generate_quality_report")
def generate_quality_report():
    """生成月度数据质量健康报告"""
    logger.info("[质量] 开始生成月度数据质量报告...")
    try:
        from app.services.data_quality_service import DataQualityService
        service = DataQualityService()
        now = datetime.now()
        report_month = f"{now.year}-{now.month:02d}"
        report = service.generate_monthly_report(report_month)
        logger.info(f"[质量] 月度报告生成完成: {report_month}, 综合得分={report['overall_score']}")
        return {"status": "success", "report_month": report_month, "overall_score": report["overall_score"]}
    except Exception as e:
        logger.error(f"[质量] 月度报告生成失败: {e}")
        return {"status": "failed", "error": str(e)}


@celery_app.task(name="app.scheduler.tasks.monitor_sync_health")
def monitor_sync_health():
    """监控数据同步健康度 - 异常告警"""
    logger.info("[质量] 开始同步健康度监控...")
    try:
        from app.services.data_quality_service import DataQualityService
        service = DataQualityService()
        health = service.get_sync_health_dashboard()

        if health["needs_alert"]:
            logger.warning(
                f"[质量] 同步健康度告警: 延迟源={health['delayed_count']}, "
                f"异常源={health['error']}, 健康度={health['health_score']}%"
            )
            # TODO: 发送钉钉/企业微信告警

        return {"status": "success", "health_score": health["health_score"], "needs_alert": health["needs_alert"]}
    except Exception as e:
        logger.error(f"[质量] 同步健康度监控失败: {e}")
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
