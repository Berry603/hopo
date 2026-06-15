"""
Celery任务调度器
Background Task Scheduler

负责: 数据同步、风险扫描、定时报告
"""
from celery import Celery
from celery.schedules import crontab
from loguru import logger

from app.core.config import settings

# 创建Celery应用
celery_app = Celery(
    "audit_system",
    broker=settings.CELERY_BROKER_URL_BUILD,
    backend=settings.CELERY_RESULT_BACKEND_BUILD,
)

# Celery配置
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,       # 单任务最大1小时
    task_soft_time_limit=3300,  # 软超时55分钟
    worker_max_tasks_per_child=200,
)

# -- 定时任务配置 (Celery Beat) --
celery_app.conf.beat_schedule = {
    # 每日凌晨2点：全量数据同步
    "etl-daily-full-sync": {
        "task": "app.scheduler.tasks.run_daily_sync",
        "schedule": crontab(hour=2, minute=0),
        "options": {"queue": "etl"},
    },
    # 每30分钟：增量数据同步
    "etl-incremental-sync": {
        "task": "app.scheduler.tasks.run_incremental_sync",
        "schedule": crontab(minute="*/30"),
        "options": {"queue": "etl"},
    },
    # 每日早上7点：风险扫描
    "risk-daily-scan": {
        "task": "app.scheduler.tasks.run_risk_scan",
        "schedule": crontab(hour=7, minute=0),
        "options": {"queue": "risk"},
    },
    # 每小时：数据质量检查
    "dq-hourly-check": {
        "task": "app.scheduler.tasks.run_quality_check",
        "schedule": crontab(minute=0),
        "options": {"queue": "etl"},
    },
    # 每周一上午9点：生成周报
    "report-weekly": {
        "task": "app.scheduler.tasks.generate_weekly_report",
        "schedule": crontab(hour=9, minute=0, day_of_week=1),
        "options": {"queue": "report"},
    },
    # 每日凌晨3点：跨系统一致性校验
    "dq-cross-system-check": {
        "task": "app.scheduler.tasks.run_cross_system_check",
        "schedule": crontab(hour=3, minute=0),
        "options": {"queue": "etl"},
    },
    # 每月1日上午8点：月度数据质量报告
    "dq-monthly-report": {
        "task": "app.scheduler.tasks.generate_quality_report",
        "schedule": crontab(hour=8, minute=0, day_of_month=1),
        "options": {"queue": "report"},
    },
    # 每15分钟：同步健康度监控
    "dq-sync-health-monitor": {
        "task": "app.scheduler.tasks.monitor_sync_health",
        "schedule": crontab(minute="*/15"),
        "options": {"queue": "etl"},
    },
}

# 导入任务模块（确保任务被注册）
import app.scheduler.tasks  # noqa


def init_scheduler():
    """初始化调度器 - 开发环境用APScheduler替代"""
    logger.info(f"Celery调度器已配置, broker={settings.CELERY_BROKER_URL_BUILD}")
