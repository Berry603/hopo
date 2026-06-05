"""
数据源适配器 - 抽象基类
Abstract Data Source Adapter

支持: 金蝶ERP, 云之家OA, 自定义SQL
"""
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Dict, List, Optional, AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime
import json


class DataSourceType(str, Enum):
    """数据源类型"""
    KINGDEE_ERP = "kingdee_erp"       # 金蝶ERP
    YUNZHIJIA_OA = "yunzhijia_oa"    # 云之家OA
    MYSQL = "mysql"                   # 直连数据库
    POSTGRESQL = "postgresql"
    API_HTTP = "api_http"            # HTTP API
    FILE_CSV = "file_csv"            # CSV文件
    FILE_EXCEL = "file_excel"        # Excel文件


class SyncMode(str, Enum):
    """同步模式"""
    FULL = "full"          # 全量同步
    INCREMENTAL = "inc"    # 增量同步（基于时间戳）
    CDC = "cdc"            # 变更数据捕获


@dataclass
class DataSourceConfig:
    """数据源配置"""
    id: str
    name: str
    source_type: DataSourceType
    config: Dict[str, Any] = field(default_factory=dict)
    sync_mode: SyncMode = SyncMode.FULL
    schedule: Optional[str] = None        # cron表达式
    enabled: bool = True
    last_sync_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "source_type": self.source_type.value,
            "sync_mode": self.sync_mode.value,
            "enabled": self.enabled,
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
        }


@dataclass
class SyncResult:
    """同步结果"""
    source_id: str
    mode: SyncMode
    total_rows: int = 0
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    errors: List[str] = field(default_factory=list)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    success: bool = False

    @property
    def duration_seconds(self) -> float:
        if self.started_at and self.finished_at:
            return (self.finished_at - self.started_at).total_seconds()
        return 0


class BaseDataSourceAdapter(ABC):
    """数据源适配器抽象基类"""

    def __init__(self, config: DataSourceConfig):
        self.config = config

    @abstractmethod
    async def connect(self) -> bool:
        """建立连接"""
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """断开连接"""
        ...

    @abstractmethod
    async def fetch_tables(self) -> List[str]:
        """获取数据源中的表/实体列表"""
        ...

    @abstractmethod
    async def fetch_schema(self, table: str) -> List[Dict[str, Any]]:
        """获取表结构"""
        ...

    @abstractmethod
    async def fetch_data(
        self,
        table: str,
        columns: Optional[List[str]] = None,
        where: Optional[str] = None,
        limit: int = 10000,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """获取数据"""
        ...

    @abstractmethod
    async def fetch_count(self, table: str, where: Optional[str] = None) -> int:
        """获取记录数"""
        ...

    async def stream_data(
        self,
        table: str,
        batch_size: int = 1000,
        where: Optional[str] = None,
    ) -> AsyncIterator[List[Dict[str, Any]]]:
        """流式获取数据（分批次）"""
        offset = 0
        while True:
            batch = await self.fetch_data(table, limit=batch_size, offset=offset, where=where)
            if not batch:
                break
            yield batch
            offset += batch_size

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, *args):
        await self.disconnect()
