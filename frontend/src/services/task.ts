/**
 * 审计任务 API 服务
 */
import request from './request';
import type { ApiResponse } from './request';

export interface AuditTask {
  id: string;
  task_id: string;
  project_id: string;
  task_name: string;
  task_description?: string;
  task_type: string;
  status: string;
  assignee_id?: string;
  created_by_id?: string;
  due_date?: string;
  started_at?: string;
  completed_at?: string;
  severity?: string;
  created_at?: string;
}

// 任务状态映射
export const TASK_STATUS_LABEL: Record<string, string> = {
  pending: '待处理', in_progress: '进行中', submitted: '待审核',
  reviewed: '已复核', completed: '已完成', cancelled: '已取消',
};

export const TASK_STATUS_COLOR: Record<string, string> = {
  pending: 'default', in_progress: 'processing', submitted: 'warning',
  reviewed: 'purple', completed: 'success', cancelled: 'default',
};

// 获取任务列表
export async function getTasks(params?: { project_id?: string; assignee_id?: string; status?: string }) {
  const res = await request.get('/audit/tasks', { params });
  return res.data;
}

// 获取任务详情
export async function getTaskDetail(id: string) {
  const res = await request.get(`/audit/tasks/${id}`);
  return res.data;
}

// 创建任务
export async function createTask(data: { audit_project_id: string; task_name: string; task_description?: string; task_type?: string; assignee_id?: string; due_date?: string }) {
  const res = await request.post('/audit/tasks', data);
  return res.data;
}

// 更新任务
export async function updateTask(id: string, data: Partial<AuditTask>) {
  const res = await request.put(`/audit/tasks/${id}`, data);
  return res.data;
}

// 删除任务
export async function deleteTask(id: string) {
  const res = await request.delete(`/audit/tasks/${id}`);
  return res.data;
}
