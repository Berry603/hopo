import React, { useState, useMemo } from 'react';
import {
  Layout, Tabs, Table, Button, Space, Tag, Input, Select, Card,
  Modal, Form, Drawer, Row, Col, Statistic, Progress, Popconfirm,
  message, Switch, Tooltip, Badge, Tree, Typography,
} from 'antd';
import {
  DatabaseOutlined, SyncOutlined, HighlightOutlined, LinkOutlined,
  PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined,
  WarningOutlined, ClockCircleOutlined, CloudSyncOutlined,
  PlayCircleOutlined, PauseCircleOutlined, ExclamationCircleOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import './DataQualityPage.less';

echarts.use([BarChart, PieChart, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

const { Content } = Layout;
const { TextArea } = Input;
const { Text } = Typography;

// ---- 模拟数据 ----
interface QualityRule {
  id: string; name: string; targetSystem: string; targetTable: string;
  targetField: string; ruleType: string; threshold: string; status: boolean;
  lastCheck: string; passRate: number;
}
const mockRules: QualityRule[] = [
  { id: 'QR-001', name: '采购金额空值检测', targetSystem: '金蝶ERP', targetTable: 'T_PURCHASE', targetField: 'amount',
    ruleType: 'null_check', threshold: '空值率<1%', status: true, lastCheck: '2026-06-05 09:00', passRate: 98.5 },
  { id: 'QR-002', name: '合同金额异常值检测', targetSystem: '金蝶ERP', targetTable: 'T_CONTRACT', targetField: 'total_amount',
    ruleType: 'outlier', threshold: '3σ范围外', status: true, lastCheck: '2026-06-05 08:30', passRate: 95.2 },
  { id: 'QR-003', name: '审批流一致性校验', targetSystem: '云之家OA', targetTable: 'T_APPROVAL', targetField: 'flow_status',
    ruleType: 'consistency', threshold: '一致率>99%', status: true, lastCheck: '2026-06-05 09:15', passRate: 99.8 },
  { id: 'QR-004', name: '供应商信息完整性', targetSystem: 'SRM', targetTable: 'T_SUPPLIER', targetField: 'tax_id',
    ruleType: 'completeness', threshold: '完整率>95%', status: false, lastCheck: '2026-06-04 18:00', passRate: 88.7 },
  { id: 'QR-005', name: '费用科目一致性检查', targetSystem: '金蝶ERP', targetTable: 'T_EXPENSE', targetField: 'account_code',
    ruleType: 'consistency', threshold: '一致率>98%', status: true, lastCheck: '2026-06-05 07:45', passRate: 97.1 },
  { id: 'QR-006', name: '月度波动检测-销售', targetSystem: '金蝶ERP', targetTable: 'T_SALES', targetField: 'revenue',
    ruleType: 'fluctuation', threshold: '波动<20%', status: true, lastCheck: '2026-06-05 09:30', passRate: 93.5 },
];

interface SyncSource {
  id: string; systemName: string; adapterType: string; status: 'online' | 'syncing' | 'error' | 'offline';
  lastSync: string; syncInterval: string; delay: number; totalRecords: number; todaySync: number;
}
const mockSources: SyncSource[] = [
  { id: 'SRC-001', systemName: '金蝶ERP', adapterType: 'kingdee', status: 'online', lastSync: '2026-06-05 09:45',
    syncInterval: '每30分钟', delay: 2, totalRecords: 1280000, todaySync: 45600 },
  { id: 'SRC-002', systemName: '云之家OA', adapterType: 'yunzhijia', status: 'syncing', lastSync: '2026-06-05 09:30',
    syncInterval: '每15分钟', delay: 5, totalRecords: 560000, todaySync: 12300 },
  { id: 'SRC-003', systemName: 'CRM系统', adapterType: 'mysql', status: 'online', lastSync: '2026-06-05 09:40',
    syncInterval: '每小时', delay: 1, totalRecords: 340000, todaySync: 8900 },
  { id: 'SRC-004', systemName: 'SRM系统', adapterType: 'mysql', status: 'error', lastSync: '2026-06-05 08:00',
    syncInterval: '每小时', delay: 105, totalRecords: 210000, todaySync: 0 },
  { id: 'SRC-005', systemName: 'HR系统', adapterType: 'postgresql', status: 'online', lastSync: '2026-06-05 09:35',
    syncInterval: '每2小时', delay: 3, totalRecords: 89000, todaySync: 1200 },
];

const statusMap: Record<string, { color: string; text: string }> = {
  online: { color: '#52c41a', text: '在线' },
  syncing: { color: '#1890ff', text: '同步中' },
  error: { color: '#f5222d', text: '异常' },
  offline: { color: '#d9d9d9', text: '离线' },
};

const DataQualityPage: React.FC = () => {
  const [rules, setRules] = useState<QualityRule[]>(mockRules);
  const [sources, setSources] = useState<SyncSource[]>(mockSources);
  const [searchText, setSearchText] = useState('');
  const [messageApi, contextHolder] = message.useMessage();
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<QualityRule | null>(null);
  const [ruleForm] = Form.useForm();

  // 编辑/切换规则
  const handleToggleRule = (id: string, checked: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, status: checked } : r));
    messageApi.info(checked ? '规则已启用' : '规则已停用');
  };

  const handleAddRule = () => {
    setEditingRule(null);
    ruleForm.resetFields();
    setRuleModalVisible(true);
  };
  const handleEditRule = (record: QualityRule) => {
    setEditingRule(record);
    ruleForm.setFieldsValue(record);
    setRuleModalVisible(true);
  };
  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
    messageApi.success('规则已删除');
  };
  const handleRuleModalOk = async () => {
    const values = await ruleForm.validateFields();
    if (editingRule) {
      setRules(prev => prev.map(r => r.id === editingRule.id ? { ...r, ...values } : r));
      messageApi.success('规则已更新');
    } else {
      setRules(prev => [{ id: `QR-${Date.now()}`, ...values, lastCheck: '-', passRate: 0 }, ...prev]);
      messageApi.success('规则已创建');
    }
    setRuleModalVisible(false);
  };

  // 同步操作
  const handleSync = (id: string) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, status: 'syncing', todaySync: s.todaySync + 500 } : s));
    messageApi.info('触发手动同步中...');
    setTimeout(() => {
      setSources(prev => prev.map(s => s.id === id ? { ...s, status: 'online', lastSync: new Date().toLocaleString(), delay: 1 } : s));
      messageApi.success('同步完成');
    }, 3000);
  };
  const handlePauseSource = (id: string) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, status: 'offline' } : s));
    messageApi.warning('同步已暂停');
  };

  // 质量评分统计
  const stats = useMemo(() => ({
    overall: 91.5,
    totalRules: rules.length,
    active: rules.filter(r => r.status).length,
    failedRules: rules.filter(r => r.passRate < 95).length,
    totalSync: sources.reduce((a, b) => a + b.todaySync, 0),
    errorSources: sources.filter(s => s.status === 'error').length,
  }), [rules, sources]);

  // 规则列
  const ruleColumns: ColumnsType<QualityRule> = [
    { title: '编号', dataIndex: 'id', width: 100 },
    { title: '规则名称', dataIndex: 'name', width: 180, ellipsis: true },
    { title: '目标系统', dataIndex: 'targetSystem', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    { title: '表/字段', key: 'target', width: 180, render: (_, r) => <span>{r.targetTable}.<Text style={{ color: '#E34D59' }}>{r.targetField}</Text></span> },
    { title: '规则类型', dataIndex: 'ruleType', width: 90,
      render: (v: string) => {
        const map: Record<string, string> = { null_check: '空值', outlier: '异常值', consistency: '一致性', completeness: '完整性', fluctuation: '波动' };
        return <Tag>{map[v] || v}</Tag>;
      } },
    { title: '阈值', dataIndex: 'threshold', width: 110 },
    { title: '最近检查', dataIndex: 'lastCheck', width: 140 },
    { title: '通过率', dataIndex: 'passRate', width: 120,
      render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 95 ? '#52c41a' : '#fa8c16'} format={p => `${p?.toFixed(1)}%`} /> },
    { title: '状态', dataIndex: 'status', width: 80,
      render: (v: boolean) => <Switch checked={v} onChange={(c) => handleToggleRule(ruleColumns.length > 0 ? '' : '', c)} />,
    },
    { title: '操作', width: 160, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" type="link" icon={<EyeOutlined />}>详情</Button>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEditRule(record)}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDeleteRule(record.id)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 同步源列
  const sourceColumns: ColumnsType<SyncSource> = [
    { title: '系统名称', dataIndex: 'systemName', width: 140, render: (v, r) => <Space><Badge status={r.status === 'online' ? 'success' : r.status === 'error' ? 'error' : 'processing'} /><Text strong>{v}</Text></Space> },
    { title: '适配器', dataIndex: 'adapterType', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    { title: '状态', dataIndex: 'status', width: 90, render: (s: string) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag> },
    { title: '延迟', dataIndex: 'delay', width: 80, render: (v: number) => <span style={{ color: v > 60 ? '#f5222d' : '#52c41a' }}>{v}分钟</span> },
    { title: '最近同步', dataIndex: 'lastSync', width: 160 },
    { title: '频率', dataIndex: 'syncInterval', width: 100 },
    { title: '总记录', dataIndex: 'totalRecords', width: 100, render: (v: number) => v.toLocaleString() },
    { title: '今日同步', dataIndex: 'todaySync', width: 100, render: (v: number) => v.toLocaleString() },
    { title: '操作', width: 140, render: (_, r) => (
      <Space size="small">
        <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleSync(r.id)}>同步</Button>
        <Button size="small" icon={<PauseCircleOutlined />} onClick={() => handlePauseSource(r.id)} danger>暂停</Button>
      </Space>
    )},
  ];

  // ECharts
  const gaugeOption = {
    series: [{
      type: 'gauge', radius: '80%', center: ['50%', '55%'],
      startAngle: 210, endAngle: -30,
      min: 0, max: 100,
      progress: { show: true, width: 18, itemStyle: { color: '#52c41a' } },
      axisLine: { lineStyle: { width: 18, color: [[0.6, '#f5222d'], [0.8, '#fa8c16'], [0.95, '#52c41a'], [1, '#52c41a']] } },
      axisTick: { show: false }, splitLine: { show: false },
      axisLabel: { show: false },
      detail: { valueAnimation: true, fontSize: 32, formatter: '{value}%', color: '#E34D59', offsetCenter: [0, '80%'] },
      data: [{ value: stats.overall }],
    }],
  };

  const barOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 54, right: 16, top: 16, bottom: 24 },
    xAxis: { type: 'category', data: ['金蝶ERP', '云之家OA', 'CRM', 'SRM', 'HR'], axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', name: '通过率%', axisLabel: { fontSize: 11 }, nameTextStyle: { fontSize: 10 } },
    series: [{
      type: 'bar', data: [98.5, 99.8, 96.2, 88.7, 97.1],
      itemStyle: { borderRadius: [6, 6, 0, 0],
        color: (params: any) => params.value >= 95 ? '#52c41a' : '#fa8c16' },
    }],
  };

  const pieOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [{
      type: 'pie', radius: ['40%', '65%'], center: ['50%', '45%'],
      data: [
        { value: stats.active, name: '启用', itemStyle: { color: '#52c41a' } },
        { value: rules.length - stats.active, name: '停用', itemStyle: { color: '#d9d9d9' } },
      ],
      label: { formatter: '{b}: {c}' },
    }],
  };

  return (
    <Layout>
      {contextHolder}
      <div className="page-header">
        <h2 className="page-title">📊 数据治理与质量中心</h2>
        <p className="page-subtitle">数据接入、清洗、质量校验、血缘追踪</p>
      </div>
      <Content className="page-content">
        <Tabs defaultActiveKey="dashboard" items={[
          {
            key: 'dashboard',
            label: <span><DatabaseOutlined /> 质量总览</span>,
            children: (
              <div className="content-card">
                <Row gutter={16}>
                  <Col span={6}><Card size="small"><Statistic title="数据质量得分" value={stats.overall} suffix="分" precision={1} valueStyle={{ color: '#E34D59' }} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="启用规则数" value={stats.active} suffix={`/ ${stats.totalRules}`} prefix={<CheckCircleOutlined />} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="异常规则数" value={stats.failedRules} valueStyle={{ color: '#fa8c16' }} prefix={<WarningOutlined />} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="今日同步量" value={stats.totalSync} prefix={<CloudSyncOutlined />} /></Card></Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={8}>
                    <Card size="small" title="综合质量评分"><ReactEChartsCore echarts={echarts} option={gaugeOption} style={{ height: 260 }} /></Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" title="各系统通过率"><ReactEChartsCore echarts={echarts} option={barOption} style={{ height: 260 }} /></Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" title="规则启用率"><ReactEChartsCore echarts={echarts} option={pieOption} style={{ height: 260 }} /></Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'rules',
            label: <span><HighlightOutlined /> 质量规则</span>,
            children: (
              <div className="content-card">
                <Space style={{ marginBottom: 16 }}>
                  <Input.Search placeholder="搜索规则名称" allowClear style={{ width: 220 }}
                    value={searchText} onChange={e => setSearchText(e.target.value)} />
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRule}>新建规则</Button>
                  <Button icon={<ReloadOutlined />} onClick={() => messageApi.info('已刷新')}>刷新</Button>
                </Space>
                <Table columns={ruleColumns} dataSource={rules} rowKey="id" pagination={false} scroll={{ x: 1300 }} size="middle" />
              </div>
            ),
          },
          {
            key: 'sync',
            label: <span><SyncOutlined /> 同步监控</span>,
            children: (
              <div className="content-card">
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}><Card size="small"><Statistic title="数据源总数" value={sources.length} prefix={<DatabaseOutlined />} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="在线" value={sources.filter(s => s.status === 'online').length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="异常" value={sources.filter(s => s.status === 'error').length} valueStyle={{ color: '#f5222d' }} prefix={<WarningOutlined />} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="今日总同步" value={stats.totalSync.toLocaleString()} /></Card></Col>
                </Row>
                <Table columns={sourceColumns} dataSource={sources} rowKey="id" pagination={false} size="middle" />
              </div>
            ),
          },
          {
            key: 'lineage',
            label: <span><LinkOutlined /> 数据血缘</span>,
            children: (
              <div className="content-card">
                <Row gutter={16}>
                  <Col span={6}><Card size="small"><Statistic title="血缘节点" value={24} prefix={<ApartmentOutlined />} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="血缘链路" value={8} prefix={<LinkOutlined />} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="影响分析" value={15} prefix={<ExclamationCircleOutlined />} /></Card></Col>
                  <Col span={6}><Card size="small"><Statistic title="变更通知" value={3} valueStyle={{ color: '#E34D59' }} /></Card></Col>
                </Row>
                <Card size="small" title="数据血缘关系图" style={{ marginTop: 16 }}>
                  <Tree showLine defaultExpandAll
                    treeData={[
                      { title: <Text strong style={{ fontSize: 15 }}>📊 审计驾驶舱</Text>, key: '0', children: [
                        { title: <Text strong>📋 审计报告</Text>, key: '0-0', children: [
                          { title: '📝 审计底稿', key: '0-0-0', children: [
                            { title: <Tag color="blue">金蝶ERP</Tag>, key: '0-0-0-0', children: [
                              { title: '采购表 (T_PURCHASE)', key: '0-0-0-0-0' },
                              { title: '费用表 (T_EXPENSE)', key: '0-0-0-0-1' },
                            ] },
                            { title: <Tag color="cyan">云之家OA</Tag>, key: '0-0-0-1', children: [
                              { title: '审批流 (T_APPROVAL)', key: '0-0-0-1-0' },
                            ] },
                          ] },
                        ] },
                        { title: <Text strong>⚠️ 风险预警</Text>, key: '0-1', children: [
                          { title: <Tag color="blue">金蝶ERP</Tag>, key: '0-1-0' },
                          { title: <Tag color="purple">SRM</Tag>, key: '0-1-1' },
                        ] },
                        { title: <Text strong>🔎 智能查询</Text>, key: '0-2', children: [
                          { title: '数据仓库 (DWD)', key: '0-2-0' },
                        ] },
                      ] },
                    ]}
                  />
                </Card>
                <Card size="small" title="最近变更通知" style={{ marginTop: 16 }}>
                  <Table columns={[
                    { title: '字段', dataIndex: 'field' }, { title: '来源', dataIndex: 'source' },
                    { title: '变更类型', dataIndex: 'type', render: (v: string) => <Tag color={v === '新增' ? 'green' : v === '修改' ? 'orange' : 'red'}>{v}</Tag> },
                    { title: '影响范围', dataIndex: 'impact' },
                    { title: '时间', dataIndex: 'time' },
                  ]} dataSource={[
                    { field: 'T_EXPENSE.amount', source: '金蝶ERP', type: '修改', impact: '费用审计底稿、风险规则QR-005', time: '2026-06-05 08:00' },
                    { field: 'T_SUPPLIER.tax_id', source: 'SRM', type: '新增', impact: '供应商分析报表', time: '2026-06-04 15:30' },
                    { field: 'T_APPROVAL.node_id', source: '云之家OA', type: '删除', impact: '审批流分析、风险规则QR-003', time: '2026-06-04 10:00' },
                  ]} rowKey="field" pagination={false} size="small" />
                </Card>
              </div>
            ),
          },
        ]} />

        {/* 规则弹窗 */}
        <Modal title={editingRule ? '编辑质量规则' : '新建质量规则'} open={ruleModalVisible}
          onOk={handleRuleModalOk} onCancel={() => setRuleModalVisible(false)} width={560} destroyOnClose>
          <Form form={ruleForm} layout="vertical" initialValues={{ ruleType: 'null_check', status: true }}>
            <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
              <Input placeholder="如：采购金额空值检测" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="targetSystem" label="目标系统" rules={[{ required: true }]}>
                  <Select options={['金蝶ERP', '云之家OA', 'CRM', 'SRM', 'HR'].map(s => ({ value: s, label: s }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="targetTable" label="目标表" rules={[{ required: true }]}>
                  <Input placeholder="T_PURCHASE" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="targetField" label="目标字段" rules={[{ required: true }]}>
                  <Input placeholder="amount" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="ruleType" label="规则类型" rules={[{ required: true }]}>
                  <Select options={[
                    { value: 'null_check', label: '空值检测' }, { value: 'outlier', label: '异常值检测' },
                    { value: 'consistency', label: '一致性校验' }, { value: 'completeness', label: '完整性检查' },
                    { value: 'fluctuation', label: '波动检测' },
                  ]} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="threshold" label="阈值条件" rules={[{ required: true }]}>
              <Input placeholder="如：空值率<1%" />
            </Form.Item>
            <Form.Item name="status" label="启用状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default DataQualityPage;
