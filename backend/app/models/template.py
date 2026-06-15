"""
底稿模板数据模型
Worksheet Template Model
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
from sqlalchemy.sql import func
import enum

from app.core.database import Base
from app.models.base import SoftDeleteMixin


class TemplateCategory(str, enum.Enum):
    """模板分类枚举"""
    FINANCIAL = "financial"      # 财务审计
    OPERATIONAL = "operational"   # 运营审计
    COMPLIANCE = "compliance"     # 合规审计
    PURCHASE = "purchase"        # 采购审计
    SALES = "sales"              # 销售审计
    ASSET = "asset"              # 资产审计
    FUND = "fund"                # 资金审计
    OTHER = "other"              # 其他


CATEGORY_LABELS = {
    TemplateCategory.FINANCIAL: "财务审计",
    TemplateCategory.OPERATIONAL: "运营审计",
    TemplateCategory.COMPLIANCE: "合规审计",
    TemplateCategory.PURCHASE: "采购审计",
    TemplateCategory.SALES: "销售审计",
    TemplateCategory.ASSET: "资产审计",
    TemplateCategory.FUND: "资金审计",
    TemplateCategory.OTHER: "其他",
}


class WorksheetTemplate(Base, SoftDeleteMixin):
    """底稿模板模型"""
    __tablename__ = "worksheet_templates"

    id = Column(String(50), primary_key=True, comment="模板ID (TMP-001)")
    name = Column(String(200), nullable=False, comment="模板名称")
    category = Column(String(50), nullable=False, default=TemplateCategory.OTHER.value, comment="模板分类")
    description = Column(Text, nullable=True, comment="模板描述")
    
    # 文件信息
    file_name = Column(String(500), nullable=False, comment="原始文件名")
    file_path = Column(String(1000), nullable=False, comment="服务器存储路径")
    file_size = Column(Integer, nullable=False, default=0, comment="文件大小(字节)")
    file_type = Column(String(20), nullable=False, comment="文件扩展名")
    
    # 元信息
    is_preset = Column(Boolean, default=False, comment="是否为系统预设模板")
    download_count = Column(Integer, default=0, comment="下载次数")
    
    # 时间戳
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
    created_by = Column(String(100), nullable=True, comment="创建人")

    def to_dict(self):
        """转为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "category_label": CATEGORY_LABELS.get(TemplateCategory(self.category), self.category),
            "description": self.description,
            "file_name": self.file_name,
            "file_path": self.file_path,
            "file_size": self.file_size,
            "file_type": self.file_type,
            "is_preset": self.is_preset,
            "download_count": self.download_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": self.created_by,
        }
