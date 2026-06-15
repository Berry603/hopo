"""
API v1 路由汇总
API v1 Router Aggregation
"""

from fastapi import APIRouter
from loguru import logger

# 创建API v1路由
api_router = APIRouter()

# 导入各模块路由
from app.api.v1.endpoints import auth
from app.api.v1.endpoints import users
from app.api.v1.endpoints import audit_projects
from app.api.v1.endpoints import audit_procedure
from app.api.v1.endpoints import audit_tasks
from app.api.v1.endpoints import project_files
from app.api.v1.endpoints import risk
from app.api.v1.endpoints import rectification
from app.api.v1.endpoints import knowledge
from app.api.v1.endpoints import data_quality
from app.api.v1.endpoints import query
from app.api.v1.endpoints import templates
from app.api.v1.endpoints import audit_logs
from app.api.v1.endpoints import notifications


# 注册路由
api_router.include_router(auth.router, prefix="/auth", tags=["认证管理"])
api_router.include_router(users.router, prefix="/users", tags=["用户管理"])
api_router.include_router(audit_projects.router, prefix="/audit/projects", tags=["审计项目管理"])
api_router.include_router(risk.router, prefix="/risk", tags=["风险预警中心"])
api_router.include_router(rectification.router, prefix="/rectification", tags=["整改跟踪中心"])
api_router.include_router(knowledge.router, prefix="/knowledge", tags=["知识管理中心"])
api_router.include_router(data_quality.router, prefix="/data-quality", tags=["数据治理与质量中心"])
api_router.include_router(query.router, prefix="/query", tags=["智能查询中心"])
api_router.include_router(templates.router, tags=["底稿模板管理"])
api_router.include_router(audit_procedure.router, prefix="/audit/procedures", tags=["审计程序与穿行测试"])
api_router.include_router(project_files.router, prefix="/audit", tags=["项目文件管理"])
api_router.include_router(audit_tasks.router, prefix="/audit", tags=["审计任务管理"])
api_router.include_router(audit_logs.router, prefix="/audit", tags=["审计日志管理"])
api_router.include_router(notifications.router, prefix="/audit", tags=["通知管理"])

logger.info("API v1 路由注册完成")
