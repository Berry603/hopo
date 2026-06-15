import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Button, Space, Modal, Form, Input, Select,
  message, Popconfirm, Tooltip, Badge, DatePicker,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined,
  PauseCircleOutlined, CheckCircleOutlined, RollbackOutlined,
} from '@ant-design/icons';
import {
  getTasks, createTask, updateTask, deleteTask,
  AuditTask, TASK_STATUS_LABEL, TASK_STATUS_COLOR,
} from '../../services/task';

const { TextArea } = Input;

const taskTypes = ['数据提取', '制度查阅', '穿行测试', '控制测试', '实质性程序', '访谈', '报告编制', '其他'];

interface TaskTabProps {
  projectId: string;
}

const TaskTab: React.FC<TaskTabProps> = ({ projectId }) => {
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AuditTask | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (projectId) loadTasks();
  }, [projectId]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await getTasks({ project_id: projectId });
      setTasks((res?.data || res || []) as AuditTask[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleCreate = () => {
    setEditingTask(null);
    form.resetFields();
    form.setFieldsValue({ audit_project_id: projectId });
    setModalOpen(true);
  };

  const handleEdit = (task: AuditTask) => {
    setEditingTask(task);
    form.setFieldsValue(task);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editingTask) {
        await updateTask(editingTask.id, values);
        message.success('任务已更新');
      } else {
        await createTask(values);
        message.success('任务已创建');
      }
      setModalOpen(false);
      loadTasks();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTask(id);
      message.success('任务已删除');
      loadTasks();
    } catch { message.error('删除失败'); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateTask(id, { status } as any);
      message.success(`状态已更新为 ${TASK_STATUS_LABEL[status]}`);
      loadTasks();
    } catch { message.error('状态更新失败'); }
  };

  const nextStatus = (current: string): { status: string; icon: React.ReactNode; text: string } | null => {
    const map: Record<string, { status: string; icon: React.ReactNode; text: string }> = {
      pending: { status: 'in_progress', icon: <PlayCircleOutlined />, text: '开始执行' },
      in_progress: { status: 'submitted', icon: <CheckCircleOutlined />, text: '提交审核' },
      submitted: { status: 'reviewed', icon: <CheckCircleOutlined />, text: '复核通过' },
      reviewed: { status: 'completed', icon: <CheckCircleOutlined />, text: '完成' },
    };
    return map[current] || null;
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建任务</Button>
      </Space>

      <Table
        dataSource={tasks}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 10 }}
        columns={[
          { title: '任务编号', dataIndex: 'task_id', width: 120 },
          { title: '任务名称', dataIndex: 'task_name', ellipsis: true },
          { title: '类型', dataIndex: 'task_type', width: 100,
            render: (v: string) => <Tag>{v}</Tag> },
          { title: '状态', dataIndex: 'status', width: 100,
            render: (v: string) => (
              <Badge status={TASK_STATUS_COLOR[v] as any} text={TASK_STATUS_LABEL[v] || v} />
            ),
          },
          { title: '截止日期', dataIndex: 'due_date', width: 120,
            render: (v: string) => v ? v.slice(0, 10) : '-' },
          {
            title: '操作', width: 250,
            render: (_: any, record: AuditTask) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
                {nextStatus(record.status) && (
                  <Tooltip title={nextStatus(record.status)!.text}>
                    <Button size="small" {...{ icon: nextStatus(record.status)!.icon }}
                      onClick={() => handleStatusChange(record.id, nextStatus(record.status)!.status)} />
                  </Tooltip>
                )}
                <Popconfirm title="确定删除此任务?" onConfirm={() => handleDelete(record.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingTask ? '编辑任务' : '新建任务'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="audit_project_id" hidden><Input /></Form.Item>
          <Form.Item name="task_name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="如：采购流程穿行测试" />
          </Form.Item>
          <Form.Item name="task_description" label="任务描述">
            <TextArea rows={3} placeholder="任务详细说明" />
          </Form.Item>
          <Form.Item name="task_type" label="任务类型">
            <Select options={taskTypes.map(t => ({ label: t, value: t }))} placeholder="选择类型" />
          </Form.Item>
          <Form.Item name="due_date" label="截止日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TaskTab;
