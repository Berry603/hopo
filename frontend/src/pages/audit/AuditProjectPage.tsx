import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout, Button, Table, Tag, Space, Modal, Form, Input, Select,
  DatePicker, message, Card, Statistic, Row, Col, Badge, Progress,
  Popconfirm, Drawer, Timeline, Upload, Divider, Steps, Tooltip,
  Radio, Empty, Switch, InputNumber, List, Descriptions, Tabs, UploadProps,
} from 'antd';
import {
  FileTextOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, PlayCircleOutlined,
  CheckCircleOutlined, PauseCircleOutlined, UploadOutlined, DownloadOutlined,
  FileWordOutlined, FilePdfOutlined, ReloadOutlined, SearchOutlined,
  FilterOutlined, TeamOutlined, ClockCircleOutlined, SolutionOutlined,
  ContainerOutlined, CheckSquareOutlined, FileDoneOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  NotificationOutlined, BookOutlined, MessageOutlined, FolderOpenOutlined,
  DatabaseOutlined, ExperimentOutlined, AuditOutlined, InboxOutlined,
  RightCircleOutlined, FileExcelOutlined, FileImageOutlined, FileOutlined,
  PictureOutlined, FileTextOutlined as FileTxtOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { ColumnsType } from 'antd/es/table';
import './AuditProjectPage.less';

import FilterBar from '@/components/FilterBar';
import { getProjects, createProject, getProjectDetail, getAuditStats, getFindings, autoGenerateFindings } from '@/services/audit';
import request from '@/services/request';
import WalkthroughTab from './WalkthroughTab';
import ProjectFilesPage from './ProjectFilesPage';
import TaskTab from './TaskTab';

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
  phase: 'planning' | 'notification' | 'data_collection' | 'field_work' | 'worksheet' | 'review' | 'report' | 'archive';
  status: 'active' | 'paused' | 'completed';
  manager: string;
  team: string[];
  startDate: string;
  endDate: string;
  progress: number;
  findings: number;
  worksheets: number;
  reportStatus: 'none' | 'draft' | 'review' | 'published';
  org?: string;
  month?: number;
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
  org?: string;
  month?: number;
}

interface AuditFinding {
  id: string;
  finding_id?: string;
  title: string;
  projectId?: string;
  projectName?: string;
  severity: 'high' | 'medium' | 'low';
  finding_type?: string;
  category?: string;
  status: 'open' | 'resolved' | 'closed' | 'confirmed' | 'draft';
  amount?: number;
  amount_involved?: string;
  responsibleDept?: string;
  responsible_dept?: string;
  responsible_person?: string;
  createdAt?: string;
  created_at?: string;
  hasRectification?: boolean;
  evidence_count?: number;
  risk_score?: number;
  source_alert_id?: string;
  recommendation?: string;
  description?: string;
  org?: string;
  month?: number;
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
  org?: string;
  month?: number;
}

const mockProjects: AuditProject[] = [
  { id: 'PRJ-2026-001', name: '2026年Q1财务收支专项审计', type: '财务审计', phase: 'worksheet', status: 'active', manager: '张三', team: ['张三','李四','王五'], startDate: '2026-03-01', endDate: '2026-05-30', progress: 68, findings: 12, worksheets: 8, reportStatus: 'none' },
  { id: 'PRJ-2026-002', name: '采购流程合规性审计', type: '合规审计', phase: 'report', status: 'active', manager: '李四', team: ['李四','赵六'], startDate: '2026-04-01', endDate: '2026-06-15', progress: 85, findings: 5, worksheets: 6, reportStatus: 'draft' },
  { id: 'PRJ-2026-003', name: '固定资产盘点专项审计', type: '运营审计', phase: 'planning', status: 'active', manager: '王五', team: ['王五','孙七'], startDate: '2026-05-15', endDate: '2026-07-30', progress: 15, findings: 1, worksheets: 2, reportStatus: 'none' },
  { id: 'PRJ-2025-012', name: '2025年度全面审计', type: '全面审计', phase: 'archive', status: 'completed', manager: '张三', team: ['张三','李四','王五','赵六'], startDate: '2025-10-01', endDate: '2026-01-31', progress: 100, findings: 23, worksheets: 15, reportStatus: 'published' },
  { id: 'PRJ-2026-004', name: '销售费用专项审计', type: '费用审计', phase: 'field_work', status: 'paused', manager: '赵六', team: ['赵六'], startDate: '2026-04-15', endDate: '2026-06-30', progress: 45, findings: 3, worksheets: 4, reportStatus: 'none' },
];

