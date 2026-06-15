import React, { useState, useMemo, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Progress, Timeline, message, Spin } from 'antd';
import { getRiskStats } from '@/services/risk';
import { getAuditStats } from '@/services/audit';
import { getRectificationStats } from '@/services/rectification';
import { getDashboard } from '@/services/dataQuality';
import dayjs from 'dayjs';
import {
  AlertOutlined,
  FileDoneOutlined,
  AuditOutlined,
  RiseOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import FilterBar from '@/components/FilterBar';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import './DashboardPage.less';

// 注册ECharts组件
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  CanvasRenderer,
]);

const DashboardPage: React.FC = () => {
  const [dashboardOrg, setDashboardOrg] = useState('all');
  const [dashboardDateStart, setDashboardDateStart] = useState('2026-01-01');
  const [dashboardDateEnd, setDashboardDateEnd] = useState('2026-06-30');
  const [loading, setLoading] = useState(true);

  // API data states — fallback to null means use mock
  const [apiRiskStats, setApiRiskStats] = useState<Record<string, unknown> | null>(null);
  const [apiAuditStats, setApiAuditStats] = useState<Record<string, unknown> | null>(null);
  const [apiRectStats, setApiRectStats] = useState<Record<string, unknown> | null>(null);
  const [apiDqDashboard, setApiDqDashboard] = useState<Record<string, unknown> | null>(null);

  // Fetch all stats in parallel on mount and when org/date filters change
  useEffect(() => {
    fetchStats();
  }, [dashboardOrg, dashboardDateStart, dashboardDateEnd]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getRiskStats(),
        getAuditStats(),
        getRectificationStats(),
        getDashboard(),
      ]);
      const [riskR, auditR, rectR, dqR] = results;
      if (riskR.status === 'fulfilled' && riskR.value?.data) {
        setApiRiskStats(riskR.value.data as Record<string, unknown>);
      }
      if (auditR.status === 'fulfilled' && auditR.value?.data) {
        setApiAuditStats(auditR.value.data as Record<string, unknown>);
      }
      if (rectR.status === 'fulfilled' && rectR.value?.data) {
        setApiRectStats(rectR.value.data as Record<string, unknown>);
      }
      if (dqR.status === 'fulfilled' && dqR.value?.data) {
        setApiDqDashboard(dqR.value.data as Record<string, unknown>);
      }
    } catch (e) {
      console.log('API unavailable, using mock data');
    }
    setLoading(false);
  };

  // 从日期范围推导起止月份索引 (1-6)
  const startMonth = useMemo(() => dayjs(dashboardDateStart).month() + 1, [dashboardDateStart]);
  const endMonth = useMemo(() => dayjs(dashboardDateEnd).month() + 1, [dashboardDateEnd]);
  const visibleMonths = Math.max(1, endMonth - startMonth + 1);
  // 主体调整系数 (模拟不同主体的数据差异)
  const orgFactor = useMemo(() => {
    if (dashboardOrg === 'sz') return 1.0;
    if (dashboardOrg === 'zq') return 0.75;
    return 1.0;
  }, [dashboardOrg]);

  // 12个月份标签
  const allMonths = ['7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月'];

  // 统计卡片数据 - 响应筛选，优先使用API数据
  const statsData = useMemo(() => {
    const baseCoverage = Math.round((70 + endMonth * 2) * orgFactor * 10) / 10;
    const baseFindings = Math.round((15 + endMonth * 2 - (dashboardOrg === 'zq' ? 5 : 0)) * orgFactor);
    const baseRectRate = Math.round((88 + endMonth * 1.2) * 10) / 10;
    const todayAlerts = Math.max(1, Math.round((5 + (endMonth % 3)) * orgFactor));

    // API overrides (priority over mock)
    const aAudit = apiAuditStats ? (apiAuditStats as Record<string, number>) : null;
    const aRect = apiRectStats ? (apiRectStats as Record<string, number>) : null;
    const aRisk = apiRiskStats ? (apiRiskStats as Record<string, number>) : null;
    const aDq = apiDqDashboard ? (apiDqDashboard as Record<string, number>) : null;

    const coverageVal = aAudit?.coverage_rate != null ? aAudit.coverage_rate : baseCoverage;
    const findingsVal = aAudit?.total_findings != null ? aAudit.total_findings : baseFindings;
    const rectRateVal = aRect?.completion_rate != null ? aRect.completion_rate : baseRectRate;
    const alertCount = aRisk?.today_alerts != null ? aRisk.today_alerts : todayAlerts;

    return [
      { title: '审计覆盖率', value: `${coverageVal}%`, prefix: <RiseOutlined style={{ color: '#52c41a' }} />, progress: true as const, percent: coverageVal },
      { title: '重大发现数', value: findingsVal, prefix: <WarningOutlined style={{ color: '#f5222d' }} />, suffix: '个', progress: false as const, percent: 0 },
      { title: '整改完成率', value: `${Math.min(100, rectRateVal)}%`, prefix: <CheckCircleOutlined style={{ color: '#52c41a' }} />, progress: true as const, percent: Math.min(100, rectRateVal) },
      { title: '今日预警数', value: alertCount, prefix: <AlertOutlined style={{ color: '#faad14' }} />, suffix: '条', progress: false as const, percent: 0 },
    ];
  }, [endMonth, dashboardOrg, orgFactor, apiRiskStats, apiAuditStats, apiRectStats, apiDqDashboard]);

  // 月份号 → allMonths 索引映射 (allMonths 按财年7月~6月排列)
  const getMonthIndex = (m: number) => m >= 7 ? m - 7 : m + 5;

  // 风险趋势图表 - 时间轴随筛选变动
  const riskTrendOption = useMemo(() => {
    const baseHigh = [3, 4, 2, 5, 3, 4, 2, 3, 5, 4, 3, 2];
    const baseMid = [5, 6, 4, 7, 8, 6, 5, 7, 6, 8, 7, 5];
    const baseLow = [8, 10, 12, 9, 11, 13, 10, 12, 9, 11, 10, 12];

    // 构建 startMonth → endMonth 的月份序列（支持跨年）
    const months: number[] = [];
    if (startMonth <= endMonth) {
      for (let m = startMonth; m <= endMonth; m++) months.push(m);
    } else {
      for (let m = startMonth; m <= 12; m++) months.push(m);
      for (let m = 1; m <= endMonth; m++) months.push(m);
    }
    const indices = months.map(getMonthIndex);
    const count = months.length;

    const high = indices.map(i => Math.round(baseHigh[i] * orgFactor));
    const mid = indices.map(i => Math.round(baseMid[i] * orgFactor));
    const low = indices.map(i => Math.round(baseLow[i] * orgFactor));
    const xData = indices.map(i => allMonths[i]);
    return {
      title: { text: count <= 6 ? `近${count}个月风险趋势` : '近12个月风险趋势', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'axis' },
      legend: { data: ['高风险', '中风险', '低风险'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: xData },
      yAxis: { type: 'value', name: '预警数量' },
      series: [
        { name: '高风险', type: 'line', data: high, lineStyle: { color: '#f5222d', width: 2 }, itemStyle: { color: '#f5222d' } },
        { name: '中风险', type: 'line', data: mid, lineStyle: { color: '#faad14', width: 2 }, itemStyle: { color: '#faad14' } },
        { name: '低风险', type: 'line', data: low, lineStyle: { color: '#52c41a', width: 2 }, itemStyle: { color: '#52c41a' } },
      ],
    };
  }, [startMonth, endMonth, orgFactor, allMonths]);

  // 各部门整改率 - 随主体联动
  const allDepts = ['财务部', '采购部', '销售部', '生产部', '研发部', '行政部'];
  const baseDeptRates = [95, 92, 98, 87, 90, 94];
  const rectificationOption = useMemo(() => {
    const deptData = baseDeptRates.map(v => Math.min(100, Math.round((v - (dashboardOrg === 'zq' ? 3 : 0)) * orgFactor)));
    return {
      title: { text: '各部门整改率', left: 'center', textStyle: { fontSize: 16 } },
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'value', name: '%', max: 100 },
      yAxis: { type: 'category', data: allDepts },
      series: [{
        type: 'bar', data: deptData,
        itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#D7011D' }, { offset: 1, color: '#ff7a85' }]) },
      }],
    };
  }, [dashboardOrg, orgFactor, allDepts]);

  const alertColumns = [
    { title: '风险编号', dataIndex: 'alert_id', key: 'alert_id' },
    { title: '风险类型', dataIndex: 'risk_type', key: 'risk_type' },
    { title: '部门', dataIndex: 'dept_name', key: 'dept_name' },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => (
        <Tag color={severity === 'high' ? 'red' : severity === 'medium' ? 'gold' : 'green'}>
          {severity === 'high' ? '高风险' : severity === 'medium' ? '中风险' : '低风险'}
        </Tag>
      ),
    },
    { title: '预警时间', dataIndex: 'alert_time', key: 'alert_time' },
  ];

  // 预警数据 - 随筛选项联动（含 date 字段用于日期级筛选）
  const allMockAlerts = [
    { alert_id: 'ALT-20260605-001', risk_type: '采购', dept_name: '采购部', severity: 'high', alert_time: '2026-06-05 08:30', org: 'sz', month: 6, date: '2026-06-05' },
    { alert_id: 'ALT-20260605-002', risk_type: '财务', dept_name: '财务部', severity: 'medium', alert_time: '2026-06-05 07:15', org: 'sz', month: 6, date: '2026-06-05' },
    { alert_id: 'ALT-20260605-003', risk_type: '销售', dept_name: '销售部', severity: 'low', alert_time: '2026-06-05 06:45', org: 'zq', month: 6, date: '2026-06-05' },
    { alert_id: 'ALT-20260605-004', risk_type: '库存', dept_name: '生产部', severity: 'high', alert_time: '2026-06-05 05:30', org: 'zq', month: 6, date: '2026-06-05' },
    { alert_id: 'ALT-20260515-001', risk_type: '资金', dept_name: '财务部', severity: 'medium', alert_time: '2026-05-15 04:20', org: 'sz', month: 5, date: '2026-05-15' },
    { alert_id: 'ALT-20260510-001', risk_type: '合同', dept_name: '法务部', severity: 'high', alert_time: '2026-05-10 09:00', org: 'zq', month: 5, date: '2026-05-10' },
    { alert_id: 'ALT-20260420-001', risk_type: '采购', dept_name: '采购部', severity: 'low', alert_time: '2026-04-20 11:00', org: 'sz', month: 4, date: '2026-04-20' },
    { alert_id: 'ALT-20260405-001', risk_type: '库存', dept_name: '生产部', severity: 'medium', alert_time: '2026-04-05 14:00', org: 'zq', month: 4, date: '2026-04-05' },
  ];
  const dummyAlerts = useMemo(() => {
    return allMockAlerts.filter(a => {
      if (dashboardOrg !== 'all' && a.org !== dashboardOrg) return false;
      if (a.date < dashboardDateStart || a.date > dashboardDateEnd) return false;
      return true;
    }).slice(0, 5);
  }, [dashboardOrg, dashboardDateStart, dashboardDateEnd]);

  // 可视化-费用结构分析
  const feeOption = useMemo(() => {
    const deptNames = ['销售部', '研发部', '采购部', '财务部', '行政部', 'IT部', '生产部'];
    const baseFee = [285.6, 234.1, 156.3, 89.2, 67.8, 145.0, 92.4];
    const baseBudget = [250, 280, 150, 100, 80, 140, 95];
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 56, right: 16, top: 24, bottom: 36 },
      xAxis: { type: 'category', data: deptNames, axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
      series: [
        { name: '费用总额(万)', type: 'bar', data: baseFee.map(v => Math.round(v * orgFactor * 10) / 10), barMaxWidth: 30, itemStyle: { borderRadius: [6, 6, 0, 0], color: '#D7011D' } },
        { name: '预算(万)', type: 'bar', data: baseBudget.map(v => Math.round(v * orgFactor * 10) / 10), barMaxWidth: 30, itemStyle: { borderRadius: [6, 6, 0, 0], color: '#1890ff' } },
      ],
      legend: { bottom: 0 },
    };
  }, [orgFactor]);

  // 审计发现分类 - 随主体调整
  const findingPieOption = useMemo(() => {
    const base = [35, 25, 20, 12, 8];
    const names = ['财务合规', '采购流程', '资产管理', 'IT控制', '其他'];
    const colors = ['#D7011D', '#fa8c16', '#1890ff', '#52c41a', '#722ed1'];
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie', radius: ['40%', '70%'],
        data: base.map((v, i) => ({ value: Math.round(v * orgFactor), name: names[i], itemStyle: { color: colors[i] } })),
        label: { formatter: '{b}\n{d}%' },
      }],
    };
  }, [orgFactor]);

  // 整改进度趋势 - 时间轴随筛选变动
  const rectTrendOption = useMemo(() => {
    const baseData = [45, 52, 58, 65, 72, 78];
    const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月'];
    const start = Math.max(0, startMonth - 1);
    const end = endMonth;
    const data = baseData.slice(start, end);
    const labels = monthLabels.slice(start, end);
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 54, right: 20, top: 24, bottom: 24 },
      xAxis: { type: 'category', data: labels, boundaryGap: false, axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', name: '%', axisLabel: { fontSize: 11 }, min: 0, max: 100 },
      series: [{
        type: 'line', smooth: true, data,
        symbol: 'circle', symbolSize: 6,
        lineStyle: { color: '#D7011D', width: 3 },
        itemStyle: { color: '#D7011D' },
      }],
    };
  }, [startMonth, endMonth]);

  return (
    <div className="dashboard-page">
      <div className="page-content">
        <FilterBar
          orgValue={dashboardOrg}
          onOrgChange={setDashboardOrg}
          dateStart={dashboardDateStart}
          dateEnd={dashboardDateEnd}
          onDateStartChange={setDashboardDateStart}
          onDateEndChange={setDashboardDateEnd}
          onRefresh={() => { fetchStats(); message.success('数据已刷新'); }}
          onExport={() => message.info('正在导出 Dashboard 数据...')}
        />

        <Spin spinning={loading} tip="加载中...">
        {/* 统计卡片 */}
        <Row gutter={[16, 16]} className="stats-row">
          {statsData.map((stat, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <Card className="stat-card">
                <Statistic
                  title={stat.title}
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  valueStyle={{ color: '#1890ff', fontSize: 28 }}
                />
                {stat.progress && (
                  <Progress
                    percent={stat.percent}
                    size="small"
                    showInfo={false}
                    style={{ marginTop: 8 }}
                  />
                )}
              </Card>
            </Col>
          ))}
        </Row>

        {/* 图表区域 */}
        <Row gutter={[16, 16]} className="chart-row">
          <Col xs={24} lg={12}>
            <Card className="chart-card">
              <ReactEChartsCore echarts={echarts} option={riskTrendOption} style={{ height: 350 }} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card className="chart-card">
              <ReactEChartsCore echarts={echarts} option={rectificationOption} style={{ height: 350 }} />
            </Card>
          </Col>
        </Row>

        {/* 可视化分析 */}
        <Row gutter={[16, 16]} className="chart-row" style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card className="chart-card" title="📊 费用结构分析" extra={<Tag color="blue">{dashboardDateStart} ~ {dashboardDateEnd}</Tag>}>
              <ReactEChartsCore echarts={echarts} option={feeOption} style={{ height: 350 }} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card className="chart-card" title="🥧 审计发现分类" extra={<Tag color="orange">累计</Tag>}>
              <ReactEChartsCore echarts={echarts} option={findingPieOption} style={{ height: 350 }} />
            </Card>
          </Col>
        </Row>

        {/* 整改进度趋势 */}
        <Row gutter={[16, 16]} className="chart-row" style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card className="chart-card" title="📈 近6月整改完成率趋势" extra={<Tag color="green">趋势分析</Tag>}>
              <ReactEChartsCore echarts={echarts} option={rectTrendOption} style={{ height: 250 }} />
            </Card>
          </Col>
        </Row>

        {/* 最新预警 */}
        <Card title="📋 最新预警 TOP 5" className="alert-card">
          <Table
            columns={alertColumns}
            dataSource={dummyAlerts}
            rowKey="alert_id"
            pagination={false}
            size="small"
          />
        </Card>
        </Spin>
      </div>
    </div>
  );
};

export default DashboardPage;