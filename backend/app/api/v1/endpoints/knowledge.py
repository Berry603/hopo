"""
知识管理中心API端点
Knowledge Management Center API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from loguru import logger
from typing import List, Optional
import json

from app.core.database import get_db
from app.core.config import settings
from app.middleware.auth import AuthMiddleware
from app.models.knowledge import (
    KnowledgeItem,
    KnowledgeType,
)
from app.models.user import User, UserRole
from app.schemas import (
    ResponseModel,
    PaginatedResponse,
)

router = APIRouter()
security = HTTPBearer()
auth_middleware = AuthMiddleware()


# ==================== 统一知识检索 ====================

@router.get("/search", response_model=PaginatedResponse)
async def search_knowledge(
    q: str = Query(..., description="搜索关键词"),
    knowledge_type: Optional[str] = Query(None, description="知识类型筛选"),
    tags: Optional[List[str]] = Query(None, description="标签筛选"),
    top_k: int = Query(10, ge=1, le=100, description="返回数量"),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    统一知识检索
    
    Args:
        q: 搜索关键词
        knowledge_type: 知识类型筛选
        tags: 标签筛选
        top_k: 返回数量
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        知识列表
    """
    # 验证Token
    payload = auth_middleware.decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if not current_user or not current_user.is_auditor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 构建查询
    query = db.query(KnowledgeItem)
    
    # 全文搜索
    search_filter = f"%{q}%"
    query = query.filter(
        (KnowledgeItem.title.like(search_filter)) |
        (KnowledgeItem.description.like(search_filter)) |
        (KnowledgeItem.content.like(search_filter))
    )
    
    # 筛选条件
    if knowledge_type:
        query = query.filter(KnowledgeItem.knowledge_type == knowledge_type)
    if tags:
        # 标签筛选（JSON格式）
        for tag in tags:
            query = query.filter(KnowledgeItem.tags.contains(tag))
    
    # 限制返回数量
    items = query.order_by(KnowledgeItem.view_count.desc()).limit(top_k).all()
    
    # 构建响应数据
    items_data = []
    for item in items:
        items_data.append({
            "id": item.id,
            "item_id": item.item_id,
            "title": item.title,
            "description": item.description,
            "knowledge_type": item.knowledge_type,
            "category": item.category,
            "subcategory": item.subcategory,
            "tags": json.loads(item.tags) if item.tags else [],
            "source": item.source,
            "is_active": item.is_active == "1",
            "is_exemplary": item.is_exemplary == "1",
            "view_count": item.view_count,
            "created_at": item.created_at.isoformat(),
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        })
    
    return {
        "code": 200,
        "message": "搜索成功",
        "data": items_data,
        "total": len(items_data),
        "page": 1,
        "page_size": top_k,
    }


# ==================== 获取知识详情 ====================

@router.get("/items/{item_id}", response_model=ResponseModel)
async def get_knowledge_item(
    item_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    获取知识详情
    
    Args:
        item_id: 知识ID
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        知识详情
    """
    # 验证Token
    payload = auth_middleware.decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if not current_user or not current_user.is_auditor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 获取知识
    item = db.query(KnowledgeItem).filter(KnowledgeItem.id == item_id).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="知识不存在",
        )
    
    # 增加浏览次数
    item.view_count += 1
    db.commit()
    
    # 构建响应数据
    item_data = {
        "id": item.id,
        "item_id": item.item_id,
        "title": item.title,
        "description": item.description,
        "knowledge_type": item.knowledge_type,
        "content": item.content,
        "content_format": item.content_format,
        "category": item.category,
        "subcategory": item.subcategory,
        "tags": json.loads(item.tags) if item.tags else [],
        "source": item.source,
        "source_url": item.source_url,
        "source_id": item.source_id,
        "applicable_domains": json.loads(item.applicable_domains) if item.applicable_domains else [],
        "applicable_departments": json.loads(item.applicable_departments) if item.applicable_departments else [],
        "is_active": item.is_active == "1",
        "is_exemplary": item.is_exemplary == "1",
        "view_count": item.view_count,
        "related_findings": json.loads(item.related_findings) if item.related_findings else [],
        "related_regulations": json.loads(item.related_regulations) if item.related_regulations else [],
        "created_by_name": item.created_by.full_name if item.created_by else None,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": item_data,
    }


# ==================== 新增案例 ====================

@router.post("/cases", status_code=status.HTTP_201_CREATED)
async def create_case_study(
    case_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    新增案例（从审计发现转化）
    
    Args:
        case_data: 案例数据
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        创建结果
    """
    # 验证Token
    payload = auth_middleware.decode_token(credentials.credentials)
    current_user_id = payload.get("sub")
    current_user = db.query(User).filter(User.id == current_user_id).first()
    
    if not current_user or not current_user.is_auditor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足",
        )
    
    # 创建案例
    from app.models.knowledge import CaseStudy
    from datetime import datetime
    
    # 生成案例编号
    import uuid
    item_id = f"CASE-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"
    
    # 创建知识项
    db_item = KnowledgeItem(
        item_id=item_id,
        title=case_data.get("title"),
        description=case_data.get("description"),
        knowledge_type=KnowledgeType.CASE,
        content=case_data.get("content"),
        category=case_data.get("category"),
        subcategory=case_data.get("subcategory"),
        tags=json.dumps(case_data.get("tags", []), ensure_ascii=False),
        is_active="1",
        is_exemplary="1" if case_data.get("is_exemplary") else "0",
        created_by_id=current_user.id,
    )
    
    db.add(db_item)
    db.flush()  # 获取ID
    
    # 创建案例
    db_case = CaseStudy(
        id=db_item.id,
        audit_type=case_data.get("audit_type"),
        risk_type=case_data.get("risk_type"),
        severity=case_data.get("severity"),
        background=case_data.get("background"),
        audit_procedure=case_data.get("audit_procedure"),
        audit_finding=case_data.get("audit_finding"),
        root_cause=case_data.get("root_cause"),
        recommendation=case_data.get("recommendation"),
        outcome=case_data.get("outcome"),
        relevance_score=case_data.get("relevance_score", 0),
    )
    
    db.add(db_case)
    db.commit()
    
    logger.info(f"案例创建成功: {db_item.item_id} - {db_item.title} (创建人: {current_user.username})")
    
    return {
        "code": 201,
        "message": "创建成功",
        "data": {
            "id": db_item.id,
            "item_id": db_item.item_id,
            "title": db_item.title,
        }
    }
