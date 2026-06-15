"""
通知管理 API
站内通知：列表、标记已读、创建通知（内部调用）
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db, SessionLocal
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.notification import Notification, NotificationType

router = APIRouter(prefix="/notifications")


@router.get("")
async def list_notifications(
    unread_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取当前用户的通知列表"""
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    
    total = q.count()
    unread = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).count()
    
    notifications = q.order_by(desc(Notification.created_at)).offset(
        (page - 1) * page_size).limit(page_size).all()
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": [_n_to_dict(n) for n in notifications],
        "total": total,
        "unread_count": unread,
        "page": page,
        "page_size": page_size,
    }


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """标记通知为已读"""
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="通知不存在")
    n.is_read = True
    db.commit()
    return {"code": 200, "message": "已标记为已读"}


@router.put("/read-all")
async def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """标记全部为已读"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"code": 200, "message": "全部标记为已读"}


def create_notification(
    user_id: str,
    type: str,
    title: str,
    content: str = None,
    link: str = None,
):
    """内部调用：创建通知"""
    try:
        db = SessionLocal()
        n = Notification(
            user_id=user_id,
            type=type,
            title=title,
            content=content,
            link=link,
        )
        db.add(n)
        db.commit()
        db.close()
        return n
    except Exception as e:
        import logging
        logging.warning(f"通知创建失败: {e}")
        return None


def _n_to_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "type": n.type.value if n.type else None,
        "title": n.title,
        "content": n.content,
        "link": n.link,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }
