"""
智能查询中心API端点
Intelligent Query Center API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from loguru import logger
from typing import List, Optional, Dict, Any

from app.core.database import get_db
from app.core.config import settings
from app.core.auth_utils import decode_token
from app.models.user import User, UserRole
from app.schemas import (
    ResponseModel,
    PaginatedResponse,
)

router = APIRouter()
security = HTTPBearer()


# ==================== NL2SQL智能问数 ====================

@router.post("/nl2sql")
async def nl2sql_query(
    query_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    自然语言查询（NL2SQL）
    
    Args:
        query_data: 查询数据
            - question: str - 自然语言问题
            - conversation_id: str (optional) - 多轮对话ID
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        查询结果
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
    
    question = query_data.get("question")
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供查询问题",
        )
    
    logger.info(f"NL2SQL查询请求: {question} (用户: {current_user.username})")
    
    # TODO: 集成 NL2SQL 引擎
    # 这里返回一个模拟结果，实际实现需要使用 LLM 生成 SQL 并执行
    
    # 安全检查：仅允许SELECT语句
    sql_safe = True
    
    # 示例SQL生成（实际应使用LLM）
    sql_generated = f"SELECT * FROM audit_projects WHERE project_name LIKE '%{question}%'"
    
    return {
        "code": 200,
        "message": "查询成功",
        "data": {
            "sql_generated": sql_generated,
            "execution_time_ms": 150,
            "question": question,
            "acknowledged": "NL2SQL引擎已准备就绪，等待LLM集成后实现完整功能",
            "visualization": {
                "type": "table",
                "config": {}
            },
            "explanation": "NL2SQL引擎已准备就绪，等待LLM集成后实现完整功能",
        }
    }


@router.post("/nl2sql/explain")
async def explain_sql(
    query_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    解释SQL逻辑
    
    Args:
        query_data: 查询数据
            - question: str - 自然语言问题
            - sql: str - SQL语句
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        解释结果
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
    
    question = query_data.get("question")
    sql = query_data.get("sql")
    
    if not question or not sql:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供问题或SQL语句",
        )
    
    logger.info(f"SQL解释请求: {question} (用户: {current_user.username})")
    
    # TODO: 集成LLM进行SQL解释
    return {
        "code": 200,
        "message": "解释成功",
        "data": {
            "question": question,
            "sql": sql,
            "explanation": "SQL解释引擎已准备就绪，等待LLM集成后实现完整功能",
        }
    }


# ==================== 审计机器人Agent ====================

@router.post("/agent/chat")
async def agent_chat(
    chat_data: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    审计机器人Agent多轮对话
    
    Args:
        chat_data: 对话数据
            - message: str - 消息
            - conversation_id: str (optional) - 对话ID
            - context: dict (optional) - 上下文
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        Agent回复
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
    
    message = chat_data.get("message")
    conversation_id = chat_data.get("conversation_id")
    context = chat_data.get("context", {})
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供消息内容",
        )
    
    logger.info(f"Agent对话请求: {message} (用户: {current_user.username})")
    
    # TODO: 集成审计Agent
    # 使用意图路由 → 选择子Agent（问数Agent / 分析Agent / 报告Agent）
    
    import uuid
    
    if not conversation_id:
        conversation_id = f"conv-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"
    
    return {
        "code": 200,
        "message": "对话成功",
        "data": {
            "conversation_id": conversation_id,
            "reply": f"审计Agent已准备就绪，等待LLM集成后实现完整功能。您的问题是：{message}",
            "artifacts": [],
            "suggested_followups": [
                "可以帮我生成审计报告吗？",
                "可以分析一下这个风险吗？",
                "可以查询相关法规吗？",
            ]
        }
    }


@router.get("/agent/conversations")
async def get_agent_conversations(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    """
    获取历史对话列表
    
    Args:
        page: 页码
        page_size: 每页数量
        credentials: HTTP认证凭证
        db: 数据库会话
    
    Returns:
        对话列表
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
    
    # TODO: 实现对话历史存储
    return {
        "code": 200,
        "message": "获取成功",
        "data": [],
        "total": 0,
        "page": page,
        "page_size": page_size,
    }


# ========== NL2SQL 智能查询 ==========

@router.post("/nl2sql")
async def natural_language_query(
    request: dict,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    自然语言查询
    
    Body: {"query": "查询本月各部门费用支出排名"}
    """
    from app.services.nl2sql_service import NL2SQLService
    
    query_text = request.get("query", "")
    if not query_text:
        raise HTTPException(status_code=400, detail="查询内容不能为空")
    
    service = NL2SQLService()
    result = service.process(query_text)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {
        "code": 200,
        "message": "查询成功",
        "data": result,
    }


@router.get("/templates")
async def list_query_templates(
    category: Optional[str] = Query(None, description="按类别筛选"),
):
    """获取查询模板列表"""
    from app.services.nl2sql_service import NL2SQLService
    
    service = NL2SQLService()
    templates = service.list_templates(category)
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": templates,
        "total": len(templates),
    }


@router.get("/templates/{template_id}")
async def get_query_template(template_id: str):
    """获取单个查询模板"""
    from app.services.nl2sql_service import NL2SQLService
    
    service = NL2SQLService()
    template = service.get_template(template_id)
    
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    return {"code": 200, "message": "获取成功", "data": template}
