"""
智能查询中心API端点
Intelligent Query Center API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from loguru import logger
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import json

from app.core.database import get_db
from app.core.config import settings
from app.api.v1.deps import get_current_user
from app.schemas import (
    ResponseModel,
    PaginatedResponse,
)
from app.services.llm_client import LLMClient
from app.services.nl2sql_service import NL2SQLService
from app.services.prompts.nl2sql_prompt import SQL_EXPLAIN_PROMPT, AGENT_SYSTEM_PROMPT

router = APIRouter()

# 对话历史存储（内存字典）
# 生产环境应替换为数据库存储
_conversation_store: Dict[str, List[Dict[str, Any]]] = {}


# ==================== NL2SQL智能问数 ====================

@router.post("/nl2sql")
async def nl2sql_query(
    query_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    自然语言查询（NL2SQL）

    Args:
        query_data: 查询数据
            - question: str - 自然语言问题
            - conversation_id: str (optional) - 多轮对话ID
        db: 数据库会话

    Returns:
        查询结果（含 SQL、数据、图表类型、Token 用量等）
    """
    
    question = query_data.get("question")
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供查询问题",
        )
    
    logger.info(f"NL2SQL查询请求: {question} (用户: {current_user.username})")
    
    # 使用 NL2SQL 引擎处理查询
    service = NL2SQLService()
    result = service.process(question, user_id=current_user.id)
    
    if "error" in result:
        logger.error(f"NL2SQL查询失败: {result['error']}")
        return {
            "code": 400,
            "message": f"查询处理失败: {result['error']}",
            "data": {
                "sql_generated": result.get("sql", ""),
                "execution_time_ms": 0,
                "question": question,
                "acknowledged": "查询处理失败",
                "visualization": {"type": "table", "config": {}},
                "explanation": result["error"],
            }
        }
    
    return {
        "code": 200,
        "message": "查询成功",
        "data": {
            "sql_generated": result.get("sql", ""),
            "execution_time_ms": len(result.get("results", [])) * 10,
            "question": question,
            "acknowledged": "NL2SQL引擎已执行查询",
            "results": result.get("results", []),
            "columns": result.get("columns", []),
            "row_count": result.get("row_count", 0),
            "visualization": {
                "type": result.get("chart_type", "table"),
                "config": {}
            },
            "explanation": f"已通过 {result.get('method', 'nl2sql')} 方式生成并执行查询",
            "intent": result.get("intent", ""),
            "method": result.get("method", "nl2sql"),
            "template_id": result.get("template_id"),
            "parameters": result.get("parameters"),
        }
    }


@router.post("/nl2sql/explain")
async def explain_sql(
    query_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    解释SQL逻辑

    Args:
        query_data: 查询数据
            - question: str - 自然语言问题
            - sql: str - SQL语句
        db: 数据库会话

    Returns:
        解释结果
    """
    
    question = query_data.get("question")
    sql = query_data.get("sql")
    
    if not question or not sql:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供问题或SQL语句",
        )
    
    logger.info(f"SQL解释请求: {question} (用户: {current_user.username})")
    
    # 使用 LLM 进行 SQL 解释
    try:
        # 使用 NL2SQLService 中的 DB_SCHEMA（延迟导入避免循环依赖）
        from app.services.nl2sql_service import DB_SCHEMA
        
        llm_client = LLMClient()
        system_prompt = SQL_EXPLAIN_PROMPT.format(
            db_schema=DB_SCHEMA,
            sql=sql,
            question=question or "无原始问题",
        )
        
        response = llm_client.chat(
            messages=f"请解释以上 SQL 查询的逻辑和业务含义。",
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=1000,
        )
        
        explanation = response.content.strip()
        logger.info(f"SQL解释成功: tokens={response.token_usage}, elapsed={response.elapsed_seconds:.2f}s")
    except Exception as e:
        logger.error(f"SQL解释LLM调用失败: {e}")
        explanation = f"SQL解释引擎暂时不可用，请检查 LLM 配置。错误: {str(e)}"
    
    return {
        "code": 200,
        "message": "解释成功",
        "data": {
            "question": question,
            "sql": sql,
            "explanation": explanation,
        }
    }


# ==================== 审计机器人Agent ====================

@router.post("/agent/chat")
async def agent_chat(
    chat_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    审计机器人Agent多轮对话

    Args:
        chat_data: 对话数据
            - message: str - 消息
            - conversation_id: str (optional) - 对话ID
            - context: dict (optional) - 上下文
        db: 数据库会话

    Returns:
        Agent回复
    """
    
    message = chat_data.get("message")
    conversation_id = chat_data.get("conversation_id")
    context = chat_data.get("context", {})
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供消息内容",
        )
    
    logger.info(f"Agent对话请求: {message} (用户: {current_user.username})")
    
    # 使用 LLM 生成 Agent 回复
    if not conversation_id:
        conversation_id = f"conv-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"
    
    # 获取对话历史
    history = _conversation_store.get(conversation_id, [])
    
    try:
        llm_client = LLMClient()
        
        context_str = json.dumps(context, ensure_ascii=False) if context else "无"
        system_prompt = AGENT_SYSTEM_PROMPT.format(
            user_name=current_user.full_name or current_user.username,
            current_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            context=context_str,
        )
        
        # 构建包含历史的消息列表
        messages = []
        for h in history[-10:]:  # 取最近10条历史
            messages.append({"role": "user", "content": h.get("user_message", "")})
            messages.append({"role": "assistant", "content": h.get("reply", "")})
        messages.append({"role": "user", "content": message})
        
        response = llm_client.chat(
            messages=messages,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=1500,
        )
        
        reply = response.content.strip()
        
        # 保存到对话历史
        history.append({
            "user_message": message,
            "reply": reply,
            "timestamp": datetime.now().isoformat(),
            "tokens_used": response.token_usage.get("total_tokens", 0),
        })
        _conversation_store[conversation_id] = history
        
        logger.info(
            f"Agent对话成功: conversation_id={conversation_id}, "
            f"tokens={response.token_usage}, elapsed={response.elapsed_seconds:.2f}s"
        )
        
    except Exception as e:
        logger.error(f"Agent LLM调用失败: {e}")
        reply = f"审计Agent暂时不可用，请稍后重试。错误: {str(e)}"
        # 即使失败也保存对话
        history.append({
            "user_message": message,
            "reply": reply,
            "timestamp": datetime.now().isoformat(),
            "tokens_used": 0,
        })
        _conversation_store[conversation_id] = history
    
    return {
        "code": 200,
        "message": "对话成功",
        "data": {
            "conversation_id": conversation_id,
            "reply": reply,
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
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    获取历史对话列表

    Args:
        page: 页码
        page_size: 每页数量
        db: 数据库会话

    Returns:
        对话列表
    """
    
    # 从内存存储中获取对话历史
    # 生产环境中应替换为数据库查询
    all_conversations = []
    for conv_id, history in _conversation_store.items():
        if history:
            first_msg = history[0]
            last_msg = history[-1]
            all_conversations.append({
                "conversation_id": conv_id,
                "title": first_msg.get("user_message", "")[:50],
                "message_count": len(history),
                "created_at": first_msg.get("timestamp", ""),
                "last_message_at": last_msg.get("timestamp", ""),
            })
    
    # 按时间倒序排列
    all_conversations.sort(key=lambda x: x["last_message_at"], reverse=True)
    
    # 分页
    total = len(all_conversations)
    start = (page - 1) * page_size
    end = start + page_size
    page_data = all_conversations[start:end]
    
    return {
        "code": 200,
        "message": "获取成功",
        "data": page_data,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ========== 查询模板 ==========

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
