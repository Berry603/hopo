import request from './request';
import type { ApiResponse, PaginatedData } from './request';

// ==================== 仪表盘 ====================

/** 获取数据治理中心仪表盘统计数据 */
export async function getDashboard() {
  const res = await request.get<ApiResponse<unknown>>('/data-quality/dashboard');
  return res.data;
}

// ==================== 数据质量规则管理 ====================

/** 获取数据质量规则列表 */
export async function getQualityRules(params?: {
  page?: number;
  page_size?: number;
  source_system?: string;
  table_name?: string;
  rule_type?: string;
  is_active?: boolean;
  keyword?: string;
}) {
  const res = await request.get<ApiResponse<PaginatedData<unknown>>>('/data-quality/rules', { params });
  return res.data;
}

/** 获取预设质量规则模板 */
export async function getPresetQualityRules() {
  const res = await request.get<ApiResponse<unknown>>('/data-quality/preset-rules');
  return res.data;
}

/** 创建数据质量规则 */
export async function createQualityRule(data: Record<string, unknown>) {
  const res = await request.post<ApiResponse<unknown>>('/data-quality/rules', data);
  return res.data;
}

/** 更新数据质量规则 */
export async function updateQualityRule(id: string, data: Record<string, unknown>) {
  const res = await request.put<ApiResponse<unknown>>(`/data-quality/rules/${id}`, data);
  return res.data;
}

/** 删除数据质量规则 */
export async function deleteQualityRule(id: string) {
  const res = await request.delete<ApiResponse<unknown>>(`/data-quality/rules/${id}`);
  return res.data;
}

/** 手动执行单条质量规则 */
export async function runQualityRule(id: string) {
  const res = await request.post<ApiResponse<unknown>>(`/data-quality/rules/${id}/run`);
  return res.data;
}

/** 批量执行所有活跃质量规则 */
export async function runAllQualityRules(params?: { system?: string }) {
  const res = await request.post<ApiResponse<unknown>>('/data-quality/rules/run-all', undefined, { params });
  return res.data;
}

// ==================== 跨系统一致性校验 ====================

/** 获取跨系统一致性检查列表 */
export async function getCrossSystemChecks(params?: { source_system?: string; target_system?: string }) {
  const res = await request.get<ApiResponse<unknown>>('/data-quality/cross-system-checks', { params });
  return res.data;
}

/** 执行跨系统一致性校验 */
export async function runCrossSystemCheck(checkId: string) {
  const res = await request.post<ApiResponse<unknown>>(`/data-quality/cross-system-checks/${checkId}/run`);
  return res.data;
}

// ==================== 数据质量报告 ====================

/** 获取数据质量报告列表 */
export async function getQualityReports(params?: { page?: number; page_size?: number; month?: string; department?: string }) {
  const res = await request.get<ApiResponse<unknown>>('/data-quality/reports', { params });
  return res.data;
}

/** 生成月度质量报告 */
export async function generateQualityReport(params?: { month?: string }) {
  const res = await request.post<ApiResponse<unknown>>('/data-quality/reports/generate', undefined, {
    params: params ?? {},
  });
  return res.data;
}

/** 获取质量评分排名 */
export async function getQualityScores(params: { report_month: string; entity_type?: string }) {
  const res = await request.get<ApiResponse<unknown>>('/data-quality/scores', { params });
  return res.data;
}

// ==================== 数据血缘追踪 ====================

/** 获取数据血缘列表 */
export async function getLineage(params?: { source_system?: string; node_level?: number }) {
  const res = await request.get<ApiResponse<unknown>>('/data-quality/lineage', { params });
  return res.data;
}

/** 全链路溯源/影响分析 */
export async function traceLineage(params: { node: string; direction?: string }) {
  const res = await request.get<ApiResponse<unknown>>('/data-quality/lineage/trace', { params });
  return res.data;
}

/** 字段变更影响分析 */
export async function analyzeFieldChangeImpact(params: { source_system: string; table_name: string; field_name: string }) {
  const res = await request.get<ApiResponse<unknown>>('/data-quality/lineage/impact-analysis', { params });
  return res.data;
}

/** 获取字段变更日志 */
export async function getFieldChangeLogs(params?: {
  page?: number;
  page_size?: number;
  source_system?: string;
  impact_level?: string;
}) {
  const res = await request.get<ApiResponse<unknown>>('/data-quality/field-changes', { params });
  return res.data;
}

// ==================== 数据接入健康度 ====================

/** 获取同步健康度总览 */
export async function getSyncHealth() {
  const res = await request.get<ApiResponse<unknown>>('/data-quality/sync-health');
  return res.data;
}

/** 获取所有源系统同步状态 */
export async function getSyncStatus() {
  const res = await request.get<ApiResponse<unknown>>('/data-quality/sync-status');
  return res.data;
}

/** 检查指定源系统同步延迟 */
export async function checkSyncDelay(sourceSystem: string) {
  const res = await request.get<ApiResponse<unknown>>(`/data-quality/sync-delay/${sourceSystem}`);
  return res.data;
}

/** 获取同步快照列表 */
export async function getSyncSnapshots(params?: {
  source_system?: string;
  table_name?: string;
  page?: number;
  page_size?: number;
}) {
  const res = await request.get<ApiResponse<unknown>>('/data-quality/sync-snapshots', { params });
  return res.data;
}
