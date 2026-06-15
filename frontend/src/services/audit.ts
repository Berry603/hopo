import request from './request';
import type { ApiResponse, PaginatedData } from './request';

// ==================== 审计项目管理 ====================

/** 获取审计项目列表 */
export async function getProjects(params?: {
  page?: number;
  page_size?: number;
  project_code?: string;
  project_name?: string;
  audit_type?: string;
  status?: string;
}) {
  const res = await request.get<ApiResponse<PaginatedData<unknown>>>('/audit/projects', { params });
  return res.data;
}

/** 获取审计项目详情 */
export async function getProjectDetail(id: string) {
  const res = await request.get<ApiResponse<unknown>>(`/audit/projects/${id}`);
  return res.data;
}

/** 创建审计项目 */
export async function createProject(data: Record<string, unknown>) {
  const res = await request.post<ApiResponse<unknown>>('/audit/projects', data);
  return res.data;
}

/** 更新审计项目 */
export async function updateProject(id: string, data: Record<string, unknown>) {
  const res = await request.put<ApiResponse<unknown>>(`/audit/projects/${id}`, data);
  return res.data;
}

/** 删除审计项目 */
export async function deleteProject(id: string) {
  const res = await request.delete<ApiResponse<unknown>>(`/audit/projects/${id}`);
  return res.data;
}

// ==================== 审计工作流 ====================

/** 推进项目阶段 */
export async function updateProjectPhase(projectId: string, data: { phase: string }) {
  const res = await request.put<ApiResponse<unknown>>(`/audit/projects/${projectId}/phase`, data);
  return res.data;
}

/** 获取项目概览（驾驶舱数据） */
export async function getProjectOverview(projectId: string) {
  const res = await request.get<ApiResponse<unknown>>(`/audit/projects/${projectId}/overview`);
  return res.data;
}

// ==================== 审计发现 ====================

/** 获取项目审计发现列表 */
export async function getFindings(projectId: string) {
  const res = await request.get<ApiResponse<unknown>>(`/audit/projects/${projectId}/findings`);
  return res.data;
}

/** 将风险预警转换为审计发现 */
export async function convertAlertToFinding(data: { alert_id: string; project_id: string }) {
  const res = await request.post<ApiResponse<unknown>>('/audit/projects/findings/from-alert', data);
  return res.data;
}

/** 自动为项目批量生成审计发现 */
export async function autoGenerateFindings(projectId: string) {
  const res = await request.post<ApiResponse<unknown>>(`/audit/projects/${projectId}/findings/auto-generate`);
  return res.data;
}

/** 获取审计发现的证据链 */
export async function getEvidenceChain(findingId: string) {
  const res = await request.get<ApiResponse<unknown>>(`/audit/projects/findings/${findingId}/evidence`);
  return res.data;
}

/** 添加证据链关联 */
export async function addEvidenceLink(findingId: string, data: Record<string, unknown>) {
  const res = await request.post<ApiResponse<unknown>>(`/audit/projects/findings/${findingId}/evidence`, data);
  return res.data;
}

// ==================== 底稿与报告 ====================

/** 获取底稿模板列表 */
export async function getWorksheetTemplates() {
  const res = await request.get<ApiResponse<unknown>>('/audit/projects/worksheet-templates');
  return res.data;
}

/** 获取报告模板列表 */
export async function getReportTemplates() {
  const res = await request.get<ApiResponse<unknown>>('/audit/projects/report-templates');
  return res.data;
}

/** 生成审计报告 */
export async function generateReport(projectId: string, data: { template_id?: string }) {
  const res = await request.post<ApiResponse<unknown>>(`/audit/projects/${projectId}/reports`, data);
  return res.data;
}

// ==================== 整改闭环 ====================

/** 创建整改通知单 */
export async function createRectificationOrder(projectId: string, data: { finding_id: string }) {
  const res = await request.post<ApiResponse<unknown>>(`/audit/projects/${projectId}/rectifications`, data);
  return res.data;
}

// ==================== 审计程序与穿行测试 ====================
// 已迁移到 services/procedure.ts，从 @/services 统一导入

// ==================== 统计 ====================

/** 获取审计统计总览 */
export async function getAuditStats() {
  const res = await request.get<ApiResponse<unknown>>('/audit/statistics');
  return res.data;
}
