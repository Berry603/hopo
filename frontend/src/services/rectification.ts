import request from './request';
import type { ApiResponse, PaginatedData } from './request';

// ==================== 整改工单管理 ====================

/** 获取整改工单列表 */
export async function getOrders(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  department?: string;
  risk_level?: string;
  is_overdue?: boolean;
  keyword?: string;
}) {
  const res = await request.get<ApiResponse<PaginatedData<unknown>>>('/rectification/orders', { params });
  return res.data;
}

/** 获取整改工单详情 */
export async function getOrderDetail(id: string) {
  const res = await request.get<ApiResponse<unknown>>(`/rectification/orders/${id}`);
  return res.data;
}

/** 批量创建整改工单 */
export async function batchCreateOrders(data: { finding_ids: string[]; auto_fill?: boolean }) {
  const res = await request.post<ApiResponse<unknown>>('/rectification/orders/batch-create', data);
  return res.data;
}

// ==================== 整改证据与核实 ====================

/** 提交整改证据 */
export async function submitEvidence(id: string, data: Record<string, unknown>) {
  const res = await request.put<ApiResponse<unknown>>(`/rectification/orders/${id}/submit`, data);
  return res.data;
}

/** 核实整改工单 */
export async function verifyOrder(id: string, data: { result: string; comments?: string }) {
  const res = await request.put<ApiResponse<unknown>>(`/rectification/orders/${id}/verify`, data);
  return res.data;
}

// ==================== 统计 ====================

/** 获取整改统计总览 */
export async function getRectificationStats() {
  const res = await request.get<ApiResponse<unknown>>('/rectification/statistics');
  return res.data;
}
