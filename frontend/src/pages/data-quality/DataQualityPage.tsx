import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout, Table, Button, Space, Tag, Input, Select, Card,
  Modal, Form, Drawer, Row, Col, Statistic, Progress, Popconfirm,
  message, Switch, Tooltip, Badge, Tree, Typography, Tabs,
  Descriptions, Alert, Empty, Spin, Divider, List, DatePicker, notification,
} from 'antd';
import {
  DatabaseOutlined, SyncOutlined, HighlightOutlined, LinkOutlined,
  PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  WarningOutlined, ClockCircleOutlined, CloudSyncOutlined,
  PlayCircleOutlined, PauseCircleOutlined, ExclamationCircleOutlined,
  ApartmentOutlined, ThunderboltOutlined, DashboardOutlined,
  FileTextOutlined, NodeIndexOutlined, SafetyCertificateOutlined,
  SwapOutlined, HistoryOutlined, AlertOutlined, RiseOutlined,
  FallOutlined, SettingOutlined, FundOutlined, BellOutlined,
  CopyOutlined, SendOutlined, DownloadOutlined, ImportOutlined,
  FilePdfOutlined, AreaChartOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, LineChart, GaugeChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import FilterBar from '@/components/FilterBar';
import './DataQualityPage.less';

echarts.use([
  BarChart, PieChart, LineChart, GaugeChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  CanvasRenderer,
]);

const { Content } = Layout;
const { TextArea } = Input;
const { Text, Title: TextTitle, Paragraph } = Typography;

// ---- Types ----
interface QualityRule {
  id: string; rule_id: string; name: string; description: string;
  source_system: string; table_name: string; field_name: string;
  rule_type: string; threshold: number; severity: string;
  is_active: boolean; last_check_at: string | null;
  last_result: any; config: any;
}

interface SyncSource {
  id: string; source_system: string; sync_status: string;
  last_sync_at: string; last_success_at: string;
  records_synced: number; records_failed: number;
  sync_duration_seconds: number; error_message: string | null;
  is_connected: boolean; latency_ms: number;
  sync_interval_minutes: number;
  today_sync_count: number; today_fail_count: number; fail_rate: number;
  expected_records?: number; record_volume_change_pct?: number;
}

interface CrossSystemCheck {
  check_id: string; name: string; description: string;
  source_system: string; source_table: string; source_field: string;
  target_system: string; target_table: string; target_field: string;
  match_key: string;
  total_compared?: number; matched?: number; mismatched?: number;
  match_rate?: number; last_check_at?: string;
  mismatch_details?: Array<{ match_key_val: string; source_val: string; target_val: string; diff_type: string }>;
}

interface FieldChange {
  change_id: string; source_system: string; table_name: string; field_name: string;
  change_type: string; old_value: string | null; new_value: string | null;
  change_description: string; impact_level: string;
  impacted_downstream: string[]; notified: boolean;
  changed_by: string; changed_at: string;
}

interface LineageNode {
  node: string; relation: string; transform: string;
  system: string; level: number;
}

interface AnomalyAlert {
  id: string; rule_name: string; source_system: string; field_name: string;
  alert_type: string; current_value: number; threshold: number;
  deviation_pct: number; severity: string; checked_at: string;
  detail: string;
}

// ---- Preset rule templates from backend ----
const PRESET_TEMPLATES = [
  { rule_id: 'DQ-001', name: '凭证金额空值检测', description: '检测金蝶ERP凭证表中金额字段的空值率，空值率超过1%触发告警', source_system: '金蝶ERP', table_name: 't_voucher', field_name: 'total_amount', rule_type: 'null_rate', threshold: 0.01, severity: 'critical' },
  { rule_id: 'DQ-002', name: '供应商名称空值检测', description: '检测SRM供应商表中供应商名称字段的空值率', source_system: 'SRM', table_name: 't_supplier', field_name: 'supplier_name', rule_type: 'null_rate', threshold: 0.005, severity: 'warning' },
  { rule_id: 'DQ-003', name: '合同金额异常值检测', description: '检测合同金额是否超出历史均值±3σ范围', source_system: 'CRM', table_name: 't_contract', field_name: 'contract_amount', rule_type: 'outlier', threshold: 3.0, severity: 'warning' },
  { rule_id: 'DQ-004', name: '月度费用波动检测', description: '当月费用支出与近6个月均值偏差超过30%时告警', source_system: '金蝶ERP', table_name: 't_expense', field_name: 'amount', rule_type: 'volatility', threshold: 0.30, severity: 'warning' },
  { rule_id: 'DQ-005', name: 'ERP-SRM供应商名称一致性', description: '同一供应商在金蝶ERP与SRM中的名称是否一致', source_system: '金蝶ERP', table_name: 't_supplier', field_name: 'supplier_name', rule_type: 'consistency', threshold: 0.95, severity: 'critical' },
  { rule_id: 'DQ-006', name: 'ERP-CRM合同金额一致性', description: '同一销售合同在ERP与CRM中的金额是否匹配', source_system: '金蝶ERP', table_name: 't_contract', field_name: 'total_amount', rule_type: 'consistency', threshold: 0.98, severity: 'critical' },
];

// ---- Mock Data ----
const mockRules: QualityRule[] = [
  { id: '1', rule_id: 'DQ-001', name: '凭证金额空值检测', description: '检测金蝶ERP凭证表中金额字段的空值率，超过1%触发告警', source_system: '金蝶ERP', table_name: 't_voucher', field_name: 'total_amount', rule_type: 'null_rate', threshold: 0.01, severity: 'critical', is_active: true, last_check_at: '2026-06-10 09:00', last_result: { passed: true, null_rate: 0.005, total: 1285000, null_count: 6425 }, config: null },
  { id: '2', rule_id: 'DQ-002', name: '供应商名称空值检测', description: '检测SRM供应商表中供应商名称字段的空值率', source_system: 'SRM', table_name: 't_supplier', field_name: 'supplier_name', rule_type: 'null_rate', threshold: 0.005, severity: 'warning', is_active: true, last_check_at: '2026-06-10 09:05', last_result: { passed: true, null_rate: 0.002, total: 3200, null_count: 6 }, config: null },
  { id: '3', rule_id: 'DQ-003', name: '合同金额异常值检测(3σ)', description: '检测合同金额是否超出历史均值±3σ范围，超出自动标红', source_system: 'CRM', table_name: 't_contract', field_name: 'contract_amount', rule_type: 'outlier', threshold: 3.0, severity: 'warning', is_active: true, last_check_at: '2026-06-10 09:10', last_result: { passed: false, outlier_count: 3, outlier_rate: 0.03, total: 8900, mean: 48200, std: 15600, outliers: [{ value: 142000, deviation_sigma: 6.0 }, { value: 138500, deviation_sigma: 5.8 }, { value: 21500, deviation_sigma: -1.7 }] }, config: null },
  { id: '4', rule_id: 'DQ-004', name: '月度费用波动检测', description: '当月费用支出与近6个月均值偏差超过30%时告警', source_system: '金蝶ERP', table_name: 't_expense', field_name: 'amount', rule_type: 'volatility', threshold: 0.30, severity: 'warning', is_active: true, last_check_at: '2026-06-10 09:15', last_result: { passed: true, deviation_pct: 0.12, current: 185000, mean: 165000 }, config: null },
  { id: '5', rule_id: 'DQ-005', name: 'ERP-SRM供应商名称一致性', description: '同一供应商在ERP与SRM中名称是否一致，一致率低于95%告警', source_system: '金蝶ERP', table_name: 't_supplier', field_name: 'supplier_name', rule_type: 'consistency', threshold: 0.95, severity: 'critical', is_active: true, last_check_at: '2026-06-10 08:00', last_result: { passed: true, match_rate: 0.96, total: 3200, matched: 3072, mismatched: 128 }, config: null },
  { id: '6', rule_id: 'DQ-006', name: 'ERP-CRM合同金额一致性', description: '同一销售合同在ERP与CRM中的金额是否匹配，一致率低于98%告警', source_system: '金蝶ERP', table_name: 't_contract', field_name: 'total_amount', rule_type: 'consistency', threshold: 0.98, severity: 'critical', is_active: false, last_check_at: '2026-06-09 18:00', last_result: { passed: false, match_rate: 0.94, total: 8900, matched: 8366, mismatched: 534 }, config: null },
  { id: '7', rule_id: 'DQ-007', name: 'QMS质检记录完整性', description: '检测QMS质检记录表中关键字段的完整性', source_system: 'QMS', table_name: 't_inspection', field_name: 'result', rule_type: 'completeness', threshold: 0.99, severity: 'warning', is_active: true, last_check_at: '2026-06-10 09:20', last_result: { passed: true, total: 15600, complete: 15588, completeness_rate: 0.999 }, config: null },
  { id: '8', rule_id: 'DQ-008', name: 'PLM物料BOM完整性检测', description: '检测PLM系统中产品BOM物料主数据的完整性', source_system: 'PLM', table_name: 't_bom', field_name: 'material_code', rule_type: 'null_rate', threshold: 0.01, severity: 'warning', is_active: true, last_check_at: '2026-06-10 09:25', last_result: { passed: true, null_rate: 0.003, total: 45000, null_count: 135 }, config: null },
];

const mockSyncSources: SyncSource[] = [
  { id: '1', source_system: '金蝶ERP', sync_status: 'online', last_sync_at: '2026-06-10 09:45:00', last_success_at: '2026-06-10 09:45:00', records_synced: 1280000, records_failed: 0, sync_duration_seconds: 45, error_message: null, is_connected: true, latency_ms: 12, sync_interval_minutes: 30, today_sync_count: 48, today_fail_count: 0, fail_rate: 0, expected_records: 1280000, record_volume_change_pct: 2.5 },
  { id: '2', source_system: '云之家OA', sync_status: 'syncing', last_sync_at: '2026-06-10 09:55:00', last_success_at: '2026-06-10 09:55:00', records_synced: 560000, records_failed: 0, sync_duration_seconds: 120, error_message: null, is_connected: true, latency_ms: 35, sync_interval_minutes: 15, today_sync_count: 96, today_fail_count: 0, fail_rate: 0, expected_records: 560000, record_volume_change_pct: -1.2 },
  { id: '3', source_system: 'CRM', sync_status: 'online', last_sync_at: '2026-06-10 09:40:00', last_success_at: '2026-06-10 09:40:00', records_synced: 340000, records_failed: 0, sync_duration_seconds: 60, error_message: null, is_connected: true, latency_ms: 8, sync_interval_minutes: 60, today_sync_count: 24, today_fail_count: 0, fail_rate: 0, expected_records: 340000, record_volume_change_pct: 5.8 },
  { id: '4', source_system: 'SRM', sync_status: 'error', last_sync_at: '2026-06-10 08:00:00', last_success_at: '2026-06-10 07:00:00', records_synced: 210000, records_failed: 120, sync_duration_seconds: 0, error_message: '连接超时: unable to reach SRM database at 10.0.1.55:5432，已超30分钟', is_connected: false, latency_ms: -1, sync_interval_minutes: 60, today_sync_count: 23, today_fail_count: 2, fail_rate: 8.7, expected_records: 210000, record_volume_change_pct: 0 },
  { id: '5', source_system: 'WMS', sync_status: 'online', last_sync_at: '2026-06-10 09:35:00', last_success_at: '2026-06-10 09:35:00', records_synced: 580000, records_failed: 0, sync_duration_seconds: 90, error_message: null, is_connected: true, latency_ms: 22, sync_interval_minutes: 1440, today_sync_count: 1, today_fail_count: 0, fail_rate: 0, expected_records: 580000, record_volume_change_pct: -0.3 },
  { id: '6', source_system: 'QMS', sync_status: 'online', last_sync_at: '2026-06-10 09:30:00', last_success_at: '2026-06-10 09:30:00', records_synced: 890000, records_failed: 0, sync_duration_seconds: 35, error_message: null, is_connected: true, latency_ms: 15, sync_interval_minutes: 360, today_sync_count: 6, today_fail_count: 0, fail_rate: 0, expected_records: 890000, record_volume_change_pct: 1.1 },
  { id: '7', source_system: 'PLM', sync_status: 'online', last_sync_at: '2026-06-10 09:25:00', last_success_at: '2026-06-10 09:25:00', records_synced: 450000, records_failed: 0, sync_duration_seconds: 55, error_message: null, is_connected: true, latency_ms: 18, sync_interval_minutes: 720, today_sync_count: 3, today_fail_count: 0, fail_rate: 0, expected_records: 450000, record_volume_change_pct: -2.1 },
];

const mockCrossChecks: CrossSystemCheck[] = [
  { check_id: 'CSC-001', name: 'ERP-SRM供应商名称一致性', description: '检查同一供应商在金蝶ERP和SRM中的名称是否一致', source_system: '金蝶ERP', source_table: 't_supplier', source_field: 'supplier_name', target_system: 'SRM', target_table: 't_supplier', target_field: 'supplier_name', match_key: 'supplier_id', total_compared: 3200, matched: 3072, mismatched: 128, match_rate: 96.0, last_check_at: '2026-06-10 08:00' },
  { check_id: 'CSC-002', name: 'ERP-SRM供应商信用等级一致性', description: '检查同一供应商在ERP与SRM中的信用等级是否一致', source_system: '金蝶ERP', source_table: 't_supplier', source_field: 'credit_level', target_system: 'SRM', target_table: 't_supplier', target_field: 'credit_rating', match_key: 'supplier_id', total_compared: 3200, matched: 2960, mismatched: 240, match_rate: 92.5, last_check_at: '2026-06-10 08:05' },
  { check_id: 'CSC-003', name: 'ERP-CRM销售合同金额一致性', description: '检查同一销售合同在ERP与CRM中的金额是否匹配', source_system: '金蝶ERP', source_table: 't_sales_contract', source_field: 'total_amount', target_system: 'CRM', target_table: 't_contract', target_field: 'amount', match_key: 'contract_no', total_compared: 8900, matched: 8642, mismatched: 258, match_rate: 97.1, last_check_at: '2026-06-10 08:10' },
  { check_id: 'CSC-004', name: 'ERP-CRM销售合同日期一致性', description: '检查同一销售合同在ERP与CRM中的日期是否一致', source_system: '金蝶ERP', source_table: 't_sales_contract', source_field: 'contract_date', target_system: 'CRM', target_table: 't_contract', target_field: 'sign_date', match_key: 'contract_no', total_compared: 8900, matched: 8695, mismatched: 205, match_rate: 97.7, last_check_at: '2026-06-10 08:15' },
];

const mockFieldChanges: FieldChange[] = [
  { change_id: 'CHG-001', source_system: '金蝶ERP', table_name: 't_expense', field_name: 'amount', change_type: 'modified', old_value: 'decimal(10,2)', new_value: 'decimal(12,2)', change_description: '金额字段精度从10位调整到12位，适配大额费用核算', impact_level: 'medium', impacted_downstream: ['数据仓库.dwd_expense', '费用审计底稿', '风险规则DQ-004', '月度费用波动检测'], notified: false, changed_by: 'ERP管理员-张工', changed_at: '2026-06-10 08:00' },
  { change_id: 'CHG-002', source_system: 'SRM', table_name: 't_supplier', field_name: 'tax_id', change_type: 'added', old_value: null, new_value: 'varchar(50)', change_description: '新增税务登记号字段，符合金税四期要求', impact_level: 'low', impacted_downstream: ['数据仓库.dwd_supplier', '供应商分析报表', '供应商风险图谱'], notified: true, changed_by: 'SRM管理员-李工', changed_at: '2026-06-09 15:30' },
  { change_id: 'CHG-003', source_system: '云之家OA', table_name: 't_approval', field_name: 'node_id', change_type: 'removed', old_value: 'varchar(32)', new_value: null, change_description: '审批节点ID字段废弃，改用workflow_id统一管理', impact_level: 'high', impacted_downstream: ['数据仓库.dwd_approval', '审批流分析', '质量规则DQ-003', '审计作业-审批追踪'], notified: false, changed_by: 'OA管理员-王工', changed_at: '2026-06-09 10:00' },
  { change_id: 'CHG-004', source_system: '金蝶ERP', table_name: 't_voucher', field_name: 'acct_code', change_type: 'modified', old_value: 'varchar(20)', new_value: 'varchar(30)', change_description: '科目编码长度扩展至30位，新增辅助核算维度', impact_level: 'high', impacted_downstream: ['数据仓库.dwd_voucher', '数据仓库.dwd_balance', '数据集市.dm_financial_audit', '风险规则DQ-001~006', '智能查询模板T001~T005'], notified: false, changed_by: 'ERP管理员-张工', changed_at: '2026-06-08 14:00' },
  { change_id: 'CHG-005', source_system: 'QMS', table_name: 't_inspection', field_name: 'defect_level', change_type: 'modified', old_value: 'enum("A","B","C")', new_value: 'enum("S","A","B","C")', change_description: '新增S级严重缺陷等级，对应关键安全项', impact_level: 'medium', impacted_downstream: ['数据仓库.dwd_inspection', '供应商评分模型', '质量报告'], notified: true, changed_by: 'QMS管理员-赵工', changed_at: '2026-06-07 11:00' },
];

const mockSnapshots = [
  { snapshot_id: 'SNAP-20260610-A1B2', source_system: '金蝶ERP', table_name: 't_voucher', records_count: 45600, sync_mode: 'full', sync_finished_at: '2026-06-10T09:45:00', duration_seconds: 45, is_success: true, can_rollback: true, diff_summary: { prev_records: 45200, change_count: 400, change_pct: 0.88 } },
  { snapshot_id: 'SNAP-20260610-C3D4', source_system: 'CRM', table_name: 't_contract', records_count: 8900, sync_mode: 'incremental', sync_finished_at: '2026-06-10T09:40:00', duration_seconds: 60, is_success: true, can_rollback: true, diff_summary: { prev_records: 8700, change_count: 200, change_pct: 2.30 } },
  { snapshot_id: 'SNAP-20260610-E5F6', source_system: 'SRM', table_name: 't_supplier', records_count: 3200, sync_mode: 'full', sync_finished_at: '2026-06-10T09:00:00', duration_seconds: 120, is_success: false, can_rollback: false, diff_summary: null, error_message: 'Connection timeout' },
  { snapshot_id: 'SNAP-20260609-G7H8', source_system: 'QMS', table_name: 't_inspection', records_count: 15600, sync_mode: 'full', sync_finished_at: '2026-06-09T09:00:00', duration_seconds: 35, is_success: true, can_rollback: true, diff_summary: { prev_records: 15450, change_count: 150, change_pct: 0.97 } },
];

const lineageTreeData = [
  {
    title: <span style={{ fontWeight: 600, fontSize: 14 }}>审计报告 / 管理层驾驶舱</span>,
    key: 'report',
    icon: <FilePdfOutlined style={{ color: '#D7011D' }} />,
    children: [
      {
        title: <span style={{ fontWeight: 500 }}>审计底稿</span>,
        key: 'worksheet',
        icon: <FileTextOutlined style={{ color: '#722ed1' }} />,
        children: [
          { title: '费用审计底稿.s4_审计发现摘要', key: 'ws-expense', icon: <FileTextOutlined /> },
          { title: '采购审计底稿.s5_供应商评估', key: 'ws-procure', icon: <FileTextOutlined /> },
          { title: '资金审计底稿.s3_资金异常', key: 'ws-fund', icon: <FileTextOutlined /> },
        ],
      },
      {
        title: <span style={{ fontWeight: 500, color: '#fa8c16' }}>数据集市层 (DM)</span>,
        key: 'dm',
        icon: <AreaChartOutlined style={{ color: '#fa8c16' }} />,
        children: [
          { title: <span>dm_financial_audit <Tag color="blue" style={{ fontSize: 10 }}>aggregate</Tag></span>, key: 'dm-fin' },
          { title: <span>dm_procurement_audit <Tag color="blue" style={{ fontSize: 10 }}>aggregate</Tag></span>, key: 'dm-proc' },
          { title: <span>dm_quality_audit <Tag color="blue" style={{ fontSize: 10 }}>aggregate</Tag></span>, key: 'dm-quality' },
        ],
      },
    ],
  },
  {
    title: <span style={{ fontWeight: 600, color: '#1890ff', fontSize: 14 }}>数据仓库层 (DWD)</span>,
    key: 'dwd',
    icon: <DatabaseOutlined style={{ color: '#1890ff' }} />,
    children: [
      {
        title: <span>dwd_voucher <Tag color="green" style={{ fontSize: 10 }}>transform</Tag></span>,
        key: 'dwd-voucher',
        children: [{ title: <><Tag color="red">金蝶ERP</Tag> t_voucher.total_amount</>, key: 'src-voucher' }],
      },
      {
        title: <span>dwd_supplier <Tag color="green" style={{ fontSize: 10 }}>transform</Tag></span>,
        key: 'dwd-supplier',
        children: [
          { title: <><Tag color="red">金蝶ERP</Tag> t_supplier</>, key: 'src-supplier-erp' },
          { title: <><Tag color="purple">SRM</Tag> t_supplier</>, key: 'src-supplier-srm' },
        ],
      },
      {
        title: <span>dwd_contract <Tag color="green" style={{ fontSize: 10 }}>transform</Tag></span>,
        key: 'dwd-contract',
        children: [
          { title: <><Tag color="red">金蝶ERP</Tag> t_sales_contract</>, key: 'src-contract-erp' },
          { title: <><Tag color="orange">CRM</Tag> t_contract</>, key: 'src-contract-crm' },
        ],
      },
      {
        title: <span>dwd_inspection <Tag color="green" style={{ fontSize: 10 }}>transform</Tag></span>,
        key: 'dwd-inspection',
        children: [{ title: <><Tag color="geekblue">QMS</Tag> t_inspection</>, key: 'src-inspection' }],
      },
    ],
  },
  {
    title: <span style={{ fontWeight: 600, color: '#52c41a', fontSize: 14 }}>源系统层 (Source)</span>,
    key: 'source',
    icon: <CloudSyncOutlined style={{ color: '#52c41a' }} />,
    children: [
      { title: <><Tag color="red">金蝶ERP</Tag> 财务凭证 / 科目余额 / 应收应付</>, key: 'src-erp' },
      { title: <><Tag color="orange">CRM</Tag> 销售合同 / 客户信息 / 回款记录</>, key: 'src-crm' },
      { title: <><Tag color="purple">SRM</Tag> 供应商 / 采购合同 / 询比价</>, key: 'src-srm' },
      { title: <><Tag color="cyan">WMS</Tag> 库存 / 出入库 / 盘点</>, key: 'src-wms' },
    ],
  },
];

// ---- Helpers ----
const ruleTypeLabels: Record<string, string> = {
  null_rate: '空值检测', outlier: '异常值检测(3σ)', consistency: '一致性校验',
  volatility: '波动检测', completeness: '完整性检查',
};
const ruleTypeColors: Record<string, string> = {
  null_rate: '#1890ff', outlier: '#fa8c16', consistency: '#722ed1',
  volatility: '#52c41a', completeness: '#13c2c2',
};
const severityLabels: Record<string, { color: string; label: string }> = {
  critical: { color: '#f5222d', label: '严重' },
  warning: { color: '#fa8c16', label: '警告' },
  info: { color: '#1890ff', label: '信息' },
};
const syncStatusMap: Record<string, { color: string; label: string; badge: 'success' | 'processing' | 'error' | 'default' }> = {
  online: { color: '#52c41a', label: '在线', badge: 'success' },
  syncing: { color: '#1890ff', label: '同步中', badge: 'processing' },
  error: { color: '#f5222d', label: '异常', badge: 'error' },
  offline: { color: '#d9d9d9', label: '离线', badge: 'default' },
};
const changeTypeLabels: Record<string, { color: string; label: string }> = {
  added: { color: '#52c41a', label: '新增' },
  modified: { color: '#fa8c16', label: '修改' },
  removed: { color: '#f5222d', label: '删除' },
};

// ---- Anomaly Alerts derived from rule results ----
const deriveAnomalyAlerts = (rules: QualityRule[], syncSources: SyncSource[]): AnomalyAlert[] => {
  const alerts: AnomalyAlert[] = [];

  // From quality rules - items that failed
  for (const rule of rules) {
    if (rule.last_result && !rule.last_result.passed) {
      if (rule.rule_type === 'outlier' && rule.last_result.outliers) {
        for (const ol of rule.last_result.outliers) {
          alerts.push({
            id: `${rule.id}-${ol.value}`,
            rule_name: rule.name,
            source_system: rule.source_system,
            field_name: rule.field_name,
            alert_type: '3σ异常值',
            current_value: ol.value,
            threshold: rule.threshold,
            deviation_pct: Math.abs(ol.deviation_sigma) * 100,
            severity: Math.abs(ol.deviation_sigma) >= 5 ? 'critical' : 'warning',
            checked_at: rule.last_check_at!,
            detail: `偏离均值 ${ol.deviation_sigma.toFixed(1)}σ (均值=${ol.mean}, σ=${ol.std})`,
          });
        }
      } else if (rule.rule_type === 'consistency') {
        alerts.push({
          id: rule.id,
          rule_name: rule.name,
          source_system: rule.source_system,
          field_name: rule.field_name,
          alert_type: '一致性异常',
          current_value: rule.last_result.match_rate * 100,
          threshold: rule.threshold * 100,
          deviation_pct: Math.abs((rule.last_result.match_rate - rule.threshold) * 100),
          severity: rule.severity,
          checked_at: rule.last_check_at!,
          detail: `一致率=${(rule.last_result.match_rate * 100).toFixed(1)}%, 阈值=${(rule.threshold * 100).toFixed(0)}%, 不一致=${rule.last_result.mismatched || 0}条`,
        });
      }
    }
  }

  // Sync delay alerts (>30min threshold per 需求文档 3.3)
  for (const src of syncSources) {
    if (src.sync_status === 'error') {
      alerts.push({
        id: `sync-${src.id}`,
        rule_name: `${src.source_system} 同步异常`,
        source_system: src.source_system,
        field_name: '-',
        alert_type: '同步中断',
        current_value: 0,
        threshold: 0,
        deviation_pct: 100,
        severity: 'critical',
        checked_at: src.last_sync_at,
        detail: src.error_message || '同步连接失败',
      });
    } else if (src.last_sync_at) {
      const delayMin = (Date.now() - new Date(src.last_sync_at).getTime()) / 60000;
      if (delayMin > 30) {
        alerts.push({
          id: `delay-${src.id}`,
          rule_name: `${src.source_system} 同步延迟`,
          source_system: src.source_system,
          field_name: '-',
          alert_type: '延迟超30分钟',
          current_value: Math.round(delayMin),
          threshold: 30,
          deviation_pct: Math.round(delayMin / 30 * 100),
          severity: delayMin > 120 ? 'critical' : 'warning',
          checked_at: src.last_sync_at,
          detail: `上次成功同步: ${src.last_sync_at}，已延迟 ${Math.round(delayMin)} 分钟`,
        });
      }
    }
  }

  return alerts;
};

const DataQualityPage: React.FC = () => {
  const { tab = 'dashboard' } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [notifApi, notifContext] = notification.useNotification();

  // State
  const [rules, setRules] = useState(mockRules);
  const [syncSources, setSyncSources] = useState(mockSyncSources);
  const [crossChecks, setCrossChecks] = useState(mockCrossChecks);
  const [fieldChanges, setFieldChanges] = useState(mockFieldChanges);
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);

  // Rule modal
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<QualityRule | null>(null);
  const [ruleForm] = Form.useForm();

  // Template modal
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  // Detail drawer
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<QualityRule | null>(null);

  // Lineage trace drawer
  const [lineageDrawerOpen, setLineageDrawerOpen] = useState(false);
  const [traceNode, setTraceNode] = useState('');
  const [traceDirection, setTraceDirection] = useState<'upstream' | 'downstream'>('upstream');
  const [traceResult, setTraceResult] = useState<{ root: string; direction: string; path: LineageNode[]; depth: number } | null>(null);

  // Filter state
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('2026-01-01');
  const [filterDateEnd, setFilterDateEnd] = useState('2026-12-31');

  // Derived data
  const anomalyAlerts = useMemo(() => deriveAnomalyAlerts(rules, syncSources), [rules, syncSources]);

  const stats = useMemo(() => ({
    totalRules: rules.length,
    activeRules: rules.filter(r => r.is_active).length,
    failedRules: rules.filter(r => r.last_result && !r.last_result.passed).length,
    qualityScore: rules.length > 0
      ? Number((rules.filter(r => r.last_result?.passed !== false).length / rules.length * 100).toFixed(1))
      : 100,
    totalSources: syncSources.length,
    errorSources: syncSources.filter(s => s.sync_status === 'error').length,
    onlineSources: syncSources.filter(s => s.sync_status === 'online').length,
    syncingSources: syncSources.filter(s => s.sync_status === 'syncing').length,
    todayTotalSync: syncSources.reduce((a, b) => a + b.today_sync_count, 0),
    todayTotalFail: syncSources.reduce((a, b) => a + b.today_fail_count, 0),
    pendingChanges: fieldChanges.filter(c => !c.notified).length,
    delayedSources: syncSources.filter(s => {
      if (!s.last_sync_at) return false;
      return (Date.now() - new Date(s.last_sync_at).getTime()) / 60000 > 30;
    }).length,
  }), [rules, syncSources, fieldChanges]);

  // ---- Rule actions ----
  const handleAddRule = () => {
    setEditingRule(null);
    ruleForm.resetFields();
    ruleForm.setFieldsValue({ is_active: true, severity: 'warning', rule_type: 'null_rate' });
    setRuleModalOpen(true);
  };

  const handleEditRule = (record: QualityRule) => {
    setEditingRule(record);
    ruleForm.setFieldsValue(record);
    setRuleModalOpen(true);
  };

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    messageApi.success('规则已删除');
  };

  const handleToggleRule = (id: string, checked: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: checked } : r));
    messageApi.info(checked ? '规则已启用' : '规则已停用');
  };

  const handleSaveRule = async () => {
    const values = await ruleForm.validateFields();
    if (editingRule) {
      setRules(prev => prev.map(r => r.id === editingRule.id ? { ...r, ...values } : r));
      messageApi.success('规则已更新');
    } else {
      const newRule: QualityRule = {
        id: `new-${Date.now()}`,
        rule_id: `DQ-${String(rules.length + 1).padStart(3, '0')}`,
        ...values,
        last_check_at: null,
        last_result: null,
        config: null,
      };
      setRules(prev => [newRule, ...prev]);
      messageApi.success('规则已创建');
    }
    setRuleModalOpen(false);
  };

  const handleLoadFromTemplate = (template: typeof PRESET_TEMPLATES[0]) => {
    setEditingRule(null);
    ruleForm.setFieldsValue({
      ...template,
      is_active: true,
    });
    setTemplateModalOpen(false);
    setRuleModalOpen(true);
    messageApi.info(`已加载模板: ${template.name}`);
  };

  const handleViewRule = (record: QualityRule) => {
    setSelectedRule(record);
    setDetailDrawerOpen(true);
  };

  // ---- Run checks ----
  const handleRunAllRules = () => {
    setScanLoading(true);
    messageApi.loading({ content: '正在执行全量质量检查...', key: 'scan', duration: 0 });
    setTimeout(() => {
      setRules(prev => prev.map(r => {
        if (!r.is_active) return r;
        const passed = Math.random() > 0.15;
        const total = Math.floor(Math.random() * 500 + 50);
        return {
          ...r,
          last_check_at: new Date().toLocaleString('zh-CN'),
          last_result: {
            passed,
            total,
            null_rate: passed ? Math.random() * 0.01 : Math.random() * 0.05 + 0.02,
            outlier_count: passed ? 0 : Math.floor(Math.random() * 3) + 1,
            match_rate: passed ? 0.95 + Math.random() * 0.05 : 0.85 + Math.random() * 0.10,
            deviation_pct: passed ? Math.random() * 0.15 : 0.35 + Math.random() * 0.20,
            message: passed ? '通过' : '超出阈值',
          },
        };
      }));
      messageApi.success({ content: `全量检查完成: ${rules.filter(r => r.is_active).length} 条规则已执行`, key: 'scan' });
      // Show notification if anomalies found
      const failCount = rules.filter(r => r.is_active).length - rules.filter(r => r.last_result?.passed !== false).length;
      if (failCount > 0) {
        notifApi.warning({
          message: '质量检查发现异常',
          description: `${failCount} 条规则未通过检查，请查看详情`,
          placement: 'topRight',
          duration: 5,
        });
      }
      setScanLoading(false);
    }, 2500);
  };

  const handleRunSingleRule = (id: string) => {
    messageApi.loading({ content: '正在执行检查...', key: `rule-${id}`, duration: 0 });
    setRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      const passed = Math.random() > 0.2;
      return {
        ...r,
        last_check_at: new Date().toLocaleString('zh-CN'),
        last_result: {
          passed,
          total: 100,
          null_rate: passed ? 0.003 : 0.025,
          outlier_count: passed ? 0 : 2,
          match_rate: passed ? 0.97 : 0.91,
          deviation_pct: passed ? 0.08 : 0.35,
          message: passed ? '通过' : '不通过',
        },
      };
    }));
    setTimeout(() => messageApi.success({ content: '检查完成', key: `rule-${id}` }), 1000);
  };

  // ---- Sync actions ----
  const handleSyncSource = (id: string) => {
    const src = syncSources.find(s => s.id === id);
    if (!src) return;
    setSyncSources(prev => prev.map(s => s.id === id ? { ...s, sync_status: 'syncing' } : s));
    messageApi.loading({ content: `正在触发 ${src.source_system} 手动同步...`, key: `sync-${id}`, duration: 0 });
    setTimeout(() => {
      setSyncSources(prev => prev.map(s => s.id === id ? {
        ...s,
        sync_status: 'online',
        last_sync_at: new Date().toLocaleString('zh-CN'),
        last_success_at: new Date().toLocaleString('zh-CN'),
        today_sync_count: s.today_sync_count + 1,
        error_message: null,
        is_connected: true,
        latency_ms: Math.floor(Math.random() * 40) + 5,
      } : s));
      messageApi.success({ content: `${src.source_system} 同步完成`, key: `sync-${id}` });
    }, 3000);
  };

  const handleMarkNotified = (changeId: string) => {
    setFieldChanges(prev => prev.map(c =>
      c.change_id === changeId ? { ...c, notified: true } : c
    ));
    messageApi.success('已标记为已通知');
  };

  const handleNotifyAll = () => {
    setFieldChanges(prev => prev.map(c => c.notified ? c : { ...c, notified: true }));
    messageApi.success('所有待通知变更已标记');
  };

  // ---- Report generation ----
  const handleGenerateReport = () => {
    setReportGenerating(true);
    messageApi.loading({ content: '正在生成月度数据质量健康报告...', key: 'gen-report', duration: 0 });
    setTimeout(() => {
      setReportGenerating(false);
      messageApi.success({
        content: '《数据质量健康报告》(2026年6月) 已生成! 综合得分: 94.5分',
        key: 'gen-report',
        duration: 4,
      });
      notifApi.success({
        message: '月度报告生成完毕',
        description: '2026年6月数据质量健康报告已生成，包含各部门/系统评分排名，可下载PDF或在线查看。',
        placement: 'topRight',
        duration: 6,
      });
    }, 3000);
  };

  // ---- Cross-system check ----
  const handleRunCrossCheck = (checkId: string) => {
    messageApi.loading({ content: '正在执行跨系统一致性校验...', key: `csc-${checkId}`, duration: 0 });
    setTimeout(() => {
      setCrossChecks(prev => prev.map(c => c.check_id === checkId ? {
        ...c,
        last_check_at: new Date().toLocaleString('zh-CN'),
        match_rate: c.match_rate! + (Math.random() * 2 - 1),
      } : c));
      messageApi.success({ content: '校验完成', key: `csc-${checkId}` });
    }, 1500);
  };

  // ---- Lineage trace ----
  const handleTraceLineage = useCallback((direction: 'upstream' | 'downstream') => {
    setTraceDirection(direction);
    if (traceNode) {
      const mockPath: LineageNode[] = direction === 'upstream'
        ? [
          { node: '审计报告.标准审计报告.§4.2 费用分析', relation: 'reference', transform: '报告引用审计底稿数据', system: '审计系统', level: 4 },
          { node: '审计底稿.费用审计底稿.s4_审计发现摘要', relation: 'reference', transform: '审计人员引用数据集市汇总数据', system: '审计系统', level: 3 },
          { node: '数据集市.dm_financial_audit.月度费用汇总', relation: 'aggregate', transform: '按部门/科目聚合月度费用', system: '金蝶ERP', level: 2 },
          { node: '数据仓库.dwd_voucher.total_amount', relation: 'transform', transform: 'ETL清洗: 空值填充/金额标准化/币种转换', system: '金蝶ERP', level: 1 },
          { node: '金蝶ERP.t_voucher.total_amount', relation: 'source', transform: '原始凭证合计金额 - 源单据: 记账凭证', system: '金蝶ERP', level: 0 },
        ]
        : [
          { node: '金蝶ERP.t_voucher.acct_code', relation: 'source', transform: '原始科目编码 - 源单据: 会计科目表', system: '金蝶ERP', level: 0 },
          { node: '数据仓库.dwd_voucher', relation: 'transform', transform: 'ETL清洗与标准化: 科目编码映射/辅助核算拆分', system: '金蝶ERP', level: 1 },
          { node: '数据仓库.dwd_balance', relation: 'derive', transform: '从凭证表计算科目余额', system: '金蝶ERP', level: 1 },
          { node: '数据集市.dm_financial_audit', relation: 'aggregate', transform: '按科目+部门+月度汇总', system: '金蝶ERP', level: 2 },
          { node: '风险预警.风险规则DQ-001~006', relation: 'reference', transform: '空值检测/异常值检测/一致性校验引用', system: '审计系统', level: 3 },
          { node: '审计底稿.费用/采购/资金审计底稿', relation: 'reference', transform: '底稿数据引用', system: '审计系统', level: 3 },
          { node: '智能查询.模板T001~T005', relation: 'reference', transform: 'NL2SQL查询模板引用', system: '审计系统', level: 3 },
        ];
      setTraceResult({ root: traceNode, direction, path: mockPath, depth: mockPath.length });
    }
    setLineageDrawerOpen(true);
  }, [traceNode]);

  // ---- Columns ----
  const ruleColumns: ColumnsType<QualityRule> = [
    { title: '编号', dataIndex: 'rule_id', width: 95, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    {
      title: '规则名称', dataIndex: 'name', width: 180, ellipsis: true,
      render: (text, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{r.source_system}.{r.table_name}.{r.field_name}</div>
        </div>
      ),
    },
    {
      title: '规则类型', dataIndex: 'rule_type', width: 100,
      render: (v: string) => <Tag color={ruleTypeColors[v]}>{ruleTypeLabels[v] || v}</Tag>,
      filters: Object.entries(ruleTypeLabels).map(([v, l]) => ({ text: l, value: v })),
      onFilter: (val, r) => r.rule_type === val,
    },
    {
      title: '严重级别', dataIndex: 'severity', width: 80,
      render: (v: string) => {
        const { color, label } = severityLabels[v] || severityLabels.info;
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: '阈值', dataIndex: 'threshold', width: 95, render: (v: number, r) => {
        if (r.rule_type === 'null_rate' || r.rule_type === 'volatility') return `${(v * 100).toFixed(1)}%`;
        if (r.rule_type === 'outlier') return `±${v}σ`;
        if (r.rule_type === 'consistency' || r.rule_type === 'completeness') return `${(v * 100).toFixed(0)}%`;
        return v;
      },
    },
    {
      title: '上次检查', dataIndex: 'last_check_at', width: 150,
      render: (v: string | null, r) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontSize: 13 }}>{v || '未执行'}</span>
          {r.last_result && (
            <Tag color={r.last_result.passed ? 'success' : 'error'} style={{ fontSize: 11 }}>
              {r.last_result.passed ? '✓ 通过' : '✗ 异常'}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '状态', dataIndex: 'is_active', width: 75,
      render: (v: boolean, r) => (
        <Switch size="small" checked={v} checkedChildren="启" unCheckedChildren="停"
          onChange={(c) => handleToggleRule(r.id, c)} />
      ),
    },
    {
      title: '操作', width: 210, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => handleViewRule(r)}>详情</Button>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEditRule(r)}>编辑</Button>
          <Button size="small" type="link" icon={<PlayCircleOutlined />}
            onClick={() => handleRunSingleRule(r.id)}>执行</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDeleteRule(r.id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const syncColumns: ColumnsType<SyncSource> = [
    {
      title: '源系统', dataIndex: 'source_system', width: 110,
      render: (v, r) => (
        <Space>
          <span className={`dq-status-dot ${r.sync_status}`} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: '状态', dataIndex: 'sync_status', width: 80,
      render: (s: string) => <Tag color={syncStatusMap[s]?.color}>{syncStatusMap[s]?.label}</Tag>,
    },
    {
      title: '延迟', dataIndex: 'latency_ms', width: 80,
      render: (v: number, r) => {
        if (v < 0) return <Tag color="error">断连</Tag>;
        if (r.sync_status === 'error') {
          const delayMin = r.last_sync_at ? Math.round((Date.now() - new Date(r.last_sync_at).getTime()) / 60000) : 0;
          return <span className={`dq-delay-indicator ${delayMin > 30 ? 'delayed' : 'warning-level'}`}>
            <ClockCircleOutlined /> {delayMin}分钟
          </span>;
        }
        return <span className={v > 60 ? 'dq-delay-indicator warning-level' : 'dq-delay-indicator normal'}>
          {v}ms
        </span>;
      },
    },
    { title: '最近同步', dataIndex: 'last_sync_at', width: 155, render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
    {
      title: '同步频率', dataIndex: 'sync_interval_minutes', width: 90,
      render: (v: number) => v >= 1440 ? '每日' : v >= 60 ? `每${v / 60}小时` : `每${v}分钟`,
    },
    {
      title: '今日同步/失败', key: 'today', width: 120,
      render: (_, r) => <span>{r.today_sync_count} <Text type="danger">/ {r.today_fail_count}</Text></span>,
    },
    {
      title: '失败率', dataIndex: 'fail_rate', width: 75,
      render: (v: number) => <span style={{ color: v > 5 ? '#f5222d' : v > 0 ? '#fa8c16' : '#52c41a', fontWeight: v > 0 ? 600 : 400 }}>{v}%</span>,
    },
    { title: '总记录', dataIndex: 'records_synced', width: 100, render: (v: number) => v.toLocaleString() },
    {
      title: '数据波动', dataIndex: 'record_volume_change_pct', width: 90,
      render: (v: number | undefined) => v !== undefined ? (
        <span style={{ color: Math.abs(v) > 10 ? '#f5222d' : Math.abs(v) > 5 ? '#fa8c16' : '#1890ff', fontWeight: Math.abs(v) > 5 ? 600 : 400 }}>
          {v > 0 ? <RiseOutlined /> : <FallOutlined />} {Math.abs(v).toFixed(1)}%
        </span>
      ) : '-',
    },
    {
      title: '操作', width: 120, render: (_, r) => (
        <Space size="small">
          {r.sync_status === 'error' ? (
            <Button size="small" type="primary" danger icon={<ReloadOutlined />}
              onClick={() => handleSyncSource(r.id)}>重试</Button>
          ) : (
            <Button size="small" icon={<SyncOutlined spin={r.sync_status === 'syncing'} />}
              onClick={() => handleSyncSource(r.id)}
              disabled={r.sync_status === 'syncing'}>同步</Button>
          )}
        </Space>
      ),
    },
  ];

  const crossCheckColumns: ColumnsType<CrossSystemCheck> = [
    { title: '编号', dataIndex: 'check_id', width: 95, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    {
      title: '检查名称', dataIndex: 'name', width: 200,
      render: (text, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 11, color: '#999', lineHeight: 1.3 }}>{r.description}</div>
        </div>
      ),
    },
    {
      title: '源系统A', key: 'source', width: 160,
      render: (_, r) => <span><Tag color="blue">{r.source_system}</Tag> {r.source_table}.{r.source_field}</span>,
    },
    {
      title: '源系统B', key: 'target', width: 160,
      render: (_, r) => <span><Tag color="purple">{r.target_system}</Tag> {r.target_table}.{r.target_field}</span>,
    },
    {
      title: '一致率', dataIndex: 'match_rate', width: 140,
      render: (v: number) => (
        <Progress percent={Number(v?.toFixed(1))} size="small"
          strokeColor={v! >= 95 ? '#52c41a' : v! >= 90 ? '#fa8c16' : '#f5222d'}
          format={p => `${p?.toFixed(1)}%`} />
      ),
    },
    {
      title: '比较/一致/不一致', key: 'stats', width: 150,
      render: (_, r) => <span style={{ fontSize: 13 }}>
        {r.total_compared?.toLocaleString()} / <Text type="success">{r.matched?.toLocaleString()}</Text> / <Text type="danger">{r.mismatched?.toLocaleString()}</Text>
      </span>,
    },
    { title: '上次检查', dataIndex: 'last_check_at', width: 150, render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
    {
      title: '操作', width: 80, render: (_, r) => (
        <Button size="small" type="primary" icon={<SwapOutlined />}
          onClick={() => handleRunCrossCheck(r.check_id)}>校验</Button>
      ),
    },
  ];

  const snapshotColumns = [
    { title: '快照编号', dataIndex: 'snapshot_id', width: 170, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: '源系统', dataIndex: 'source_system', width: 90 },
    { title: '表名', dataIndex: 'table_name', width: 110 },
    { title: '记录数', dataIndex: 'records_count', width: 90, render: (v: number) => v.toLocaleString() },
    {
      title: '模式', dataIndex: 'sync_mode', width: 75,
      render: (v: string) => <Tag color={v === 'full' ? 'blue' : 'green'}>{v === 'full' ? '全量' : '增量'}</Tag>,
    },
    { title: '完成时间', dataIndex: 'sync_finished_at', width: 170 },
    { title: '耗时', dataIndex: 'duration_seconds', width: 70, render: (v: number) => `${v}s` },
    {
      title: '与上次差异', key: 'diff', width: 150,
      render: (_: any, r: any) => r.diff_summary ? (
        <span>
          {r.diff_summary.change_count > 0
            ? <RiseOutlined style={{ color: '#fa8c16' }} />
            : <FallOutlined style={{ color: '#52c41a' }} />
          }
          {' '}{r.diff_summary.change_count.toLocaleString()} 条 ({r.diff_summary.change_pct}%)
        </span>
      ) : r.error_message ? <Tag color="error">失败</Tag> : '-',
    },
    {
      title: '状态', key: 'status', width: 70,
      render: (_: any, r: any) => (
        <Space>
          <Tag color={r.is_success ? 'success' : 'error'}>{r.is_success ? '成功' : '失败'}</Tag>
          {r.can_rollback && r.is_success && <Tooltip title="支持回滚"><HistoryOutlined style={{ color: '#1890ff' }} /></Tooltip>}
        </Space>
      ),
    },
  ];

  const fieldChangeColumns: ColumnsType<FieldChange> = [
    { title: '编号', dataIndex: 'change_id', width: 95, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    {
      title: '变更字段', key: 'field', width: 200,
      render: (_, r) => <span style={{ fontSize: 12 }}>{r.source_system}.{r.table_name}.<Text style={{ color: '#D7011D', fontWeight: 500 }}>{r.field_name}</Text></span>,
    },
    {
      title: '变更类型', dataIndex: 'change_type', width: 75,
      render: (v: string) => <Tag color={changeTypeLabels[v]?.color}>{changeTypeLabels[v]?.label}</Tag>,
    },
    { title: '变更描述', dataIndex: 'change_description', width: 230, ellipsis: true, render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
    {
      title: '影响级别', dataIndex: 'impact_level', width: 80,
      render: (v: string) => (
        <Tag color={v === 'high' ? 'red' : v === 'medium' ? 'orange' : 'green'}>
          {v === 'high' ? '高' : v === 'medium' ? '中' : '低'}
        </Tag>
      ),
    },
    {
      title: '影响下游', dataIndex: 'impacted_downstream', width: 180, ellipsis: true,
      render: (v: string[]) => <span style={{ fontSize: 11 }}>{v?.join(', ') || '-'}</span>,
    },
    {
      title: '状态', dataIndex: 'notified', width: 90,
      render: (v: boolean) => v
        ? <Tag color="success" icon={<CheckCircleOutlined />}>已通知</Tag>
        : <Badge status="processing" text={<span style={{ color: '#fa8c16' }}>待通知</span>} />,
    },
    { title: '变更时间', dataIndex: 'changed_at', width: 150, render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
    {
      title: '操作', width: 100, render: (_, r) => !r.notified ? (
        <Button size="small" type="primary" ghost icon={<BellOutlined />}
          onClick={() => handleMarkNotified(r.change_id)}>标记通知</Button>
      ) : <Text type="secondary" style={{ fontSize: 12 }}>已完成</Text>,
    },
  ];

  // ---- ECharts Options ----
  const gaugeOption = useMemo(() => ({
    series: [{
      type: 'gauge', radius: '88%', center: ['50%', '58%'],
      startAngle: 210, endAngle: -30,
      min: 0, max: 100,
      progress: {
        show: true, width: 16,
        itemStyle: { color: stats.qualityScore >= 95 ? '#52c41a' : stats.qualityScore >= 80 ? '#fa8c16' : '#f5222d' },
      },
      axisLine: { lineStyle: { width: 16, color: [[0.6, '#f5222d'], [0.8, '#fa8c16'], [0.95, '#52c41a'], [1, '#52c41a']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      detail: { valueAnimation: true, fontSize: 28, fontWeight: 700, formatter: '{value}%', offsetCenter: [0, '78%'], color: '#262626' },
      data: [{ value: stats.qualityScore, name: '综合质量评分' }],
    }],
  }), [stats.qualityScore]);

  const systemBarOption = useMemo(() => {
    const systems = ['金蝶ERP', '云之家OA', 'CRM', 'SRM', 'WMS', 'QMS', 'PLM'];
    const rates = systems.map(sys => {
      const sysRules = rules.filter(r => r.source_system === sys);
      if (!sysRules.length) return 100;
      return Number((sysRules.filter(r => r.last_result?.passed !== false).length / sysRules.length * 100).toFixed(1));
    });
    return {
      tooltip: { trigger: 'axis', formatter: '{b}: {c}%' },
      grid: { left: 50, right: 20, top: 10, bottom: 24 },
      xAxis: { type: 'category', data: systems, axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', name: '通过率%', min: 0, max: 100 },
      series: [{
        type: 'bar', data: rates, barMaxWidth: 30,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: (p: any) => p.value >= 95 ? '#52c41a' : p.value >= 80 ? '#fa8c16' : '#f5222d',
        },
        label: { show: true, position: 'top', fontSize: 11, formatter: '{c}%' },
      }],
    };
  }, [rules]);

  const ruleTypePieOption = useMemo(() => {
    const dist: Record<string, number> = {};
    rules.forEach(r => { dist[r.rule_type] = (dist[r.rule_type] || 0) + 1; });
    const data = Object.entries(dist).map(([k, v]) => ({ value: v, name: ruleTypeLabels[k] || k, itemStyle: { color: ruleTypeColors[k] } }));
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} 条 ({d}%)' },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['45%', '72%'], center: ['50%', '45%'],
        data, label: { formatter: '{b}\n{c} 条', fontSize: 11 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
      }],
    };
  }, [rules]);

  const checkTrendOption = useMemo(() => {
    const months = ['1月', '2月', '3月', '4月', '5月', '6月'];
    const passed = [92, 94, 93, 95, 94, stats.qualityScore];
    const failed = months.map((_, i) => 100 - passed[i]);
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, data: ['通过率', '异常率'], textStyle: { fontSize: 11 } },
      grid: { left: 50, right: 20, top: 16, bottom: 30 },
      xAxis: { type: 'category', data: months, boundaryGap: false },
      yAxis: { type: 'value', name: '%', min: 0, max: 100 },
      series: [
        { name: '通过率', type: 'line', smooth: true, data: passed, lineStyle: { color: '#52c41a', width: 3 }, itemStyle: { color: '#52c41a' }, areaStyle: { color: 'rgba(82,196,26,0.08)' } },
        { name: '异常率', type: 'line', smooth: true, data: failed, lineStyle: { color: '#f5222d', width: 2, type: 'dashed' }, itemStyle: { color: '#f5222d' } },
      ],
    };
  }, [stats.qualityScore]);

  // ---- Render Tab Content ----

  const renderDashboard = () => (
    <div>
      <div className="dq-filter-bar">
        <div className="filter-left">
          <FilterBar
            orgValue={filterOrg} onOrgChange={setFilterOrg}
            dateStart={filterDateStart} dateEnd={filterDateEnd}
            onDateStartChange={setFilterDateStart} onDateEndChange={setFilterDateEnd}
            onRefresh={() => messageApi.info('仪表盘数据已刷新')}
            onExport={() => messageApi.info('正在导出数据质量报告...')}
          />
        </div>
        <div className="filter-right">
          <Button type="primary" icon={<ThunderboltOutlined />} loading={scanLoading}
            onClick={handleRunAllRules} style={{ background: '#D7011D', borderColor: '#D7011D' }}>
            一键全部检查
          </Button>
        </div>
      </div>

      {/* 异常告警条 */}
      {anomalyAlerts.filter(a => a.severity === 'critical').length > 0 && (
        <div className="dq-alert-strip">
          <Alert
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message={
              <span>
                发现 <Text strong style={{ color: '#f5222d' }}>{anomalyAlerts.filter(a => a.severity === 'critical').length}</Text> 项严重数据质量问题
                {stats.errorSources > 0 && <span>，<Text strong style={{ color: '#f5222d' }}>{stats.errorSources}</Text> 个源系统同步异常</span>}
                {stats.delayedSources > 0 && <span>，<Text strong style={{ color: '#fa8c16' }}>{stats.delayedSources}</Text> 个源系统同步延迟超30分钟</span>}
                ，请及时处理
              </span>
            }
            action={<Button size="small" type="primary" danger onClick={handleRunAllRules}>立即复检</Button>}
          />
        </div>
      )}
      {anomalyAlerts.length > 0 && anomalyAlerts.filter(a => a.severity === 'critical').length === 0 && (
        <div className="dq-alert-strip">
          <Alert
            type="warning"
            showIcon
            message={
              <span>
                发现 <Text strong style={{ color: '#fa8c16' }}>{anomalyAlerts.length}</Text> 项数据质量警告
                {stats.delayedSources > 0 && <span>，<Text strong style={{ color: '#fa8c16' }}>{stats.delayedSources}</Text> 个源系统同步延迟超30分钟</span>}
                ，建议关注
              </span>
            }
          />
        </div>
      )}

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6} xl={4}>
          <Card className="dq-stat-card" size="small" hoverable>
            <Statistic title="数据质量评分" value={stats.qualityScore} suffix="分"
              prefix={<SafetyCertificateOutlined style={{ color: '#D7011D' }} />}
              valueStyle={{ color: stats.qualityScore >= 90 ? '#52c41a' : '#fa8c16', fontSize: 28, fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6} xl={4}>
          <Card className="dq-stat-card" size="small" hoverable>
            <Statistic title="启用规则" value={stats.activeRules} suffix={`/ ${stats.totalRules}`}
              prefix={<SettingOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: 28, fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6} xl={4}>
          <Card className="dq-stat-card" size="small" hoverable>
            <Statistic title="异常规则/告警" value={`${stats.failedRules}/${anomalyAlerts.length}`}
              prefix={<WarningOutlined />}
              valueStyle={{ color: stats.failedRules > 0 ? '#fa8c16' : '#52c41a', fontSize: 28, fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6} xl={4}>
          <Card className="dq-stat-card" size="small" hoverable>
            <Statistic title="源系统在线" value={`${stats.onlineSources}/${stats.totalSources}`}
              prefix={<CloudSyncOutlined />}
              valueStyle={{ color: stats.errorSources > 0 ? '#fa8c16' : '#52c41a', fontSize: 28, fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6} xl={4}>
          <Card className="dq-stat-card" size="small" hoverable>
            <Statistic title="今日同步" value={stats.todayTotalSync.toLocaleString()}
              prefix={<SyncOutlined />}
              valueStyle={{ fontSize: 28, fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6} xl={4}>
          <Card className="dq-stat-card" size="small" hoverable>
            <Statistic title="待处理变更" value={stats.pendingChanges}
              prefix={<BellOutlined />}
              valueStyle={{ color: stats.pendingChanges > 0 ? '#f5222d' : '#52c41a', fontSize: 28, fontWeight: 700 }} />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="dq-chart-card" size="small" title="综合质量评分" style={{ textAlign: 'center' }}>
            <ReactEChartsCore echarts={echarts} option={gaugeOption} style={{ height: 220 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="dq-chart-card" size="small" title="各系统通过率">
            <ReactEChartsCore echarts={echarts} option={systemBarOption} style={{ height: 220 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="dq-chart-card" size="small" title="规则类型分布">
            <ReactEChartsCore echarts={echarts} option={ruleTypePieOption} style={{ height: 220 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card className="dq-chart-card" size="small" title="近6月质量趋势" extra={<Tag color="blue">月度跟踪</Tag>}>
            <ReactEChartsCore echarts={echarts} option={checkTrendOption} style={{ height: 260 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card className="dq-chart-card" size="small" title={
            <Space>
              <span>数据异常告警</span>
              <Badge count={anomalyAlerts.length} size="small" style={{ backgroundColor: anomalyAlerts.filter(a => a.severity === 'critical').length > 0 ? '#f5222d' : '#fa8c16' }} />
            </Space>
          }>
            {anomalyAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#52c41a' }}>
                <CheckCircleOutlined style={{ fontSize: 48 }} />
                <p style={{ marginTop: 12, fontSize: 15, fontWeight: 500 }}>所有指标正常，暂无异常告警</p>
              </div>
            ) : (
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                <div className="dq-anomaly-list">
                  {anomalyAlerts.slice(0, 8).map(alert => (
                    <div key={alert.id} className={`dq-anomaly-item ${alert.severity}`}>
                      <div className="anomaly-info">
                        <div className="anomaly-title">
                          <Tag color={alert.severity === 'critical' ? 'red' : 'orange'} style={{ fontSize: 10, marginRight: 6 }}>
                            {alert.alert_type}
                          </Tag>
                          {alert.rule_name}
                        </div>
                        <div className="anomaly-detail">{alert.detail}</div>
                      </div>
                      <div className="anomaly-value">
                        <div className="value-bold">
                          {alert.alert_type === '3σ异常值' ? `¥${(alert.current_value / 10000).toFixed(1)}万` :
                           alert.alert_type === '一致性异常' ? `${alert.current_value.toFixed(1)}%` :
                           alert.alert_type === '延迟超30分钟' ? `${alert.current_value}分钟` : '-'}
                        </div>
                        {alert.alert_type === '3σ异常值' && <Tag color="error" className="value-tag">偏离{alert.deviation_pct.toFixed(0)}%</Tag>}
                      </div>
                    </div>
                  ))}
                  {anomalyAlerts.length > 8 && (
                    <div style={{ textAlign: 'center', padding: 8, color: '#999', fontSize: 12 }}>
                      还有 {anomalyAlerts.length - 8} 条告警...
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 最近检查结果 + 同步健康 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card className="dq-section-card" size="small" title="最近质量检查结果">
            <Table columns={[
              { title: '规则', dataIndex: 'name', key: 'name', width: 190, render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text> },
              { title: '目标', key: 'target', width: 180, render: (_, r: QualityRule) => <code style={{ fontSize: 11 }}>{r.source_system}.{r.table_name}.{r.field_name}</code> },
              { title: '类型', dataIndex: 'rule_type', width: 90, render: (v: string) => <Tag color={ruleTypeColors[v]} style={{ fontSize: 11 }}>{ruleTypeLabels[v]}</Tag> },
              { title: '结果', key: 'result', width: 70, render: (_, r) => r.last_result
                ? <Tag color={r.last_result.passed ? 'success' : 'error'}>{r.last_result.passed ? '通过' : '异常'}</Tag>
                : <Tag color="default">未执行</Tag>
              },
              { title: '检查时间', dataIndex: 'last_check_at', width: 150, render: (v: string | null) => v ? <span style={{ fontSize: 12 }}>{v}</span> : '-' },
              { title: '详情', key: 'detail', render: (_, r) => r.last_result ? (
                <span style={{ fontSize: 12, color: '#666' }}>
                  {r.rule_type === 'null_rate' && `空值率: ${((r.last_result.null_rate || 0) * 100).toFixed(2)}% (阈值≤${((r.threshold || 0) * 100).toFixed(1)}%)`}
                  {r.rule_type === 'outlier' && `异常值: ${r.last_result.outlier_count || 0}个 / ${r.last_result.total?.toLocaleString() || 0}条`}
                  {r.rule_type === 'volatility' && `偏差: ${((r.last_result.deviation_pct || 0) * 100).toFixed(1)}% (阈值≤${((r.threshold || 0) * 100).toFixed(0)}%)`}
                  {r.rule_type === 'consistency' && `一致率: ${((r.last_result.match_rate || 0) * 100).toFixed(1)}% (阈值≥${((r.threshold || 0) * 100).toFixed(0)}%)`}
                  {r.rule_type === 'completeness' && `完整率: ${((r.last_result.completeness_rate || 0) * 100).toFixed(1)}%`}
                </span>
              ) : '-'},
            ]} dataSource={rules.filter(r => r.last_result)} rowKey="id" pagination={{ pageSize: 5 }} size="small" />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card className="dq-section-card" size="small" title="同步健康概览"
            extra={<Tag color={stats.errorSources > 0 ? 'error' : stats.delayedSources > 0 ? 'warning' : 'success'}>
              {stats.errorSources > 0 ? '有异常' : stats.delayedSources > 0 ? '有延迟' : '全部正常'}
            </Tag>}>
            <Row gutter={[16, 16]} style={{ padding: '4px 0' }}>
              <Col span={6}><Statistic title="在线" value={stats.onlineSources} valueStyle={{ color: '#52c41a', fontSize: 24, fontWeight: 600 }} /></Col>
              <Col span={6}><Statistic title="同步中" value={stats.syncingSources} valueStyle={{ color: '#1890ff', fontSize: 24, fontWeight: 600 }} /></Col>
              <Col span={6}><Statistic title="延迟源" value={stats.delayedSources} valueStyle={{ color: stats.delayedSources > 0 ? '#fa8c16' : '#52c41a', fontSize: 24, fontWeight: 600 }} /></Col>
              <Col span={6}><Statistic title="异常源" value={stats.errorSources} valueStyle={{ color: stats.errorSources > 0 ? '#f5222d' : '#52c41a', fontSize: 24, fontWeight: 600 }} /></Col>
            </Row>
            <Divider style={{ margin: '10px 0' }} />
            <div>
              {syncSources.filter(s => s.sync_status === 'error').map(s => (
                <Alert key={s.id} type="error" showIcon
                  message={<span>{s.source_system} 同步中断 <Text type="danger">(超30分钟)</Text></span>}
                  description={s.error_message}
                  style={{ marginBottom: 8, borderRadius: 6 }}
                  action={<Button size="small" danger onClick={() => handleSyncSource(s.id)}>重试同步</Button>}
                />
              ))}
              {syncSources.filter(s => {
                if (s.sync_status === 'error' || !s.last_sync_at) return false;
                return (Date.now() - new Date(s.last_sync_at).getTime()) / 60000 > 30;
              }).map(s => {
                const delayMin = Math.round((Date.now() - new Date(s.last_sync_at).getTime()) / 60000);
                return (
                  <Alert key={`delay-${s.id}`} type="warning" showIcon
                    message={<span>{s.source_system} 同步延迟 <Text type="warning">{delayMin}分钟</Text> (阈值: 30分钟)</span>}
                    description={`上次成功同步: ${s.last_sync_at}`}
                    style={{ marginBottom: 8, borderRadius: 6 }}
                  />
                );
              })}
              {stats.errorSources === 0 && stats.delayedSources === 0 && (
                <div style={{ textAlign: 'center', padding: 24, color: '#52c41a' }}>
                  <CheckCircleOutlined style={{ fontSize: 32 }} />
                  <p style={{ marginTop: 8, fontSize: 14 }}>所有源系统同步正常</p>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderRules = () => (
    <div>
      <div className="dq-filter-bar">
        <div className="filter-left">
          <Input.Search placeholder="搜索规则名称/描述..." allowClear style={{ width: 260 }} prefix={<SearchOutlined />} />
          <Select placeholder="规则类型" allowClear style={{ width: 140 }}
            options={Object.entries(ruleTypeLabels).map(([v, l]) => ({ value: v, label: l }))} />
          <Select placeholder="源系统" allowClear style={{ width: 130 }}
            options={['金蝶ERP', '云之家OA', 'CRM', 'SRM', 'WMS', 'QMS', 'PLM'].map(s => ({ value: s, label: s }))} />
          <Select placeholder="严重级别" allowClear style={{ width: 110 }}
            options={Object.entries(severityLabels).map(([v, { label }]) => ({ value: v, label }))} />
        </div>
        <div className="filter-right">
          <Button icon={<ReloadOutlined />} onClick={() => messageApi.info('已刷新')}>刷新</Button>
          <Button icon={<ImportOutlined />} onClick={() => setTemplateModalOpen(true)}>从模板创建</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRule}
            style={{ background: '#D7011D', borderColor: '#D7011D' }}>新建规则</Button>
        </div>
      </div>
      <Card className="dq-section-card" size="small" bodyStyle={{ padding: 0 }}>
        <Table columns={ruleColumns} dataSource={rules} rowKey="id" loading={loading}
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条规则` }}
          scroll={{ x: 1350 }} size="middle" />
      </Card>

      {/* Template Selection Modal */}
      <Modal title="从预设模板创建规则" open={templateModalOpen}
        onCancel={() => setTemplateModalOpen(false)} footer={null} width={700}>
        <Table columns={[
          { title: '编号', dataIndex: 'rule_id', width: 85, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
          { title: '规则名称', dataIndex: 'name', width: 180 },
          { title: '类型', dataIndex: 'rule_type', width: 90, render: (v: string) => <Tag color={ruleTypeColors[v]}>{ruleTypeLabels[v]}</Tag> },
          { title: '源系统', dataIndex: 'source_system', width: 90 },
          { title: '描述', dataIndex: 'description', ellipsis: true },
          { title: '操作', width: 80, render: (_, r) => (
            <Button size="small" type="primary" icon={<ImportOutlined />}
              onClick={() => handleLoadFromTemplate(r)}>加载</Button>
          )},
        ]} dataSource={PRESET_TEMPLATES} rowKey="rule_id" pagination={false} size="small" />
      </Modal>
    </div>
  );

  const renderConsistency = () => (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card className="dq-stat-card" size="small"><Statistic title="检查项总数" value={crossChecks.length} prefix={<SwapOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card className="dq-stat-card" size="small"><Statistic title="一致率≥95%" value={crossChecks.filter(c => (c.match_rate || 0) >= 95).length} valueStyle={{ color: '#52c41a', fontSize: 24 }} /></Card></Col>
        <Col xs={12} sm={6}><Card className="dq-stat-card" size="small"><Statistic title="一致率90-95%" value={crossChecks.filter(c => (c.match_rate || 0) >= 90 && (c.match_rate || 0) < 95).length} valueStyle={{ color: '#fa8c16', fontSize: 24 }} /></Card></Col>
        <Col xs={12} sm={6}><Card className="dq-stat-card" size="small"><Statistic title="一致率<90%" value={crossChecks.filter(c => (c.match_rate || 0) < 90).length} valueStyle={{ color: '#f5222d', fontSize: 24 }} /></Card></Col>
      </Row>

      <Card className="dq-section-card" size="small" title={<><SwapOutlined /> 跨系统一致性校验</>}
        extra={<Button type="primary" size="small" icon={<PlayCircleOutlined />}
          onClick={() => {
            crossChecks.forEach(c => handleRunCrossCheck(c.check_id));
            messageApi.success('批量校验已触发');
          }}>一键校验全部</Button>}>
        <Table columns={crossCheckColumns} dataSource={crossChecks} rowKey="check_id" pagination={false} size="middle" />
      </Card>

      <Card className="dq-section-card" size="small" title={<><WarningOutlined /> 不一致明细 (最近)</>} style={{ marginTop: 16 }}>
        <Table columns={[
          { title: '检查项', dataIndex: 'check_name', width: 200, render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text> },
          { title: '关联键', dataIndex: 'match_key_val', width: 130, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
          { title: '系统A值', dataIndex: 'source_val', width: 160 },
          { title: '系统B值', dataIndex: 'target_val', width: 160 },
          { title: '差异', dataIndex: 'diff_type', width: 110, render: (v: string) => <Tag color="orange">{v}</Tag> },
          { title: '建议', key: 'suggestion', width: 180, render: () => <Text type="secondary" style={{ fontSize: 12 }}>需人工核实差异原因</Text> },
        ]} dataSource={[
          { check_name: 'ERP-SRM供应商名称一致性', match_key_val: 'SUP-0047', source_val: '深圳华强电子有限公司', target_val: '深圳华强电子', diff_type: '名称不完整', suggestion: '核实工商注册全称' },
          { check_name: 'ERP-SRM供应商名称一致性', match_key_val: 'SUP-0048', source_val: '华强电子', target_val: '深圳市华强电子有限公司', diff_type: '名称不完整', suggestion: '以工商注册名为准' },
          { check_name: 'ERP-SRM供应商信用等级', match_key_val: 'SUP-0023', source_val: 'A', target_val: 'B', diff_type: '等级不一致', suggestion: '确认最近一次评级时间' },
          { check_name: 'ERP-SRM供应商信用等级', match_key_val: 'SUP-0056', source_val: 'B', target_val: 'A', diff_type: '等级不一致', suggestion: 'ERP与SRM评级周期不同' },
          { check_name: 'ERP-CRM合同金额', match_key_val: 'CT-20260056', source_val: '¥285,000.00', target_val: '¥258,000.00', diff_type: '金额不一致(差¥27,000)', suggestion: '检查是否含税差异' },
          { check_name: 'ERP-CRM合同日期', match_key_val: 'CT-20260089', source_val: '2026-03-15', target_val: '2026-03-20', diff_type: '日期偏差(5天)', suggestion: '确认合同签署日期' },
        ]} rowKey={(_, i) => String(i)} pagination={{ pageSize: 6 }} size="small" />
      </Card>
    </div>
  );

  const renderSync = () => (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={4}><Card className="dq-stat-card" size="small"><Statistic title="数据源总数" value={stats.totalSources} prefix={<DatabaseOutlined />} /></Card></Col>
        <Col xs={12} sm={4}><Card className="dq-stat-card" size="small"><Statistic title="在线" value={stats.onlineSources} valueStyle={{ color: '#52c41a', fontSize: 24 }} /></Card></Col>
        <Col xs={12} sm={4}><Card className="dq-stat-card" size="small"><Statistic title="同步中" value={stats.syncingSources} valueStyle={{ color: '#1890ff', fontSize: 24 }} /></Card></Col>
        <Col xs={12} sm={4}><Card className="dq-stat-card" size="small"><Statistic title="异常" value={stats.errorSources} valueStyle={{ color: stats.errorSources > 0 ? '#f5222d' : '#52c41a', fontSize: 24 }} /></Card></Col>
        <Col xs={12} sm={4}><Card className="dq-stat-card" size="small"><Statistic title="今日总同步" value={stats.todayTotalSync.toLocaleString()} valueStyle={{ fontSize: 24 }} /></Card></Col>
        <Col xs={12} sm={4}><Card className="dq-stat-card" size="small"><Statistic title="今日失败" value={stats.todayTotalFail} valueStyle={{ color: stats.todayTotalFail > 0 ? '#f5222d' : '#52c41a', fontSize: 24 }} /></Card></Col>
      </Row>

      {/* 延迟告警 */}
      {stats.delayedSources > 0 && (
        <Alert type="warning" showIcon
          message={<><ClockCircleOutlined /> 同步延迟告警: <Text strong>{stats.delayedSources}</Text> 个源系统延迟超过30分钟 (需求文档3.3)</>}
          description="根据数据治理规范，延迟超过30分钟后将自动推送钉钉/企业微信告警通知"
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      <Card className="dq-section-card" size="small" title={<><CloudSyncOutlined /> 数据源同步状态</>}
        extra={<Text type="secondary" style={{ fontSize: 12 }}>按需求文档3.3: 同步延迟/失败率/数据量波动监控</Text>}>
        <Table columns={syncColumns} dataSource={syncSources} rowKey="id" pagination={false}
          scroll={{ x: 1450 }} size="middle" />
      </Card>

      <Card className="dq-section-card" size="small" title={<><HistoryOutlined /> 同步快照记录</>}
        extra={<Text type="secondary" style={{ fontSize: 12 }}>支持按时间点回滚和比对</Text>}
        style={{ marginTop: 16 }}>
        <Table columns={snapshotColumns} dataSource={mockSnapshots} rowKey="snapshot_id"
          pagination={false} size="middle" />
      </Card>
    </div>
  );

  const renderLineage = () => (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card className="dq-stat-card" size="small"><Statistic title="血缘节点" value={28} prefix={<NodeIndexOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card className="dq-stat-card" size="small"><Statistic title="血缘链路" value={12} prefix={<LinkOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card className="dq-stat-card" size="small"><Statistic title="待通知变更" value={stats.pendingChanges} prefix={<AlertOutlined />} valueStyle={{ color: stats.pendingChanges > 0 ? '#f5222d' : '#52c41a', fontSize: 24 }} /></Card></Col>
        <Col xs={12} sm={6}><Card className="dq-stat-card" size="small"><Statistic title="本月影响分析" value={7} prefix={<ThunderboltOutlined />} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card className="dq-section-card" size="small" title={<><ApartmentOutlined /> 数据血缘关系图 (全链路追溯)</>}
            extra={<Space size="small">
              <Input.Search placeholder="输入节点名称追溯..." allowClear style={{ width: 260 }}
                value={traceNode} onChange={e => setTraceNode(e.target.value)}
                onSearch={() => handleTraceLineage('upstream')}
                enterButton={<><LinkOutlined /> 溯源</>} />
              <Button size="small" icon={<NodeIndexOutlined />}
                onClick={() => handleTraceLineage('downstream')}>影响分析</Button>
            </Space>}>
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#e6f7ff', borderRadius: 6, border: '1px solid #91d5ff' }}>
              <Text style={{ fontSize: 13 }}>
                <Text strong>全链路溯源路径:</Text> 源系统源单据 → 数据仓库DWD层 → 数据集市DM层 → 审计底稿 → 审计报告/驾驶舱
              </Text>
            </div>
            <Tree showLine defaultExpandAll
              treeData={lineageTreeData}
              className="dq-lineage-tree"
              style={{ minHeight: 340 }} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card className="dq-section-card" size="small" title={<><ExclamationCircleOutlined /> 字段变更通知</>}
            extra={
              <Space size="small">
                <Badge count={stats.pendingChanges} size="small" />
                {stats.pendingChanges > 0 && (
                  <Button size="small" type="primary" ghost icon={<SendOutlined />}
                    onClick={handleNotifyAll}>全部标记</Button>
                )}
              </Space>
            }>
            <Table columns={fieldChangeColumns} dataSource={fieldChanges} rowKey="change_id"
              pagination={false} size="small" scroll={{ x: 1100 }} />
          </Card>
        </Col>
      </Row>

      {/* 变更影响分析 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card className="dq-section-card" size="small" title={<><ThunderboltOutlined /> 变更影响快速分析</>}
            extra={<Text type="secondary" style={{ fontSize: 12 }}>需求文档3.2: 任意节点变更→评估对下游审计模型影响</Text>}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <Input.Search placeholder="源系统 (如: 金蝶ERP)" style={{ width: 170 }} />
              <Input placeholder="表名 (如: t_voucher)" style={{ width: 150 }} />
              <Input placeholder="字段名 (如: acct_code)" style={{ width: 150 }} />
              <Button type="primary" icon={<SearchOutlined />}
                onClick={() => {
                  messageApi.info('已触发影响分析');
                  notifApi.info({
                    message: '影响分析完成',
                    description: '金蝶ERP.t_voucher.acct_code 变更将影响 8 个下游节点',
                    placement: 'topRight',
                  });
                }}>分析</Button>
            </div>
            <div className="dq-impact-panel high-impact">
              <div className="impact-header">
                <ExclamationCircleOutlined style={{ color: '#f5222d', fontSize: 18 }} />
                <span className="impact-title" style={{ color: '#f5222d' }}>示例: 金蝶ERP.t_voucher.acct_code 科目编码变更 (高风险)</span>
              </div>
              <div className="impact-detail">
                <p><Text strong>变更内容:</Text> 科目编码长度从 varchar(20) 扩展至 varchar(30)，新增辅助核算维度</p>
                <p><Text strong>变更时间:</Text> 2026-06-08 14:00 | <Text strong>变更人:</Text> ERP管理员-张工</p>
                <p><Text strong>直接影响 (2个):</Text> 数据仓库.dwd_voucher → 数据仓库.dwd_balance</p>
                <p><Text strong>间接影响 (6个):</Text> 数据集市.dm_financial_audit → 6条风险规则(DQ-001~DQ-006) → 5个智能查询模板(T001~T005)</p>
                <p><Text strong style={{ color: '#f5222d' }}>建议:</Text> 更新所有引用该字段的ETL转换逻辑、风险规则阈值、NL2SQL查询模板中的科目映射表</p>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderReports = () => (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card className="dq-stat-card" size="small"><Statistic title="本月综合评分" value={stats.qualityScore} suffix="分" valueStyle={{ color: '#D7011D', fontSize: 28, fontWeight: 700 }} /></Card></Col>
        <Col xs={12} sm={6}><Card className="dq-stat-card" size="small"><Statistic title="已检查规则" value={stats.totalRules} prefix={<CheckCircleOutlined />} valueStyle={{ fontSize: 24 }} /></Card></Col>
        <Col xs={12} sm={6}><Card className="dq-stat-card" size="small"><Statistic title="上月评分" value={91.5} suffix="分" valueStyle={{ color: '#52c41a', fontSize: 24 }} /></Card></Col>
        <Col xs={12} sm={6}><Card className="dq-stat-card" size="small"><Statistic title="环比变化" value={stats.qualityScore - 91.5} suffix="分" prefix={stats.qualityScore >= 91.5 ? <RiseOutlined /> : <FallOutlined />} valueStyle={{ color: stats.qualityScore >= 91.5 ? '#52c41a' : '#f5222d', fontSize: 24 }} /></Card></Col>
      </Row>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Space>
          <Text strong style={{ fontSize: 15 }}>《数据质量健康报告》- 2026年6月</Text>
          <Tag color="blue">需求文档3.1: 月度质量报告</Tag>
        </Space>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={() => messageApi.info('正在导出PDF...')}>导出PDF</Button>
          <Button type="primary" icon={<FileTextOutlined />} loading={reportGenerating}
            onClick={handleGenerateReport}
            style={{ background: '#D7011D', borderColor: '#D7011D' }}>
            生成月度报告
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="dq-section-card" size="small" title="各部门数据质量评分排名">
            <Table columns={[
              { title: '排名', key: 'rank', width: 60, render: (_, __, i) => <Tag color={i < 3 ? 'gold' : 'default'} style={{ fontWeight: 600 }}>{i + 1}</Tag> },
              { title: '部门', dataIndex: 'dept', width: 100, render: (v: string) => <Text strong>{v}</Text> },
              { title: '评分', dataIndex: 'score', width: 140,
                render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 95 ? '#52c41a' : v >= 85 ? '#fa8c16' : '#f5222d'} format={p => `${p}分`} />,
              },
              { title: '通过/总数', dataIndex: 'detail', width: 90 },
              { title: '异常项', dataIndex: 'issues', width: 70, render: (v: number) => <Tag color={v > 0 ? 'error' : 'success'}>{v}</Tag> },
              { title: '较上月', dataIndex: 'change', width: 80,
                render: (v: number) => <span style={{ color: v >= 0 ? '#52c41a' : '#f5222d', fontWeight: 500 }}>{v >= 0 ? <RiseOutlined /> : <FallOutlined />} {Math.abs(v)}</span>,
              },
            ]} dataSource={[
              { dept: '财务部', score: 96.5, detail: '30/31', issues: 1, change: 1.2 },
              { dept: '销售部', score: 94.2, detail: '19/20', issues: 1, change: -0.8 },
              { dept: '采购部', score: 92.8, detail: '24/26', issues: 2, change: 2.1 },
              { dept: '质量部', score: 95.0, detail: '11/11', issues: 0, change: 0.5 },
              { dept: '研发部', score: 95.0, detail: '10/10', issues: 0, change: 0 },
              { dept: '仓储部', score: 90.3, detail: '9/10', issues: 1, change: 0.5 },
              { dept: '行政部', score: 88.5, detail: '8/10', issues: 2, change: -1.5 },
            ]} rowKey="dept" pagination={false} size="small" />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="dq-section-card" size="small" title="各系统数据质量评分排名">
            <Table columns={[
              { title: '排名', key: 'rank', width: 60, render: (_, __, i) => <Tag color={i < 3 ? 'gold' : 'default'} style={{ fontWeight: 600 }}>{i + 1}</Tag> },
              { title: '系统', dataIndex: 'system', width: 110, render: (v: string) => <Text strong>{v}</Text> },
              { title: '评分', dataIndex: 'score', width: 140,
                render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 95 ? '#52c41a' : v >= 85 ? '#fa8c16' : '#f5222d'} format={p => `${p}分`} />,
              },
              { title: '通过/总数', dataIndex: 'detail', width: 90 },
              { title: '异常项', dataIndex: 'errors', width: 70, render: (v: number) => <Tag color={v > 0 ? 'error' : 'success'}>{v}</Tag> },
            ]} dataSource={[
              { system: '金蝶ERP', score: 95.8, detail: '19/20', errors: 1 },
              { system: '云之家OA', score: 98.2, detail: '5/5', errors: 0 },
              { system: 'CRM', score: 93.0, detail: '9/10', errors: 1 },
              { system: 'SRM', score: 88.5, detail: '6/7', errors: 1 },
              { system: 'WMS', score: 96.0, detail: '4/4', errors: 0 },
              { system: 'QMS', score: 97.0, detail: '6/6', errors: 0 },
              { system: 'PLM', score: 94.5, detail: '5/5', errors: 0 },
            ]} rowKey="system" pagination={false} size="small" />
          </Card>
        </Col>
      </Row>

      <Card className="dq-section-card" size="small" title="历史质量报告" style={{ marginTop: 16 }}
        extra={<Button size="small" icon={<DownloadOutlined />} onClick={() => messageApi.info('正在导出全部历史报告...')}>全部导出</Button>}>
        <Table columns={[
          { title: '报告月份', dataIndex: 'month', width: 110, render: (v: string) => <Text strong>{v}</Text> },
          { title: '综合评分', dataIndex: 'score', width: 140,
            render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 90 ? '#52c41a' : '#fa8c16'} format={p => `${p}分`} />,
          },
          { title: '检查规则', dataIndex: 'rules', width: 90 },
          { title: '通过率', dataIndex: 'pass_rate', width: 80, render: (v: number) => <span style={{ fontWeight: 500 }}>{v}%</span> },
          { title: '异常项', dataIndex: 'issues', width: 80, render: (v: number) => <Tag color={v > 0 ? 'error' : 'success'}>{v}</Tag> },
          { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={v === '已发布' ? 'success' : 'processing'}>{v}</Tag> },
          { title: '生成时间', dataIndex: 'generated_at', width: 160, render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
          { title: '操作', key: 'action', width: 120,
            render: () => <Space size="small">
              <Button size="small" type="link" icon={<EyeOutlined />}>查看</Button>
              <Button size="small" type="link" icon={<DownloadOutlined />}>下载</Button>
            </Space>,
          },
        ]} dataSource={[
          { month: '2026-06', score: stats.qualityScore, rules: stats.totalRules, pass_rate: stats.qualityScore, issues: stats.failedRules, status: '已发布', generated_at: '2026-06-10 09:30' },
          { month: '2026-05', score: 93.5, rules: 25, pass_rate: 93.5, issues: 2, status: '已发布', generated_at: '2026-05-31 09:00' },
          { month: '2026-04', score: 91.0, rules: 23, pass_rate: 91.0, issues: 3, status: '已发布', generated_at: '2026-04-30 09:00' },
          { month: '2026-03', score: 89.8, rules: 21, pass_rate: 89.8, issues: 4, status: '已发布', generated_at: '2026-03-31 09:00' },
          { month: '2026-02', score: 90.2, rules: 20, pass_rate: 90.2, issues: 3, status: '已发布', generated_at: '2026-02-28 09:00' },
          { month: '2026-01', score: 88.0, rules: 18, pass_rate: 88.0, issues: 5, status: '已发布', generated_at: '2026-01-31 09:00' },
        ]} rowKey="month" pagination={false} size="middle" />
      </Card>
    </div>
  );

  const tabItems = [
    { key: 'dashboard', label: <span><DashboardOutlined /> 质量仪表盘</span>, children: renderDashboard() },
    { key: 'rules', label: <span><SettingOutlined /> 质量规则</span>, children: renderRules() },
    { key: 'consistency', label: <span><SwapOutlined /> 一致性校验</span>, children: renderConsistency() },
    { key: 'sync', label: <span><SyncOutlined /> 同步监控</span>, children: renderSync() },
    { key: 'lineage', label: <span><ApartmentOutlined /> 血缘与变更</span>, children: renderLineage() },
    { key: 'reports', label: <span><FileTextOutlined /> 质量报告</span>, children: renderReports() },
  ];

  return (
    <Layout className="data-quality-page">
      {contextHolder}
      {notifContext}
      <Content className="page-content">
        <Tabs
          activeKey={tab}
          onChange={key => navigate(`/data-quality/${key}`)}
          items={tabItems}
          size="large"
          tabBarStyle={{ marginBottom: 0, background: '#fff', padding: '0 16px', borderRadius: '8px 8px 0 0' }}
        />

        {/* Rule Create/Edit Modal */}
        <Modal title={editingRule ? '编辑质量规则' : '新建质量规则'} open={ruleModalOpen}
          onOk={handleSaveRule} onCancel={() => setRuleModalOpen(false)} width={640} destroyOnClose
          okButtonProps={{ style: { background: '#D7011D', borderColor: '#D7011D' } }}>
          <Form form={ruleForm} layout="vertical" className="dq-rule-form"
            initialValues={{ is_active: true, severity: 'warning', rule_type: 'null_rate' }}>
            <div className="form-section-title"><SettingOutlined /> 基本信息</div>
            <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
              <Input placeholder="如：凭证金额空值检测" />
            </Form.Item>
            <Form.Item name="description" label="规则描述">
              <TextArea rows={2} placeholder="描述检测逻辑和触发条件..." />
            </Form.Item>
            <div className="form-section-title"><DatabaseOutlined /> 数据源配置</div>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="source_system" label="源系统" rules={[{ required: true }]}>
                  <Select options={['金蝶ERP', '云之家OA', 'CRM', 'SRM', 'WMS', 'QMS', 'PLM'].map(s => ({ value: s, label: s }))} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="table_name" label="表名" rules={[{ required: true }]}>
                  <Input placeholder="t_voucher" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="field_name" label="字段名" rules={[{ required: true }]}>
                  <Input placeholder="total_amount" />
                </Form.Item>
              </Col>
            </Row>
            <div className="form-section-title"><HighlightOutlined /> 检测配置</div>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="rule_type" label="规则类型" rules={[{ required: true }]}>
                  <Select options={Object.entries(ruleTypeLabels).map(([v, l]) => ({ value: v, label: l }))} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="severity" label="严重级别" rules={[{ required: true }]}>
                  <Select options={Object.entries(severityLabels).map(([v, { label }]) => ({ value: v, label }))} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="threshold" label="阈值" rules={[{ required: true }]}
                  tooltip="如: 空值率阈值 0.01=1%, 异常值3σ, 一致率0.95=95%">
                  <Input placeholder="0.01" />
                </Form.Item>
              </Col>
            </Row>
            <div className="form-section-title"><CheckCircleOutlined /> 启用设置</div>
            <Form.Item name="is_active" valuePropName="checked" label="创建后立即启用">
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </Form>
        </Modal>

        {/* Rule Detail Drawer */}
        <Drawer title={<><EyeOutlined /> 规则详情: {selectedRule?.rule_id}</>} open={detailDrawerOpen}
          onClose={() => setDetailDrawerOpen(false)} width={520}>
          {selectedRule && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <TextTitle level={4}>{selectedRule.name}</TextTitle>
                <Paragraph type="secondary">{selectedRule.description}</Paragraph>
              </div>
              <Descriptions column={2} bordered size="small" labelStyle={{ fontWeight: 500 }}>
                <Descriptions.Item label="源系统">{selectedRule.source_system}</Descriptions.Item>
                <Descriptions.Item label="表名"><code>{selectedRule.table_name}</code></Descriptions.Item>
                <Descriptions.Item label="字段名"><code style={{ color: '#D7011D' }}>{selectedRule.field_name}</code></Descriptions.Item>
                <Descriptions.Item label="规则类型">
                  <Tag color={ruleTypeColors[selectedRule.rule_type]}>{ruleTypeLabels[selectedRule.rule_type]}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="严重级别">
                  <Tag color={severityLabels[selectedRule.severity]?.color}>{severityLabels[selectedRule.severity]?.label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="阈值">
                  {selectedRule.rule_type === 'null_rate' || selectedRule.rule_type === 'volatility'
                    ? `${(selectedRule.threshold * 100).toFixed(1)}%`
                    : selectedRule.rule_type === 'outlier' ? `±${selectedRule.threshold}σ`
                    : `${(selectedRule.threshold * 100).toFixed(0)}%`}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Badge status={selectedRule.is_active ? 'success' : 'default'} text={selectedRule.is_active ? '启用' : '停用'} />
                </Descriptions.Item>
                <Descriptions.Item label="上次检查">{selectedRule.last_check_at || '未执行'}</Descriptions.Item>
              </Descriptions>
              {selectedRule.last_result && (
                <div style={{
                  marginTop: 20, padding: 16,
                  background: selectedRule.last_result.passed ? '#f6ffed' : '#fff2f0',
                  borderRadius: 8,
                  border: `1px solid ${selectedRule.last_result.passed ? '#b7eb8f' : '#ffccc7'}`,
                }}>
                  <Text strong style={{ color: selectedRule.last_result.passed ? '#52c41a' : '#f5222d', fontSize: 14 }}>
                    {selectedRule.last_result.passed ? '✓ 最近检查: 通过' : '✗ 最近检查: 异常 - 需要关注'}
                  </Text>
                  <pre style={{ marginTop: 8, fontSize: 12, background: '#fff', padding: 10, borderRadius: 4, overflow: 'auto' }}>
                    {JSON.stringify(selectedRule.last_result, null, 2)}
                  </pre>
                </div>
              )}
              <div style={{ marginTop: 20 }}>
                <Button type="primary" icon={<PlayCircleOutlined />} block
                  onClick={() => { handleRunSingleRule(selectedRule.id); setDetailDrawerOpen(false); }}
                  style={{ background: '#D7011D', borderColor: '#D7011D' }}>
                  立即执行检查
                </Button>
              </div>
            </div>
          )}
        </Drawer>

        {/* Lineage Trace Drawer */}
        <Drawer
          title={<Space>{traceDirection === 'upstream' ? <LinkOutlined /> : <NodeIndexOutlined />}
            {traceDirection === 'upstream' ? '向上溯源' : '向下影响分析'}: {traceResult?.root || ''}
          </Space>}
          open={lineageDrawerOpen} onClose={() => setLineageDrawerOpen(false)} width={580}>
          {traceResult && (
            <div>
              <Alert
                type={traceDirection === 'upstream' ? 'info' : 'warning'}
                message={traceDirection === 'upstream'
                  ? '全链路向上溯源 — 追溯数据来源: 报告数值→审计底稿→数据仓库→源系统→源单据 (需求文档3.2)'
                  : '向下影响分析 — 评估变更影响: 源字段→数据仓库→数据集市→审计模型→报告 (需求文档3.2)'}
                style={{ marginBottom: 16, borderRadius: 8 }}
              />
              <div style={{ marginBottom: 12 }}>
                <Text strong>追溯深度: {traceResult.depth} 层节点</Text>
              </div>
              <div className="dq-lineage-trace-path">
                {traceResult.path.map((node, i) => (
                  <div key={i} className="trace-node">
                    <div className="trace-connector">
                      <div className="trace-dot" style={{
                        color: i === 0 ? '#D7011D' : i === traceResult.path.length - 1 ? '#52c41a' : '#1890ff',
                        background: i === 0 ? '#D7011D' : i === traceResult.path.length - 1 ? '#52c41a' : '#1890ff',
                      }} />
                      <div className="trace-line" />
                    </div>
                    <div className={`trace-content ${i === 0 ? 'root' : i === traceResult.path.length - 1 ? 'source' : 'mid'}`}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                        <Tag color={i === 0 ? 'red' : i === traceResult.path.length - 1 ? 'green' : 'blue'} style={{ marginRight: 8 }}>
                          L{node.level}
                        </Tag>
                        {node.node}
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>
                        <Tag style={{ fontSize: 10 }}>{node.relation}</Tag>
                        {node.transform}
                      </div>
                      <div style={{ fontSize: 11, color: '#999' }}>
                        数据来源: {node.system}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Drawer>
      </Content>
    </Layout>
  );
};

export default DataQualityPage;
