"""
基础模型 Mixin
提供软删除等通用功能
"""
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import Session


class SoftDeleteMixin:
    """
    软删除 Mixin

    用法：
        class MyModel(Base, SoftDeleteMixin):
            __tablename__ = "my_table"
            ...

    提供了 is_deleted / deleted_at / deleted_by_id 三个字段，
    以及 soft_delete() 方法。
    """
    is_deleted = Column(Boolean, default=False, nullable=False, index=True, comment="软删除标记")
    deleted_at = Column(DateTime(timezone=True), nullable=True, comment="删除时间")
    deleted_by_id = Column(String(36), nullable=True, comment="删除人ID")

    def soft_delete(self, deleted_by_id: str = None):
        """标记为软删除"""
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        if deleted_by_id:
            self.deleted_by_id = deleted_by_id


def active_query(db: Session, model_class):
    """
    返回自动过滤 is_deleted=False 的查询

    用法：
        projects = active_query(db, AuditProject).filter(...).all()
    替代：
        projects = db.query(AuditProject).filter(AuditProject.is_deleted == False).filter(...).all()
    """
    return db.query(model_class).filter(model_class.is_deleted == False)
