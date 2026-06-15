"""
云之家OA适配器
Yunzhijia OA Adapter

对接云之家审批流程、组织架构、消息通知等
"""
from typing import Any, Dict, List, Optional
from loguru import logger

from app.adapters.base import BaseDataSourceAdapter, DataSourceConfig
from app.adapters.kingdee import KingdeeERPAdapter


class YunzhijiaOAAdapter(BaseDataSourceAdapter):
    """云之家OA数据源适配器"""

    # OA常用实体
    ENTITIES = [
        "审批流程",
        "组织架构",
        "人员信息",
        "考勤记录",
        "公告通知",
        "会议管理",
    ]

    def __init__(self, config: DataSourceConfig):
        super().__init__(config)
        self._conn = None
        cfg = config.config
        self.app_id = cfg.get("app_id", "")
        self.app_secret = cfg.get("app_secret", "")
        self.corp_id = cfg.get("corp_id", "")  # 企业ID
        self.api_base = cfg.get("api_base", "https://open.ikuyun.com")

    async def connect(self) -> bool:
        """通过云之家开放API连接"""
        try:
            logger.info(f"[云之家OA] 企业{self.corp_id} 连接中...")
            # TODO: 实际获取access_token
            self._conn = {
                "mode": "api",
                "base": self.api_base,
                "corp_id": self.corp_id,
            }
            logger.info(f"[云之家OA] 连接成功: {self.config.name}")
            return True
        except Exception as e:
            logger.error(f"[云之家OA] 连接失败: {e}")
            return False

    async def disconnect(self) -> None:
        self._conn = None

    async def fetch_tables(self) -> List[str]:
        return self.ENTITIES

    async def fetch_schema(self, table: str) -> List[Dict[str, Any]]:
        schemas = {
            "审批流程": [
                {"name": "process_id", "type": "varchar", "comment": "流程ID"},
                {"name": "process_name", "type": "varchar", "comment": "流程名称"},
                {"name": "applicant_id", "type": "varchar", "comment": "申请人ID"},
                {"name": "applicant_name", "type": "varchar", "comment": "申请人姓名"},
                {"name": "dept_id", "type": "varchar", "comment": "部门ID"},
                {"name": "create_time", "type": "datetime", "comment": "创建时间"},
                {"name": "status", "type": "varchar", "comment": "状态"},
                {"name": "approvers", "type": "json", "comment": "审批人链"},
            ],
            "组织架构": [
                {"name": "dept_id", "type": "varchar", "comment": "部门ID"},
                {"name": "dept_name", "type": "varchar", "comment": "部门名称"},
                {"name": "parent_id", "type": "varchar", "comment": "上级部门ID"},
                {"name": "manager_id", "type": "varchar", "comment": "负责人ID"},
                {"name": "level", "type": "int", "comment": "层级"},
            ],
            "人员信息": [
                {"name": "user_id", "type": "varchar", "comment": "用户ID"},
                {"name": "user_name", "type": "varchar", "comment": "姓名"},
                {"name": "dept_id", "type": "varchar", "comment": "部门ID"},
                {"name": "position", "type": "varchar", "comment": "职位"},
                {"name": "email", "type": "varchar", "comment": "邮箱"},
                {"name": "phone", "type": "varchar", "comment": "手机号"},
                {"name": "status", "type": "varchar", "comment": "状态"},
            ],
        }
        return schemas.get(table, [])

    async def fetch_data(
        self,
        table: str,
        columns: Optional[List[str]] = None,
        where: Optional[str] = None,
        limit: int = 10000,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        logger.info(f"[云之家OA] 查询: {table} (limit={limit})")
        # TODO: 实际API调用
        return []

    async def fetch_count(self, table: str, where: Optional[str] = None) -> int:
        return 0


# --- 适配器工厂 ---

_ADAPTER_REGISTRY = {}


def register_adapter(source_type: str, adapter_cls):
    """注册适配器"""
    _ADAPTER_REGISTRY[source_type] = adapter_cls


def get_adapter(config: DataSourceConfig) -> BaseDataSourceAdapter:
    """根据配置获取适配器实例"""
    adapter_cls = _ADAPTER_REGISTRY.get(config.source_type.value)
    if adapter_cls is None:
        raise ValueError(f"未注册的数据源类型: {config.source_type}")
    return adapter_cls(config)


# 注册内置适配器
register_adapter("kingdee_erp", KingdeeERPAdapter)
register_adapter("yunzhijia_oa", YunzhijiaOAAdapter)
