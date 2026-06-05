import React, { useState, useEffect } from 'react';
import {
  Tabs,
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
import ReactECharts from 'echarts-for-react';
import type { ColumnsType } from 'antd/es/table';
import './RiskAlertPage.less';

const { Content } = Layout;
const { Option } = Select;
const { RangePicker } = DatePicker;

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
}

const mockAlerts: RiskAlert[] = [
  { id: 'ALT-20250605001', title: '采购单 PO-202506-0034 单价偏离市场价超30%', type: '采购价格偏离', severity: 'high', department: '采购部', status: 'pending', ruleName: '采购价格异常', amount: 128000, createdAt: '2026-06-05 09:23:15' },
  { id: 'ALT-20250605002', title: '行政部差旅费单笔超5000元', type: '费用异常', severity: 'medium', department: '行政部', status: 'pending', ruleName: '单笔大额费用', amount: 6800, createdAt: '2026-06-05 10:45:32' },
  { id: 'ALT-20250605003', title: '应收款超期90天未收回', type: '往来异常', severity: 'high', department: '财务部', status: 'confirmed', ruleName: '应收款超期', amount: 256000, createdAt: '2026-06-04 14:12:08' },
  { id: 'ALT-20250605004', title: '固定资产折旧异常：预计使用年限变更', type: '资产异常', severity: 'low', department: '生产部', status: 'resolved', ruleName: '固定资产变更', createdAt: '2026-06-03 11:30:45' },
  { id: 'ALT-20250605005', title: '付款审批流程缺少二级审核', type: '内控缺陷', severity: 'medium', department: '财务部', status: 'false_positive', ruleName: '付款审批缺级', amount: 45000, createdAt: '2026-06-02 16:50:22' },
  { id: 'ALT-20250605006', title: '发票与入库单金额差异: 差异率8.5%', type: '内控缺陷', severity: 'medium', department: '仓储部', status: 'pending', ruleName: '发票入库差异', amount: 3200, createdAt: '2026-06-05 08:15:10' },
  { id: 'ALT-20250605007', title: '员工报销发票连续编号异常', type: '费用异常', severity: 'low', department: '销售部', status: 'pending', ruleName: '发票编号异常', amount: 1200, createdAt: '2026-06-05 07:45:33' },
];

