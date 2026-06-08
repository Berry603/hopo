import React, { useState } from 'react';
import {
  Layout, Tabs, Button, Table, Tag, Space, Modal, Form, Input, Select,
  DatePicker, message, Card, Statistic, Row, Col, Badge, Progress,
  Popconfirm, Drawer, Timeline, Upload, Divider, Steps, Tooltip,
  Radio, Empty, Switch, InputNumber, List, Descriptions,
} from 'antd';
import {
  AuditOutlined, FormOutlined, BarChartOutlined, FileTextOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, PlayCircleOutlined,
  CheckCircleOutlined, PauseCircleOutlined, UploadOutlined, DownloadOutlined,
  FileWordOutlined, FilePdfOutlined, ReloadOutlined, SearchOutlined,
  FilterOutlined, TeamOutlined, ClockCircleOutlined, SolutionOutlined,
  ContainerOutlined, CheckSquareOutlined, FileDoneOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { ColumnsType } from 'antd/es/table';
import './AuditProjectPage.less';

const { Content } = Layout;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Step } = Steps;
const { TextArea } = Input;

// ==================== Mock Data ====================

interface AuditProject {
  id: string;
  name: string;
  type: string;
  phase: 'planning' | 'execution' | 'reporting' | 'closed';
  status: 'active' | 'paused' | 'completed';
  manager: string;
  team: string[];
  startDate: string;
  endDate: string;
  progress: number;
  findings: number;
  worksheets: number;
  reportStatus: 'none' | 'draft' | 'review' | 'published';
}

interface AuditTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  assignee: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'reviewed' | 'completed';
  priority: 'high' | 'medium' | 'low';
  worksheetCount: number;
}

interface AuditFinding {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  status: 'open' | 'resolved' | 'closed';
  amount?: number;
  responsibleDept: string;
  createdAt: string;
  hasRectification: boolean;
}

interface Report {
  id: string;
  projectId: string;
  projectName: string;
  template: string;
  status: 'draft' | 'review' | 'published';
  version: string;
  createdAt: string;
  updatedAt: string;
}

const mockProjects: AuditProject[] = [
  { id: 'PRJ-2026-001', name: '2026年Q1财务收支专项审计', type: '财务审计', phase: 'execution', status: 'active', manager: '张三', team: ['张三','李四','王五'], startDate: '2026-03-01', endDate: '2026-05-30', progress: 68, findings: 12, worksheets: 8, reportStatus: 'none' },
  { id: 'PRJ-2026-002', name: '采购流程合规性审计', type: '合规审计', phase: 'reporting', status: 'active', manager: '李四', team: ['李四','赵六'], startDate: '2026-04-01', endDate: '2026-06-15', progress: 85, findings: 5, worksheets: 6, reportStatus: 'draft' },
  { id: 'PRJ-2026-003', name: '固定资产盘点专项审计', type: '运营审计', phase: 'planning', status: 'active', manager: '王五', team: ['王五','孙七'], startDate: '2026-05-15', endDate: '2026-07-30', progress: 15, findings: 0, worksheets: 2, reportStatus: 'none' },
  { id: 'PRJ-2025-012', name: '2025年度全面审计', type: '全面审计', phase: 'closed', status: 'completed', manager: '张三', team: ['张三','李四','王五','赵六'], startDate: '2025-10-01', endDate: '2026-01-31', progress: 100, findings: 23, worksheets: 15, reportStatus: 'published' },
  { id: 'PRJ-2026-004', name: '销售费用专项审计', type: '费用审计', phase: 'execution', status: 'paused', manager: '赵六', team: ['赵六'], startDate: '2026-04-15', endDate: '2026-06-30', progress: 45, findings: 3, worksheets: 4, reportStatus: 'none' },
];

