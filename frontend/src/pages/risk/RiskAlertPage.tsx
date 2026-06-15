import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import {
  Layout,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Card,
  Statistic,
  Row,
  Col,
  DatePicker,
  Badge,
  Popconfirm,
  Tooltip,
  Empty,
  Spin,
  Switch,
  Drawer,
} from 'antd';
import {
  AlertOutlined,
  SettingOutlined,
  BarChartOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  FilterOutlined,
  ThunderboltOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, BarChart, PieChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);
import type { ColumnsType } from 'antd/es/table';
import './RiskAlertPage.less';

import FilterBar from '@/components/FilterBar';
import { getRules, createRule, updateRule, getAlerts, handleAlert, triggerRiskScan } from '@/services/risk';
import { getProjects, convertAlertToFinding } from '@/services/audit';

const { Content } = Layout;

// ==================== Mock Data ====================

interface RiskAlert {
  id: string;
  title: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  department: string;
  status: 'pending' | 'confirmed' | 'resolved' | 'false_positive';
  ruleName: string;
  amount?: number;
  createdAt: string;
  org: string;
  month: number;
}

interface RiskRule {
  id: string;
  name: string;
  description: string;
  riskType: string;
  severity: string;
  ruleType: string;
  threshold: number;
  isActive: boolean;
  triggerCount: number;
  lastTriggered: string | null;
  createdAt: string;
  org: string;
}

const mockAlerts: RiskAlert[] = [
  { id: 'ALT-20250605001', title: '采购单 PO-202506-0034 单价偏离市场价超30%', type: '采购价格偏离', severity: 'high', department: '采购部', status: 'pending', ruleName: '采购价格异常', amount: 128000, createdAt: '2026-06-05 09:23:15', org: 'sz', month: 6 },
  { id: 'ALT-20250605002', title: '行政部差旅费单笔超5000元', type: '费用异常', severity: 'medium', department: '行政部', status: 'pending', ruleName: '单笔大额费用', amount: 6800, createdAt: '2026-03-20 10:45:32', org: 'zq', month: 3 },
  { id: 'ALT-20250605003', title: '应收款超期90天未收回', type: '往来异常', severity: 'high', department: '财务部', status: 'confirmed', ruleName: '应收款超期', amount: 256000, createdAt: '2026-05-12 14:12:08', org: 'sz', month: 5 },
  { id: 'ALT-20250605004', title: '固定资产折旧异常：预计使用年限变更', type: '资产异常', severity: 'low', department: '生产部', status: 'resolved', ruleName: '固定资产变更', createdAt: '2026-02-15 11:30:45', org: 'zq', month: 2 },
  { id: 'ALT-20250605005', title: '付款审批流程缺少二级审核', type: '内控缺陷', severity: 'medium', department: '财务部', status: 'false_positive', ruleName: '付款审批缺级', amount: 45000, createdAt: '2026-04-10 16:50:22', org: 'sz', month: 4 },
  { id: 'ALT-20250605006', title: '发票与入库单金额差异: 差异率8.5%', type: '内控缺陷', severity: 'medium', department: '仓储部', status: 'pending', ruleName: '发票入库差异', amount: 3200, createdAt: '2026-06-05 08:15:10', org: 'zq', month: 6 },
  { id: 'ALT-20250605007', title: '员工报销发票连续编号异常', type: '费用异常', severity: 'low', department: '销售部', status: 'pending', ruleName: '发票编号异常', amount: 1200, createdAt: '2026-01-08 07:45:33', org: 'sz', month: 1 },
];

