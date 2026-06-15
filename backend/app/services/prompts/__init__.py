"""
Prompt 模板模块
Prompt Templates Module

提供 NL2SQL、SQL 解释、审计 Agent 等功能的系统提示词模板
"""
from app.services.prompts.nl2sql_prompt import (
    NL2SQL_SYSTEM_PROMPT,
    SQL_EXPLAIN_PROMPT,
    AGENT_SYSTEM_PROMPT,
)

__all__ = [
    "NL2SQL_SYSTEM_PROMPT",
    "SQL_EXPLAIN_PROMPT",
    "AGENT_SYSTEM_PROMPT",
]
