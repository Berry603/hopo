"""
审计通知 / 消息模型
简化的站内通知系统，用于任务分配、复核提醒、整改超期等
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Text, Enum as SQLEnum
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum

from app.core.database import Base


class NotificationType(str, PyEnum):
    TASK_ASSIGN = "task_assign"         # 任务分配
    REVIEW_REMIND = "review_remind"     # 复核提醒
    RECTIFICATION = "rectification"     # 整改相关
    PHASE_COMPLETE = "phase_complete"   # 阶段完成
    ALERT_TRIGGERED = "alert_triggered" # 预警触发


class Notification(Base):
    """站内通知"""
    __tablename__ = "notifications"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True, comment="接收人ID")
    type = Column(SQLEnum(NotificationType), nullable=False, comment="通知类型")
    title = Column(String(200), nullable=False, comment="通知标题")
    content = Column(Text, nullable=True, comment="通知内容")
    link = Column(String(200), nullable=True, comment="跳转链接")
    is_read = Column(Boolean, default=False, comment="是否已读")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True, comment="创建时间")
    
    def __repr__(self):
        return f"<Notification {self.type} - {self.title}>"