const mockRules: RiskRule[] = [
  { id: 'RULE-001', name: '采购价格偏离', description: '采购单价偏离市场价超过设定阈值', riskType: '采购价格偏离', severity: 'high', ruleType: '阈值类', threshold: 20, isActive: true, triggerCount: 15, lastTriggered: '2026-06-05 09:23:15', createdAt: '2026-01-15', org: 'sz' },
  { id: 'RULE-002', name: '费用异常增长', description: '同比/环比费用增长超过阈值', riskType: '费用异常', severity: 'medium', ruleType: '阈值类', threshold: 30, isActive: true, triggerCount: 42, lastTriggered: '2026-06-04 14:12:08', createdAt: '2026-01-15', org: 'zq' },
  { id: 'RULE-003', name: '应收款超期', description: '应收款超期天数超过阈值', riskType: '往来异常', severity: 'high', ruleType: '阈值类', threshold: 90, isActive: true, triggerCount: 8, lastTriggered: '2026-06-03 11:30:45', createdAt: '2026-01-20', org: 'sz' },
  { id: 'RULE-004', name: '资产非正常报废', description: '固定资产使用年限内提前报废', riskType: '资产异常', severity: 'medium', ruleType: '逻辑类', threshold: 0, isActive: false, triggerCount: 3, lastTriggered: '2026-05-28 09:10:00', createdAt: '2026-02-01', org: 'zq' },
  { id: 'RULE-005', name: '付款审批缺级', description: '大额付款缺少应有的审批层级', riskType: '内控缺陷', severity: 'high', ruleType: '逻辑类', threshold: 50000, isActive: true, triggerCount: 5, lastTriggered: '2026-06-02 16:50:22', createdAt: '2026-02-10', org: 'sz' },
  { id: 'RULE-006', name: '发票入库差异', description: '发票金额与入库单金额差异超阈值', riskType: '内控缺陷', severity: 'medium', ruleType: '阈值类', threshold: 5, isActive: true, triggerCount: 12, lastTriggered: '2026-06-05 08:15:10', createdAt: '2026-03-01', org: 'zq' },
  { id: 'RULE-007', name: '往来款超期挂账', description: '往来款项超期未清理', riskType: '往来异常', severity: 'low', ruleType: '阈值类', threshold: 180, isActive: true, triggerCount: 22, lastTriggered: '2026-06-01 10:20:00', createdAt: '2026-03-15', org: 'sz' },
];

const severityMap: Record<string, { color: string; label: string }> = {
  high: { color: '#f5222d', label: '高' },
  medium: { color: '#faad14', label: '中' },
  low: { color: '#52c41a', label: '低' },
};

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'processing', label: '待处理' },
  confirmed: { color: 'warning', label: '已确认' },
  resolved: { color: 'success', label: '已解决' },
  false_positive: { color: 'default', label: '误报' },
};

// ==================== Component ====================

