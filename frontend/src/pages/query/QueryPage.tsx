import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Tabs, Table, Button, Space, Tag, Input, Select, Card,
  Row, Col, Divider, Typography, Empty, message, Collapse, Spin, Avatar,
  Tooltip, List,
} from 'antd';
import {
  SearchOutlined, BulbOutlined, BarChartOutlined, SendOutlined,
  ReloadOutlined, ThunderboltOutlined, CopyOutlined, CodeOutlined,
  TableOutlined, LineChartOutlined, PieChartOutlined, UserOutlined,
  RobotOutlined, ClearOutlined, StarOutlined, HistoryOutlined,
  DownloadOutlined, WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, PieChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import './QueryPage.less';

echarts.use([BarChart, PieChart, LineChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

const { Content } = Layout;
const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

// ---- 查询模板 ----
interface QueryTemplate {
  id: string; category: string; title: string; description: string; sql: string;
  tags: string[];
}
const mockTemplates: QueryTemplate[] = [
  { id: 'TPL-001', category: '费用', title: '各部门费用支出排名', description: '按部门统计本月费用总额并排名',
    sql: 'SELECT dept_name, SUM(amount) AS total FROM T_EXPENSE WHERE month=cur_month GROUP BY dept_name ORDER BY total DESC',
    tags: ['费用', '排名', '部门'] },
  { id: 'TPL-002', category: '采购', title: '大额采购合同查询', description: '查询金额超过阈值的采购合同',
    sql: 'SELECT * FROM T_CONTRACT WHERE total_amount > 100000 AND contract_type="采购" ORDER BY total_amount DESC',
    tags: ['采购', '合同', '大额'] },
  { id: 'TPL-003', category: '风险', title: '供应商风险筛查', description: '筛选存在经营异常的供应商',
    sql: 'SELECT * FROM T_SUPPLIER WHERE risk_level IN ("高","中") AND status="active"',
    tags: ['供应商', '风险', '筛查'] },
  { id: 'TPL-004', category: '审计', title: '审计发现统计', description: '按类型和等级统计审计发现',
    sql: 'SELECT finding_type, severity, COUNT(*) as cnt FROM T_AUDIT_FINDING GROUP BY finding_type, severity ORDER BY cnt DESC',
    tags: ['审计', '统计', '发现'] },
  { id: 'TPL-005', category: '整改', title: '逾期整改工单', description: '查询所有逾期的整改工单',
    sql: 'SELECT * FROM T_RECTIFICATION WHERE deadline < CURDATE() AND status NOT IN ("closed","verified") ORDER BY deadline',
    tags: ['整改', '逾期', '工单'] },
  { id: 'TPL-006', category: '费用', title: '差旅费异常检测', description: '筛选差旅费超出预算150%的记录',
    sql: 'SELECT * FROM T_EXPENSE WHERE category="差旅" AND amount > budget * 1.5 ORDER BY amount DESC',
    tags: ['差旅', '异常', '预算'] },
];

// ---- 模拟结果 ----
interface QueryResult {
  columns: string[]; rows: Record<string, any>[]; sql: string; rowCount: number;
  visualization?: 'table' | 'bar' | 'pie' | 'line'; chartData?: any;
}

const mockResults: Record<string, QueryResult> = {
  '各部门费用支出排名': {
    columns: ['部门', '费用总额(万)', '预算(万)', '执行率'],
    rows: [
      { '部门': '销售部', '费用总额(万)': 285.6, '预算(万)': 250, '执行率': '114%' },
      { '部门': '研发部', '费用总额(万)': 234.1, '预算(万)': 280, '执行率': '84%' },
      { '部门': '采购部', '费用总额(万)': 156.3, '预算(万)': 150, '执行率': '104%' },
      { '部门': '财务部', '费用总额(万)': 89.2, '预算(万)': 100, '执行率': '89%' },
      { '部门': '行政部', '费用总额(万)': 67.8, '预算(万)': 80, '执行率': '85%' },
      { '部门': 'IT部', '费用总额(万)': 145.0, '预算(万)': 140, '执行率': '104%' },
      { '部门': '生产部', '费用总额(万)': 92.4, '预算(万)': 95, '执行率': '97%' },
    ],
    sql: 'SELECT dept_name AS "部门", SUM(amount)/10000 AS "费用总额(万)", budget/10000 AS "预算(万)", CONCAT(ROUND(SUM(amount)/budget*100),"%") AS "执行率" FROM T_EXPENSE e JOIN T_BUDGET b ON e.dept_id=b.dept_id WHERE MONTH(e.date)=MONTH(CURDATE()) GROUP BY dept_name, budget ORDER BY SUM(amount) DESC',
    rowCount: 7, visualization: 'bar',
    chartData: { xData: ['销售部', '研发部', '采购部', '财务部', '行政部', 'IT部', '生产部'],
      series: [{ name: '费用总额', data: [285.6, 234.1, 156.3, 89.2, 67.8, 145.0, 92.4] }, { name: '预算', data: [250, 280, 150, 100, 80, 140, 95] }] },
  },
  '大额采购合同': {
    columns: ['合同编号', '供应商', '合同金额(万)', '签订日期', '采购类别'],
    rows: [
      { '合同编号': 'C2025-0045', '供应商': '深圳明源科技', '合同金额(万)': 358.0, '签订日期': '2025-03-15', '采购类别': 'IT设备' },
      { '合同编号': 'C2025-0052', '供应商': '广州建材集团', '合同金额(万)': 286.5, '签订日期': '2025-04-02', '采购类别': '原材料' },
      { '合同编号': 'C2025-0031', '供应商': '佛山五金公司', '合同金额(万)': 178.2, '签订日期': '2025-02-20', '采购类别': '五金配件' },
      { '合同编号': 'C2025-0068', '供应商': '北京软件公司', '合同金额(万)': 156.0, '签订日期': '2025-05-10', '采购类别': '软件服务' },
      { '合同编号': 'C2025-0041', '供应商': '上海物流公司', '合同金额(万)': 132.0, '签订日期': '2025-03-28', '采购类别': '物流服务' },
    ],
    sql: 'SELECT contract_no AS "合同编号", supplier_name AS "供应商", total_amount/10000 AS "合同金额(万)", sign_date AS "签订日期", category AS "采购类别" FROM T_CONTRACT WHERE total_amount > 100000 AND contract_type="采购" ORDER BY total_amount DESC',
    rowCount: 5, visualization: 'bar',
    chartData: { xData: ['深圳明源', '广州建材', '佛山五金', '北京软件', '上海物流'],
      series: [{ name: '合同金额(万)', data: [358, 286.5, 178.2, 156, 132] }] },
  },
};

// ---- 聊天消息 ----
interface ChatMessage {
  id: string; role: 'user' | 'assistant'; content: string; time: string;
  result?: QueryResult;
}

const QueryPage: React.FC = () => {
  const [queryText, setQueryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [vizMode, setVizMode] = useState<'table' | 'bar' | 'pie' | 'line'>('table');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const [history, setHistory] = useState<string[]>([]);

  // Agent 聊天
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'assistant', content: '你好！我是审计智能助手 🤖  \n我可以帮你：\n- 📊 自然语言查询数据\n- 📈 分析审计趋势和异常\n- 📝 生成审计报告摘要\n\n请告诉我想了解什么？', time: '15:00' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // NL2SQL查询
  const handleQuery = () => {
    if (!queryText.trim()) { messageApi.warning('请输入查询内容'); return; }
    setLoading(true);
    // 模拟查询
    setTimeout(() => {
      let found: QueryResult | null = null;
      if (queryText.includes('部门') || queryText.includes('费用') || queryText.includes('排名')) {
        found = mockResults['各部门费用支出排名'];
      } else if (queryText.includes('合同') || queryText.includes('采购')) {
        found = mockResults['大额采购合同'];
      }
      if (found) {
        setResult(found);
        setVizMode(found.visualization || 'table');
        messageApi.success(`查询完成，返回 ${found.rowCount} 条结果`);
      } else {
        setResult({
          columns: ['提示'],
          rows: [{ '提示': '未找到匹配结果，请尝试更具体的查询条件' }],
          sql: '-- 未能生成SQL',
          rowCount: 0,
        });
        messageApi.info('未找到匹配结果');
      }
      setHistory(prev => [queryText, ...prev.slice(0, 9)]);
      setLoading(false);
    }, 1500);
  };

  // 模板快速查询
  const handleTemplateQuery = (tplId: string) => {
    const tpl = mockTemplates.find(t => t.id === tplId);
    if (!tpl) return;
    setQueryText(tpl.title);
    setSelectedTemplate(tplId);
    setLoading(true);
    setTimeout(() => {
      if (tpl.category === '费用') setResult(mockResults['各部门费用支出排名']);
      else if (tpl.category === '采购') setResult(mockResults['大额采购合同']);
      else {
        setResult({
          columns: ['结果'], rows: [{ '结果': `模板 "${tpl.title}" 执行成功（模拟数据）` }],
          sql: tpl.sql, rowCount: 1,
        });
      }
      setHistory(prev => [tpl.title, ...prev.slice(0, 9)]);
      setLoading(false);
      messageApi.success('模板查询完成');
    }, 1000);
  };

  // Agent 聊天发送
  const handleChatSend = () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: chatInput, time: new Date().toLocaleTimeString() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    // 模拟回复
    setTimeout(() => {
      let reply: string;
      let qr: QueryResult | undefined;
      if (chatInput.includes('费用') || chatInput.includes('部门') || chatInput.includes('排名')) {
        reply = '好的，我已经查询了各部门本月费用支出情况：';
        qr = mockResults['各部门费用支出排名'];
      } else if (chatInput.includes('合同') || chatInput.includes('采购')) {
        reply = '已查询大额采购合同，以下是结果：';
        qr = mockResults['大额采购合同'];
      } else if (chatInput.includes('风险') || chatInput.includes('预警')) {
        reply = '当前系统共有 12 条活跃风险预警：\n- 🔴 高风险 3 条（采购流程、IT权限、账户安全）\n- 🟡 中风险 5 条\n- 🟢 低风险 4 条\n\n建议优先处理高风险项。';
      } else if (chatInput.includes('报告') || chatInput.includes('总结')) {
        reply = '📋 **本月审计摘要**\n\n本月完成审计项目 3 个，发现主要问题：\n1. 采购合同审批（高风险）- 已整改中\n2. 费用报销附件不完整（中风险）- 逾期未完成\n3. 固定资产盘点差异（高风险）- 已派发整改\n\n整改完成率 78%，2条逾期工单需关注。';
      } else {
        reply = `关于"${chatInput.slice(0, 20)}"，我需要更多信息才能给出准确回答。你能补充一下具体想了解的维度吗？（如：时间范围、部门、金额范围等）`;
      }
      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: reply, time: new Date().toLocaleTimeString(), result: qr };
      setChatMessages(prev => [...prev, botMsg]);
    }, 1500);
  };

  // ECharts 可视化
  const getChartOption = (): any => {
    if (!result?.chartData) return {};
    const { xData, series } = result.chartData;
    if (vizMode === 'bar') {
      return {
        tooltip: { trigger: 'axis' },
        legend: { bottom: 0 },
        grid: { left: 56, right: 16, top: 24, bottom: 36 },
        xAxis: { type: 'category', data: xData, axisLabel: { fontSize: 11 } },
        yAxis: { type: 'value', axisLabel: { fontSize: 11 }, nameTextStyle: { fontSize: 10 } },
        series: series.map((s: any, i: number) => ({ ...s, type: 'bar', barMaxWidth: 40,
          itemStyle: { borderRadius: [6, 6, 0, 0], color: i === 0 ? '#E34D59' : '#1890ff' } })),
      };
    }
    if (vizMode === 'pie') {
      return {
        tooltip: { trigger: 'item' },
        series: [{ type: 'pie', radius: ['40%', '70%'],
          data: xData.map((x: string, i: number) => ({ name: x, value: series[0]?.data[i] || 0 })),
        }],
      };
    }
    if (vizMode === 'line') {
      return {
        tooltip: { trigger: 'axis' },
        grid: { left: 54, right: 20, top: 24, bottom: 24 },
        xAxis: { type: 'category', data: xData, boundaryGap: false, axisLabel: { fontSize: 11 } },
        yAxis: { type: 'value', axisLabel: { fontSize: 11 }, nameTextStyle: { fontSize: 10 } },
        series: series.map((s: any) => ({ ...s, type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, areaStyle: { opacity: 0.1 } })),
      };
    }
    return {};
  };

  // 动态表格列
  const getColumns = (): ColumnsType<any> => {
    if (!result?.columns) return [];
    return result.columns.map(c => ({ title: c, dataIndex: c, key: c, ellipsis: true }));
  };

  return (
    <Layout>
      {contextHolder}
      <div className="page-header">
        <h2 className="page-title">🔎 智能查询中心</h2>
        <p className="page-subtitle">NL2SQL 自然语言查询 + 审计机器人 Agent</p>
      </div>
      <Content className="page-content">
        <Tabs defaultActiveKey="nl2sql" items={[
          {
            key: 'nl2sql',
            label: <span><SearchOutlined /> NL2SQL 查询</span>,
            children: (
              <div>
                {/* 查询输入区 */}
                <div className="content-card">
                  <Text strong style={{ fontSize: 15 }}>输入自然语言查询</Text>
                  <Row gutter={12} style={{ marginTop: 12 }}>
                    <Col flex="auto">
                      <TextArea rows={3} placeholder="例如：查询上季度采购金额超过10万的合同，按金额降序排列"
                        value={queryText} onChange={e => setQueryText(e.target.value)}
                        style={{ fontSize: 14 }} disabled={loading} />
                    </Col>
                    <Col>
                      <Button type="primary" icon={<SearchOutlined />} onClick={handleQuery} loading={loading}
                        size="large" style={{ height: '100%', minHeight: 72 }}>
                        {loading ? '查询中...' : '查询'}
                      </Button>
                    </Col>
                  </Row>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={4}>
                      <Text type="secondary" style={{ fontSize: 12 }}>ⓘ 支持：部门/费用/合同/供应商/审计发现/整改 等维度的自然语言查询</Text>
                    </Space>
                    <Button size="small" icon={<ClearOutlined />} onClick={() => { setQueryText(''); setResult(null); }}>清空</Button>
                  </div>
                </div>

                {/* 查询模板 */}
                <div className="content-card" style={{ marginTop: 16 }}>
                  <Text strong>快速模板</Text>
                  <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                    {mockTemplates.map(tpl => (
                      <Col xs={24} sm={12} md={8} key={tpl.id}>
                        <Card size="small" hoverable className={selectedTemplate === tpl.id ? 'tpl-card-selected' : ''}
                          onClick={() => handleTemplateQuery(tpl.id)}>
                          <Card.Meta
                            title={<Space><Tag color="blue">{tpl.category}</Tag>{tpl.title}</Space>}
                            description={tpl.description}
                          />
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>

                {/* 查询结果 */}
                <Spin spinning={loading} tip="正在生成SQL并执行查询...">
                  <div style={{ marginTop: 16 }}>
                    {result ? (
                      <>
                        {/* SQL展示 */}
                        <Collapse ghost size="small" items={[{
                          key: 'sql', label: <span><CodeOutlined /> 生成的SQL</span>,
                          children: <div style={{ background: '#1F1F1F', color: '#a6e22e', padding: 12, borderRadius: 6, fontFamily: 'monospace', fontSize: 13, overflowX: 'auto' }}>
                            {result.sql}
                          </div>,
                        }]} />

                        {/* 可视化切换 */}
                        <Card size="small" style={{ marginTop: 12 }}
                          title={<Space>
                            <span>查询结果 ({result.rowCount} 条)</span>
                            <Tag color="blue">NL2SQL</Tag>
                          </Space>}
                          extra={
                            <Space>
                              <Space.Compact size="small">
                                <Tooltip title="表格"><Button type={vizMode === 'table' ? 'primary' : 'default'} icon={<TableOutlined />} onClick={() => setVizMode('table')} /></Tooltip>
                                <Tooltip title="柱状图"><Button type={vizMode === 'bar' ? 'primary' : 'default'} icon={<BarChartOutlined />} onClick={() => setVizMode('bar')} /></Tooltip>
                                <Tooltip title="饼图"><Button type={vizMode === 'pie' ? 'primary' : 'default'} icon={<PieChartOutlined />} onClick={() => setVizMode('pie')} /></Tooltip>
                                <Tooltip title="折线图"><Button type={vizMode === 'line' ? 'primary' : 'default'} icon={<LineChartOutlined />} onClick={() => setVizMode('line')} /></Tooltip>
                              </Space.Compact>
                              <Button size="small" icon={<CopyOutlined />} onClick={() => messageApi.success('已复制到剪贴板')}>复制</Button>
                              <Button size="small" icon={<DownloadOutlined />} onClick={() => messageApi.info('导出中...')}>导出</Button>
                            </Space>
                          }>
                          {vizMode === 'table' ? (
                            <Table columns={getColumns()} dataSource={result.rows.map((r, i) => ({ ...r, key: i }))}
                              pagination={{ pageSize: 10, showTotal: t => `共 ${t} 条` }} size="small" scroll={{ x: 600 }} />
                          ) : (
                            <ReactEChartsCore echarts={echarts} option={getChartOption()} style={{ height: 350 }} />
                          )}
                        </Card>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 60 }}>
                        <SearchOutlined style={{ fontSize: 56, color: '#d9d9d9', marginBottom: 16 }} />
                        <div><Text type="secondary">输入自然语言查询，或点击上方模板快速开始</Text></div>
                      </div>
                    )}
                  </div>
                </Spin>

                {/* 查询历史 */}
                {history.length > 0 && (
                  <Card size="small" title={<span><HistoryOutlined /> 最近查询</span>} style={{ marginTop: 16 }}>
                    {history.map((h, i) => (
                      <Tag key={i} style={{ marginBottom: 8, cursor: 'pointer' }}
                        onClick={() => setQueryText(h)}>{h}</Tag>
                    ))}
                  </Card>
                )}
              </div>
            ),
          },
          {
            key: 'agent',
            label: <span><BulbOutlined /> 审计 Agent</span>,
            children: (
              <div>
                <Row gutter={16}>
                  {/* 聊天区域 */}
                  <Col span={18}>
                    <Card size="small" title={<Space><RobotOutlined /> 审计智能助手</Space>}
                      extra={<Button size="small" icon={<ClearOutlined />} onClick={() => setChatMessages([chatMessages[0]])}>清空对话</Button>}
                      style={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, maxHeight: 'calc(70vh - 120px)' }}>
                        {chatMessages.map(msg => (
                          <div key={msg.id} style={{ marginBottom: 16, display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 8 }}>
                            <Avatar icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                              style={{ background: msg.role === 'user' ? '#1890ff' : '#E34D59' }} />
                            <div style={{ maxWidth: '75%', background: msg.role === 'user' ? '#e6f7ff' : '#f6f6f6', padding: '10px 14px', borderRadius: 10, whiteSpace: 'pre-wrap' }}>
                              <Text>{msg.content}</Text>
                              <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{msg.time}</div>
                            </div>
                          </div>
                        ))}
                        <div ref={chatEndRef} />
                      </div>
                      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                        <Row gutter={8}>
                          <Col flex="auto">
                            <TextArea value={chatInput} onChange={e => setChatInput(e.target.value)}
                              placeholder="输入你的问题，如：本月销售费用趋势怎么样？"
                              onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                              rows={2} />
                          </Col>
                          <Col>
                            <Button type="primary" icon={<SendOutlined />} onClick={handleChatSend}
                              style={{ height: '100%' }}>发送</Button>
                          </Col>
                        </Row>
                        <Space size={4} style={{ marginTop: 8 }}>
                          <Tag style={{ cursor: 'pointer' }} onClick={() => setChatInput('各部门费用排名')}>各部门费用排名</Tag>
                          <Tag style={{ cursor: 'pointer' }} onClick={() => setChatInput('查看风险预警')}>查看风险预警</Tag>
                          <Tag style={{ cursor: 'pointer' }} onClick={() => setChatInput('生成本月审计摘要')}>生成本月审计摘要</Tag>
                        </Space>
                      </div>
                    </Card>
                  </Col>

                  {/* Agent能力面板 */}
                  <Col span={6}>
                    <Card size="small" title="Agent 能力" style={{ marginBottom: 16 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Card size="small"><Text strong>📊 问数</Text><br /><Text type="secondary">自然语言查询和分析</Text></Card>
                        <Card size="small"><Text strong>📈 分析</Text><br /><Text type="secondary">统计分析和趋势检测</Text></Card>
                        <Card size="small"><Text strong>📝 报告</Text><br /><Text type="secondary">自动生成审计报告</Text></Card>
                        <Card size="small"><Text strong>🔄 多轮</Text><br /><Text type="secondary">上下文理解和追问</Text></Card>
                      </Space>
                    </Card>
                    <Card size="small" title="快捷操作">
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Button block icon={<ThunderboltOutlined />} onClick={() => messageApi.info('正在生成本月审计概况...')}>本月审计概况</Button>
                        <Button block icon={<WarningOutlined />} onClick={() => navigate('/risk')}>查看风险预警</Button>
                        <Button block icon={<StarOutlined />} onClick={() => messageApi.info('正在生成摘要报告...')}>生成摘要报告</Button>
                      </Space>
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'visualization',
            label: <span><BarChartOutlined /> 可视化</span>,
            children: (
              <div>
                <Row gutter={16}>
                  <Col span={12}>
                    <Card size="small" title="📊 费用结构分析" extra={<Tag color="blue">自动推荐</Tag>}>
                      <ReactEChartsCore echarts={echarts} option={{
                        tooltip: { trigger: 'axis' },
                        grid: { left: 56, right: 16, top: 24, bottom: 36 },
                        xAxis: { type: 'category', data: ['销售部', '研发部', '采购部', '财务部', '行政部', 'IT部', '生产部'], axisLabel: { fontSize: 11 } },
                        yAxis: { type: 'value', axisLabel: { fontSize: 11 }, nameTextStyle: { fontSize: 10 } },
                        series: [
                          { name: '费用总额(万)', type: 'bar', data: [285.6, 234.1, 156.3, 89.2, 67.8, 145.0, 92.4], barMaxWidth: 36, itemStyle: { borderRadius: [6, 6, 0, 0], color: '#E34D59' } },
                          { name: '预算(万)', type: 'bar', data: [250, 280, 150, 100, 80, 140, 95], barMaxWidth: 36, itemStyle: { borderRadius: [6, 6, 0, 0], color: '#1890ff' } },
                        ],
                        legend: { bottom: 0 },
                      }} style={{ height: 350 }} />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="🥧 审计发现分类" extra={<Tag color="blue">自动推荐</Tag>}>
                      <ReactEChartsCore echarts={echarts} option={{
                        tooltip: { trigger: 'item' },
                        legend: { bottom: 0 },
                        series: [{
                          type: 'pie', radius: ['40%', '70%'],
                          data: [
                            { value: 35, name: '财务合规', itemStyle: { color: '#E34D59' } },
                            { value: 25, name: '采购流程', itemStyle: { color: '#fa8c16' } },
                            { value: 20, name: '资产管理', itemStyle: { color: '#1890ff' } },
                            { value: 12, name: 'IT控制', itemStyle: { color: '#52c41a' } },
                            { value: 8, name: '其他', itemStyle: { color: '#722ed1' } },
                          ],
                          label: { formatter: '{b}\n{d}%' },
                        }],
                      }} style={{ height: 350 }} />
                    </Card>
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <Card size="small" title="📈 近6月整改完成率趋势" extra={<Tag color="green">趋势分析</Tag>}>
                      <ReactEChartsCore echarts={echarts} option={{
                        tooltip: { trigger: 'axis' },
                        grid: { left: 54, right: 20, top: 24, bottom: 24 },
                        xAxis: { type: 'category', data: ['1月', '2月', '3月', '4月', '5月', '6月'], boundaryGap: false, axisLabel: { fontSize: 11 } },
                        yAxis: { type: 'value', name: '%', axisLabel: { fontSize: 11 }, nameTextStyle: { fontSize: 10 }, min: 0, max: 100 },
                        series: [{
                          type: 'line', smooth: true, data: [45, 52, 58, 65, 72, 78],
                          symbol: 'circle', symbolSize: 6,
                          areaStyle: { color: 'rgba(227,77,89,0.12)' },
                          lineStyle: { color: '#E34D59', width: 3 },
                          itemStyle: { color: '#E34D59' },
                        }],
                      }} style={{ height: 250 }} />
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
        ]} />
      </Content>
    </Layout>
  );
};

export default QueryPage;
