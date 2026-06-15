import request from './request';
import type { ApiResponse, PaginatedData } from './request';

// ==================== 风险规则管理 ====================

/** 获取风险规则列表 */
export async function getRules(params?: {
  page?: number;
  page_size?: number;
  risk_type?: string;
  severity?: string;
  is_active?: boolean;
}) {
  const res = await request.get<ApiResponse<PaginatedData<unknown>>>('/risk/rules', { params });
  return res.data;
}

/** 创建风险规则 */
export async function createRule(data: Record<string, unknown>) {
  const res = await request.post<ApiResponse<unknown>>('/risk/rules', data);
  return res.data;
}

/** 更新风险规则 */
export async function updateRule(id: string, data: Record<string, unknown>) {
  const res = await request.put<ApiResponse<unknown>>(`/risk/rules/${id}`, data);
  return res.data;
}

// ==================== 风险预警事件管理 ====================

/** 获取风险预警事件列表 */
export async function getAlerts(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  severity?: string;
  risk_type?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
}) {
  const res = await request.get<ApiResponse<PaginatedData<unknown>>>('/risk/alerts', { params });
  return res.data;
}

/** 获取风险预警事件详情 */
export async function getAlertDetail(id: string) {
  const res = await request.get<ApiResponse<unknown>>(`/risk/alerts/${id}`);
  return res.data;
}

/** 确认风险预警事件 */
export async function confirmAlert(id: string, data: { note?: string }) {
  const res = await request.put<ApiResponse<unknown>>(`/risk/alerts/${id}/confirm`, data);
  return res.data;
}

/** 处理风险预警事件（通用的 handle 端点） */
export async function handleAlert(id: string, data: { action: string; note?: string }) {
  const res = await request.put<ApiResponse<unknown>>(`/risk/alerts/${id}/handle`, data);
  return res.data;
}

// ==================== 风险扫描引擎 ====================

/** 获取风险统计 */
export async function getRiskStats() {
  const res = await request.get<ApiResponse<unknown>>('/risk/statistics');
  return res.data;
}

/** 触发全量风险扫描 */
export async function triggerRiskScan() {
  const res = await request.post<ApiResponse<unknown>>('/risk/scan');
  return res.data;
}

/** 触发单条规则扫描 */
export async function triggerSingleRule(ruleId: string) {
  const res = await request.post<ApiResponse<unknown>>(`/risk/scan/${ruleId}`);
  return res.data;
}

/** 获取预设风险规则模板 */
export async function getPresetRules() {
  const res = await request.get<ApiResponse<unknown>>('/risk/preset-rules');
  return res.data;
}