const RiskAlertPage: React.FC = () => {
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<RiskAlert[]>(mockAlerts);
  const [rules, setRules] = useState<RiskRule[]>(mockRules);
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(tab || 'alerts');

  // 同步 URL tab 参数到 activeTab
  useEffect(() => {
    if (tab && ['alerts', 'rules', 'charts'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [tab]);

  // Modal states
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<RiskRule | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<RiskAlert | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'confirmed' | 'false_positive'>('confirmed');
  const [confirmingAlertId, setConfirmingAlertId] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [convertModalVisible, setConvertModalVisible] = useState(false);
  const [convertingAlertId, setConvertingAlertId] = useState<string>('');
  const [convertProjectId, setConvertProjectId] = useState<string>('');
  const [projectList, setProjectList] = useState<{ id: string; project_name: string; project_code: string }[]>([]);
  const [convertLoading, setConvertLoading] = useState(false);

  const [form] = Form.useForm();

  // ==================== API Data Fetching ====================

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await getAlerts({
        page: 1,
        page_size: 100,
        status: undefined,
        severity: undefined,
        start_date: filterDateStart,
        end_date: filterDateEnd,
      });
      const data = res;
      if (Array.isArray(data) && data.length > 0) {
        setAlerts(data as unknown as RiskAlert[]);
        setLoading(false);
        return;
      }
    } catch (e) {
      console.log('API unavailable, using mock alerts');
    }
    setAlerts(mockAlerts);
    setLoading(false);
  };

  const fetchRules = async () => {
    try {
      const res = await getRules({ page: 1, page_size: 100 });
      const data = res;
      if (Array.isArray(data) && data.length > 0) {
        setRules(data as unknown as RiskRule[]);
        return;
      }
    } catch (e) {
      console.log('API unavailable, using mock rules');
    }
    setRules(mockRules);
  };

  // ==================== Alert Actions ====================

  const handleConfirmAlert = (id: string, action: 'confirmed' | 'false_positive') => {
    setConfirmingAlertId(id);
    setConfirmAction(action);
    setConfirmModalVisible(true);
  };

  const doConfirm = async () => {
    try {
      await handleAlert(confirmingAlertId, { action: confirmAction });
    } catch (e) {
      console.log('API handle failed, updating locally');
    }
    setAlerts(prev => prev.map(a => a.id === confirmingAlertId ? { ...a, status: confirmAction } : a));
    message.success(`预警已标记为${confirmAction === 'confirmed' ? '已确认' : '误报'}`);
    setConfirmModalVisible(false);
  };

  const handleResolveAlert = async (id: string) => {
    try {
      await handleAlert(id, { action: 'resolved' });
    } catch (e) {
      console.log('API resolve failed, updating locally');
    }
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
    message.success('预警已标记为已解决');
  };

  const handleConvertToFinding = async (alertId: string) => {
    setConvertingAlertId(alertId);
    setConvertProjectId('');
    setConvertModalVisible(true);
    // 加载项目列表
    try {
      const res = await getProjects({ page: 1, page_size: 100 });
      if (Array.isArray(res)) {
        setProjectList(res as unknown as { id: string; project_name: string; project_code: string }[]);
      }
    } catch (e) {
      console.log('Failed to load projects for convert modal');
    }
  };

  const doConvert = async () => {
    if (!convertProjectId) {
      message.warning('请选择目标审计项目');
      return;
    }
    setConvertLoading(true);
    try {
      const res = await convertAlertToFinding({
        alert_id: convertingAlertId,
        project_id: convertProjectId,
      });
      message.success(`已转为审计发现 ${(res as unknown as Record<string, unknown>)?.finding_id || ''}`);
        setAlerts(prev => prev.map(a => a.id === convertingAlertId ? { ...a, status: 'confirmed' } : a));
        setConvertModalVisible(false);
    } catch (e) {
      message.error('转换失败，请检查预警是否已转换过');
    }
    setConvertLoading(false);
  };

  const handleViewAlert = (alert: RiskAlert) => {
    setSelectedAlert(alert);
    setDetailDrawerVisible(true);
  };

  // ==================== Rule Actions ====================

  const handleAddRule = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, severity: 'medium', ruleType: '阈值类', threshold: 10 });
    setRuleModalVisible(true);
  };

  const handleEditRule = (rule: RiskRule) => {
    setEditingRule(rule);
    form.setFieldsValue({ ...rule });
    setRuleModalVisible(true);
  };

  const handleDeleteRule = async (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    message.success('规则已删除');
  };

  const handleToggleRule = async (id: string, active: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: active } : r));
    try {
      await updateRule(id, { isActive: active } as Record<string, unknown>);
    } catch (e) {
      console.log('API toggle failed, updated locally');
    }
    message.success(active ? '规则已启用' : '规则已停用');
  };

  const handleSaveRule = () => {
    form.validateFields().then(async values => {
      if (editingRule) {
        try {
          await updateRule(editingRule.id, values as Record<string, unknown>);
        } catch (e) {
          console.log('API updateRule failed, updating locally');
        }
        setRules(prev => prev.map(r => r.id === editingRule.id ? { ...r, ...values } : r));
        message.success('规则已更新');
      } else {
        let apiCreated = false;
        try {
          const res = await createRule(values as Record<string, unknown>);
          if (res) {
            const d = res as unknown as Record<string, unknown>;
            const newRule: RiskRule = {
              id: (d.id as string) || `RULE-${String(rules.length + 1).padStart(3, '0')}`,
              ...(values as unknown as Omit<RiskRule, 'id' | 'triggerCount' | 'lastTriggered' | 'createdAt'>),
              triggerCount: 0,
              lastTriggered: null,
              createdAt: new Date().toISOString().slice(0, 10),
            };
            setRules(prev => [...prev, newRule]);
            apiCreated = true;
          }
        } catch (e) {
          console.log('API createRule failed, creating locally');
        }
        if (!apiCreated) {
          const newRule: RiskRule = {
            id: `RULE-${String(rules.length + 1).padStart(3, '0')}`,
            ...(values as unknown as Omit<RiskRule, 'id' | 'triggerCount' | 'lastTriggered' | 'createdAt'>),
            triggerCount: 0,
            lastTriggered: null,
            createdAt: new Date().toISOString().slice(0, 10),
          };
          setRules(prev => [...prev, newRule]);
        }
        message.success('规则已创建');
      }
      setRuleModalVisible(false);
    });
  };

  // ==================== Scan ====================

  const handleScan = () => {
    setScanLoading(true);
    // Try API scan first
    triggerRiskScan().then(() => {
      fetchAlerts();
      fetchRules();
      message.success('扫描完成，预警列表已更新');
      setScanLoading(false);
      setActiveTab('alerts');
    }).catch(() => {
      console.log('API scan failed, using local simulation');
      setTimeout(() => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const orgs: string[] = ['sz', 'zq'];
        const newAlerts: RiskAlert[] = [
          {
            id: `ALT-${Date.now()}`,
            title: `【扫描发现】新增费用异常: ${Math.floor(Math.random() * 10 + 1)}笔`,
            type: '费用异常',
            severity: Math.random() > 0.5 ? 'high' : 'medium',
            department: ['采购部', '行政部', '财务部', '销售部'][Math.floor(Math.random() * 4)],
            status: 'pending',
            ruleName: '费用异常增长',
            amount: Math.floor(Math.random() * 50000 + 1000),
            createdAt: new Date().toLocaleString('zh-CN'),
            org: orgs[Math.floor(Math.random() * orgs.length)],
            month: currentMonth,
          },
        ];
        setAlerts(prev => [...newAlerts, ...prev]);

        // Update rule trigger counts
        setRules(prev => prev.map(r =>
          r.isActive && Math.random() > 0.5
            ? { ...r, triggerCount: r.triggerCount + Math.floor(Math.random() * 3 + 1), lastTriggered: new Date().toLocaleString('zh-CN') }
            : r
        ));

        message.success(`扫描完成，发现 ${newAlerts.length} 条新预警`);
        setScanLoading(false);
        setActiveTab('alerts');
      }, 2000);
    });
  };

  // ==================== Columns ====================

  const alertColumns: ColumnsType<RiskAlert> = [
    {
      title: '预警编号',
      dataIndex: 'id',
      key: 'id',
      width: 170,
      render: (text) => <code style={{ fontSize: 12 }}>{text}</code>,
    },
    {
      title: '预警内容',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>规则: {record.ruleName}</div>
        </div>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (s: string) => {
        const { color, label } = severityMap[s] || severityMap.low;
        return <Tag color={color}>{label}</Tag>;
      },
      filters: [
        { text: '高', value: 'high' },
        { text: '中', value: 'medium' },
        { text: '低', value: 'low' },
      ],
      onFilter: (value, record) => record.severity === value,
    },
    {
      title: '责任部门',
      dataIndex: 'department',
      key: 'department',
      width: 110,
    },
    {
      title: '涉及金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right',
      render: (amount?: number) => amount ? `¥${amount.toLocaleString()}` : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: string) => {
        const { color, label } = statusMap[s] || statusMap.pending;
        return <Badge status={color as any}>{label}</Badge>;
      },
      filters: [
        { text: '待处理', value: 'pending' },
        { text: '已确认', value: 'confirmed' },
        { text: '已解决', value: 'resolved' },
        { text: '误报', value: 'false_positive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: '触发时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewAlert(record)}>
            查看
          </Button>
          {record.status === 'pending' && (
            <>
              <Tooltip title="确认为有效预警">
                <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleConfirmAlert(record.id, 'confirmed')}>
                  确认
                </Button>
              </Tooltip>
              <Tooltip title="标记为误报">
                <Button size="small" danger icon={<StopOutlined />} onClick={() => handleConfirmAlert(record.id, 'false_positive')}>
                  误报
                </Button>
              </Tooltip>
            </>
          )}
          {record.status === 'confirmed' && (
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleResolveAlert(record.id)}>
              解决
            </Button>
          )}
          {(record.status === 'pending' || record.status === 'confirmed') && (
            <Tooltip title="转为审计发现并关联到审计项目">
              <Button size="small" style={{ color: '#E34D59', borderColor: '#E34D59' }} onClick={() => handleConvertToFinding(record.id)}>
                转为发现
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const ruleColumns: ColumnsType<RiskRule> = [
    {
      title: '规则ID',
      dataIndex: 'id',
      key: 'id',
      width: 110,
      render: (text) => <code style={{ fontSize: 12 }}>{text}</code>,
    },
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.description}</div>
        </div>
      ),
    },
    {
      title: '风险类型',
      dataIndex: 'riskType',
      key: 'riskType',
      width: 120,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '严重等级',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (s: string) => {
        const { color, label } = severityMap[s] || severityMap.low;
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: '规则类型',
      dataIndex: 'ruleType',
      key: 'ruleType',
      width: 90,
      render: (text) => <Tag>{text}</Tag>,
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 90,
      align: 'right',
      render: (v: number) => v ? `${v}${v < 100 ? '%' : '天'}` : '-',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 90,
      render: (active: boolean, record) => (
        <Switch
          checked={active}
          checkedChildren="启用"
          unCheckedChildren="停用"
          onChange={(checked) => handleToggleRule(record.id, checked)}
        />
      ),
    },
    {
      title: '触发次数',
      dataIndex: 'triggerCount',
      key: 'triggerCount',
      width: 90,
      align: 'right',
    },
    {
      title: '最近触发',
      dataIndex: 'lastTriggered',
      key: 'lastTriggered',
      width: 160,
      render: (text) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditRule(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除此规则？"
            description="删除后无法恢复，已产生的预警不受影响。"
            onConfirm={() => handleDeleteRule(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ==================== Filter State ====================
  const [filterOrg, setFilterOrg] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('2026-01-01');
  const [filterDateEnd, setFilterDateEnd] = useState('2026-06-30');

  // Fetch data from API when tab or filters change
  useEffect(() => {
    if (activeTab === 'alerts') fetchAlerts();
    else if (activeTab === 'rules') fetchRules();
  }, [activeTab, filterOrg, filterDateStart, filterDateEnd]);

  // ==================== Filtered Data ====================

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      const orgMatch = filterOrg === 'all' || a.org === filterOrg;
      const alertDate = a.createdAt.slice(0, 10);
      const periodMatch = alertDate >= filterDateStart && alertDate <= filterDateEnd;
      return orgMatch && periodMatch;
    });
  }, [alerts, filterOrg, filterDateStart, filterDateEnd]);

  const filteredRules = useMemo(() => {
    return rules.filter(r => filterOrg === 'all' || r.org === filterOrg);
  }, [rules, filterOrg]);

  // ==================== Stats ====================

  const stats = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return {
      total: filteredAlerts.length,
      pending: filteredAlerts.filter(a => a.status === 'pending').length,
      high: filteredAlerts.filter(a => a.severity === 'high' && a.status === 'pending').length,
      today: filteredAlerts.filter(a => a.createdAt.startsWith(todayStr)).length,
    };
  }, [filteredAlerts]);

  // ==================== Charts ====================

  const riskTypePieOption = useMemo(() => {
    const typeCount: Record<string, number> = {};
    filteredAlerts.forEach(a => {
      typeCount[a.type] = (typeCount[a.type] || 0) + 1;
    });
    const data = Object.entries(typeCount).map(([name, value]) => ({ name, value }));
    return {
      title: { text: '风险类型分布', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'item', formatter: '{a} <br/>{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', left: 'left', top: 40 },
      series: [{
        name: '风险类型',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '55%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{c}条' },
        data,
      }],
    };
  }, [filteredAlerts]);

  const riskTrendOption = useMemo(() => {
    const now = new Date();
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`);
    }
    const highData: number[] = new Array(7).fill(0);
    const mediumData: number[] = new Array(7).fill(0);
    const lowData: number[] = new Array(7).fill(0);

    filteredAlerts.forEach(a => {
      const alertDate = a.createdAt.slice(5, 10);
      const idx = dates.findIndex(d => {
        const parts = d.split('/');
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}` === alertDate;
      });
      if (idx >= 0) {
        if (a.severity === 'high') highData[idx]++;
        else if (a.severity === 'medium') mediumData[idx]++;
        else lowData[idx]++;
      }
    });

    return {
      title: { text: '近7日风险趋势', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'axis' },
      legend: { data: ['高危', '中危', '低危'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: dates },
      yAxis: { type: 'value', name: '预警数' },
      series: [
        { name: '高危', type: 'line', smooth: true, data: highData, itemStyle: { color: '#f5222d' }, lineStyle: { color: '#f5222d', width: 2 } },
        { name: '中危', type: 'line', smooth: true, data: mediumData, itemStyle: { color: '#faad14' }, lineStyle: { color: '#faad14', width: 2 } },
        { name: '低危', type: 'line', smooth: true, data: lowData, itemStyle: { color: '#52c41a' }, lineStyle: { color: '#52c41a', width: 2 } },
      ],
    };
  }, [filteredAlerts]);

  const deptBarOption = useMemo(() => {
    const deptCount: Record<string, number> = {};
    filteredAlerts.forEach(a => {
      deptCount[a.department] = (deptCount[a.department] || 0) + 1;
    });
    const sorted = Object.entries(deptCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const yData = sorted.map(([name]) => name);
    const seriesData = sorted.map(([, value]) => value);

    return {
      title: { text: '部门风险TOP5', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: yData },
      series: [{
        name: '预警数',
        type: 'bar',
        data: seriesData,
        itemStyle: { color: '#D7011D', borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right' },
      }],
    };
  }, [filteredAlerts]);

  return (
    <Layout className="risk-alert-page">
      <Content className="page-content">
        <FilterBar
          orgValue={filterOrg}
          onOrgChange={setFilterOrg}
          dateStart={filterDateStart}
          dateEnd={filterDateEnd}
          onDateStartChange={setFilterDateStart}
          onDateEndChange={setFilterDateEnd}
          onRefresh={() => { fetchAlerts(); fetchRules(); message.success('数据已刷新'); }}
          onExport={() => message.info('正在导出预警数据...')}
        />

        {/* Stats Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="待处理预警" value={stats.pending} valueStyle={{ color: '#f5222d' }}
                prefix={<ExclamationCircleOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="高危预警" value={stats.high} valueStyle={{ color: '#f5222d' }}
                prefix={<AlertOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="今日新增" value={stats.today} valueStyle={{ color: '#D7011D' }}
                prefix={<ThunderboltOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="活跃规则" value={filteredRules.filter(r => r.isActive).length}
                suffix={`/${filteredRules.length}`} prefix={<SettingOutlined />} />
            </Card>
          </Col>
        </Row>

        {activeTab === 'alerts' && (
          <div className="content-card">
            <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Input.Search
                placeholder="搜索预警内容、编号..."
                allowClear
                style={{ width: 300 }}
                prefix={<SearchOutlined />}
              />
              <DatePicker.RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
                style={{ width: 260 }}
                placeholder={['开始日期', '结束日期']}
                getPopupContainer={(trigger) => trigger.parentElement || document.body}
              />
              <Button icon={<FilterOutlined />}>高级筛选</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { fetchAlerts(); message.success('已刷新'); }}>
                刷新
              </Button>
            </div>
            <Table
              columns={alertColumns}
              dataSource={filteredAlerts}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
              scroll={{ x: 1200 }}
            />
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="content-card">
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Input.Search placeholder="搜索规则名称..." allowClear style={{ width: 280 }} prefix={<SearchOutlined />} />
                <Select placeholder="风险类型" allowClear style={{ width: 140 }}
                  options={[
                    { value: '采购价格偏离', label: '采购价格偏离' },
                    { value: '费用异常', label: '费用异常' },
                    { value: '往来异常', label: '往来异常' },
                    { value: '资产异常', label: '资产异常' },
                    { value: '内控缺陷', label: '内控缺陷' },
                  ]}
                />
              </Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRule} style={{ background: '#D7011D', borderColor: '#D7011D' }}>
                新建规则
              </Button>
            </div>
            <Table
              columns={ruleColumns}
              dataSource={filteredRules}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1300 }}
            />
          </div>
        )}

        {activeTab === 'charts' && (
          <div>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card>
                  <ReactEChartsCore echarts={echarts} option={riskTypePieOption} style={{ height: 350 }} />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card>
                  <ReactEChartsCore echarts={echarts} option={riskTrendOption} style={{ height: 350 }} />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card>
                  <ReactEChartsCore echarts={echarts} option={deptBarOption} style={{ height: 350 }} />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="预警处理统计" style={{ height: 386 }}>
                  <Row gutter={[16, 24]}>
                    <Col span={12}>
                      <Statistic title="已确认" value={filteredAlerts.filter(a => a.status === 'confirmed').length} valueStyle={{ color: '#faad14' }} />
                    </Col>
                    <Col span={12}>
                      <Statistic title="已解决" value={filteredAlerts.filter(a => a.status === 'resolved').length} valueStyle={{ color: '#52c41a' }} />
                    </Col>
                    <Col span={12}>
                      <Statistic title="误报" value={filteredAlerts.filter(a => a.status === 'false_positive').length} />
                    </Col>
                    <Col span={12}>
                      <Statistic title="平均处理时长" value="2.3" suffix="天" />
                    </Col>
                  </Row>
                  <div style={{ marginTop: 24, padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
                    <div style={{ fontWeight: 500, color: '#52c41a', marginBottom: 8 }}>今日风险摘要</div>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      今日新增 {stats.today} 条预警，其中高危 {stats.high} 条。
                      采购部预警数量最多（31条），建议重点关注采购价格偏离类风险。
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Content>

      {/* Rule Modal */}
      <Modal
        title={editingRule ? `编辑规则: ${editingRule.name}` : '新建风险规则'}
        open={ruleModalVisible}
        onOk={handleSaveRule}
        onCancel={() => setRuleModalVisible(false)}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
                <Input placeholder="如: 采购价格偏离" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="riskType" label="风险类型" rules={[{ required: true }]}>
                <Select placeholder="选择风险类型"
                  options={[
                    { value: '采购价格偏离', label: '采购价格偏离' },
                    { value: '费用异常', label: '费用异常' },
                    { value: '往来异常', label: '往来异常' },
                    { value: '资产异常', label: '资产异常' },
                    { value: '内控缺陷', label: '内控缺陷' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="规则描述">
            <Input.TextArea rows={2} placeholder="描述该规则的检测逻辑和触发条件" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="severity" label="严重等级">
                <Select
                  options={[
                    { value: 'high', label: '高' },
                    { value: 'medium', label: '中' },
                    { value: 'low', label: '低' },
                  ]}
                  optionRender={(opt) => {
                    const colorMap: Record<string, string> = { high: '#f5222d', medium: '#faad14', low: '#52c41a' };
                    return <span><Tag color={colorMap[opt.value as string] || '#f5222d'}>{opt.label}</Tag></span>;
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ruleType" label="规则类型">
                <Select
                  options={[
                    { value: '阈值类', label: '阈值类' },
                    { value: '逻辑类', label: '逻辑类' },
                    { value: '统计类', label: '统计类' },
                    { value: 'AI模型', label: 'AI模型' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="threshold" label="阈值">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="10" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="isActive" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        title={confirmAction === 'confirmed' ? '确认预警' : '标记误报'}
        open={confirmModalVisible}
        onOk={doConfirm}
        onCancel={() => setConfirmModalVisible(false)}
      >
        <p>
          {confirmAction === 'confirmed'
            ? '确认将此预警标记为有效？系统将持续跟踪后续处理进度。'
            : '确认将此预警标记为误报？该预警将不再出现在待处理列表中。'}
        </p>
      </Modal>

      {/* Convert to Finding Modal */}
      <Modal
        title="转为审计发现"
        open={convertModalVisible}
        onOk={doConvert}
        onCancel={() => setConvertModalVisible(false)}
        confirmLoading={convertLoading}
        okText="确认转换"
        cancelText="取消"
      >
        <p style={{ marginBottom: 12 }}>选择目标审计项目，将当前预警转换为审计发现并自动建立证据链关联。</p>
        <Select
          placeholder="请选择目标审计项目"
          style={{ width: '100%' }}
          value={convertProjectId || undefined}
          onChange={(value) => setConvertProjectId(value)}
          options={projectList.map(p => ({
            value: p.id,
            label: `${p.project_code} - ${p.project_name}`,
          }))}
          showSearch
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
        />
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={`预警详情: ${selectedAlert?.id}`}
        width={520}
        onClose={() => setDetailDrawerVisible(false)}
        open={detailDrawerVisible}
      >
        {selectedAlert && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>{selectedAlert.title}</div>
              <Space>
                <Tag color={severityMap[selectedAlert.severity]?.color}>{severityMap[selectedAlert.severity]?.label}</Tag>
                <Badge status={statusMap[selectedAlert.status]?.color as any}>{statusMap[selectedAlert.status]?.label}</Badge>
              </Space>
            </div>
            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 24 }}>
              <Row gutter={[16, 16]}>
                <Col span={12}><div style={{ color: '#999', fontSize: 12 }}>责任部门</div><div>{selectedAlert.department}</div></Col>
                <Col span={12}><div style={{ color: '#999', fontSize: 12 }}>触发规则</div><div>{selectedAlert.ruleName}</div></Col>
                <Col span={12}><div style={{ color: '#999', fontSize: 12 }}>涉及金额</div><div>{selectedAlert.amount ? `¥${selectedAlert.amount.toLocaleString()}` : '-'}</div></Col>
                <Col span={12}><div style={{ color: '#999', fontSize: 12 }}>触发时间</div><div>{selectedAlert.createdAt}</div></Col>
              </Row>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>处理记录</div>
              <div style={{ padding: 12, border: '1px solid #f0f0f0', borderRadius: 6, background: '#fafafa' }}>
                <div style={{ fontSize: 13, color: '#666' }}>2026-06-05 09:23:15 系统自动触发预警</div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>规则引擎检测到异常数据，自动生成预警。</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              {selectedAlert.status === 'pending' && (
                <>
                  <Button onClick={() => { setDetailDrawerVisible(false); handleConfirmAlert(selectedAlert.id, 'false_positive'); }}>标记误报</Button>
                  <Button type="primary" onClick={() => { setDetailDrawerVisible(false); handleConfirmAlert(selectedAlert.id, 'confirmed'); }}>确认预警</Button>
                </>
              )}
              {selectedAlert.status === 'confirmed' && (
                <Button type="primary" onClick={() => { setDetailDrawerVisible(false); handleResolveAlert(selectedAlert.id); }}>标记已解决</Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </Layout>
  );
};

export default RiskAlertPage;
