import request from './request';
import type { ApiResponse } from './request';

// ==================== 统一知识检索 ====================

/** 统一知识检索 */
export async function searchKnowledge(params: {
  q: string;
  knowledge_type?: string;
  top_k?: number;
  tags?: string[];
}) {
  const res = await request.get<ApiResponse<unknown>>('/knowledge/search', { params });
  return res.data;
}

/** 获取知识详情 */
export async function getKnowledgeItem(id: string) {
  const res = await request.get<ApiResponse<unknown>>(`/knowledge/items/${id}`);
  return res.data;
}

// ==================== 案例管理 ====================

/** 新增案例 */
export async function createCase(data: Record<string, unknown>) {
  const res = await request.post<ApiResponse<unknown>>('/knowledge/cases', data);
  return res.data;
}

// ==================== 底稿模板管理 ====================

/** 获取模板列表 */
export async function getTemplates(params?: { category?: string; keyword?: string; file_type?: string }) {
  const res = await request.get<ApiResponse<unknown>>('/templates', { params });
  return res.data;
}

/** 获取模板分类列表 */
export async function getTemplateCategories() {
  const res = await request.get<ApiResponse<unknown>>('/templates/categories');
  return res.data;
}

/** 获取模板详情 */
export async function getTemplate(id: string) {
  const res = await request.get<ApiResponse<unknown>>(`/templates/${id}`);
  return res.data;
}

/** 上传模板 */
export async function uploadTemplate(data: FormData) {
  const res = await request.post<ApiResponse<unknown>>('/templates/upload', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

/** 删除模板 */
export async function deleteTemplate(id: string) {
  const res = await request.delete<ApiResponse<unknown>>(`/templates/${id}`);
  return res.data;
}

/** 获取模板下载链接 */
export function getTemplateDownloadUrl(id: string, format?: string) {
  const base = `/api/v1/templates/${id}/download`;
  return format ? `${base}?format=${format}` : base;
}
