"""
整改跟踪中心API端点
Rectification Tracking Center API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from loguru import logger
from typing import List, Optional
from datetime import datetime, date
import json

from app.core.database import get_db
from app.core.config import settings
from app.core.auth_utils import decode_token
from app.models.rectification import (
    RectificationOrder,
    RectificationEvidence,
    OrderStatus,
)
from app.models.user import User, UserRole
from app.schemas import (
    ResponseModel,
    PaginatedResponse,
)

router = APIRouter()
security = HTTPBearer()


# ==================== 获取整改工单列表 ====================

@router.get("/orders", response_model=PaginatedResponse)
async def get_rectification_orders(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    status: Optional[str] = Query(None, description="状态筛选"),
    department: Optional[str] = Query(None, description="部门筛选"),
    risk_level: Optional[str] = Query(None, description="风险等级筛选"),
    is_overdue: Optional[bool] = Query(None, description="是否逾期"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    获取整改工单列表
    
    Args:
        page: 页码
        page_size: 每页数量
        status: 状态筛选
        department: 部门筛选
        risk_level: 风险等级筛选
        is_overdue: 是否逾期
        keyword: 关键词搜索
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        整改工单列表
    """
    # 验证Token
    payload = decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if not current_user or not current_user.is_auditor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 构建查询
    query = db.query(RectificationOrder)
    
    # 筛选条件
    if status:
        query = query.filter(RectificationOrder.status == status)
    if department:
        query = query.filter(RectificationOrder.responsible_dept_id == department)
    if risk_level:
        query = query.filter(RectificationOrder.risk_level == risk_level)
    if is_overdue is not None:
        today = date.today()
        if is_overdue:
            query = query.filter(RectificationOrder.deadline < today)
        else:
            query = query.filter(RectificationOrder.deadline >= today)
    if keyword:
        keyword_filter = f"%{keyword}%"
        query = query.filter(
            (RectificationOrder.order_id.like(keyword_filter)) |
            (RectificationOrder.title.like(keyword_filter)) |
            (RectificationOrder.description.like(keyword_filter))
        )
    
    # 分页
    total = query.count()
    orders = query.order_by(RectificationOrder.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    # 构建响应数据
    orders_data = []
    for order in orders:
        orders_data.append({
            "id": order.id,
            "order_id": order.order_id,
            "finding_id": order.finding_id,
            "audit_project_id": order.audit_project_id,
            "audit_project_name": order.project.project_name if order.project else None,
            "title": order.title,
            "description": order.description,
            "risk_level": order.risk_level,
            "amount_involved": order.amount_involved,
            "responsible_dept_id": order.responsible_dept_id,
            "responsible_dept_name": order.responsible_dept_name,
            "responsible_person_id": order.responsible_person_id,
            "responsible_person_name": order.responsible_person_name,
            "deadline": order.deadline.isoformat(),
            "status": order.status,
            "escalated_level": order.escalated_level,
            "is_overdue": order.is_overdue,
            "days_remaining": order.days_remaining,
            "created_at": order.created_at.isoformat(),
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        })
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": orders_data,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ==================== 批量创建整改工单 ====================

@router.post("/orders/batch-create", status_code=status.HTTP_201_CREATED)
async def batch_create_rectification_orders(
    batch_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    批量创建整改工单
    
    Args:
        batch_data: 批量创建数据
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        创建结果
    """
    # 验证Token
    payload = decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    # 检查权限
    if not current_user or current_user.role not in [UserRole.SUPER_ADMIN, UserRole.AUDIT_DIRECTOR, UserRole.AUDIT_MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    finding_ids = batch_data.get("finding_ids", [])
    auto_fill = batch_data.get("auto_fill", True)
    
    if not finding_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供审计发现ID列表",
        )
    
    # 获取审计发现
    from app.models.audit import AuditFinding
    
    orders = []
    failed_items = []
    
    for finding_id in finding_ids:
        finding = db.query(AuditFinding).filter(AuditFinding.id == finding_id).first()
        
        if not finding:
            failed_items.append({
                "finding_id": finding_id,
                "reason": "审计发现不存在",
            })
            continue
        
        # 创建整改工单
        from datetime import timedelta
        
        suggested_days = 30  # 默认30天
        deadline = date.today() + timedelta(days=suggested_days)
        
        order_id = f"RECT-{datetime.now().strftime('%Y%m%d')}-{datetime.now().strftime('%H%M%S')}"
        
        db_order = RectificationOrder(
            order_id=order_id,
            finding_id=finding.id,
            audit_project_id=finding.audit_project_id,
            title=f"整改：{finding.title}",
            description=finding.description,
            risk_level=finding.severity,
            amount_involved=finding.amount_involved,
            responsible_dept_id=finding.responsible_dept if auto_fill else None,
            responsible_dept_name=finding.responsible_dept if auto_fill else None,
            responsible_person_id=finding.responsible_person if auto_fill else None,
            responsible_person_name=finding.responsible_person if auto_fill else None,
            suggested_deadline_days=suggested_days,
            deadline=deadline,
            status=OrderStatus.PENDING,
            escalated_level=0,
        )
        
        db.add(db_order)
        orders.append(db_order)
    
    db.commit()
    
    # 刷新对象
    for order in orders:
        db.refresh(order)
    
    logger.info(f"批量创建整改工单成功: {len(orders)}个 (创建人: {current_user.username})")
    
    return {
        "code": 201,
        "message": "批量创建成功",
        "data": {
            "orders": [{
                "id": order.id,
                "order_id": order.order_id,
                "title": order.title,
            } for order in orders],
            "failed_items": failed_items,
        }
    }


# ==================== 提交整改证据 ====================

@router.put("/orders/{order_id}/submit")
async def submit_rectification_evidence(
    order_id: str,
    submit_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    提交整改证据
    
    Args:
        order_id: 工单ID
        submit_data: 提交数据
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        提交结果
    """
    # 验证Token
    payload = decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="当前用户不存在",
        )
    
    # 获取工单
    order = db.query(RectificationOrder).filter(RectificationOrder.id == order_id).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="整改工单不存在",
        )
    
    # 检查权限（只能由责任人或管理员提交）
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.AUDIT_DIRECTOR, UserRole.AUDIT_MANAGER] and current_user.id != order.responsible_person_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 更新工单状态
    order.status = OrderStatus.SUBMITTED
    order.updated_at = datetime.utcnow()
    
    # 创建整改证据
    evidences_data = submit_data.get("evidences", [])
    
    for evidence_data in evidences_data:
        db_evidence = RectificationEvidence(
            order_id=order.id,
            evidence_type=evidence_data.get("evidence_type"),
            file_name=evidence_data.get("file_name"),
            file_path=evidence_data.get("file_path"),
            file_size=evidence_data.get("file_size"),
            description=evidence_data.get("description"),
            submitted_by_id=current_user.id,
        )
        
        db.add(db_evidence)
    
    db.commit()
    
    logger.info(f"整改证据提交成功: {order.order_id} - {order.title} (提交人: {current_user.username})")
    
    return {
        "code": 200,
        "message": "提交成功",
    }
