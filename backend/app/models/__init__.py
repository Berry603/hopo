"""
模型初始化文件
Models Initialization File
"""

from app.models.user import User, UserRole
from app.models.audit_project import (
    AuditProject,
    AuditType,
    AuditPhase,
    ProjectStatus,
)
from app.models.risk import (
    RiskRule,
    RiskAlert,
    RiskType,
    SeverityLevel,
    AlertStatus,
    RuleType,
)
from app.models.rectification import (
    RectificationOrder,
    RectificationEvidence,
    OrderStatus,
)
from app.models.audit import (
    AuditFinding,
    AuditTask,
    AuditWorksheet,
    FindingSeverity,
    FindingStatus,
    TaskStatus,
    WorksheetStatus,
)
from app.models.knowledge import (
    KnowledgeItem,
    Regulation,
    CaseStudy,
    KnowledgeType,
)
from app.models.data_quality import (
    QualityRule,
    QualityReport,
    SyncStatus,
    DataLineage,
    RuleType as DataQualityRuleType,
    SeverityLevel as DataQualitySeverityLevel,
)
from app.models.etl import (
    DataSourceConfigModel,
    SyncTaskModel,
    SyncLogModel,
    QualityRuleModel,
    QualityCheckResultModel,
)
from app.models.rbac import (
    Permission,
    Role,
    role_permission,
    user_role,
    PRESET_PERMISSIONS,
    PRESET_ROLES,
)
from app.models.sso import (
    SSOProvider,
    SSOLog,
)
from app.models.audit_log import (
    AuditLog,
    SensitiveDataAccess,
)

# 导出所有模型
__all__ = [
    # 用户模型
    "User",
    "UserRole",
    
    # 审计项目模型
    "AuditProject",
    "AuditType",
    "AuditPhase",
    "ProjectStatus",
    
    # 风险预警模型
    "RiskRule",
    "RiskAlert",
    "RiskType",
    "SeverityLevel",
    "AlertStatus",
    "RuleType",
    
    # 整改跟踪模型
    "RectificationOrder",
    "RectificationEvidence",
    "OrderStatus",
    
    # 审计作业模型
    "AuditFinding",
    "AuditTask",
    "AuditWorksheet",
    "FindingSeverity",
    "FindingStatus",
    "TaskStatus",
    "WorksheetStatus",
    
    # 知识管理模型
    "KnowledgeItem",
    "Regulation",
    "CaseStudy",
    "KnowledgeType",
    
    # 数据质量模型
    "QualityRule",
    "QualityReport",
    "SyncStatus",
    "DataLineage",
    "DataQualityRuleType",
    "DataQualitySeverityLevel",
    
    # ETL模型
    "DataSourceConfigModel",
    "SyncTaskModel",
    "SyncLogModel",
    "QualityRuleModel",
    "QualityCheckResultModel",
    
    # RBAC模型
    "Permission",
    "Role",
    "role_permission",
    "user_role",
    "PRESET_PERMISSIONS",
    "PRESET_ROLES",
    
    # SSO模型
    "SSOProvider",
    "SSOLog",
    
    # 审计日志
    "AuditLog",
    "SensitiveDataAccess",
]
