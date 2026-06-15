import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Layout, Table, Button, Space, Tag, Input, Select, DatePicker,
  Modal, Form, Drawer, Steps, Progress, Descriptions, Badge, Popconfirm,
  message, Row, Col, Card, Statistic, Timeline, Empty, Typography,
  Upload,
} from 'antd';
import {
  FileDoneOutlined, CheckCircleOutlined, BarChartOutlined,
  SearchOutlined, PlusOutlined, ExclamationCircleOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined,
  ArrowUpOutlined, WarningOutlined, ThunderboltOutlined,
  DownloadOutlined, ReloadOutlined, FilterOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import FilterBar from '@/components/FilterBar';
import './RectificationPage.less';

echarts.use([BarChart, PieChart, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

const { Content } = Layout;
const { TextArea } = Input;
const { Text } = Typography;

// ---- 模拟数据 ----
interface RectOrder {
  id: string; title: string; department: string; source: string;
  severity: 'high' | 'medium' | 'low'; status: 'pending' | 'in_progress' | 'overdue' | 'verified' | 'closed';
  assignee: string; deadline: string; progress: number;
  createdAt: string; description: string; evidence: string[];
  verifyStatus?: 'passed' | 'returned' | 'pending';
  org: string; month: number;
}
const mockOrders: RectOrder[] = [
  { id: 'REC-20260101', title: '采购合同审批流程缺陷整改', department: '采购部', source: 'AUD-20250001',
    severity: 'high', status: 'in_progress', assignee: '张敏', deadline: '2026-06-15', progress: 65,
    createdAt: '2026-01-15', description: '采购合同无金额上限审批节点，需补充分级审批流程',
    evidence: ['流程截图.png', '整改方案.docx'], verifyStatus: 'pending', org: 'sz', month: 1 },
  { id: 'REC-20260102', title: '费用报销附件不完整整改', department: '财务部', source: 'AUD-20250001',
    severity: 'medium', status: 'overdue', assignee: '李芳', deadline: '2026-05-20', progress: 30,
    createdAt: '2026-02-03', description: '差旅费报销缺少行程单和发票附件，需补全并规范流程',
    evidence: ['补传清单.xlsx'], verifyStatus: 'pending', org: 'sz', month: 2 },
  { id: 'REC-20260103', title: '固定资产盘点差异整改', department: '行政部', source: 'AUD-20250003',
    severity: 'high', status: 'pending', assignee: '王刚', deadline: '2026-07-01', progress: 0,
    createdAt: '2026-03-10', description: 'IT设备实物与账面差异28台，需全面盘点和账实核对',
    evidence: [], verifyStatus: 'pending', org: 'zq', month: 3 },
  { id: 'REC-20260104', title: '供应商准入资质审查整改', department: '采购部', source: 'AUD-20250002',
    severity: 'low', status: 'verified', assignee: '陈婷', deadline: '2026-04-10', progress: 100,
    createdAt: '2026-01-20', description: '部分供应商营业执照过期未更新，已补全',
    evidence: ['营业执照.pdf', '资质清单.xlsx'], verifyStatus: 'passed', org: 'sz', month: 1 },
  { id: 'REC-20260105', title: '销售合同毛利率异常整改', department: '销售部', source: 'AUD-20250004',
    severity: 'medium', status: 'in_progress', assignee: '赵磊', deadline: '2026-06-30', progress: 45,
    createdAt: '2026-04-01', description: '部分合同毛利率低于公司标准3%，需核查定价逻辑',
    evidence: ['定价分析.xlsx'], verifyStatus: 'pending', org: 'zq', month: 4 },
  { id: 'REC-20260106', title: 'IT系统权限回收整改', department: 'IT部', source: 'AUD-20250005',
    severity: 'high', status: 'overdue', assignee: '刘洋', deadline: '2026-05-01', progress: 20,
    createdAt: '2026-03-15', description: '离职员工账号未及时回收，存在安全风险',
    evidence: [], verifyStatus: 'pending', org: 'sz', month: 3 },
  { id: 'REC-20260107', title: '差旅标准超标整改', department: '财务部', source: 'AUD-20250006',
    severity: 'low', status: 'closed', assignee: '李芳', deadline: '2026-05-10', progress: 100,
    createdAt: '2026-02-15', description: '已修订差旅管理制度，超额费用已追回',
    evidence: ['制度修订版.pdf'], verifyStatus: 'passed', org: 'zq', month: 2 },
];

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待派发' },
  in_progress: { color: 'processing', text: '进行中' },
  overdue: { color: 'error', text: '已逾期' },
  verified: { color: 'success', text: '已验证' },
  closed: { color: 'default', text: '已归档' },
};

const severityMap: Record<string, { color: string; text: string }> = {
  high: { color: '#f5222d', text: '高' },
  medium: { color: '#fa8c16', text: '中' },
  low: { color: '#52c41a', text: '低' },
};

const RectificationPage: React.FC = () => {
  const [orders, setOrders] = useState<RectOrder[]>(mockOrders);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RectOrder | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState<RectOrder | null>(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const { tab = 'orders' } = useParams<{ tab: string }>();

  const [rectOrg, setRectOrg] = useState('all');
  const [rectDateStart, setRectDateStart] = useState('2026-01-01');
  const [rectDateEnd, setRectDateEnd] = useState('2026-06-30');

  const rectStartMonth = useMemo(() => dayjs(rectDateStart).month() + 1, [rectDateStart]);
  const rectEndMonth = useMemo(() => dayjs(rectDateEnd).month() + 1, [rectDateEnd]);

  // 筛选（含 FilterBar 机构/日期范围）
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (searchText && !o.title.includes(searchText) && !o.id.includes(searchText)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(o.status)) return false;
      if (severityFilter.length > 0 && !severityFilter.includes(o.severity)) return false;
      if (rectOrg !== 'all' && o.org !== rectOrg) return false;
      if (o.createdAt < rectDateStart || o.createdAt > rectDateEnd) return false;
      return true;
    });
  }, [orders, searchText, statusFilter, severityFilter, rectOrg, rectDateStart, rectDateEnd]);

  // 统计（基于筛选后的数据）
  const stats = useMemo(() => ({
    total: filteredOrders.length,
    pending: filteredOrders.filter(o => o.status === 'pending').length,
    overdue: filteredOrders.filter(o => o.status === 'overdue').length,
    completed: filteredOrders.filter(o => o.status === 'verified' || o.status === 'closed').length,
  }), [filteredOrders]);

  // 查看详情
  const handleView = (record: RectOrder) => {
    setSelectedOrder(record);
    setDrawerVisible(true);
  };

  // 新建/编辑
  const handleAdd = () => {
    setEditingOrder(null);
    form.resetFields();
    setModalVisible(true);
  };
  const handleEdit = (record: RectOrder) => {
    setEditingOrder(record);
    form.setFieldsValue({
      ...record,
      deadline: record.deadline ? dayjs(record.deadline) : undefined,
    });
    setModalVisible(true);
  };
  const handleDelete = (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
    messageApi.success('整改工单已删除');
  };
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      // 将 dayjs/Date 类型字段统一转为字符串，避免 React 渲染崩溃
      const clean = { ...values };
      if (clean.deadline && typeof clean.deadline === 'object') {
        clean.deadline = clean.deadline.format?.('YYYY-MM-DD') || String(clean.deadline);
      }
      if (editingOrder) {
        setOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, ...clean } : o));
        messageApi.success('整改工单已更新');
      } else {
        const newOrder: RectOrder = {
          id: `REC-${Date.now()}`,
          ...clean,
          progress: 0,
          createdAt: new Date().toISOString().split('T')[0],
          evidence: [],
          verifyStatus: 'pending',
        };
        setOrders(prev => [newOrder, ...prev]);
        messageApi.success('整改工单已创建');
      }
      setModalVisible(false);
    } catch {}
  };

  // 状态操作
  const handleStatusChange = (id: string, newStatus: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus as any } : o));
    messageApi.success('状态已更新');
  };

  // 批量升级逾期
  const handleEscalate = () => {
    const count = orders.filter(o => o.status === 'overdue').length;
    messageApi.warning(`已对 ${count} 条逾期工单发送督办通知`);
  };

  // 验证管理操作（强制上传验证依据）
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<{ id: string; result: 'passed' | 'returned' } | null>(null);
  const [verifyEvidence, setVerifyEvidence] = useState<File[]>([]);
  const [verifyComment, setVerifyComment] = useState('');

  const handleVerifyClick = (id: string, result: 'passed' | 'returned') => {
    setVerifyTarget({ id, result });
    setVerifyEvidence([]);
    setVerifyComment('');
    setVerifyModalVisible(true);
  };

  const handleVerifyConfirm = () => {
    if (!verifyTarget) return;
    if (verifyEvidence.length === 0) {
      messageApi.warning('请上传验证依据文件');
      return;
    }
    if (!verifyComment.trim()) {
      messageApi.warning('请填写验证说明');
      return;
    }
    setOrders(prev => prev.map(o => o.id === verifyTarget.id ? {
      ...o,
      verifyStatus: verifyTarget.result,
      status: verifyTarget.result === 'passed' ? 'verified' as const : 'in_progress' as const,
      evidence: [...o.evidence, ...verifyEvidence.map(f => f.name)],
    } : o));
    messageApi.success(verifyTarget.result === 'passed' ? '验证通过' : '已退回重改');
    setVerifyModalVisible(false);
  };

  // ---- 列定义 ----
  const columns: ColumnsType<RectOrder> = [
    { title: '工单编号', dataIndex: 'id', key: 'id', width: 140, fixed: 'left' },
    { title: '整改标题', dataIndex: 'title', key: 'title', width: 220, ellipsis: true,
      render: (text, record) => <a onClick={() => handleView(record)}>{text}</a> },
    { title: '责任部门', dataIndex: 'department', key: 'department', width: 100 },
    { title: '风险等级', dataIndex: 'severity', key: 'severity', width: 90,
      render: (s: string) => <Tag color={severityMap[s].color}>{severityMap[s].text}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => <Badge status={s === 'overdue' ? 'error' : (s === 'verified' || s === 'closed' ? 'success' : 'processing')}>{statusMap[s]?.text}</Badge> },
    { title: '整改人', dataIndex: 'assignee', key: 'assignee', width: 80 },
    { title: '截止日期', dataIndex: 'deadline', key: 'deadline', width: 110, sorter: (a, b) => a.deadline.localeCompare(b.deadline) },
    { title: '进度', dataIndex: 'progress', key: 'progress', width: 130,
      render: (v: number) => <Progress percent={v} size="small" strokeColor={v >= 100 ? '#52c41a' : '#D7011D'} /> },
    { title: '操作', key: 'action', width: 200, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => handleView(record)}>查看</Button>
          {record.status !== 'closed' && record.status !== 'verified' && (
            <>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
              <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  // ---- ECharts (从筛选后数据动态构建) ----
  const barOption = useMemo(() => {
    const depts = ['采购部', '财务部', '行政部', '销售部', 'IT部'];
    const completed = depts.map(d => filteredOrders.filter(o => o.department === d && (o.status === 'verified' || o.status === 'closed')).length);
    const progressing = depts.map(d => filteredOrders.filter(o => o.department === d && o.status === 'in_progress').length);
    const overdue = depts.map(d => filteredOrders.filter(o => o.department === d && o.status === 'overdue').length);
    const pending = depts.map(d => filteredOrders.filter(o => o.department === d && o.status === 'pending').length);
    return {
      tooltip: { trigger: 'axis' as const },
      legend: { data: ['已完成', '进行中', '逾期', '待派发'], bottom: 0 },
      grid: { left: 48, right: 16, top: 24, bottom: 36 },
      xAxis: { type: 'category' as const, data: depts, axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value' as const, axisLabel: { fontSize: 11 } },
      series: [
        { name: '已完成', type: 'bar' as const, stack: 'total', data: completed, color: '#52c41a' },
        { name: '进行中', type: 'bar' as const, stack: 'total', data: progressing, color: '#1890ff' },
        { name: '逾期', type: 'bar' as const, stack: 'total', data: overdue, color: '#f5222d' },
        { name: '待派发', type: 'bar' as const, stack: 'total', data: pending, color: '#d9d9d9' },
      ],
    };
  }, [filteredOrders]);

  const pieOption = useMemo(() => {
    const completed = filteredOrders.filter(o => o.status === 'verified' || o.status === 'closed').length;
    const progressing = filteredOrders.filter(o => o.status === 'in_progress').length;
    const overdue = filteredOrders.filter(o => o.status === 'overdue').length;
    const pending = filteredOrders.filter(o => o.status === 'pending').length;
    return {
      tooltip: { trigger: 'item' as const },
      legend: { orient: 'vertical' as const, right: 0, top: 'center' },
      series: [{
        type: 'pie' as const, radius: ['40%', '70%'], center: ['40%', '50%'],
        data: [
          { value: completed, name: '已完成', itemStyle: { color: '#52c41a' } },
          { value: progressing, name: '进行中', itemStyle: { color: '#1890ff' } },
          { value: overdue, name: '逾期', itemStyle: { color: '#f5222d' } },
          { value: pending, name: '待派发', itemStyle: { color: '#d9d9d9' } },
        ],
        label: { formatter: '{b}\n{d}%' as any },
      }],
    };
  }, [filteredOrders]);

  const lineOption = useMemo(() => {
    const fullData = [45, 52, 58, 65, 72, 78];
    const months = ['1月', '2月', '3月', '4月', '5月', '6月'];
    const start = Math.max(0, rectStartMonth - 1);
    const data = fullData.slice(start, rectEndMonth);
    const labels = months.slice(start, rectEndMonth);
    return {
      tooltip: { trigger: 'axis' as const },
      grid: { left: 54, right: 20, top: 24, bottom: 24 },
      xAxis: { type: 'category' as const, data: labels, boundaryGap: false, axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value' as const, name: '完成率%', axisLabel: { fontSize: 11 }, nameTextStyle: { fontSize: 10 }, min: 0, max: 100 },
      series: [{
        type: 'line' as const, smooth: true, data,
        symbol: 'circle', symbolSize: 6,
        lineStyle: { color: '#D7011D', width: 2 },
        itemStyle: { color: '#D7011D' },
      }],
    };
  }, [rectStartMonth, rectEndMonth]);

  return (
    <Layout>
      {contextHolder}
      <Content className="page-content">
        {tab === 'orders' && (
          <div className="content-card">
            <FilterBar
              orgValue={rectOrg}
              onOrgChange={setRectOrg}
              dateStart={rectDateStart}
              dateEnd={rectDateEnd}
              onDateStartChange={setRectDateStart}
              onDateEndChange={setRectDateEnd}
              onRefresh={() => message.success('数据已刷新')}
              onExport={() => message.info('正在导出整改数据...')}
            />

            {/* 统计卡片 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Card size="small"><Statistic title="整改总数" value={stats.total} prefix={<FileDoneOutlined />} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="待派发" value={stats.pending} valueStyle={{ color: '#d9d9d9' }} prefix={<ClockCircleOutlined />} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="已逾期" value={stats.overdue} valueStyle={{ color: '#f5222d' }} prefix={<WarningOutlined />} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card></Col>
            </Row>

            {/* 工具栏 */}
            <Row justify="space-between" style={{ marginBottom: 16 }}>
              <Space>
                <Input placeholder="搜索工单编号/标题" prefix={<SearchOutlined />} value={searchText}
                  onChange={e => setSearchText(e.target.value)} allowClear style={{ width: 220 }} />
                <Select placeholder="状态筛选" allowClear mode="multiple" value={statusFilter}
                  onChange={setStatusFilter} style={{ width: 200 }}
                  options={Object.entries(statusMap).map(([k, v]) => ({ value: k, label: v.text }))} />
                <Select placeholder="风险等级" allowClear mode="multiple" value={severityFilter}
                  onChange={setSeverityFilter} style={{ width: 160 }}
                  options={Object.entries(severityMap).map(([k, v]) => ({ value: k, label: v.text }))} />
                <Button icon={<ReloadOutlined />} onClick={() => { setSearchText(''); setStatusFilter([]); setSeverityFilter([]); }}>重置</Button>
              </Space>
              <Space>
                <Button icon={<ThunderboltOutlined />} onClick={handleEscalate}>批量督办</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建整改工单</Button>
              </Space>
            </Row>

            {/* 表格 */}
            <Table columns={columns} dataSource={filteredOrders} rowKey="id"
              pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }} scroll={{ x: 1200 }} size="middle" />
          </div>
        )}
        {tab === 'verify' && (
          <div className="content-card">
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Card size="small"><Statistic title="待验证" value={4} prefix={<ClockCircleOutlined />} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="验证通过" value={2} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="退回重改" value={1} valueStyle={{ color: '#fa8c16' }} prefix={<ExclamationCircleOutlined />} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="通过率" value="66.7%" suffix="%" /></Card></Col>
            </Row>
            <Table columns={[
              { title: '工单编号', dataIndex: 'id', width: 140 },
              { title: '整改标题', dataIndex: 'title', ellipsis: true },
              { title: '责任部门', dataIndex: 'department', width: 100 },
              { title: '证据数量', dataIndex: 'evidence', width: 100, render: (v: string[]) => v.length },
              { title: '验证状态', dataIndex: 'verifyStatus', width: 100,
                render: (s: string) => {
                  const map: Record<string, { color: string; text: string }> = { pending: { color: 'blue', text: '待验证' }, passed: { color: 'green', text: '通过' }, returned: { color: 'orange', text: '退回' } };
                  return <Tag color={map[s]?.color}>{map[s]?.text || s}</Tag>;
                } },
              { title: '操作', width: 160, render: (_, record) => (
                <Space size="small">
                  <Button size="small" type="link" onClick={() => handleView(record)}>查看证据</Button>
                  {record.verifyStatus === 'pending' && (
                    <>
                      <Button size="small" type="link" style={{ color: '#52c41a' }} onClick={() => handleVerifyClick(record.id, 'passed')}>通过</Button>
                      <Button size="small" type="link" danger onClick={() => handleVerifyClick(record.id, 'returned')}>退回</Button>
                    </>
                  )}
                </Space>
              )},
            ]} dataSource={orders.filter(o => o.status === 'verified' || o.status === 'in_progress' || o.status === 'overdue')} rowKey="id"
              pagination={false} size="middle" />
          </div>
        )}
        {tab === 'stats' && (
          <div className="content-card">
            <Row gutter={16}>
              <Col span={8}><Card size="small" title="整改进度分布"><ReactEChartsCore echarts={echarts} option={pieOption} style={{ height: 280 }} /></Card></Col>
              <Col span={8}><Card size="small" title="部门整改概况"><ReactEChartsCore echarts={echarts} option={barOption} style={{ height: 280 }} /></Card></Col>
              <Col span={8}><Card size="small" title="整改完成率趋势"><ReactEChartsCore echarts={echarts} option={lineOption} style={{ height: 280 }} /></Card></Col>
            </Row>
            <Card size="small" title="整改周期分析" style={{ marginTop: 16 }}>
              <Row gutter={16}>
                <Col span={8}><Statistic title="平均整改周期" value={28} suffix="天" prefix={<ClockCircleOutlined />} /></Col>
                <Col span={8}><Statistic title="最短整改" value={10} suffix="天" valueStyle={{ color: '#52c41a' }} /></Col>
                <Col span={8}><Statistic title="最长整改" value={62} suffix="天" valueStyle={{ color: '#f5222d' }} /></Col>
              </Row>
            </Card>
          </div>
        )}

        {/* 详情抽屉 */}
        <Drawer title="整改工单详情" width={600} open={drawerVisible} onClose={() => setDrawerVisible(false)} destroyOnClose>
          {selectedOrder && (
            <div>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="工单编号">{selectedOrder.id}</Descriptions.Item>
                <Descriptions.Item label="状态"><Badge status={selectedOrder.status === 'overdue' ? 'error' : 'processing'}>{statusMap[selectedOrder.status]?.text || ''}</Badge></Descriptions.Item>
                <Descriptions.Item label="整改标题" span={2}>{selectedOrder.title}</Descriptions.Item>
                <Descriptions.Item label="责任部门">{selectedOrder.department}</Descriptions.Item>
                <Descriptions.Item label="整改人">{selectedOrder.assignee}</Descriptions.Item>
                <Descriptions.Item label="风险等级"><Tag color={severityMap[selectedOrder.severity]?.color}>{severityMap[selectedOrder.severity]?.text}</Tag></Descriptions.Item>
                <Descriptions.Item label="截止日期">{selectedOrder.deadline}</Descriptions.Item>
                <Descriptions.Item label="来源">{selectedOrder.source || '无'}</Descriptions.Item>
                <Descriptions.Item label="创建日期">{selectedOrder.createdAt}</Descriptions.Item>
                <Descriptions.Item label="整改描述" span={2}>{selectedOrder.description}</Descriptions.Item>
                <Descriptions.Item label="证据附件" span={2}>
                  {selectedOrder.evidence?.length > 0 ? (
                    <Space wrap>
                      {selectedOrder.evidence.map((e, i) => {
                        const ext = e.split('.').pop()?.toLowerCase();
                        const colorMap: Record<string, string> = { pdf: '#D7011D', xlsx: '#52c41a', xls: '#52c41a', docx: '#1677ff', doc: '#1677ff', png: '#fa8c16', jpg: '#fa8c16', csv: '#722ed1' };
                        const iconMap: Record<string, string> = { pdf: '📄', xlsx: '📊', xls: '📊', docx: '📝', doc: '📝', png: '🖼️', jpg: '🖼️', csv: '📋' };
                        return (
                          <Tag
                            key={i}
                            color={colorMap[ext || ''] || 'blue'}
                            style={{ cursor: 'pointer', fontSize: 13, padding: '2px 10px' }}
                            onClick={() => {
                              const content = `证据附件：${e}\n\n（此文件尚未上传至服务器，预览功能待对接文件存储后开放）`;
                              const blob = new Blob([content], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = e;
                              a.click();
                              URL.revokeObjectURL(url);
                              message.success(`正在预览: ${e}`);
                            }}
                          >
                            {(iconMap[ext || ''] || '📎')} {e} <DownloadOutlined style={{ marginLeft: 4 }} />
                          </Tag>
                        );
                      })}
                    </Space>
                  ) : <Text type="secondary">暂无证据</Text>}
                </Descriptions.Item>
              </Descriptions>
              <div style={{ marginTop: 16 }}>
                <Text strong>整改进度</Text>
                <Progress percent={selectedOrder.progress} strokeColor={selectedOrder.progress >= 100 ? '#52c41a' : '#D7011D'} style={{ marginTop: 8 }} />
              </div>
              <div style={{ marginTop: 16 }}>
                <Text strong>操作记录</Text>
                <Timeline style={{ marginTop: 8 }}
                  items={[
                    { children: `创建工单 — ${selectedOrder.createdAt}` },
                    { children: `派发至 ${selectedOrder.assignee}`, color: 'blue' },
                    { children: selectedOrder.status === 'overdue' ? '⚠️ 已逾期 — 发送督办通知' : '整改进行中', color: selectedOrder.status === 'overdue' ? 'red' : 'blue' },
                    ...(selectedOrder.status === 'verified' || selectedOrder.status === 'closed' ? [{ children: '✅ 验证通过 — 整改完成', color: 'green' }] : []),
                  ]}
                />
              </div>
            </div>
          )}
        </Drawer>

        {/* 新建/编辑弹窗 */}
        <Modal title={editingOrder ? '编辑整改工单' : '新建整改工单'} open={modalVisible}
          onOk={handleModalOk} onCancel={() => setModalVisible(false)} width={560} destroyOnClose>
          <Form form={form} layout="vertical" initialValues={{ severity: 'medium' }}>
            <Form.Item name="title" label="整改标题" rules={[{ required: true, message: '请输入标题' }]}>
              <Input placeholder="如：采购合同审批流程缺陷整改" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="department" label="责任部门" rules={[{ required: true }]}>
                  <Select options={['采购部', '财务部', '行政部', '销售部', 'IT部', '生产部', '研发部'].map(d => ({ value: d, label: d }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="assignee" label="整改人" rules={[{ required: true }]}>
                  <Input placeholder="输入整改人姓名" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="severity" label="风险等级" rules={[{ required: true }]}>
                  <Select options={Object.entries(severityMap).map(([k, v]) => ({ value: k, label: v.text }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="deadline" label="截止日期" rules={[{ required: true, message: '请选择截止日期' }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="source" label="关联来源">
              <Input placeholder="审计发现编号（选填）" />
            </Form.Item>
            <Form.Item name="description" label="整改描述" rules={[{ required: true }]}>
              <TextArea rows={4} placeholder="描述需要整改的问题和整改要求" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 验证弹窗 — 强制上传验证依据 */}
        <Modal title="整改验证" open={verifyModalVisible}
          onOk={handleVerifyConfirm} onCancel={() => setVerifyModalVisible(false)}
          okText={verifyTarget?.result === 'passed' ? '确认通过' : '确认退回'}
          okButtonProps={{ danger: verifyTarget?.result === 'returned' }}
          width={500}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              {verifyTarget?.result === 'passed' ? '验证通过' : '退回重改'}
            </div>
            <Input.TextArea
              rows={3}
              placeholder="请填写验证说明（必填）：通过依据 / 退回原因"
              value={verifyComment}
              onChange={e => setVerifyComment(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <Upload
              multiple
              beforeUpload={(file) => {
                setVerifyEvidence(prev => [...prev, file]);
                return false;
              }}
              onRemove={(file) => setVerifyEvidence(prev => prev.filter(f => f.name !== file.name))}
              fileList={verifyEvidence.map((f, i) => ({ uid: String(i), name: f.name, status: 'done' as const }))}
            >
              <Button icon={<UploadOutlined />}>上传验证依据（截图/报告/测试记录）</Button>
            </Upload>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              * 必须上传至少一个验证依据文件并填写说明
            </div>
          </div>
        </Modal>
      </Content>
    </Layout>
  );
};

export default RectificationPage;
