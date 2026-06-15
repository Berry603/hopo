import request from './request';
import type { ApiResponse, PaginatedData } from './request';

// ==================== NL2SQL 智能问数 ====================

/** 自然语言查询（NL2SQL） */
export async function submitNLQuery(data: { question: string; conversation_id?: string }) {
  const res = await request.post<ApiResponse<unknown>>('/query/nl2sql', data);
  return res.data;
}

/** 解释 SQL 逻辑 */
export async function explainSql(data: { question: string; sql: string }) {
  const res = await request.post<ApiResponse<unknown>>('/query/nl2sql/explain', data);
  return res.data;
}

// ==================== 审计机器人 Agent ====================

/** 审计机器人 Agent 对话 */
export async function submitAgentQuery(data: {
  message: string;
  conversation_id?: string;
  context?: Record<string, unknown>;
}) {
  const res = await request.post<ApiResponse<unknown>>('/query/agent/chat', data);
  return res.data;
}

/** 获取 Agent 历史对话列表 */
export async function getConversations(params?: { page?: number; page_size?: number }) {
  const res = await request.get<ApiResponse<unknown>>('/query/agent/conversations', { params });
  return res.data;
}

// ==================== 查询模板 ====================

/** 获取查询模板列表 */
export async function getQueryTemplates(params?: { category?: string }) {
  const res = await request.get<ApiResponse<unknown>>('/query/templates', { params });
  return res.data;
}

/** 获取单个查询模板 */
export async function getQueryTemplate(id: string) {
  const res = await request.get<ApiResponse<unknown>>(`/query/templates/${id}`);
  return res.data;
}
