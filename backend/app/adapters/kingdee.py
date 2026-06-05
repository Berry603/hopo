"""
金蝶ERP适配器
Kingdee ERP Adapter

通过金蝶开放API / 数据库直连对接
"""
from typing import Any, Dict, List, Optional
from loguru import logger

from app.adapters.base import BaseDataSourceAdapter, DataSourceConfig, SyncMode


class KingdeeERPAdapter(BaseDataSourceAdapter):
    """金蝶ERP数据源适配器"""

    # 金蝶ERP常见表映射（中文名 → 表名）
    TABLE_MAP = {
        "科目余额表": "t_balance",
        "凭证表": "t_voucher",
        "凭证分录": "t_voucher_entry",
        "核算项目": "t_acct_item",
        "部门": "t_department",
        "供应商": "t_supplier",
        "客户": "t_customer",
        "费用报销单": "t_expense",
        "付款申请单": "t_payment",
        "应收应付": "t_arap",
    }

    def __init__(self, config: DataSourceConfig):
        super().__init__(config)
        self._conn = None
        # 从配置中提取连接信息
        cfg = config.config
        self.api_base = cfg.get("api_base", "")
        self.api_key = cfg.get("api_key", "")
        self.db_url = cfg.get("db_url", "")
        self.use_api = cfg.get("use_api", False)

    async def connect(self) -> bool:
        """通过HTTP API或数据库直连"""
        try:
            if self.use_api and self.api_base:
                # API模式：使用金蝶开放平台API
                logger.info(f"[金蝶ERP] 通过API连接: {self.api_base}")
                self._conn = {"mode": "api", "base": self.api_base, "key": self.api_key}
            elif self.db_url:
                # 数据库直连模式
                logger.info(f"[金蝶ERP] 通过数据库直连")
                # TODO: 实际使用 sqlalchemy 创建连接
                self._conn = {"mode": "db", "url": self.db_url}
            else:
                logger.error("[金蝶ERP] 未配置连接信息")
                return False
            
            logger.info(f"[金蝶ERP] 连接成功: {self.config.name}")
            return True
        except Exception as e:
            logger.error(f"[金蝶ERP] 连接失败: {e}")
            return False

    async def disconnect(self) -> None:
        self._conn = None
        logger.info(f"[金蝶ERP] 已断开: {self.config.name}")

    async def fetch_tables(self) -> List[str]:
        return list(self.TABLE_MAP.keys())

    async def fetch_schema(self, table: str) -> List[Dict[str, Any]]:
        """获取金蝶ERP表结构（预定义常用表）"""
        schemas = {
            "凭证表": [
                {"name": "voucher_id", "type": "varchar", "comment": "凭证ID"},
                {"name": "voucher_no", "type": "varchar", "comment": "凭证号"},
                {"name": "voucher_date", "type": "date", "comment": "凭证日期"},
                {"name": "period", "type": "int", "comment": "会计期间"},
                {"name": "maker", "type": "varchar", "comment": "制单人"},
                {"name": "auditor", "type": "varchar", "comment": "审核人"},
                {"name": "total_amount", "type": "decimal", "comment": "合计金额"},
                {"name": "status", "type": "varchar", "comment": "状态"},
            ],
            "科目余额表": [
                {"name": "account_id", "type": "varchar", "comment": "科目ID"},
                {"name": "account_code", "type": "varchar", "comment": "科目编码"},
                {"name": "account_name", "type": "varchar", "comment": "科目名称"},
                {"name": "period", "type": "int", "comment": "会计期间"},
                {"name": "begin_balance", "type": "decimal", "comment": "期初余额"},
                {"name": "debit_amount", "type": "decimal", "comment": "借方发生额"},
                {"name": "credit_amount", "type": "decimal", "comment": "贷方发生额"},
                {"name": "end_balance", "type": "decimal", "comment": "期末余额"},
            ],
            "费用报销单": [
                {"name": "expense_id", "type": "varchar", "comment": "报销单ID"},
                {"name": "expense_no", "type": "varchar", "comment": "报销单号"},
                {"name": "applicant", "type": "varchar", "comment": "申请人"},
                {"name": "dept_name", "type": "varchar", "comment": "部门"},
                {"name": "expense_date", "type": "date", "comment": "报销日期"},
                {"name": "amount", "type": "decimal", "comment": "金额"},
                {"name": "category", "type": "varchar", "comment": "费用类别"},
                {"name": "description", "type": "varchar", "comment": "事由说明"},
                {"name": "status", "type": "varchar", "comment": "审批状态"},
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
        """
        从金蝶ERP获取数据
        
        实际环境中通过API或数据库查询获取真实数据，
        当前返回模拟数据结构供开发测试
        """
        logger.info(f"[金蝶ERP] 查询: {table} (limit={limit}, offset={offset})")
        
        # 模拟数据 - 实际环境替换为真实API调用或SQL查询
        table_name = self.TABLE_MAP.get(table, table)
        
        if self.use_api:
            # TODO: 调用金蝶开放平台API
            return self._fetch_via_api(table_name, columns, where, limit, offset)
        else:
            # TODO: 数据库直连查询
            return self._fetch_via_db(table_name, columns, where, limit, offset)

    async def fetch_count(self, table: str, where: Optional[str] = None) -> int:
        table_name = self.TABLE_MAP.get(table, table)
        logger.info(f"[金蝶ERP] 计数: {table_name}")
        return 0  # 实际环境替换

    def _fetch_via_api(self, table: str, columns, where, limit, offset) -> List[Dict]:
        """通过金蝶API获取数据（待实现）"""
        logger.warning(f"[金蝶ERP] API模式待实现: {table}")
        return []

    def _fetch_via_db(self, table: str, columns, where, limit, offset) -> List[Dict]:
        """通过数据库获取数据（待实现）"""
        logger.warning(f"[金蝶ERP] DB直连模式待实现: {table}")
        return []