const mockTasks: AuditTask[] = [
  { id: 'TSK-001', title: '销售费用凭证抽查（3-4月）', projectId: 'PRJ-2026-004', projectName: '销售费用专项审计', assignee: '赵六', deadline: '2026-06-10', status: 'in_progress', priority: 'high', worksheetCount: 2 },
  { id: 'TSK-002', title: '采购合同合规性检查', projectId: 'PRJ-2026-002', projectName: '采购流程合规性审计', assignee: '李四', deadline: '2026-06-08', status: 'submitted', priority: 'medium', worksheetCount: 3 },
  { id: 'TSK-003', title: '固定资产台账核对', projectId: 'PRJ-2026-003', projectName: '固定资产盘点专项审计', assignee: '王五', deadline: '2026-06-20', status: 'pending', priority: 'medium', worksheetCount: 0 },
  { id: 'TSK-004', title: 'Q1收入确认审核', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', assignee: '张三', deadline: '2026-05-25', status: 'reviewed', priority: 'high', worksheetCount: 2 },
  { id: 'TSK-005', title: '成本核算方法复核', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', assignee: '李四', deadline: '2026-05-28', status: 'completed', priority: 'medium', worksheetCount: 3 },
];

const mockFindings: AuditFinding[] = [
  { id: 'FND-001', title: '销售费用报销缺少审批签字', projectId: 'PRJ-2026-004', projectName: '销售费用专项审计', severity: 'medium', category: '内控缺陷', status: 'open', amount: 12800, responsibleDept: '销售部', createdAt: '2026-05-20', hasRectification: false },
  { id: 'FND-002', title: '采购合同未按招标流程执行', projectId: 'PRJ-2026-002', projectName: '采购流程合规性审计', severity: 'high', category: '合规违规', status: 'open', amount: 256000, responsibleDept: '采购部', createdAt: '2026-05-18', hasRectification: true },
  { id: 'FND-003', title: '固定资产标签缺失率35%', projectId: 'PRJ-2026-003', projectName: '固定资产盘点专项审计', severity: 'low', category: '资产管理', status: 'open', responsibleDept: '生产部', createdAt: '2026-05-22', hasRectification: false },
  { id: 'FND-004', title: '收入确认时点与合同条款不一致', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'high', category: '财务合规', status: 'resolved', amount: 450000, responsibleDept: '财务部', createdAt: '2026-04-15', hasRectification: true },
  { id: 'FND-005', title: '备用金超限额未清理', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'medium', category: '资金管理', status: 'closed', amount: 32000, responsibleDept: '行政部', createdAt: '2026-04-20', hasRectification: true },
];

const mockReports: Report[] = [
  { id: 'RPT-001', projectId: 'PRJ-2026-002', projectName: '采购流程合规性审计', template: '标准审计报告', status: 'draft', version: 'v0.3', createdAt: '2026-05-25', updatedAt: '2026-06-01' },
  { id: 'RPT-002', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', template: '年度审计报告', status: 'published', version: 'v1.0', createdAt: '2026-01-15', updatedAt: '2026-01-31' },
];

const worksheetData: Record<string, { name: string; preparedBy: string; lastModified: string; pages: number; memo: string }[]> = {
  'PRJ-2026-001': [
    { name: '销售费用凭证抽查表.xlsx', preparedBy: 'Berry', lastModified: '2026-06-01', pages: 12, memo: '抽查50笔' },
    { name: '差旅费明细分析.docx', preparedBy: '李雷', lastModified: '2026-05-28', pages: 8, memo: '含异常标记' },
    { name: '合同台账核对表.xlsx', preparedBy: '韩梅梅', lastModified: '2026-05-25', pages: 20, memo: '全部供应商' },
    { name: '银行流水比对.doc', preparedBy: 'Berry', lastModified: '2026-05-22', pages: 15, memo: '已对账' },
  ],
  'PRJ-2026-002': [
    { name: '采购订单抽查表.xlsx', preparedBy: '王芳', lastModified: '2026-05-30', pages: 18, memo: '随机抽样100笔' },
    { name: '供应商资质审查表.docx', preparedBy: '赵明', lastModified: '2026-05-28', pages: 6, memo: '全部供应商' },
    { name: '比价单汇总分析.xlsx', preparedBy: '孙丽', lastModified: '2026-05-26', pages: 10, memo: '含异常标注' },
    { name: '采购合同台账.doc', preparedBy: '王芳', lastModified: '2026-05-20', pages: 22, memo: '近三年' },
    { name: '入库单核对表.xlsx', preparedBy: '赵明', lastModified: '2026-05-18', pages: 14, memo: '与ERP比对' },
    { name: '付款审批跟踪表.doc', preparedBy: '孙丽', lastModified: '2026-05-15', pages: 8, memo: '已审批完毕' },
  ],
  'PRJ-2025-012': [
    { name: '年度审计底稿-总账.xlsx', preparedBy: 'Berry', lastModified: '2026-01-30', pages: 45, memo: '科目余额表' },
    { name: '关联交易核对表.docx', preparedBy: '李雷', lastModified: '2026-01-28', pages: 12, memo: '已核实' },
    { name: '固定资产盘点表.xlsx', preparedBy: '韩梅梅', lastModified: '2026-01-25', pages: 30, memo: '全盘点' },
    { name: '应收应付账龄分析.doc', preparedBy: 'Berry', lastModified: '2026-01-20', pages: 18, memo: '账龄分析' },
  ],
};

const phaseMap: Record<string, { label: string; color: string; step: number }> = {
  planning: { label: '计划阶段', color: 'blue', step: 0 },
  execution: { label: '执行阶段', color: 'processing', step: 1 },
  reporting: { label: '报告阶段', color: 'warning', step: 2 },
  closed: { label: '已结项', color: 'success', step: 3 },
};

const statusMap: Record<string, { label: string; color: string }> = {
  active: { label: '进行中', color: 'processing' },
  paused: { label: '已暂停', color: 'warning' },
  completed: { label: '已完成', color: 'success' },
};

const taskStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待执行', color: 'default' },
  in_progress: { label: '执行中', color: 'processing' },
  submitted: { label: '已提交', color: 'warning' },
  reviewed: { label: '已复核', color: 'blue' },
  completed: { label: '已完成', color: 'success' },
};

const severityMap: Record<string, { color: string; label: string }> = {
  high: { color: '#f5222d', label: '高' },
  medium: { color: '#faad14', label: '中' },
  low: { color: '#52c41a', label: '低' },
};

// ==================== Component ====================

const AuditProjectPage: React.FC = () => {
  const [projects, setProjects] = useState<AuditProject[]>(mockProjects);
  const [tasks, setTasks] = useState<AuditTask[]>(mockTasks);
  const [findings, setFindings] = useState<AuditFinding[]>(mockFindings);
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [activeTab, setActiveTab] = useState('projects');
  const [findingProjectFilter, setFindingProjectFilter] = useState<string | null>(null);

  // Modals / Drawers
  const [projectModalVisible, setProjectModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<AuditProject | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState<AuditProject | null>(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [findingModalVisible, setFindingModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [worksheetModalVisible, setWorksheetModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewWorksheet, setPreviewWorksheet] = useState<{ name: string; preparedBy: string; lastModified: string; pages: number; memo: string } | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const [projectForm] = Form.useForm();
  const [taskForm] = Form.useForm();
  const [findingForm] = Form.useForm();

  // ==================== Project Actions ====================

  const handleAddProject = () => {
    setEditingProject(null);
    projectForm.resetFields();
    projectForm.setFieldsValue({ status: 'active', phase: 'planning', progress: 0 });
    setProjectModalVisible(true);
  };

  const handleEditProject = (project: AuditProject) => {
    setEditingProject(project);
    projectForm.setFieldsValue(project);
    setProjectModalVisible(true);
  };

  const handleDeleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    message.success('项目已删除');
  };

  const handleSaveProject = () => {
    projectForm.validateFields().then(values => {
      if (editingProject) {
        setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...values } : p));
        message.success('项目已更新');
      } else {
        const newId = `PRJ-2026-${String(projects.length + 1).padStart(3, '0')}`;
        setProjects(prev => [...prev, { ...values, id: newId, findings: 0, worksheets: 0, reportStatus: 'none' } as AuditProject]);
        message.success('项目已创建');
      }
      setProjectModalVisible(false);
    });
  };

  const handleViewProject = (project: AuditProject) => {
    setSelectedProject(project);
    setDetailDrawerVisible(true);
  };

  const handleToggleStatus = (project: AuditProject) => {
    const next = project.status === 'active' ? 'paused' : 'active';
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: next } : p));
    message.success(next === 'paused' ? '项目已暂停' : '项目已恢复');
  };

  // ==================== Task Actions ====================

  const handleAddTask = () => {
    taskForm.resetFields();
    taskForm.setFieldsValue({ status: 'pending', priority: 'medium' });
    setTaskModalVisible(true);
  };

  const handleSaveTask = () => {
    taskForm.validateFields().then(values => {
      const newTask: AuditTask = {
        id: `TSK-${String(tasks.length + 1).padStart(3, '0')}`,
        ...values,
        projectName: projects.find(p => p.id === values.projectId)?.name || '',
        worksheetCount: 0,
      };
      setTasks(prev => [...prev, newTask]);
      message.success('任务已创建');
      setTaskModalVisible(false);
    });
  };

  // ==================== Finding Actions ====================

  const handleAddFinding = () => {
    findingForm.resetFields();
    findingForm.setFieldsValue({ status: 'open', severity: 'medium' });
    setFindingModalVisible(true);
  };

  const handleSaveFinding = () => {
    findingForm.validateFields().then(values => {
      const newFinding: AuditFinding = {
        id: `FND-${String(findings.length + 1).padStart(3, '0')}`,
        ...values,
        projectName: projects.find(p => p.id === values.projectId)?.name || '',
        createdAt: new Date().toISOString().slice(0, 10),
        hasRectification: false,
      };
      setFindings(prev => [...prev, newFinding]);
      // Update project finding count
      setProjects(prev => prev.map(p => p.id === values.projectId ? { ...p, findings: p.findings + 1 } : p));
      message.success('审计发现已记录');
      setFindingModalVisible(false);
    });
  };

  // ==================== Report Actions ====================

  const handleGenerateReport = (projectId: string) => {
    setGeneratingReport(true);
    setTimeout(() => {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        const newReport: Report = {
          id: `RPT-${String(reports.length + 1).padStart(3, '0')}`,
          projectId,
          projectName: project.name,
          template: '标准审计报告',
          status: 'draft',
          version: 'v0.1',
          createdAt: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString().slice(0, 10),
        };
        setReports(prev => [...prev, newReport]);
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, reportStatus: 'draft' } : p));
        message.success('审计报告已生成');
      }
      setGeneratingReport(false);
      setReportModalVisible(false);
    }, 2000);
  };

  // ==================== Task 表格操作 ====================

  const handleViewTask = (task: AuditTask) => {
    message.info(`查看任务: ${task.title}\n执行人: ${task.assignee}\n截止: ${task.deadline}\n状态: ${task.status}`);
  };

  const handleEditTask = (task: AuditTask) => {
    taskForm.setFieldsValue(task);
    setTaskModalVisible(true);
  };

  // ==================== Finding 表格操作 ====================

  const handleViewFinding = (finding: AuditFinding) => {
    message.info(`审计发现: ${finding.title}\n类别: ${finding.category}\n严重等级: ${finding.severity}\n责任部门: ${finding.responsibleDept}`);
  };

  const handleEditFinding = (finding: AuditFinding) => {
    findingForm.setFieldsValue(finding);
    setFindingModalVisible(true);
  };

  // ==================== Report 表格操作 ====================

  const handleViewReport = (report: Report) => {
    message.info(`审计报告: ${report.id}\n项目: ${report.projectName}\n模板: ${report.template}\n版本: ${report.version}\n状态: ${report.status}`);
  };

  const handleEditReport = (report: Report) => {
    setReportModalVisible(true);
    message.info(`编辑报告: ${report.id}`);
  };

  const handleDownloadReport = (report: Report) => {
    message.success(`报告 ${report.id} 已加入下载队列`);
  };

  // ==================== Worksheet 操作 ====================

  type WorksheetItem = { name: string; preparedBy: string; lastModified: string; pages: number; memo: string };

  const handlePreviewWorksheet = (item: WorksheetItem) => {
    setPreviewWorksheet(item);
    setPreviewModalVisible(true);
  };

  const handleDownloadWorksheet = (item: WorksheetItem) => {
    message.success(`底稿「${item.name}」已加入下载队列`);
  };

  // ==================== Columns ====================

  const projectColumns: ColumnsType<AuditProject> = [
    { title: '项目编号', dataIndex: 'id', key: 'id', width: 140, render: t => <code style={{ fontSize: 12 }}>{t}</code> },
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.type} | 负责人: {record.manager}</div>
        </div>
      ),
    },
    { title: '当前阶段', dataIndex: 'phase', key: 'phase', width: 110, render: (p: string) => <Tag color={phaseMap[p]?.color}>{phaseMap[p]?.label}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Badge status={statusMap[s]?.color as any}>{statusMap[s]?.label}</Badge> },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 140,
      render: (p: number) => <Progress percent={p} size="small" strokeColor={p >= 100 ? '#52c41a' : p >= 60 ? '#E34D59' : '#faad14'} />,
      sorter: (a, b) => a.progress - b.progress,
    },
    { title: '发现数', dataIndex: 'findings', key: 'findings', width: 80, align: 'right' },
    { title: '底稿数', dataIndex: 'worksheets', key: 'worksheets', width: 80, align: 'right' },
    { title: '报告', dataIndex: 'reportStatus', key: 'reportStatus', width: 100, render: (s: string) => s === 'none' ? <Tag>未生成</Tag> : s === 'draft' ? <Tag color="warning">草稿</Tag> : <Tag color="success">已发布</Tag> },
    {
      title: '起止日期',
      key: 'dates',
      width: 190,
      render: (_, r) => <span style={{ fontSize: 12 }}>{r.startDate} ~ {r.endDate}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewProject(record)}>查看</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditProject(record)}>编辑</Button>
          <Button
            size="small"
            icon={record.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => handleToggleStatus(record)}
          >
            {record.status === 'active' ? '暂停' : '恢复'}
          </Button>
          {record.reportStatus === 'none' && record.phase !== 'planning' && (
            <Button size="small" icon={<FileTextOutlined />} onClick={() => { setSelectedProject(record); setReportModalVisible(true); }}>生成报告</Button>
          )}
        </Space>
      ),
    },
  ];

  const taskColumns: ColumnsType<AuditTask> = [
    { title: '任务编号', dataIndex: 'id', key: 'id', width: 110, render: t => <code style={{ fontSize: 12 }}>{t}</code> },
    {
      title: '任务名称',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.projectName}</div>
        </div>
      ),
    },
    { title: '执行人', dataIndex: 'assignee', key: 'assignee', width: 100 },
    { title: '截止日期', dataIndex: 'deadline', key: 'deadline', width: 120 },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 90, render: (p: string) => <Tag color={severityMap[p]?.color}>{severityMap[p]?.label}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Badge status={taskStatusMap[s]?.color as any}>{taskStatusMap[s]?.label}</Badge> },
    { title: '底稿', dataIndex: 'worksheetCount', key: 'worksheetCount', width: 80, align: 'right', render: (n: number) => <Tag>{n} 份</Tag> },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewTask(record)}>查看</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditTask(record)}>编辑</Button>
        </Space>
      ),
    },
  ];

  const findingColumns: ColumnsType<AuditFinding> = [
    { title: '发现编号', dataIndex: 'id', key: 'id', width: 120, render: t => <code style={{ fontSize: 12 }}>{t}</code> },
    {
      title: '发现内容',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.projectName}</div>
        </div>
      ),
    },
    { title: '严重等级', dataIndex: 'severity', key: 'severity', width: 90, render: (s: string) => <Tag color={severityMap[s]?.color}>{severityMap[s]?.label}</Tag> },
    { title: '类别', dataIndex: 'category', key: 'category', width: 110, render: (t: string) => <Tag color="blue">{t}</Tag> },
    { title: '责任部门', dataIndex: 'responsibleDept', key: 'responsibleDept', width: 110 },
    { title: '涉及金额', dataIndex: 'amount', key: 'amount', width: 130, align: 'right', render: (a?: number) => a ? `¥${a.toLocaleString()}` : '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => s === 'open' ? <Badge status="error">待整改</Badge> : s === 'resolved' ? <Badge status="processing">整改中</Badge> : <Badge status="success">已关闭</Badge> },
    { title: '整改单', dataIndex: 'hasRectification', key: 'hasRectification', width: 90, render: (v: boolean) => v ? <Tag color="success">已创建</Tag> : <Tag>未创建</Tag> },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewFinding(record)}>查看</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditFinding(record)}>编辑</Button>
          {!record.hasRectification && <Button size="small" type="primary" icon={<FileTextOutlined />}>生成整改</Button>}
        </Space>
      ),
    },
  ];

  const reportColumns: ColumnsType<Report> = [
    { title: '报告编号', dataIndex: 'id', key: 'id', width: 110, render: t => <code style={{ fontSize: 12 }}>{t}</code> },
    { title: '所属项目', dataIndex: 'projectName', key: 'projectName' },
    { title: '模板', dataIndex: 'template', key: 'template', width: 130, render: (t: string) => <Tag>{t}</Tag> },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => s === 'draft' ? <Tag color="warning">草稿</Tag> : s === 'review' ? <Tag color="processing">审核中</Tag> : <Tag color="success">已发布</Tag> },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 120 },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewReport(record)}>预览</Button>
          {record.status === 'draft' && <Button size="small" icon={<EditOutlined />} onClick={() => handleEditReport(record)}>编辑</Button>}
          <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadReport(record)}>下载</Button>
        </Space>
      ),
    },
  ];

  // ==================== Charts ====================

  const phasePieOption = {
    title: { text: '项目阶段分布', left: 'center', textStyle: { fontSize: 16 } },
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: 1, name: '计划阶段', itemStyle: { color: '#1890ff' } },
        { value: 2, name: '执行阶段', itemStyle: { color: '#E34D59' } },
        { value: 1, name: '报告阶段', itemStyle: { color: '#faad14' } },
        { value: 1, name: '已结项', itemStyle: { color: '#52c41a' } },
      ],
    }],
  };

  const typeBarOption = {
    title: { text: '审计类型分布', left: 'center', textStyle: { fontSize: 16 } },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['财务审计', '合规审计', '运营审计', '费用审计', '全面审计'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [1, 1, 1, 1, 1], itemStyle: { color: '#E34D59', borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top' } }],
  };

  // ==================== Stats ====================

  const stats = {
    activeProjects: projects.filter(p => p.status === 'active').length,
    totalFindings: findings.filter(f => f.status === 'open').length,
    pendingTasks: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
    publishedReports: reports.filter(r => r.status === 'published').length,
  };

  return (
    <Layout className="audit-project-page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="page-title"><AuditOutlined /> 审计作业中心</h2>
            <p className="page-subtitle">审计项目全流程管理，智能辅助作业</p>
          </div>
        </div>
      </div>

      <Content className="page-content">
        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card><Statistic title="进行中项目" value={stats.activeProjects} prefix={<PlayCircleOutlined />} valueStyle={{ color: '#E34D59' }} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="待整改发现" value={stats.totalFindings} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: '#f5222d' }} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="待执行任务" value={stats.pendingTasks} prefix={<ClockCircleOutlined />} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="已发布报告" value={stats.publishedReports} prefix={<FileDoneOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        </Row>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'projects',
              label: <span><AuditOutlined /> 审计项目</span>,
              children: (
                <div className="content-card">
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <Space>
                      <Input.Search placeholder="搜索项目名称/编号..." allowClear style={{ width: 300 }} prefix={<SearchOutlined />} />
                      <Select placeholder="审计类型" allowClear style={{ width: 140 }}>
                        <Option value="财务审计">财务审计</Option>
                        <Option value="合规审计">合规审计</Option>
                        <Option value="运营审计">运营审计</Option>
                        <Option value="费用审计">费用审计</Option>
                        <Option value="全面审计">全面审计</Option>
                      </Select>
                    </Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddProject} style={{ background: '#E34D59', borderColor: '#E34D59' }}>新建项目</Button>
                  </div>
                  <Table columns={projectColumns} dataSource={projects} rowKey="id" pagination={{ pageSize: 10 }} scroll={{ x: 1400 }} />
                </div>
              ),
            },
            {
              key: 'tasks',
              label: <span><FormOutlined /> 审计任务</span>,
              children: (
                <div className="content-card">
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                    <Space>
                      <Input.Search placeholder="搜索任务..." allowClear style={{ width: 280 }} prefix={<SearchOutlined />} />
                      <Select placeholder="状态" allowClear style={{ width: 120 }}>
                        <Option value="pending">待执行</Option>
                        <Option value="in_progress">执行中</Option>
                        <Option value="submitted">已提交</Option>
                        <Option value="completed">已完成</Option>
                      </Select>
                    </Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTask} style={{ background: '#E34D59', borderColor: '#E34D59' }}>派发任务</Button>
                  </div>
                  <Table columns={taskColumns} dataSource={tasks} rowKey="id" pagination={{ pageSize: 10 }} scroll={{ x: 1100 }} />
                </div>
              ),
            },
            {
              key: 'findings',
              label: <span><FileTextOutlined /> 审计发现</span>,
              children: (
                <div className="content-card">
                  {findingProjectFilter && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: '#874d00' }}>
                        📋 当前仅显示「{projects.find(p => p.id === findingProjectFilter)?.name || findingProjectFilter}」的审计发现
                      </span>
                      <Button size="small" type="link" onClick={() => setFindingProjectFilter(null)} style={{ color: '#E34D59', padding: '0 4px' }}>查看全部 ×</Button>
                    </div>
                  )}
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                    <Space>
                      <Input.Search placeholder="搜索发现内容..." allowClear style={{ width: 280 }} prefix={<SearchOutlined />} />
                      <Select placeholder="严重等级" allowClear style={{ width: 120 }}>
                        <Option value="high">高</Option>
                        <Option value="medium">中</Option>
                        <Option value="low">低</Option>
                      </Select>
                    </Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddFinding} style={{ background: '#E34D59', borderColor: '#E34D59' }}>记录发现</Button>
                  </div>
                  <Table columns={findingColumns} dataSource={findingProjectFilter ? findings.filter(f => f.projectId === findingProjectFilter) : findings} rowKey="id" pagination={{ pageSize: 10 }} scroll={{ x: 1300 }} />
                </div>
              ),
            },
            {
              key: 'reports',
              label: <span><BarChartOutlined /> 审计报告</span>,
              children: (
                <div className="content-card">
                  <div style={{ marginBottom: 16 }}>
                    <Space>
                      <Input.Search placeholder="搜索报告..." allowClear style={{ width: 280 }} prefix={<SearchOutlined />} />
                      <Select placeholder="状态" allowClear style={{ width: 120 }}>
                        <Option value="draft">草稿</Option>
                        <Option value="review">审核中</Option>
                        <Option value="published">已发布</Option>
                      </Select>
                    </Space>
                  </div>
                  {reports.length === 0 ? <Empty description="暂无报告，请在项目中生成" /> : (
                    <Table columns={reportColumns} dataSource={reports} rowKey="id" pagination={{ pageSize: 10 }} />
                  )}
                  <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
                    <Col xs={24} md={12}><Card><ReactECharts option={phasePieOption} style={{ height: 300 }} /></Card></Col>
                    <Col xs={24} md={12}><Card><ReactECharts option={typeBarOption} style={{ height: 300 }} /></Card></Col>
                  </Row>
                </div>
              ),
            },
          ]}
        />
      </Content>

      {/* Project Modal */}
      <Modal title={editingProject ? '编辑项目' : '新建审计项目'} open={projectModalVisible} onOk={handleSaveProject} onCancel={() => setProjectModalVisible(false)} width={640}>
        <Form form={projectForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={16}><Form.Item name="name" label="项目名称" rules={[{ required: true }]}><Input placeholder="如: 2026年Q1财务审计" /></Form.Item></Col>
            <Col span={8}><Form.Item name="type" label="审计类型" rules={[{ required: true }]}>
              <Select placeholder="选择类型"><Option value="财务审计">财务审计</Option><Option value="合规审计">合规审计</Option><Option value="运营审计">运营审计</Option><Option value="费用审计">费用审计</Option><Option value="全面审计">全面审计</Option></Select>
            </Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="manager" label="项目负责人" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="phase" label="当前阶段"><Select><Option value="planning">计划阶段</Option><Option value="execution">执行阶段</Option><Option value="reporting">报告阶段</Option><Option value="closed">已结项</Option></Select></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="startDate" label="开始日期"><Input type="date" /></Form.Item></Col>
            <Col span={12}><Form.Item name="endDate" label="结束日期"><Input type="date" /></Form.Item></Col>
          </Row>
          <Form.Item name="progress" label="进度 (%)"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      {/* Task Modal */}
      <Modal title="派发审计任务" open={taskModalVisible} onOk={handleSaveTask} onCancel={() => setTaskModalVisible(false)} width={560}>
        <Form form={taskForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="projectId" label="所属项目" rules={[{ required: true }]}>
            <Select placeholder="选择项目">{projects.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}</Select>
          </Form.Item>
          <Form.Item name="title" label="任务名称" rules={[{ required: true }]}><Input placeholder="如: 销售费用凭证抽查" /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="assignee" label="执行人" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="deadline" label="截止日期"><Input type="date" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="priority" label="优先级"><Select><Option value="high">高</Option><Option value="medium">中</Option><Option value="low">低</Option></Select></Form.Item></Col>
            <Col span={12}><Form.Item name="status" label="状态"><Select><Option value="pending">待执行</Option><Option value="in_progress">执行中</Option></Select></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      {/* Finding Modal */}
      <Modal title="记录审计发现" open={findingModalVisible} onOk={handleSaveFinding} onCancel={() => setFindingModalVisible(false)} width={560}>
        <Form form={findingForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="projectId" label="所属项目" rules={[{ required: true }]}>
            <Select placeholder="选择项目">{projects.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}</Select>
          </Form.Item>
          <Form.Item name="title" label="发现描述" rules={[{ required: true }]}><TextArea rows={2} placeholder="描述审计发现的问题" /></Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="severity" label="严重等级"><Select><Option value="high">高</Option><Option value="medium">中</Option><Option value="low">低</Option></Select></Form.Item></Col>
            <Col span={8}><Form.Item name="category" label="类别"><Select><Option value="内控缺陷">内控缺陷</Option><Option value="合规违规">合规违规</Option><Option value="资产管理">资产管理</Option><Option value="财务合规">财务合规</Option><Option value="资金管理">资金管理</Option></Select></Form.Item></Col>
            <Col span={8}><Form.Item name="responsibleDept" label="责任部门"><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="amount" label="涉及金额"><InputNumber style={{ width: '100%' }} min={0} placeholder="0" prefix="¥" /></Form.Item>
        </Form>
      </Modal>

      {/* Report Modal */}
      <Modal title="生成审计报告" open={reportModalVisible} onCancel={() => setReportModalVisible(false)} footer={[
        <Button key="cancel" onClick={() => setReportModalVisible(false)}>取消</Button>,
        <Button key="gen" type="primary" loading={generatingReport} onClick={() => selectedProject && handleGenerateReport(selectedProject.id)} style={{ background: '#E34D59', borderColor: '#E34D59' }}>确认生成</Button>,
      ]}>
        <p>为项目 <strong>{selectedProject?.name}</strong> 生成审计报告</p>
        <Form layout="vertical">
          <Form.Item label="报告模板"><Select defaultValue="standard"><Option value="standard">标准审计报告</Option><Option value="annual">年度审计报告</Option><Option value="special">专项审计报告</Option></Select></Form.Item>
          <Form.Item label="包含内容">
            <div><Switch defaultChecked size="small" /> 审计发现汇总</div>
            <div style={{ marginTop: 8 }}><Switch defaultChecked size="small" /> 整改建议</div>
            <div style={{ marginTop: 8 }}><Switch defaultChecked size="small" /> 风险评估</div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Worksheet Modal */}
      <Modal
        title={`工作底稿 - ${selectedProject?.name || ''}`}
        open={worksheetModalVisible}
        onCancel={() => setWorksheetModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedProject && (
          <List
            dataSource={worksheetData[selectedProject.id] || []}
            renderItem={(item) => (
              <List.Item actions={[
                <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => handlePreviewWorksheet(item)}>预览</Button>,
                <Button size="small" type="link" icon={<DownloadOutlined />} onClick={() => handleDownloadWorksheet(item)}>下载</Button>,
              ]}>
                <List.Item.Meta
                  avatar={<FileWordOutlined style={{ fontSize: 24, color: '#2b579a' }} />}
                  title={item.name}
                  description={`${item.preparedBy} · ${item.lastModified} · ${item.pages}页 · ${item.memo}`}
                />
              </List.Item>
            )}
          />
        )}
      </Modal>

      {/* Worksheet Preview Modal */}
      <Modal
        title={`底稿预览: ${previewWorksheet?.name || ''}`}
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={<Button onClick={() => setPreviewModalVisible(false)}>关闭</Button>}
        width={800}
      >
        {previewWorksheet && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="文件名称">{previewWorksheet.name}</Descriptions.Item>
              <Descriptions.Item label="制单人">{previewWorksheet.preparedBy}</Descriptions.Item>
              <Descriptions.Item label="最后修改">{previewWorksheet.lastModified}</Descriptions.Item>
              <Descriptions.Item label="页数">{previewWorksheet.pages} 页</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{previewWorksheet.memo}</Descriptions.Item>
            </Descriptions>
            <Divider orientation="left" plain>文件内容预览</Divider>
            <div style={{
              background: '#fafafa', border: '1px solid #d9d9d9', borderRadius: 6,
              padding: 16, minHeight: 240, maxHeight: 420, overflow: 'auto',
              fontFamily: 'Consolas, Monaco, monospace', fontSize: 13, lineHeight: 1.7,
              whiteSpace: 'pre-wrap', color: '#333',
            }}>
              <div style={{ color: '#999', marginBottom: 8 }}>══════════ {previewWorksheet.name} ══════════</div>
              <div style={{ color: '#666', marginBottom: 12 }}>制单人: {previewWorksheet.preparedBy}　|　日期: {previewWorksheet.lastModified}　|　{previewWorksheet.pages}页</div>
              <div style={{ marginBottom: 12 }}>摘要: {previewWorksheet.memo}</div>
              <div style={{ borderTop: '1px dashed #d9d9d9', margin: '8px 0' }} />
              <div>一、审计目的</div>
              <div style={{ marginLeft: 16, color: '#555' }}>根据年度审计计划，对相关业务事项进行合规性与合理性审查。</div>
              <div style={{ marginTop: 12 }}>二、审计范围</div>
              <div style={{ marginLeft: 16, color: '#555' }}>抽查期间内的相关凭证、合同、台账等业务资料。</div>
              <div style={{ marginLeft: 16, color: '#555' }}>涉及部门: 采购部、财务部、行政部、销售部</div>
              <div style={{ marginTop: 12 }}>三、审计发现</div>
              <div style={{ marginLeft: 16, color: '#555' }}>1. 部分凭证缺少必要的审批签字，涉及金额 ¥12,500</div>
              <div style={{ marginLeft: 16, color: '#555' }}>2. 差旅费报销存在超标现象，超标准金额合计 ¥3,200</div>
              <div style={{ marginLeft: 16, color: '#555' }}>3. 合同条款与公司标准模板不一致，建议修订</div>
              <div style={{ marginTop: 12 }}>四、审计结论</div>
              <div style={{ marginLeft: 16, color: '#555' }}>总体合规，存在个别流程瑕疵，建议限期整改。</div>
              <div style={{ borderTop: '1px dashed #d9d9d9', margin: '8px 0' }} />
              <div style={{ color: '#999', fontSize: 11 }}>— 此为预览视图，完整文件请点击「下载」获取 —</div>
            </div>
          </div>
        )}
      </Modal>

      {/* Project Detail Drawer */}
      <Drawer title={`项目详情: ${selectedProject?.id}`} width={600} onClose={() => setDetailDrawerVisible(false)} open={detailDrawerVisible}>
        {selectedProject && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>{selectedProject.name}</div>
            <Space style={{ marginBottom: 16 }}>
              <Tag color={phaseMap[selectedProject.phase]?.color}>{phaseMap[selectedProject.phase]?.label}</Tag>
              <Badge status={statusMap[selectedProject.status]?.color as any}>{statusMap[selectedProject.status]?.label}</Badge>
            </Space>

            <Steps current={phaseMap[selectedProject.phase]?.step || 0} size="small" style={{ marginBottom: 24 }}>
              <Step title="计划" icon={<ContainerOutlined />} />
              <Step title="执行" icon={<SolutionOutlined />} />
              <Step title="报告" icon={<FileTextOutlined />} />
              <Step title="结项" icon={<CheckCircleOutlined />} />
            </Steps>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => { setDetailDrawerVisible(false); setActiveTab('findings'); setFindingProjectFilter(selectedProject.id); }}
                  style={{ cursor: 'pointer' }}
                >
                  <Statistic title="审计发现" value={selectedProject.findings} />
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#999' }}>点击查看 →</div>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => setWorksheetModalVisible(true)}
                  style={{ cursor: 'pointer' }}
                >
                  <Statistic title="工作底稿" value={selectedProject.worksheets} />
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#999' }}>点击查看 →</div>
                </Card>
              </Col>
            </Row>

            <Divider orientation="left">项目信息</Divider>
            <Row gutter={[16, 8]}>
              <Col span={12}><div style={{ color: '#999', fontSize: 12 }}>项目负责人</div><div>{selectedProject.manager}</div></Col>
              <Col span={12}><div style={{ color: '#999', fontSize: 12 }}>团队成员</div><div>{selectedProject.team.join(', ')}</div></Col>
              <Col span={12}><div style={{ color: '#999', fontSize: 12 }}>开始日期</div><div>{selectedProject.startDate}</div></Col>
              <Col span={12}><div style={{ color: '#999', fontSize: 12 }}>结束日期</div><div>{selectedProject.endDate}</div></Col>
            </Row>

            <Divider orientation="left">项目进度</Divider>
            <Progress percent={selectedProject.progress} strokeColor={selectedProject.progress >= 100 ? '#52c41a' : '#E34D59'} />

            <Divider orientation="left">操作记录</Divider>
            <Timeline items={[
              { children: `${selectedProject.startDate} 项目立项`, color: 'green' },
              { children: `${selectedProject.startDate} 计划阶段完成`, color: 'blue' },
              { children: '执行阶段进行中...', color: selectedProject.phase === 'execution' ? 'red' : 'gray' },
              ...(selectedProject.phase === 'reporting' || selectedProject.phase === 'closed' ? [{ children: '报告编制完成', color: 'blue' }] : []),
              ...(selectedProject.phase === 'closed' ? [{ children: '项目已结项', color: 'green' }] : []),
            ]} />
          </div>
        )}
      </Drawer>
    </Layout>
  );
};

export default AuditProjectPage;