const mockRules: RiskRule[] = [
  { id: 'RULE-001', name: '采购价格偏离', description: '采购单价偏离市场价超过设定阈值', riskType: '采购价格偏离', severity: 'high', ruleType: '阈值类', threshold: 20, isActive: true, triggerCount: 15, lastTriggered: '2026-06-05 09:23:15', createdAt: '2026-01-15' },
  { id: 'RULE-002', name: '费用异常增长', description: '同比/环比费用增长超过阈值', riskType: '费用异常', severity: 'medium', ruleType: '阈值类', threshold: 30, isActive: true, triggerCount: 42, lastTriggered: '2026-06-04 14:12:08', createdAt: '2026-01-15' },
  { id: 'RULE-003', name: '应收款超期', description: '应收款超期天数超过阈值', riskType: '往来异常', severity: 'high', ruleType: '阈值类', threshold: 90, isActive: true, triggerCount: 8, lastTriggered: '2026-06-03 11:30:45', createdAt: '2026-01-20' },
  { id: 'RULE-004', name: '资产非正常报废', description: '固定资产使用年限内提前报废', riskType: '资产异常', severity: 'medium', ruleType: '逻辑类', threshold: 0, isActive: false, triggerCount: 3, lastTriggered: '2026-05-28 09:10:00', createdAt: '2026-02-01' },
  { id: 'RULE-005', name: '付款审批缺级', description: '大额付款缺少应有的审批层级', riskType: '内控缺陷', severity: 'high', ruleType: '逻辑类', threshold: 50000, isActive: true, triggerCount: 5, lastTriggered: '2026-06-02 16:50:22', createdAt: '2026-02-10' },
  { id: 'RULE-006', name: '发票入库差异', description: '发票金额与入库单金额差异超阈值', riskType: '内控缺陷', severity: 'medium', ruleType: '阈值类', threshold: 5, isActive: true, triggerCount: 12, lastTriggered: '2026-06-05 08:15:10', createdAt: '2026-03-01' },
  { id: 'RULE-007', name: '往来款超期挂账', description: '往来款项超期未清理', riskType: '往来异常', severity: 'low', ruleType: '阈值类', threshold: 180, isActive: true, triggerCount: 22, lastTriggered: '2026-06-01 10:20:00', createdAt: '2026-03-15' },
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
  const [alerts, setAlerts] = useState<RiskAlert[]>(mockAlerts);
  const [rules, setRules] = useState<RiskRule[]>(mockRules);
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('alerts');

  // Modal states
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<RiskRule | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<RiskAlert | null>(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'confirmed' | 'false_positive'>('confirmed');
  const [confirmingAlertId, setConfirmingAlertId] = useState<string>('');

  const [form] = Form.useForm();

  // ==================== Alert Actions ====================

  const handleConfirmAlert = (id: string, action: 'confirmed' | 'false_positive') => {
    setConfirmingAlertId(id);
    setConfirmAction(action);
    setConfirmModalVisible(true);
  };

  const doConfirm = () => {
    setAlerts(prev => prev.map(a => a.id === confirmingAlertId ? { ...a, status: confirmAction } : a));
    message.success(`预警已标记为${confirmAction === 'confirmed' ? '已确认' : '误报'}`);
    setConfirmModalVisible(false);
  };

  const handleResolveAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
    message.success('预警已标记为已解决');
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

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    message.success('规则已删除');
  };

  const handleToggleRule = (id: string, active: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: active } : r));
    message.success(active ? '规则已启用' : '规则已停用');
  };

  const handleSaveRule = () => {
    form.validateFields().then(values => {
      if (editingRule) {
        setRules(prev => prev.map(r => r.id === editingRule.id ? { ...r, ...values } : r));
        message.success('规则已更新');
      } else {
        const newRule: RiskRule = {
          id: `RULE-${String(rules.length + 1).padStart(3, '0')}`,
          ...values,
          triggerCount: 0,
          lastTriggered: null,
          createdAt: new Date().toISOString().slice(0, 10),
        };
        setRules(prev => [...prev, newRule]);
        message.success('规则已创建');
      }
      setRuleModalVisible(false);
    });
  };

  // ==================== Scan ====================

  const handleScan = () => {
    setScanLoading(true);
    setTimeout(() => {
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

  // ==================== Charts ====================

  const riskTypePieOption = {
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
      data: [
        { value: 15, name: '采购价格偏离' },
        { value: 42, name: '费用异常' },
        { value: 8, name: '往来异常' },
        { value: 5, name: '资产异常' },
        { value: 17, name: '内控缺陷' },
      ],
    }],
  };

  const riskTrendOption = {
    title: { text: '近7日风险趋势', left: 'center', textStyle: { fontSize: 16 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['高危', '中危', '低危'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: ['05/30', '05/31', '06/01', '06/02', '06/03', '06/04', '06/05'] },
    yAxis: { type: 'value', name: '预警数' },
    series: [
      { name: '高危', type: 'line', stack: 'Total', areaStyle: {}, smooth: true, data: [3, 2, 4, 1, 2, 3, 2], itemStyle: { color: '#f5222d' } },
      { name: '中危', type: 'line', stack: 'Total', areaStyle: {}, smooth: true, data: [5, 7, 4, 6, 3, 5, 4], itemStyle: { color: '#faad14' } },
      { name: '低危', type: 'line', stack: 'Total', areaStyle: {}, smooth: true, data: [8, 6, 7, 5, 4, 6, 5], itemStyle: { color: '#52c41a' } },
    ],
  };

  const deptBarOption = {
    title: { text: '部门风险TOP5', left: 'center', textStyle: { fontSize: 16 } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: ['生产部', '仓储部', '销售部', '行政部', '财务部', '采购部'] },
    series: [{
      name: '预警数',
      type: 'bar',
      data: [5, 8, 12, 15, 23, 31],
      itemStyle: { color: '#E34D59', borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right' },
    }],
  };

  // ==================== Stats ====================

  const stats = {
    total: alerts.length,
    pending: alerts.filter(a => a.status === 'pending').length,
    high: alerts.filter(a => a.severity === 'high' && a.status === 'pending').length,
    today: alerts.filter(a => a.createdAt.startsWith('2026-06-05')).length,
  };

  return (
    <Layout className="risk-alert-page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="page-title"><AlertOutlined /> 风险预警中心</h2>
            <p className="page-subtitle">7×24小时自动风险扫描，实时预警推送</p>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            loading={scanLoading}
            onClick={handleScan}
            style={{ background: '#E34D59', borderColor: '#E34D59' }}
          >
            {scanLoading ? '扫描中...' : '立即扫描'}
          </Button>
        </div>
      </div>

      <Content className="page-content">
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
              <Statistic title="今日新增" value={stats.today} valueStyle={{ color: '#E34D59' }}
                prefix={<ThunderboltOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="活跃规则" value={rules.filter(r => r.isActive).length}
                suffix={`/${rules.length}`} prefix={<SettingOutlined />} />
            </Card>
          </Col>
        </Row>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'alerts',
              label: (
                <span>
                  <AlertOutlined /> 预警事件
                  {stats.pending > 0 && <Badge count={stats.pending} style={{ marginLeft: 6 }} />}
                </span>
              ),
              children: (
                <div className="content-card">
                  <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <Input.Search
                      placeholder="搜索预警内容、编号..."
                      allowClear
                      style={{ width: 300 }}
                      prefix={<SearchOutlined />}
                    />
                    <RangePicker style={{ width: 260 }} />
                    <Button icon={<FilterOutlined />}>高级筛选</Button>
                    <Button icon={<ReloadOutlined />} onClick={() => { setAlerts([...mockAlerts]); message.success('已刷新'); }}>
                      刷新
                    </Button>
                  </div>
                  <Table
                    columns={alertColumns}
                    dataSource={alerts}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
                    scroll={{ x: 1200 }}
                  />
                </div>
              ),
            },
            {
              key: 'rules',
              label: <span><SettingOutlined /> 规则管理</span>,
              children: (
                <div className="content-card">
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <Input.Search placeholder="搜索规则名称..." allowClear style={{ width: 280 }} prefix={<SearchOutlined />} />
                      <Select placeholder="风险类型" allowClear style={{ width: 140 }}>
                        <Option value="采购价格偏离">采购价格偏离</Option>
                        <Option value="费用异常">费用异常</Option>
                        <Option value="往来异常">往来异常</Option>
                        <Option value="资产异常">资产异常</Option>
                        <Option value="内控缺陷">内控缺陷</Option>
                      </Select>
                    </Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRule} style={{ background: '#E34D59', borderColor: '#E34D59' }}>
                      新建规则
                    </Button>
                  </div>
                  <Table
                    columns={ruleColumns}
                    dataSource={rules}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1300 }}
                  />
                </div>
              ),
            },
            {
              key: 'charts',
              label: <span><BarChartOutlined /> 风险看板</span>,
              children: (
                <div>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Card>
                        <ReactECharts option={riskTypePieOption} style={{ height: 350 }} />
                      </Card>
                    </Col>
                    <Col xs={24} md={12}>
                      <Card>
                        <ReactECharts option={riskTrendOption} style={{ height: 350 }} />
                      </Card>
                    </Col>
                    <Col xs={24} md={12}>
                      <Card>
                        <ReactECharts option={deptBarOption} style={{ height: 350 }} />
                      </Card>
                    </Col>
                    <Col xs={24} md={12}>
                      <Card title="预警处理统计" style={{ height: 386 }}>
                        <Row gutter={[16, 24]}>
                          <Col span={12}>
                            <Statistic title="已确认" value={alerts.filter(a => a.status === 'confirmed').length} valueStyle={{ color: '#faad14' }} />
                          </Col>
                          <Col span={12}>
                            <Statistic title="已解决" value={alerts.filter(a => a.status === 'resolved').length} valueStyle={{ color: '#52c41a' }} />
                          </Col>
                          <Col span={12}>
                            <Statistic title="误报" value={alerts.filter(a => a.status === 'false_positive').length} />
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
              ),
            },
          ]}
        />
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
                <Select placeholder="选择风险类型">
                  <Option value="采购价格偏离">采购价格偏离</Option>
                  <Option value="费用异常">费用异常</Option>
                  <Option value="往来异常">往来异常</Option>
                  <Option value="资产异常">资产异常</Option>
                  <Option value="内控缺陷">内控缺陷</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="规则描述">
            <Input.TextArea rows={2} placeholder="描述该规则的检测逻辑和触发条件" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="severity" label="严重等级">
                <Select>
                  <Option value="high"><Tag color="#f5222d">高</Tag> 高</Option>
                  <Option value="medium"><Tag color="#faad14">中</Tag> 中</Option>
                  <Option value="low"><Tag color="#52c41a">低</Tag> 低</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ruleType" label="规则类型">
                <Select>
                  <Option value="阈值类">阈值类</Option>
                  <Option value="逻辑类">逻辑类</Option>
                  <Option value="统计类">统计类</Option>
                  <Option value="AI模型">AI模型</Option>
                </Select>
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