const mockTasks: AuditTask[] = [
  { id: 'TSK-001', title: '销售费用凭证抽查（3-4月）', projectId: 'PRJ-2026-004', projectName: '销售费用专项审计', assignee: '赵六', deadline: '2026-06-10', status: 'in_progress', priority: 'high', worksheetCount: 2 },
  { id: 'TSK-002', title: '采购合同合规性检查', projectId: 'PRJ-2026-002', projectName: '采购流程合规性审计', assignee: '李四', deadline: '2026-06-08', status: 'submitted', priority: 'medium', worksheetCount: 3 },
  { id: 'TSK-003', title: '固定资产台账核对', projectId: 'PRJ-2026-003', projectName: '固定资产盘点专项审计', assignee: '王五', deadline: '2026-06-20', status: 'pending', priority: 'medium', worksheetCount: 0 },
  { id: 'TSK-004', title: 'Q1收入确认审核', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', assignee: '张三', deadline: '2026-05-25', status: 'reviewed', priority: 'high', worksheetCount: 2 },
  { id: 'TSK-005', title: '成本核算方法复核', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', assignee: '李四', deadline: '2026-05-28', status: 'completed', priority: 'medium', worksheetCount: 3 },
];

const mockFindings: AuditFinding[] = [
  // PRJ-2026-001: 2026年Q1财务收支专项审计 (12条)
  { id: 'FND-001', title: '收入确认时点与合同条款不一致', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'high', category: '财务合规', status: 'resolved', amount: 450000, responsibleDept: '财务部', createdAt: '2026-04-15', hasRectification: true },
  { id: 'FND-002', title: '备用金超限额未清理（行政部）', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'medium', category: '资金管理', status: 'closed', amount: 32000, responsibleDept: '行政部', createdAt: '2026-04-20', hasRectification: true },
  { id: 'FND-003', title: '费用报销单据不完整（Q1 3月）', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'medium', category: '内控缺陷', status: 'open', amount: 18500, responsibleDept: '财务部', createdAt: '2026-04-25', hasRectification: false },
  { id: 'FND-004', title: '预付账款长期挂账未清理', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'high', category: '财务合规', status: 'open', amount: 1200000, responsibleDept: '财务部', createdAt: '2026-04-28', hasRectification: false },
  { id: 'FND-005', title: '跨期费用未按权责发生制入账', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'medium', category: '财务合规', status: 'open', amount: 86000, responsibleDept: '财务部', createdAt: '2026-05-02', hasRectification: false },
  { id: 'FND-006', title: '差旅费标准超出规定上限', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'low', category: '费用管控', status: 'open', amount: 23400, responsibleDept: '人力资源部', createdAt: '2026-05-05', hasRectification: false },
  { id: 'FND-007', title: '资金划转缺乏授权审批记录', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'high', category: '内控缺陷', status: 'open', amount: 780000, responsibleDept: '财务部', createdAt: '2026-05-08', hasRectification: false },
  { id: 'FND-008', title: '应收账款账龄超180天未计提坏账', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'medium', category: '财务合规', status: 'open', amount: 340000, responsibleDept: '销售部', createdAt: '2026-05-10', hasRectification: false },
  { id: 'FND-009', title: '银行余额调节表与账面差异未说明', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'medium', category: '财务合规', status: 'resolved', amount: 5600, responsibleDept: '财务部', createdAt: '2026-05-12', hasRectification: true },
  { id: 'FND-010', title: '福利费计提比例超过规定标准', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'low', category: '费用管控', status: 'closed', amount: 12000, responsibleDept: '人力资源部', createdAt: '2026-05-14', hasRectification: true },
  { id: 'FND-011', title: '研发费用加计扣除台账不完整', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'medium', category: '税务合规', status: 'open', amount: 950000, responsibleDept: '研发部', createdAt: '2026-05-16', hasRectification: false },
  { id: 'FND-012', title: '期末存货计价方法执行不一致', projectId: 'PRJ-2026-001', projectName: '2026年Q1财务收支专项审计', severity: 'high', category: '财务合规', status: 'open', amount: 2100000, responsibleDept: '财务部', createdAt: '2026-05-18', hasRectification: false },
  // PRJ-2026-002: 采购流程合规性审计 (5条)
  { id: 'FND-013', title: '采购合同未按招标流程执行', projectId: 'PRJ-2026-002', projectName: '采购流程合规性审计', severity: 'high', category: '合规违规', status: 'open', amount: 256000, responsibleDept: '采购部', createdAt: '2026-05-18', hasRectification: true },
  { id: 'FND-014', title: '供应商资质审核材料不全', projectId: 'PRJ-2026-002', projectName: '采购流程合规性审计', severity: 'medium', category: '合规违规', status: 'open', amount: 0, responsibleDept: '采购部', createdAt: '2026-05-20', hasRectification: false },
  { id: 'FND-015', title: '单次采购超权限未履行集体决策', projectId: 'PRJ-2026-002', projectName: '采购流程合规性审计', severity: 'high', category: '内控缺陷', status: 'open', amount: 580000, responsibleDept: '采购部', createdAt: '2026-05-22', hasRectification: false },
  { id: 'FND-016', title: '采购验收记录与入库单不一致', projectId: 'PRJ-2026-002', projectName: '采购流程合规性审计', severity: 'low', category: '流程缺陷', status: 'open', amount: 34000, responsibleDept: '仓储部', createdAt: '2026-05-25', hasRectification: false },
  { id: 'FND-017', title: '关联方采购未进行公允价值评估', projectId: 'PRJ-2026-002', projectName: '采购流程合规性审计', severity: 'high', category: '合规违规', status: 'open', amount: 1350000, responsibleDept: '采购部', createdAt: '2026-05-28', hasRectification: false },
  // PRJ-2026-003: 固定资产盘点专项审计 (1条)
  { id: 'FND-018', title: '固定资产标签缺失率35%', projectId: 'PRJ-2026-003', projectName: '固定资产盘点专项审计', severity: 'low', category: '资产管理', status: 'open', responsibleDept: '生产部', createdAt: '2026-05-22', hasRectification: false },
  // PRJ-2026-004: 销售费用专项审计 (3条)
  { id: 'FND-019', title: '销售费用报销缺少审批签字', projectId: 'PRJ-2026-004', projectName: '销售费用专项审计', severity: 'medium', category: '内控缺陷', status: 'open', amount: 12800, responsibleDept: '销售部', createdAt: '2026-05-20', hasRectification: false },
  { id: 'FND-020', title: '业务招待费超季度预算20%', projectId: 'PRJ-2026-004', projectName: '销售费用专项审计', severity: 'medium', category: '费用管控', status: 'open', amount: 45600, responsibleDept: '销售部', createdAt: '2026-05-23', hasRectification: false },
  { id: 'FND-021', title: '促销费用缺乏活动效果评估', projectId: 'PRJ-2026-004', projectName: '销售费用专项审计', severity: 'low', category: '流程缺陷', status: 'open', amount: 89000, responsibleDept: '市场部', createdAt: '2026-05-26', hasRectification: false },
  // PRJ-2025-012: 2025年度全面审计 (23条)
  { id: 'FND-022', title: '年度预算执行偏差率超15%未及时预警', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'high', category: '预算管理', status: 'closed', amount: 4200000, responsibleDept: '财务部', createdAt: '2025-11-05', hasRectification: true },
  { id: 'FND-023', title: '关联方交易披露不完整', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'high', category: '合规违规', status: 'closed', amount: 8900000, responsibleDept: '财务部', createdAt: '2025-11-08', hasRectification: true },
  { id: 'FND-024', title: '信息系统访问权限未及时回收', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'medium', category: '信息安全', status: 'closed', amount: 0, responsibleDept: 'IT部', createdAt: '2025-11-10', hasRectification: true },
  { id: 'FND-025', title: '固定资产折旧政策执行不统一', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'medium', category: '财务合规', status: 'closed', amount: 560000, responsibleDept: '财务部', createdAt: '2025-11-12', hasRectification: true },
  { id: 'FND-026', title: '薪酬核算与考勤记录差异', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'medium', category: '人力资源', status: 'closed', amount: 120000, responsibleDept: '人力资源部', createdAt: '2025-11-15', hasRectification: true },
  { id: 'FND-027', title: '仓库盘点差异率超3%未查明原因', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'high', category: '资产管理', status: 'closed', amount: 780000, responsibleDept: '仓储部', createdAt: '2025-11-18', hasRectification: true },
  { id: 'FND-028', title: '工程项目预算追加未经董事会批准', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'high', category: '内控缺陷', status: 'closed', amount: 3200000, responsibleDept: '工程部', createdAt: '2025-11-20', hasRectification: true },
  { id: 'FND-029', title: '研发项目结转资本化比例偏高', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'medium', category: '财务合规', status: 'closed', amount: 1500000, responsibleDept: '研发部', createdAt: '2025-11-22', hasRectification: true },
  { id: 'FND-030', title: '销售返利核算方式变更未披露', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'high', category: '财务合规', status: 'closed', amount: 2300000, responsibleDept: '销售部', createdAt: '2025-11-25', hasRectification: true },
  { id: 'FND-031', title: '子公司内部控制报告未按时提交', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'medium', category: '合规违规', status: 'closed', amount: 0, responsibleDept: '子公司A', createdAt: '2025-11-28', hasRectification: true },
  { id: 'FND-032', title: '合同管理台账不完整（遗漏47份）', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'medium', category: '流程缺陷', status: 'closed', amount: 0, responsibleDept: '法务部', createdAt: '2025-12-01', hasRectification: true },
  { id: 'FND-033', title: '税务申报数据与账簿数据不一致', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'high', category: '税务合规', status: 'closed', amount: 1890000, responsibleDept: '财务部', createdAt: '2025-12-03', hasRectification: true },
  { id: 'FND-034', title: '对外担保未履行信息披露义务', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'high', category: '合规违规', status: 'closed', amount: 5000000, responsibleDept: '财务部', createdAt: '2025-12-05', hasRectification: true },
  { id: 'FND-035', title: '员工费用报销重复提交审核未发现', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'medium', category: '内控缺陷', status: 'closed', amount: 68000, responsibleDept: '财务部', createdAt: '2025-12-08', hasRectification: true },
  { id: 'FND-036', title: '客户信用额度超限未触发预警', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'medium', category: '风险管理', status: 'closed', amount: 340000, responsibleDept: '销售部', createdAt: '2025-12-10', hasRectification: true },
  { id: 'FND-037', title: '印章使用记录缺失（Q3-Q4）', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'low', category: '内控缺陷', status: 'closed', amount: 0, responsibleDept: '行政部', createdAt: '2025-12-12', hasRectification: true },
  { id: 'FND-038', title: '外包服务验收缺乏量化考核指标', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'low', category: '流程缺陷', status: 'closed', amount: 450000, responsibleDept: '采购部', createdAt: '2025-12-15', hasRectification: true },
  { id: 'FND-039', title: '应付账款账龄分析异常（长期挂账）', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'medium', category: '财务合规', status: 'closed', amount: 2100000, responsibleDept: '财务部', createdAt: '2025-12-17', hasRectification: true },
  { id: 'FND-040', title: '股权激励方案执行条件未达标却正常授予', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'high', category: '合规违规', status: 'closed', amount: 0, responsibleDept: '人力资源部', createdAt: '2025-12-19', hasRectification: true },
  { id: 'FND-041', title: '安全生产费计提及使用记录不规范', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'medium', category: '合规违规', status: 'closed', amount: 230000, responsibleDept: '安全环保部', createdAt: '2025-12-21', hasRectification: true },
  { id: 'FND-042', title: '物流外包服务价格高于市场均价23%', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'medium', category: '成本管控', status: 'closed', amount: 890000, responsibleDept: '供应链部', createdAt: '2025-12-23', hasRectification: true },
  { id: 'FND-043', title: '年末大额资产转让未进行资产评估', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'high', category: '资产管理', status: 'closed', amount: 6800000, responsibleDept: '财务部', createdAt: '2025-12-26', hasRectification: true },
  { id: 'FND-044', title: '子公司间往来账款长期未对账', projectId: 'PRJ-2025-012', projectName: '2025年度全面审计', severity: 'medium', category: '财务合规', status: 'closed', amount: 1450000, responsibleDept: '财务部', createdAt: '2025-12-28', hasRectification: true },
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

const phaseMap: Record<string, { label: string; color: string }> = {
  planning: { label: '计划阶段', color: 'blue' },
  notification: { label: '通知阶段', color: 'cyan' },
  data_collection: { label: '资料收集', color: 'geekblue' },
  field_work: { label: '现场审计', color: 'processing' },
  worksheet: { label: '底稿编写', color: 'orange' },
  review: { label: '复核阶段', color: 'purple' },
  report: { label: '报告阶段', color: 'warning' },
  archive: { label: '已归档', color: 'success' },
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

// ==================== 8-Phase Audit Workflow ====================

interface PhaseDef {
  key: string;
  title: string;
  stage_code: string;
  icon: React.ReactNode;
  description: string;
  deliverables: string[];
  departments: string[];
  data_sources: string[];
  actions: { label: string; icon: React.ReactNode; onClick: string; disabled?: boolean }[];
}

const PHASE_DEFS: PhaseDef[] = [
  {
    key: '00_initiation', stage_code: '00',
    title: '00 立项与通知',
    icon: <NotificationOutlined />,
    description: '审计立项评审、下发审计通知书、编制资料需求清单、审计组人员分工',
    departments: ['项目管理部', '被审计单位'],
    data_sources: ['OA系统', '项目管理平台'],
    deliverables: ['审计立项评审单.docx', '审计通知书.docx', '资料需求清单.xlsx', '审计组人员分工表.xlsx', '审计进场会纪要.docx'],
    actions: [
      { label: '生成审计通知书', icon: <FileTextOutlined />, onClick: 'notice' },
      { label: '编制需求清单', icon: <SolutionOutlined />, onClick: 'checklist' },
      { label: '人员分工', icon: <TeamOutlined />, onClick: 'team' },
    ],
  },
  {
    key: '01_regulations', stage_code: '01',
    title: '01 制度依据',
    icon: <BookOutlined />,
    description: '整理外部法规、内部制度、历史审计资料，为审计提供制度依据和合规基准',
    departments: ['被审计单位各业务部门', '财务部', '法务部'],
    data_sources: ['ERP制度模块', 'SRM合同模块', 'OA文档中心'],
    deliverables: ['外部法规汇编.pdf', '被审计单位制度汇编.pdf', '关键业务流程.docx', '上次审计报告.pdf', '历年检查记录.xlsx'],
    actions: [
      { label: '关联法规库', icon: <BookOutlined />, onClick: 'link_regulations' },
      { label: '上传内部制度', icon: <UploadOutlined />, onClick: 'upload_policy' },
      { label: '引用历史资料', icon: <FolderOpenOutlined />, onClick: 'history' },
    ],
  },
  {
    key: '02_interviews', stage_code: '02',
    title: '02 访谈与沟通记录',
    icon: <MessageOutlined />,
    description: '制定访谈提纲、开展访谈并记录纪要、获取管理层声明书',
    departments: ['被审计单位管理层', '被审计单位各业务部门', '审计组'],
    data_sources: ['OA审批流', '云之家审批'],
    deliverables: ['访谈提纲.docx', '访谈记录表.pdf', '访谈纪要.docx', '管理层声明书.pdf', '访谈过程截图'],
    actions: [
      { label: '访谈提纲模板', icon: <FileTextOutlined />, onClick: 'interview_template' },
      { label: '记录访谈纪要', icon: <EditOutlined />, onClick: 'interview_notes' },
      { label: '上传沟通记录', icon: <UploadOutlined />, onClick: 'upload_communication' },
    ],
  },
  {
    key: '03_collection', stage_code: '03',
    title: '03 收集被审计单位资料',
    icon: <FolderOpenOutlined />,
    description: '收集财务资料（报表/账册/凭证）、业务资料（合同/订单/出入库单）、人事资料及其他部门资料',
    departments: ['被审计单位各业务部门', '财务部', '采购部', '仓库', '人力资源部'],
    data_sources: ['ERP系统', 'SRM系统', 'HRM系统', 'OA系统'],
    deliverables: ['财务报表.xlsx', '科目余额表.xlsx', '明细账.xlsx', '凭证.xlsx', '合同台账.xlsx', '订单记录.xlsx', '考勤记录.xlsx'],
    actions: [
      { label: '上传财务资料', icon: <UploadOutlined />, onClick: 'upload_finance' },
      { label: '上传业务资料', icon: <UploadOutlined />, onClick: 'upload_business' },
      { label: '浏览项目文件', icon: <FolderOpenOutlined />, onClick: 'browse_files' },
    ],
  },
  {
    key: '04_data', stage_code: '04',
    title: '04 系统关联数据',
    icon: <DatabaseOutlined />,
    description: '从ERP/CRM/SRM等源系统提取原始数据、清洗处理、编写取数脚本、记录系统日志',
    departments: ['IT部', '财务部', '审计组'],
    data_sources: ['ERP数据库', 'SRM数据库', '云之家API', 'WMS系统'],
    deliverables: ['原始数据导出.csv', '清洗后数据.xlsx', '取数脚本.sql', '关键操作日志.log', '数据提取过程截图'],
    actions: [
      { label: '进入数据治理中心', icon: <DatabaseOutlined />, onClick: 'data_governance' },
      { label: '智能查询取数', icon: <SearchOutlined />, onClick: 'smart_query' },
      { label: '上传取数脚本', icon: <UploadOutlined />, onClick: 'upload_script' },
    ],
  },
  {
    key: '05_testing', stage_code: '05',
    title: '05 测试与底稿',
    icon: <ExperimentOutlined />,
    description: '执行穿行测试、控制测试、实质性程序，填写审计底稿，汇总审计发现',
    departments: ['审计组全体成员'],
    data_sources: ['ERP', 'SRM', '云之家', 'CRM'],
    deliverables: ['穿行测试检查表.docx', '样本选取记录.xlsx', '控制测试底稿.xlsx', '实质性程序底稿.xlsx', '审计发现问题汇总表.xlsx'],
    actions: [
      { label: '执行穿行测试', icon: <PlayCircleOutlined />, onClick: 'walkthrough' },
      { label: '查看审计发现', icon: <ExclamationCircleOutlined />, onClick: 'findings' },
      { label: '管理工作底稿', icon: <FileTextOutlined />, onClick: 'worksheets' },
      { label: '自动生成发现', icon: <ThunderboltOutlined />, onClick: 'auto_findings' },
    ],
  },
  {
    key: '06_reporting', stage_code: '06',
    title: '06 审计报告与沟通',
    icon: <AuditOutlined />,
    description: '编制审计报告过程稿、征求意见、出具正式报告、编写管理建议书',
    departments: ['审计组', '被审计单位管理层'],
    data_sources: ['审计系统报告模块'],
    deliverables: ['审计报告（过程稿）.docx', '审计报告（征求意见稿）.docx', '审计报告（正式稿）.docx', '管理建议书.docx'],
    actions: [
      { label: '生成审计报告', icon: <FileTextOutlined />, onClick: 'gen_report' },
      { label: '查看报告列表', icon: <EyeOutlined />, onClick: 'view_reports' },
      { label: '生成整改工单', icon: <FileDoneOutlined />, onClick: 'rectification' },
    ],
  },
  {
    key: '99_archive', stage_code: '99',
    title: '99 归档与说明',
    icon: <InboxOutlined />,
    description: '编制文件夹索引说明、填写项目归档交接单、统计工时、跟踪未解决问题',
    departments: ['审计组', '档案管理部门'],
    data_sources: ['文档归档系统'],
    deliverables: ['文件夹索引说明.txt', '项目归档交接单.xlsx', '工时统计表.xlsx', '未解决问题跟踪表.xlsx'],
    actions: [
      { label: '生成文件夹索引', icon: <FileTextOutlined />, onClick: 'index' },
      { label: '归档交接', icon: <CheckCircleOutlined />, onClick: 'archive' },
      { label: '工时统计', icon: <ClockCircleOutlined />, onClick: 'hours' },
    ],
  },
];

const phaseStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待开始', color: '#d9d9d9' },
  in_progress: { label: '进行中', color: '#E34D59' },
  completed: { label: '已完成', color: '#52c41a' },
};

// ==================== Component ====================

const AuditProjectPage: React.FC = () => {
  const [projects, setProjects] = useState<AuditProject[]>(mockProjects);
  const [tasks, setTasks] = useState<AuditTask[]>(mockTasks);
  const [findings, setFindings] = useState<AuditFinding[]>(mockFindings);
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [findingProjectFilter, setFindingProjectFilter] = useState<string | null>(null);
  const { tab = 'projects' } = useParams<{ tab: string }>();
  const navigate = useNavigate();

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
  const [phaseDrawerTab, setPhaseDrawerTab] = useState<string>('overview');
  // 阶段概览数据（文件数等）
  const [phaseOverviewData, setPhaseOverviewData] = useState<Record<string, any>>({});
  const [phaseProgress, setPhaseProgress] = useState<Record<string, any>>({});  // 阶段状态（含依赖校验）
  const [phaseLoading, setPhaseLoading] = useState(false);

  // 加载阶段概览
  const loadPhaseOverview = async (projectId: string) => {
    setPhaseLoading(true);
    try {
      const res = await request.get(`/audit/projects/${projectId}/phases`);
      const data = res.data?.data || res.data || [];
      const map: Record<string, any> = {};
      (data as any[]).forEach((p: any) => { map[p.stage_code] = p; });
      setPhaseOverviewData(map);
    } catch { /* ignore */ }
    setPhaseLoading(false);
  };

  // 加载阶段进度（含依赖校验）
  const loadPhaseProgress = async (projectId: string) => {
    try {
      const res = await request.get(`/audit/projects/${projectId}/phases/progress`);
      const data = (res as any)?.data || res || [];
      const map: Record<string, any> = {};
      (Array.isArray(data) ? data : []).forEach((p: any) => { map[p.stage_code] = p; });
      setPhaseProgress(map);
    } catch { /* ignore */ }
  };

  // 更新阶段进度（后端自动校验依赖 + 同步 current_phase）
  const handleMarkPhaseComplete = async (stageCode: string) => {
    const project = selectedProject;
    if (!project) return;
    try {
      // 后端在 PhaseProgress 更新后自动同步 AuditProject.current_phase，无需前端二次调用
      await request.put(`/audit/projects/${project.id}/phases/${stageCode}/progress`, { status: 'completed' });
      message.success(`阶段「${stageCode}」已标记完成`);
      loadPhaseProgress(project.id);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || '操作失败';
      message.warning(detail);
    }
  };
  
  // ===== 文件操作 =====
  const getProjectId = () => selectedProject?.id || '';
  
  const handleDownloadFile = async (filePath: string) => {
    const pid = getProjectId();
    if (!pid) return;
    try {
      const res = await request.get(`/audit/projects/${pid}/files/download`, {
        params: { file_path: filePath },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('/').pop() || 'file';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { message.error('下载失败'); }
  };
  
  const handleDeleteFile = async (filePath: string) => {
    const pid = getProjectId();
    if (!pid) return;
    try {
      await request.delete(`/audit/projects/${pid}/files`, { params: { file_path: filePath } });
      message.success('文件已删除');
      if (selectedProject) loadPhaseOverview(selectedProject.id);
    } catch { message.error('删除失败'); }
  };
  
  const handleUploadFile = async (stageCode: string, file: File, onSuccess?: (body: any) => void) => {
    const pid = getProjectId();
    if (!pid) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('stage', stageCode);
    try {
      await request.post(`/audit/projects/${pid}/files/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(`${file.name} 上传成功`);
      onSuccess?.(null);
      if (selectedProject) loadPhaseOverview(selectedProject.id);
    } catch { message.error('上传失败'); }
  };
  
  const handleReplaceFile = async (oldPath: string, file: File, onSuccess?: (body: any) => void) => {
    // 先删旧文件，再传新文件
    const pid = getProjectId();
    if (!pid) return;
    try {
      await request.delete(`/audit/projects/${pid}/files`, { params: { file_path: oldPath } });
    } catch { /* ignore */ }
    // 从旧路径提取阶段码
    const stageCode = oldPath.split('/')[0]?.slice(0, 2) || '05';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('stage', stageCode);
    try {
      await request.post(`/audit/projects/${pid}/files/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(`${file.name} 替换成功`);
      onSuccess?.(null);
      if (selectedProject) loadPhaseOverview(selectedProject.id);
    } catch { message.error('替换失败'); }
  };

  const FileIcon = ({ ext }: { ext: string }) => {
    const iconMap: Record<string, React.ReactNode> = {
      '.xlsx': <FileExcelOutlined style={{ color: '#52c41a' }} />,
      '.xls': <FileExcelOutlined style={{ color: '#52c41a' }} />,
      '.docx': <FileWordOutlined style={{ color: '#1890ff' }} />,
      '.doc': <FileWordOutlined style={{ color: '#1890ff' }} />,
      '.pdf': <FilePdfOutlined style={{ color: '#f5222d' }} />,
      '.png': <PictureOutlined style={{ color: '#722ed1' }} />,
      '.jpg': <PictureOutlined style={{ color: '#722ed1' }} />,
      '.jpeg': <PictureOutlined style={{ color: '#722ed1' }} />,
      '.gif': <PictureOutlined style={{ color: '#722ed1' }} />,
    };
    return iconMap[ext] || <FileOutlined />;
  };

  const linkBtnStyle: React.CSSProperties = { fontSize: 11, padding: 0, height: 'auto' };

  // 项目的8阶段状态追踪: projectId -> { phaseKey: 'pending'|'in_progress'|'completed' }
  const [projectPhases, setProjectPhases] = useState<Record<string, Record<string, string>>>({});

  // ==================== Phase Helpers ====================

  const getPhaseStatus = (projectId: string, phaseKey: string): string => {
    return projectPhases[projectId]?.[phaseKey] || 'pending';
  };

  const updatePhaseStatus = (projectId: string, phaseKey: string, status: string) => {
    setProjectPhases(prev => ({
      ...prev,
      [projectId]: { ...(prev[projectId] || {}), [phaseKey]: status },
    }));
  };

  const getCurrentPhaseIndex = (projectId: string): number => {
    const phases = projectPhases[projectId] || {};
    const keys = PHASE_DEFS.map(p => p.key);
    for (let i = keys.length - 1; i >= 0; i--) {
      if (phases[keys[i]] === 'completed' || phases[keys[i]] === 'in_progress') return i;
    }
    return 0;
  };

  const handlePhaseAction = (action: string, projectId: string) => {
    if (!selectedProject) return;
    switch (action) {
      case 'walkthrough':
        updatePhaseStatus(projectId, '05_testing', 'in_progress');
        setPhaseDrawerTab('walkthrough');
        break;
      case 'findings':
        setDetailDrawerVisible(false);
        setFindingProjectFilter(projectId);
        navigate('/audit/findings');
        break;
      case 'worksheets':
        setWorksheetModalVisible(true);
        break;
      case 'auto_findings':
        (async () => {
          try {
            const res = await autoGenerateFindings(projectId);
            if (res?.code === 200) message.success(res.message || '已自动生成审计发现');
            fetchFindingsForProject(projectId);
          } catch { message.error('自动生成失败'); }
        })();
        break;
      case 'gen_report':
        setReportModalVisible(true);
        break;
      case 'view_reports':
        setDetailDrawerVisible(false);
        navigate('/audit/reports');
        break;
      case 'rectification':
        setDetailDrawerVisible(false);
        navigate('/rectification/orders');
        break;
      case 'link_regulations':
        setDetailDrawerVisible(false);
        navigate('/knowledge/regulations');
        break;
      case 'data_governance':
        setDetailDrawerVisible(false);
        navigate('/data-quality/dashboard');
        break;
      case 'smart_query':
        setDetailDrawerVisible(false);
        navigate('/query/nl2sql');
        break;
      case 'browse_files':
        setPhaseDrawerTab('files');
        break;
      case 'notice': case 'checklist': case 'team':
      case 'upload_policy': case 'history':
      case 'interview_template': case 'interview_notes': case 'upload_communication':
      case 'upload_finance': case 'upload_business':
      case 'upload_script':
      case 'index': case 'archive': case 'hours':
        message.info('模板/文件下载已触发');
        break;
      default:
        break;
    }
  };

  const initProjectPhases = (project: AuditProject) => {
    if (!projectPhases[project.id]) {
      // 后端8阶段 → 工作站阶段索引
      const getIdx = (phase: string): number => {
        const idx: Record<string, number> = {
          planning: 0, notification: 0,       // → 00 立项与通知
          data_collection: 3,                  // → 03 收集被审计单位资料
          field_work: 4,                       // → 04 系统关联数据
          worksheet: 5, review: 5,             // → 05 测试与底稿
          report: 6,                           // → 06 审计报告与沟通
          archive: 7,                          // → 99 归档与说明
        };
        return idx[phase] ?? 0;
      };
      const phases: Record<string, string> = {};
      PHASE_DEFS.forEach((p, i) => {
        if (project.phase === 'archive' || project.status === 'completed') {
          phases[p.key] = 'completed';
        } else if (i <= getIdx(project.phase)) {
          phases[p.key] = i < getIdx(project.phase) ? 'completed' : 'in_progress';
        } else {
          phases[p.key] = 'pending';
        }
      });
      if (project.phase !== 'archive') phases['99_archive'] = 'pending';
      setProjectPhases(prev => ({ ...prev, [project.id]: phases }));
    }
  };

  const [projectForm] = Form.useForm();
  const [taskForm] = Form.useForm();
  const [findingForm] = Form.useForm();
  const [tableLoading, setTableLoading] = useState(false);
  const [apiProjects, setApiProjects] = useState<any[]>([]);
  const [apiAuditStats, setApiAuditStats] = useState<Record<string, unknown> | null>(null);

  // ==================== API Data Fetching ====================

  const fetchProjects = async () => {
    setTableLoading(true);
    try {
      const res = await getProjects({ page: 1, page_size: 100 });
      const rawData = res as any;
      // Backend returns {code, message, data: [...], total, page, page_size}
      const resData = rawData?.data;
      const data = Array.isArray(resData) ? resData : [];
      if (data.length > 0) {
        // Map API fields to frontend interface
        const mapped: AuditProject[] = data.map((item: any) => ({
          id: item.project_code || item.id,
          name: item.project_name || item.name || '',
          type: item.audit_type || '',
          phase: (item.current_phase || 'planning') as AuditProject['phase'],
          status: (item.status === 'in_progress' ? 'active' : item.status === 'completed' ? 'completed' : 'active') as AuditProject['status'],
          manager: item.project_manager_name || item.created_by_name || '',
          team: [],
          startDate: item.start_date || '',
          endDate: item.end_date || '',
          progress: 0,
          findings: 0,
          worksheets: 0,
          reportStatus: 'none' as const,
          org: item.target_dept_name,
        }));
        setProjects(mapped);
        // Also stash raw data for phase tracking
        setApiProjects(data);
        setTableLoading(false);
        return;
      }
    } catch (e) {
      console.log('API unavailable, using mock projects');
    }
    setProjects(mockProjects);
    setTableLoading(false);
  };

  const fetchAuditStats = async () => {
    try {
      const res = await getAuditStats();
      if (res) {
        setApiAuditStats(res as unknown as Record<string, unknown>);
      }
    } catch (e) {
      console.log('API stats unavailable, using local calculations');
    }
  };

  const fetchFindingsForProject = async (projectId: string) => {
    try {
      const res = await getFindings(projectId);
      const findingsData = (res as any)?.data;
      if (Array.isArray(findingsData) && findingsData.length > 0) {
        const apiFindings = (findingsData as Record<string, unknown>[]).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          finding_id: item.finding_id as string,
          title: item.title as string,
          projectId: projectId,
          projectName: projects.find(p => p.id === projectId)?.name || '',
          severity: (item.severity as 'high' | 'medium' | 'low') || 'medium',
          finding_type: (item.finding_type || item.category) as string,
          status: (item.status as AuditFinding['status']) || 'open',
          amount: item.amount_involved ? parseFloat(item.amount_involved as string) || undefined : undefined,
          amount_involved: item.amount_involved as string,
          responsibleDept: (item.responsible_dept || item.responsibleDept) as string,
          responsible_person: item.responsible_person as string,
          created_at: item.created_at as string,
          createdAt: item.created_at as string,
          evidence_count: item.evidence_count as number,
          risk_score: item.risk_score as number,
          source_alert_id: item.source_alert_id as string,
          recommendation: item.recommendation as string,
          description: item.description as string,
        }));
        setFindings(prev => {
          const existing = prev.filter(f => f.projectId !== projectId);
          return [...existing, ...(apiFindings as AuditFinding[])];
        });
        return;
      }
    } catch (e) {
      console.log('API findings unavailable, using mock findings');
    }
  };

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
    projectForm.validateFields().then(async values => {
      if (editingProject) {
        setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...values } : p));
        message.success('项目已更新');
      } else {
        let apiCreated = false;
        try {
          // Map frontend field names to backend snake_case format
          const projectCode = `AUD-${new Date().getFullYear()}-${String(projects.length + 1).padStart(3, '0')}`;
          const apiPayload = {
            project_code: projectCode,
            project_name: values.name,
            audit_type: values.type || 'financial',
            target_dept_name: values.org || '',
            start_date: values.startDate || '',
            end_date: values.endDate || '',
            audit_objective: '',
          };
          const res: any = await createProject(apiPayload);
          if (res?.data) {
            const apiData = res.data;
            const newProject: AuditProject = {
              id: apiData.project_code || apiData.id || projectCode,
              name: apiData.project_name || values.name,
              type: apiData.audit_type || values.type || 'financial',
              phase: 'planning',
              status: 'active',
              manager: values.manager || '',
              team: [],
              startDate: values.startDate || '',
              endDate: values.endDate || '',
              progress: 0,
              findings: 0,
              worksheets: 0,
              reportStatus: 'none' as const,
              org: values.org,
              month: values.month,
            };
            setProjects(prev => [...prev, newProject]);
            apiCreated = true;
          }
        } catch (e: any) {
          console.log('API createProject failed:', e?.response?.data || e?.message);
        }
        if (!apiCreated) {
          const newId = `PRJ-2026-${String(projects.length + 1).padStart(3, '0')}`;
          setProjects(prev => [...prev, { ...values, id: newId, findings: 0, worksheets: 0, reportStatus: 'none' } as AuditProject]);
        }
        message.success('项目已创建');
        fetchProjects(); // Refresh from backend to get actual data
      }
      setProjectModalVisible(false);
    });
  };

  const handleViewProject = (project: AuditProject) => {
    setSelectedProject(project);
    setPhaseDrawerTab('overview');
    initProjectPhases(project);
    setDetailDrawerVisible(true);
    fetchFindingsForProject(project.id);
    loadPhaseOverview(project.id);
    loadPhaseProgress(project.id);
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
    const dept = finding.responsibleDept || finding.responsible_dept || '-';
    const type = finding.finding_type || finding.category || '-';
    const evidence = finding.evidence_count !== undefined ? `${finding.evidence_count} 条` : '未统计';
    message.info(
      `审计发现: ${finding.title}\n类别: ${type}\n严重等级: ${finding.severity}\n责任部门: ${dept}\n证据: ${evidence}`,
      5,
    );
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
    const content = `审计报告\n报告编号：${report.id}\n所属项目：${report.projectName}\n模板：${report.template}\n版本：${report.version}\n状态：${report.status}\n创建时间：${report.createdAt}\n更新时间：${report.updatedAt}\n\n一、审计概况\n本报告依据审计计划，对${report.projectName}进行了全面审查。\n\n二、主要发现\n详见附件。\n\n三、审计结论\n经审计，被审计单位内部控制基本健全，存在若干改进空间，建议按整改意见执行。`;
    const blob = new Blob(['\uFEFF' + content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.id}_${report.projectName}_审计报告_${report.version}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success(`报告 ${report.id} 下载已开始`);
  };

  // ==================== Worksheet 操作 ====================

  type WorksheetItem = { name: string; preparedBy: string; lastModified: string; pages: number; memo: string };

  const handlePreviewWorksheet = (item: WorksheetItem) => {
    setPreviewWorksheet(item);
    setPreviewModalVisible(true);
  };

  const handleDownloadWorksheet = (item: WorksheetItem) => {
    // 根据文件扩展名生成对应的模拟内容并触发浏览器下载
    const ext = item.name.split('.').pop()?.toLowerCase() || 'txt';
    let content = '';
    let mimeType = 'text/plain';

    if (ext === 'xlsx' || ext === 'xls') {
      // 生成简单 CSV 内容（用 .xlsx 名称但实际为 csv，演示用）
      content = `审计底稿 - ${item.name}\n制单人,${item.preparedBy}\n日期,${item.lastModified}\n页数,${item.pages}\n备注,${item.memo}\n\n序号,项目,金额(元),备注\n1,样本1,10000,正常\n2,样本2,25000,需关注\n3,样本3,8500,正常`;
      mimeType = 'text/csv;charset=utf-8;';
    } else if (ext === 'docx' || ext === 'doc') {
      content = `审计底稿：${item.name}\n制单人：${item.preparedBy}\n日期：${item.lastModified}\n页数：${item.pages} 页\n备注：${item.memo}\n\n一、审计目的\n对相关业务事项进行合规性审查，评估内部控制有效性。\n\n二、审计范围\n覆盖审计期间内全部相关业务凭证及台账记录。\n\n三、审计发现\n详见正文。\n\n四、审计结论\n经审计，相关内容基本符合规定，具体发现事项见审计报告。`;
      mimeType = 'text/plain;charset=utf-8;';
    } else {
      content = `${item.name}\n制单人：${item.preparedBy}\n日期：${item.lastModified}`;
    }

    const blob = new Blob(['\uFEFF' + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success(`底稿「${item.name}」下载已开始`);
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
          <a style={{ fontWeight: 500 }} onClick={() => handleViewProject(record)}>{text}</a>
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
    { title: '发现编号', dataIndex: 'finding_id', key: 'finding_id', width: 120, render: (t?: string) => t ? <code style={{ fontSize: 12 }}>{t}</code> : '-' },
    {
      title: '发现内容',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.projectName || record.finding_type}</div>
        </div>
      ),
    },
    { title: '严重等级', dataIndex: 'severity', key: 'severity', width: 90, render: (s: string) => <Tag color={severityMap[s]?.color}>{severityMap[s]?.label}</Tag> },
    { title: '类别', dataIndex: 'finding_type', key: 'finding_type', width: 110, render: (t: string) => <Tag color="blue">{t}</Tag> },
    { title: '责任部门', dataIndex: 'responsibleDept', key: 'responsibleDept', width: 110, render: (_: unknown, record: AuditFinding) => record.responsibleDept || record.responsible_dept || '-' },
    { title: '涉及金额', dataIndex: 'amount', key: 'amount', width: 130, align: 'right', render: (a?: number, record?: AuditFinding) => {
      const val = a || (record?.amount_involved ? parseFloat(record.amount_involved) : 0);
      return val ? `¥${val.toLocaleString()}` : '-';
    }},
    { title: '证据', dataIndex: 'evidence_count', key: 'evidence_count', width: 70, align: 'center', render: (n?: number) => n != null ? <Tag>{n}</Tag> : <Tag>0</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => {
      if (s === 'open' || s === 'confirmed') return <Badge status="error">待整改</Badge>;
      if (s === 'resolved') return <Badge status="processing">整改中</Badge>;
      if (s === 'closed') return <Badge status="success">已关闭</Badge>;
      return <Badge status="default">{s}</Badge>;
    }},
    { title: '整改单', dataIndex: 'hasRectification', key: 'hasRectification', width: 90, render: (v?: boolean) => v ? <Tag color="success">已创建</Tag> : <Tag>未创建</Tag> },
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

  // ==================== Filter State ====================
  const [projOrg, setProjOrg] = useState('all');
  const [projDateStart, setProjDateStart] = useState('2026-01-01');
  const [projDateEnd, setProjDateEnd] = useState('2026-06-30');

  // Fetch data from API when tab or filters change
  useEffect(() => {
    if (tab === 'projects' || tab === undefined) {
      fetchProjects();
      fetchAuditStats();
    }
    if (tab === 'findings' && findingProjectFilter) {
      fetchFindingsForProject(findingProjectFilter);
    }
  }, [tab, projOrg, projDateStart, projDateEnd, findingProjectFilter]);

  // Helper: extract date from item (default to month-based synthetic date)
  const getDataDate = (item: any) => item.date || (item.startDate || item.createdAt || '').slice(0, 10) || '2026-06-01';
  const getDataOrg = (item: any) => item.org || (item.projectId?.startsWith('PRJ-2026-001') || item.projectId?.startsWith('PRJ-2026-003') || item.projectId?.startsWith('PRJ-2026-004') ? 'sz' : 'zq');

  const dateInRange = (d: string) => d >= projDateStart && d <= projDateEnd;

  // Filtered data
  const filteredProjects = useMemo(() => projects.filter(p => {
    if (projOrg !== 'all' && getDataOrg(p) !== projOrg) return false;
    return dateInRange(getDataDate(p));
  }), [projects, projOrg, projDateStart, projDateEnd]);

  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (projOrg !== 'all' && getDataOrg(t) !== projOrg) return false;
    return dateInRange(getDataDate(t));
  }), [tasks, projOrg, projDateStart, projDateEnd]);

  const filteredFindings = useMemo(() => findings.filter(f => {
    if (projOrg !== 'all' && getDataOrg(f) !== projOrg) return false;
    return dateInRange(getDataDate(f));
  }), [findings, projOrg, projDateStart, projDateEnd]);

  const filteredReports = useMemo(() => reports.filter(r => {
    if (projOrg !== 'all' && getDataOrg(r) !== projOrg) return false;
    return dateInRange(getDataDate(r));
  }), [reports, projOrg, projDateStart, projDateEnd]);

  // ==================== Stats ====================

  const stats = useMemo(() => {
    const a = apiAuditStats as Record<string, number> | null;
    return {
      activeProjects: a?.active_projects != null ? a.active_projects : filteredProjects.filter(p => p.status === 'active').length,
      totalFindings: a?.open_findings != null ? a.open_findings : filteredFindings.filter(f => f.status === 'open').length,
      pendingTasks: a?.pending_tasks != null ? a.pending_tasks : filteredTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
      publishedReports: a?.published_reports != null ? a.published_reports : filteredReports.filter(r => r.status === 'published').length,
    };
  }, [filteredProjects, filteredFindings, filteredTasks, filteredReports, apiAuditStats]);

  return (
    <Layout className="audit-project-page">
      <Content className="page-content">
        <FilterBar
          orgValue={projOrg}
          onOrgChange={setProjOrg}
          dateStart={projDateStart}
          dateEnd={projDateEnd}
          onDateStartChange={setProjDateStart}
          onDateEndChange={setProjDateEnd}
          onRefresh={() => { fetchProjects(); fetchAuditStats(); message.success('数据已刷新'); }}
          onExport={() => message.info('正在导出审计项目数据...')}
        />

        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card><Statistic title="进行中项目" value={stats.activeProjects} prefix={<PlayCircleOutlined />} valueStyle={{ color: '#E34D59' }} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="待整改发现" value={stats.totalFindings} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: '#f5222d' }} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="待执行任务" value={stats.pendingTasks} prefix={<ClockCircleOutlined />} /></Card></Col>
          <Col xs={12} sm={6}><Card><Statistic title="已发布报告" value={stats.publishedReports} prefix={<FileDoneOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        </Row>

        {/* ===== 审计项目 ===== */}
      {tab === 'projects' && (
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
          <Table columns={projectColumns} dataSource={filteredProjects} rowKey="id" loading={tableLoading} pagination={{ pageSize: 10 }} scroll={{ x: 1400 }} />
        </div>
      )}

      {/* ===== 审计任务 ===== */}
      {tab === 'tasks' && (
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
          <Table columns={taskColumns} dataSource={filteredTasks} rowKey="id" pagination={{ pageSize: 10 }} scroll={{ x: 1100 }} />
        </div>
      )}

      {/* ===== 审计发现 ===== */}
      {tab === 'findings' && (
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
          <Table columns={findingColumns} dataSource={findingProjectFilter ? filteredFindings.filter(f => f.projectId === findingProjectFilter) : filteredFindings} rowKey="id" pagination={{ pageSize: 10 }} scroll={{ x: 1300 }} />
        </div>
      )}

      {/* ===== 审计报告 ===== */}
      {tab === 'reports' && (
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
            <Table columns={reportColumns} dataSource={filteredReports} rowKey="id" pagination={{ pageSize: 10 }} />
          )}
          <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
            <Col xs={24} md={12}><Card><ReactECharts option={phasePieOption} style={{ height: 300 }} /></Card></Col>
            <Col xs={24} md={12}><Card><ReactECharts option={typeBarOption} style={{ height: 300 }} /></Card></Col>
          </Row>
        </div>
      )}

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
            <Col span={12}><Form.Item name="phase" label="当前阶段"><Select>
                {Object.entries(phaseMap).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
              </Select></Form.Item></Col>
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

      {/* Project Detail Drawer — 8-Phase Audit Workstation */}
      <Drawer
        title={selectedProject ? `${selectedProject.name}` : '项目详情'}
        width={820}
        onClose={() => setDetailDrawerVisible(false)}
        open={detailDrawerVisible}
        extra={
          selectedProject && (
            <Space size="small">
              <Tag color={phaseMap[selectedProject.phase]?.color}>{phaseMap[selectedProject.phase]?.label}</Tag>
              <Badge status={statusMap[selectedProject.status]?.color as any} text={statusMap[selectedProject.status]?.label} />
            </Space>
          )
        }
      >
        {selectedProject && (
          <Tabs
            activeKey={phaseDrawerTab}
            onChange={setPhaseDrawerTab}
            items={[
              {
                key: 'overview',
                label: '阶段工作站',
                children: (
                  <div>
                    {/* Project quick info bar */}
                    <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
                      <Row gutter={16}>
                        <Col span={6}><Statistic title="审计发现" value={findings.filter(f => f.projectId === selectedProject.id).length || selectedProject.findings} valueStyle={{ fontSize: 20 }} /></Col>
                        <Col span={6}><Statistic title="工作底稿" value={selectedProject.worksheets} valueStyle={{ fontSize: 20 }} /></Col>
                        <Col span={6}><Statistic title="负责人" value={selectedProject.manager} valueStyle={{ fontSize: 14 }} /></Col>
                        <Col span={6}><Statistic title="进度" value={selectedProject.progress} suffix="%" valueStyle={{ fontSize: 20, color: '#E34D59' }} /></Col>
                      </Row>
                      <Progress percent={selectedProject.progress} strokeColor={selectedProject.progress >= 100 ? '#52c41a' : '#E34D59'} size="small" style={{ marginTop: 8 }} />
                    </Card>

                    {/* 8-Phase cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {PHASE_DEFS.map((phase) => {
                        const serverProgress = phase.stage_code ? phaseProgress[phase.stage_code] : null;
                        const status = serverProgress?.status || getPhaseStatus(selectedProject.id, phase.key);
                        const depsCompleted = serverProgress?.deps_completed !== false;
                        const st = phaseStatusMap[status] || phaseStatusMap.pending;
                        const isActive = status === 'in_progress';
                        const phaseBlocked = (status === 'pending' || status === undefined) && !depsCompleted && phase.stage_code !== '00';
                        return (
                          <Card
                            key={phase.key}
                            size="small"
                            style={{
                              borderLeft: `4px solid ${phaseBlocked ? '#d9d9d9' : st.color}`,
                              background: isActive ? '#fff7f0' : status === 'completed' ? '#f6ffed' : '#fff',
                              opacity: phaseBlocked ? 0.5 : (status === 'pending' ? 0.75 : 1),
                            }}
                            title={
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 18, color: st.color, flexShrink: 0 }}>{phase.icon}</span>
                                <span style={{ fontWeight: 600, fontSize: 14 }}>{phase.title}</span>
                                {phaseBlocked && <Tag color="warning">等待前置阶段</Tag>}
                                {phase.stage_code && phaseOverviewData[phase.stage_code] && (
                                  <Tag color="default" style={{ fontSize: 11 }}>
                                    {phaseOverviewData[phase.stage_code].file_count} 个文件
                                  </Tag>
                                )}
                                <Tag color={st.color === '#52c41a' ? 'success' : st.color === '#E34D59' ? 'processing' : 'default'} style={{ marginLeft: 'auto' }}>
                                  {st.label}
                                </Tag>
                                {(status === 'in_progress' || (status === 'pending' && depsCompleted && phase.stage_code !== '00')) && (
                                  <Button
                                    size="small"
                                    type="link"
                                    icon={<CheckCircleOutlined />}
                                    onClick={() => phase.stage_code && handleMarkPhaseComplete(phase.stage_code)}
                                  >
                                    标记完成
                                  </Button>
                                )}
                              </div>
                            }
                          >
                            <p style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>
                              {phase.description}
                            </p>
                            {/* 实际文件列表 */}
                            <div style={{ marginBottom: 6 }}>
                              <span style={{ fontSize: 12, color: '#999' }}>交付物：</span>
                              {phase.stage_code && phaseOverviewData[phase.stage_code]?.files?.length > 0 ? (
                                <div style={{ marginTop: 4 }}>
                                  {phaseOverviewData[phase.stage_code].files.map((f: any, fi: number) => (
                                    <div key={fi} style={{
                                      display: 'flex', alignItems: 'center', gap: 8,
                                      padding: '2px 0', borderBottom: fi < phaseOverviewData[phase.stage_code].files.length - 1 ? '1px solid #f0f0f0' : 'none',
                                    }}>
                                      <FileIcon ext={f.ext} />
                                      <span style={{ flex: 1, fontSize: 12 }}>{f.name}</span>
                                      <span style={{ fontSize: 11, color: '#999' }}>
                                        {f.size > 1024 ? `${(f.size / 1024).toFixed(1)}KB` : `${f.size}B`}
                                      </span>
                                      <Button size="small" type="link" style={linkBtnStyle}
                                        onClick={() => handleDownloadFile(f.path)}>
                                        下载
                                      </Button>
                                      <Upload
                                        customRequest={({ file, onSuccess }) => handleReplaceFile(f.path, file as File, onSuccess)}
                                        showUploadList={false}
                                        accept=".xlsx,.xls,.docx,.doc,.pdf,.png,.jpg,.jpeg,.csv"
                                      >
                                        <Button size="small" type="link" style={linkBtnStyle}>替换</Button>
                                      </Upload>
                                      <Popconfirm title="确定删除?" onConfirm={() => handleDeleteFile(f.path)}>
                                        <Button size="small" type="link" danger>删除</Button>
                                      </Popconfirm>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <Space size={[4, 4]} wrap style={{ display: 'inline' }}>
                                  {phase.deliverables.map((d) => (
                                    <Tag key={d} style={{ fontSize: 11, marginBottom: 2, color: '#bbb' }}>{d}</Tag>
                                  ))}
                                </Space>
                              )}
                            </div>
                            {/* 上传按钮 */}
                            {phase.stage_code && (
                              <Upload
                                customRequest={({ file, onSuccess }) => handleUploadFile(phase.stage_code!, file as File, onSuccess)}
                                showUploadList={false}
                                accept=".xlsx,.xls,.docx,.doc,.pdf,.png,.jpg,.jpeg,.csv,.txt,.sql"
                              >
                                <Button size="small" icon={<UploadOutlined />} style={{ marginBottom: 6, fontSize: 12 }}>
                                  上传文件
                                </Button>
                              </Upload>
                            )}
                            <div style={{ marginBottom: 6 }}>
                              <span style={{ fontSize: 12, color: '#999' }}>涉及部门：</span>
                              <Space size={[4, 4]} wrap style={{ display: 'inline' }}>
                                {phase.departments.map((d) => (
                                  <Tag key={d} color="blue" style={{ fontSize: 11 }}>{d}</Tag>
                                ))}
                              </Space>
                            </div>
                            <div style={{ marginBottom: 6 }}>
                              <span style={{ fontSize: 12, color: '#999' }}>数据来源：</span>
                              <Space size={[4, 4]} wrap style={{ display: 'inline' }}>
                                {phase.data_sources.map((d) => (
                                  <Tag key={d} color="geekblue" style={{ fontSize: 11 }}>{d}</Tag>
                                ))}
                              </Space>
                            </div>
                            <Space size={4} wrap>
                              {phase.actions.map((act) => (
                                <Button
                                  key={act.onClick}
                                  size="small"
                                  icon={act.icon}
                                  onClick={() => handlePhaseAction(act.onClick, selectedProject.id)}
                                  disabled={act.disabled}
                                  style={{ fontSize: 12 }}
                                >
                                  {act.label}
                                </Button>
                              ))}
                            </Space>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Member & date info */}
                    <Divider style={{ margin: '16px 0 8px' }} />
                    <Descriptions size="small" column={2}>
                      <Descriptions.Item label="团队成员">{selectedProject.team.join(', ')}</Descriptions.Item>
                      <Descriptions.Item label="项目周期">{selectedProject.startDate} ~ {selectedProject.endDate}</Descriptions.Item>
                    </Descriptions>
                  </div>
                ),
              },
              {
                key: 'walkthrough',
                label: '穿行测试',
                children: <WalkthroughTab projectId={selectedProject.id} projectName={selectedProject.name} />,
              },
              {
                key: 'tasks',
                label: '审计任务',
                children: <TaskTab projectId={selectedProject.id} />,
              },
              {
                key: 'files',
                label: '项目文件',
                children: <ProjectFilesPage projectId={selectedProject.id} projectCode={(selectedProject as any).project_code || selectedProject.id} projectName={selectedProject.name} />,
              },
            ]}
          />
        )}
      </Drawer>
    </Layout>
  );
};

export default AuditProjectPage;
