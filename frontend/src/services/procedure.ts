/**
 * 审计程序 & 穿行测试 API 服务
 */
import request from './request';

export interface ProcedureItem {
  id: string;
  sort_order: number;
  field_name: string;
  field_label: string;
  data_type: string;
  data_source?: string;
  expected_result?: string;
  options?: string[];
  is_required: boolean;
  placeholder?: string;
  remark?: string;
}

export interface Procedure {
  id: string;
  procedure_code: string;
  name: string;
  procedure_type: string;
  description?: string;
  target_process?: string;
  data_sources?: string[];
  version?: string;
  is_preset: boolean;
  items: ProcedureItem[];
  created_at?: string;
}

export interface ExecutionRow {
  row_index: number;
  data: Record<string, any>;
  conclusion?: string;
  remark?: string;
}

export interface Execution {
  id: string;
  project_id: string;
  project_name?: string;
  procedure_id: string;
  procedure_name?: string;
  procedure_type?: string;
  target_process?: string;
  status: string;
  sample_count: number;
  conclusion?: string;
  output_file_path?: string;
  started_at?: string;
  completed_at?: string;
  items?: ProcedureItem[];
  rows?: ExecutionRow[];
}

// 获取程序模板列表
export async function getProcedures(params?: {
  procedure_type?: string;
  is_preset?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}) {
  const res = await request.get('/audit/procedures', { params });
  return res.data;
}

// 获取程序模板详情
export async function getProcedureDetail(id: string) {
  const res = await request.get(`/audit/procedures/${id}`);
  return res.data;
}

// 获取执行记录列表
export async function listExecutions(params?: {
  project_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}) {
  const res = await request.get('/audit/procedures/executions', { params });
  return res.data;
}

// 创建执行
export async function createExecution(data: { project_id: string; procedure_id: string }) {
  const res = await request.post('/audit/procedures/executions', data);
  return res.data;
}

// 保存执行数据行
export async function saveExecutionRows(execId: string, rows: Record<string, unknown>[]) {
  const res = await request.put(`/audit/procedures/executions/${execId}/rows`, { rows });
  return res.data;
}

// 完成执行
export async function completeExecution(execId: string, data: { conclusion: string }) {
  const res = await request.post(`/audit/procedures/executions/${execId}/complete`, data);
  return res.data;
}

// 获取执行详情
export async function getExecutionDetail(exec_id: string) {
  const res = await request.get(`/audit/procedures/executions/${exec_id}`);
  return res.data;
}

// 导出执行结果为 Excel
export async function exportExecutionExcel(execId: string) {
  const res = await request.get(`/audit/procedures/executions/${execId}/export`);
  return res.data;
}
