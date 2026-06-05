import React from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Progress, Timeline } from 'antd';
import {
  AlertOutlined,
  FileDoneOutlined,
  AuditOutlined,
  RiseOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
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
  // 统计卡片数据
  const statsData = [
    {
      title: '审计覆盖率',
      value: '78.5%',
      prefix: <RiseOutlined style={{ color: '#52c41a' }} />,
      progress: true,
      percent: 78.5,
    },
    {
      title: '重大发现数',
      value: 23,
      prefix: <WarningOutlined style={{ color: '#f5222d' }} />,
      suffix: '个',
    },
    {
      title: '整改完成率',
      value: '95.2%',
      prefix: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      progress: true,
      percent: 95.2,
    },
    {
      title: '今日预警数',
      value: 8,
      prefix: <AlertOutlined style={{ color: '#faad14' }} />,
      suffix: '条',
    },
  ];

  // 风险趋势图表配置
  const riskTrendOption = {
    title: {
      text: '近12个月风险趋势',
      left: 'center',
      textStyle: { fontSize: 16 },
    },
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['高风险', '中风险', '低风险'],
      bottom: 0,
    },
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月'],
    },
    yAxis: { type: 'value', name: '预警数量' },
    series: [
      {
        name: '高风险',
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        data: [3, 4, 2, 5, 3, 4, 2, 3, 5, 4, 3, 2],
        color: '#f5222d',
      },
      {
        name: '中风险',
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        data: [5, 6, 4, 7, 8, 6, 5, 7, 6, 8, 7, 5],
        color: '#faad14',
      },
      {
        name: '低风险',
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        data: [8, 10, 12, 9, 11, 13, 10, 12, 9, 11, 10, 12],
        color: '#52c41a',
      },
    ],
  };

  // 整改率图表配置
  const rectificationOption = {
    title: {
      text: '各部门整改率',
      left: 'center',
      textStyle: { fontSize: 16 },
    },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', name: '%', max: 100 },
    yAxis: {
      type: 'category',
      data: ['财务部', '采购部', '销售部', '生产部', '研发部', '行政部'],
    },
    series: [
      {
        type: 'bar',
        data: [95, 92, 98, 87, 90, 94],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#E34D59' },
            { offset: 1, color: '#ff7a85' },
          ]),
        },
      },
    ],
  };

  const alertColumns = [
    { title: '风险编号', dataIndex: 'alert_id', key: 'alert_id' },
    { title: '风险类型', dataIndex: 'risk_type', key: 'risk_type' },
    { title: '部门', dataIndex: 'dept_name', key: 'dept_name' },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => (
        <Tag color={severity === 'HIGH' ? 'red' : severity === 'MEDIUM' ? 'gold' : 'green'}>
          {severity === 'HIGH' ? '高风险' : severity === 'MEDIUM' ? '中风险' : '低风险'}
        </Tag>
      ),
    },
    { title: '预警时间', dataIndex: 'alert_time', key: 'alert_time' },
  ];

  const dummyAlerts = [
    { alert_id: 'ALT-20260605-001', risk_type: '采购', dept_name: '采购部', severity: 'HIGH', alert_time: '2026-06-05 08:30' },
    { alert_id: 'ALT-20260605-002', risk_type: '财务', dept_name: '财务部', severity: 'MEDIUM', alert_time: '2026-06-05 07:15' },
    { alert_id: 'ALT-20260605-003', risk_type: '销售', dept_name: '销售部', severity: 'LOW', alert_time: '2026-06-05 06:45' },
    { alert_id: 'ALT-20260605-004', risk_type: '库存', dept_name: '生产部', severity: 'HIGH', alert_time: '2026-06-05 05:30' },
    { alert_id: 'ALT-20260605-005', risk_type: '资金', dept_name: '财务部', severity: 'MEDIUM', alert_time: '2026-06-05 04:20' },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2 className="page-title">📊 系统概览</h2>
        <p className="page-subtitle">HOPO ICMS 智能审计系统 - 实时数据监控</p>
      </div>

      <div className="page-content">
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
      </div>
    </div>
  );
};

export default DashboardPage;