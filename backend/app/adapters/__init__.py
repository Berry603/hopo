"""
数据源适配器模块
Data Source Adapters

支持: 金蝶ERP, 云之家OA, 直连数据库, HTTP API
"""
from app.adapters.base import (
    BaseDataSourceAdapter,
    DataSourceConfig,
    DataSourceType,
    SyncMode,
    SyncResult,
)
from app.adapters.kingdee import KingdeeERPAdapter
from app.adapters.yunzhijia import (
    YunzhijiaOAAdapter,
    get_adapter,
    register_adapter,
)

__all__ = [
    "BaseDataSourceAdapter",
    "DataSourceConfig",
    "DataSourceType",
    "SyncMode",
    "SyncResult",
    "KingdeeERPAdapter",
    "YunzhijiaOAAdapter",
    "get_adapter",
    "register_adapter",
]
