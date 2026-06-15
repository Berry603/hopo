import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Button, Space, Modal, Form, Select, Input,
  Tabs, message, Typography, Descriptions, Tooltip, Badge, Divider,
  Row, Col, Steps, Alert,
} from 'antd';
import {
  PlayCircleOutlined, DownloadOutlined, CheckCircleOutlined,
  HistoryOutlined, FileSearchOutlined, PlusOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  getProcedures, listExecutions, createExecution,
  saveExecutionRows, completeExecution, getExecutionDetail,
  exportExecutionExcel, Procedure, Execution,
} from '../../services/procedure';
import request from '../../services/request';

async function getProjects() {
  const res = await request.get('/audit/projects');
  return (res.data as any[]) || [];
}

async function getProcedureList() {
  const res = await request.get('/audit/procedures');
  return (res.data as any[]) || [];
}

async function getExecutionList() {
  const res = await request.get('/audit/procedures/executions');
  return (res.data as any[]) || [];
}
const { Title, Text } = Typography;

const procedureTypeMap: Record<string, { label: string; color: string }> = {
  walkthrough: { label: '穿行测试', color: 'blue' },
  control_test: { label: '控制测试', color: 'orange' },
  substantive: { label: '实质性程序', color: 'purple' },
  compliance: { label: '合规审核', color: 'green' },
  analytical: { label: '分析性复核', color: 'cyan' },
};

const ProcedurePage: React.FC = () => {
  const location = useLocation();
  const tab = new URLSearchParams(location.search).get('tab') || 'templates';
  const navigate = useNavigate();

  // 程序模板列表
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(false);
  // 执行记录
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [execLoading, setExecLoading] = useState(false);
  // 项目列表
  const [projects, setProjects] = useState<any[]>([]);
  // 新建执行弹窗
  const [createModal, setCreateModal] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  // 执行详情弹窗
  const [detailModal, setDetailModal] = useState(false);
  const [detailData, setDetailData] = useState<Execution | null>(null);
  // 编辑数据
  const [editRows, setEditRows] = useState<Record<string, any>[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProcedures();
    loadExecutions();
    loadProjects();
  }, []);

  const loadProcedures = async () => {
    setLoading(true);
    try {
      const data = await getProcedureList();
      setProcedures(data || []);
    } catch { message.error('加载程序模板失败'); }
    setLoading(false);
  };

  const loadExecutions = async () => {
    setExecLoading(true);
    try {
      const data = await getExecutionList();
      setExecutions(data || []);
    } catch { message.error('加载执行记录失败'); }
    setExecLoading(false);
  };

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data || []);
    } catch { /* ignore */ }
  };

  const handleCreateExecution = async () => {
    if (!selectedProcedure || !selectedProject) {
      message.warning('请选择程序和项目');
      return;
    }
    try {
      const res = await createExecution({ project_id: selectedProject, procedure_id: selectedProcedure.id });
      message.success('穿行测试已开始执行');
      setCreateModal(false);
      loadExecutions();
      // 切到执行记录 tab
      navigate('/audit/procedure?tab=executions');
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '创建失败');
    }
  };

  const handleViewExecution = async (execId: string) => {
    try {
      const res = await getExecutionDetail(execId);
      const execData = res;
      setDetailData(execData);
      // 初始化编辑行
      if (execData.rows && execData.rows.length > 0) {
        setEditRows(execData.rows.map((r: any) => r.data));
      } else {
        // 添加一个空行
        setEditRows([{}]);
      }
      setDetailModal(true);
    } catch { message.error('加载执行详情失败'); }
  };

  const handleSaveRows = async () => {
    if (!detailData) return;
    setSaving(true);
    try {
      const rows = editRows.map((data, idx) => {
        // 判断是否有异常
        const items = detailData.items || [];
        const conclusion = data.conclusion || '正常';
        return { row_index: idx, data, conclusion };
      });
      await saveExecutionRows(detailData.id, rows);
      message.success('数据已保存');
    } catch { message.error('保存失败'); }
    setSaving(false);
  };

  const handleCompleteExecution = async () => {
    if (!detailData) return;
    setSaving(true);
    try {
      // 先保存
      const rows = editRows.map((data, idx) => ({
        row_index: idx, data, conclusion: data.conclusion || '正常',
      }));
      await saveExecutionRows(detailData.id, rows);
      // 再完成
      await completeExecution(detailData.id, { conclusion: '穿行测试已完成，详见检查明细' });
      message.success('穿行测试已完成，Excel 已生成');
      setDetailModal(false);
      loadExecutions();
    } catch { message.error('完成失败'); }
    setSaving(false);
  };

  const handleRowChange = (rowIdx: number, field: string, value: any) => {
    const newRows = [...editRows];
    if (!newRows[rowIdx]) newRows[rowIdx] = {};
    newRows[rowIdx][field] = value;
    setEditRows(newRows);
  };

  const handleAddRow = () => {
    setEditRows([...editRows, {}]);
  };

  const handleRemoveRow = (idx: number) => {
    setEditRows(editRows.filter((_, i) => i !== idx));
  };

  const statusColor: Record<string, string> = {
    pending: 'default',
    in_progress: 'processing',
    completed: 'success',
    reviewed: 'purple',
  };
  const statusLabel: Record<string, string> = {
    pending: '待执行', in_progress: '执行中', completed: '已完成', reviewed: '已复核',
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <ExperimentOutlined style={{ marginRight: 8 }} />
        审计程序与穿行测试
      </Title>

      <Tabs
        activeKey={tab}
        onChange={(k) => navigate(`/audit/procedure?tab=${k}`)}
        items={[
          {
            key: 'templates',
            label: <span><FileSearchOutlined /> 程序模板</span>,
            children: (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />}
                    onClick={() => setCreateModal(true)}>
                    执行穿行测试
                  </Button>
                </Space>

                <Row gutter={[16, 16]}>
                  {procedures.map((proc) => (
                    <Col xs={24} sm={12} lg={8} key={proc.id}>
                      <Card
                        hoverable
                        size="small"
                        title={
                          <Space>
                            <Tag color={procedureTypeMap[proc.procedure_type]?.color || 'default'}>
                              {procedureTypeMap[proc.procedure_type]?.label || proc.procedure_type}
                            </Tag>
                            <Text strong>{proc.name}</Text>
                          </Space>
                        }
                        extra={
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            v{proc.version}
                          </Text>
                        }
                        actions={[
                          <Tooltip title="执行此程序">
                            <PlayCircleOutlined onClick={() => {
                              setSelectedProcedure(proc);
                              setCreateModal(true);
                            }} />
                          </Tooltip>,
                        ]}
                      >
                        <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                          {proc.description || proc.target_process}
                        </p>
                        <Space>
                          <Tag>{proc.items.length} 个检查节点</Tag>
                          {proc.is_preset && <Tag color="gold">预设</Tag>}
                        </Space>
                        {proc.data_sources && (
                          <div style={{ marginTop: 8 }}>
                            {proc.data_sources.map((ds: string) => (
                              <Tag key={ds} color="geekblue" style={{ fontSize: 11 }}>
                                {ds === 'erp' ? 'ERP' : ds === 'srm' ? 'SRM' :
                                 ds === 'yunzhijia' ? '云之家' : ds === 'crm' ? 'CRM' : ds === 'wms' ? 'WMS' : ds}
                              </Tag>
                            ))}
                          </div>
                        )}
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            ),
          },
          {
            key: 'executions',
            label: <span><HistoryOutlined /> 执行记录</span>,
            children: (
              <Table
                dataSource={executions}
                rowKey="id"
                loading={execLoading}
                pagination={{ pageSize: 10, showSizeChanger: true }}
                columns={[
                  { title: '项目', dataIndex: 'project_name', width: 200 },
                  { title: '程序', dataIndex: 'procedure_name', width: 200 },
                  {
                    title: '类型', dataIndex: 'procedure_type', width: 100,
                    render: (v: string) => (
                      <Tag color={procedureTypeMap[v]?.color}>{procedureTypeMap[v]?.label || v}</Tag>
                    ),
                  },
                  {
                    title: '状态', dataIndex: 'status', width: 100,
                    render: (v: string) => (
                      <Badge status={statusColor[v] as any} text={statusLabel[v] || v} />
                    ),
                  },
                  { title: '样本数', dataIndex: 'sample_count', width: 80 },
                  {
                    title: '操作', width: 200,
                    render: (_: any, record: Execution) => (
                      <Space>
                        <Button size="small" onClick={() => handleViewExecution(record.id)}>
                          {record.status === 'in_progress' ? '填写数据' : '查看'}
                        </Button>
                        {record.output_file_path && (
                          <Tooltip title={record.output_file_path}>
                            <Button size="small" icon={<DownloadOutlined />}
                              onClick={() => message.info(`文件: ${record.output_file_path}`)} />
                          </Tooltip>
                        )}
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
        ]}
      />

      {/* 新建执行弹窗 */}
      <Modal
        title="执行穿行测试"
        open={createModal}
        onOk={handleCreateExecution}
        onCancel={() => setCreateModal(false)}
        width={600}
      >
        <Form layout="vertical">
          <Form.Item label="选择程序模板">
            <Select
              value={selectedProcedure?.id}
              onChange={(v) => setSelectedProcedure(procedures.find(p => p.id === v) || null)}
              placeholder="请选择穿行测试模板"
              options={procedures.map(p => ({
                label: `${p.procedure_code} - ${p.name}`,
                value: p.id,
              }))}
            />
          </Form.Item>
          <Form.Item label="选择审计项目">
            <Select
              value={selectedProject}
              onChange={setSelectedProject}
              placeholder="请选择要执行的项目"
              options={projects.map((p: any) => ({
                label: `${p.project_code} - ${p.project_name}`,
                value: p.id,
              }))}
            />
          </Form.Item>
          {selectedProcedure && (
            <Alert
              type="info"
              showIcon
              message={`${selectedProcedure.name}`}
              description={
                <div>
                  <p>{selectedProcedure.description}</p>
                  <p>检查节点: {selectedProcedure.items.length} 个</p>
                  <p>数据来源: {(selectedProcedure.data_sources || []).join(', ')}</p>
                </div>
              }
            />
          )}
        </Form>
      </Modal>

      {/* 执行详情弹窗 */}
      <Modal
        title={detailData ? `${detailData.procedure_name} - 检查数据` : '加载中...'}
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        width={900}
        footer={
          detailData?.status === 'in_progress' ? (
            <Space>
              <Button onClick={handleSaveRows} loading={saving}>保存数据</Button>
              <Button type="primary" onClick={handleCompleteExecution} loading={saving}
                icon={<CheckCircleOutlined />}>
                完成执行并生成Excel
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setDetailModal(false)}>关闭</Button>
          )
        }
      >
        {detailData && (
          <div>
            <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="项目">{detailData.project_name}</Descriptions.Item>
              <Descriptions.Item label="程序">{detailData.procedure_name}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Badge status={statusColor[detailData.status] as any} text={statusLabel[detailData.status]} />
              </Descriptions.Item>
              <Descriptions.Item label="样本数">{detailData.sample_count}</Descriptions.Item>
            </Descriptions>

            {detailData.status === 'in_progress' ? (
              <div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%', borderCollapse: 'collapse', fontSize: 13,
                    border: '1px solid #e8e8e8',
                  }}>
                    <thead>
                      <tr style={{ background: '#fafafa' }}>
                        <th style={thStyle}>#</th>
                        {(detailData.items || []).map((item) => (
                          <th key={item.field_name} style={thStyle}>
                            {item.field_label}
                            {item.is_required && <span style={{ color: 'red' }}>*</span>}
                            <div style={{ fontSize: 11, color: '#999', fontWeight: 'normal' }}>
                              {item.data_source || item.data_type}
                            </div>
                          </th>
                        ))}
                        <th style={{ ...thStyle, minWidth: 80 }}>结论</th>
                        <th style={{ ...thStyle, minWidth: 30 }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editRows.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          <td style={tdStyle}>{rowIdx + 1}</td>
                          {(detailData.items || []).map((item) => (
                            <td key={item.field_name} style={tdStyle}>
                              <CellInput
                                item={item}
                                value={row[item.field_name]}
                                onChange={(v) => handleRowChange(rowIdx, item.field_name, v)}
                              />
                            </td>
                          ))}
                          <td style={tdStyle}>
                            <Select
                              size="small"
                              value={row.conclusion || '正常'}
                              onChange={(v) => handleRowChange(rowIdx, 'conclusion', v)}
                              style={{ width: 80 }}
                              options={[
                                { label: '正常', value: '正常' },
                                { label: '异常', value: '异常' },
                                { label: '待确认', value: '待确认' },
                              ]}
                            />
                          </td>
                          <td style={tdStyle}>
                            <Button size="small" danger
                              onClick={() => handleRemoveRow(rowIdx)}>×</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button type="dashed" onClick={handleAddRow} block style={{ marginTop: 8 }}>
                  + 添加样本行
                </Button>
              </div>
            ) : (
              <Table
                dataSource={detailData.rows || []}
                rowKey="row_index"
                size="small"
                pagination={false}
                columns={[
                  { title: '#', dataIndex: 'row_index', width: 40, render: (v: number) => v + 1 },
                  ...(detailData.items || []).map((item) => ({
                    title: item.field_label,
                    width: 120,
                    render: (_: any, record: any) => {
                      const val = record.data?.[item.field_name];
                      if (item.data_type === 'boolean') {
                        return val ? <Tag color="green">是</Tag> : <Tag color="red">否</Tag>;
                      }
                      if (item.data_type === 'select') {
                        return <Tag>{val || '-'}</Tag>;
                      }
                      return val || '-';
                    },
                  })),
                  {
                    title: '结论', width: 80,
                    render: (_: any, record: any) => (
                      <Tag color={record.conclusion === '异常' ? 'red' : record.conclusion === '待确认' ? 'orange' : 'green'}>
                        {record.conclusion || '正常'}
                      </Tag>
                    ),
                  },
                ]}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap',
  borderBottom: '2px solid #e8e8e8', fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px', borderBottom: '1px solid #f0f0f0',
  verticalAlign: 'top',
};

// 单元格输入组件
const CellInput: React.FC<{
  item: any;
  value: any;
  onChange: (v: any) => void;
}> = ({ item, value, onChange }) => {
  if (item.data_type === 'select' && item.options?.length) {
    return (
      <Select
        size="small"
        value={value || undefined}
        onChange={onChange}
        placeholder="请选择"
        style={{ width: '100%', minWidth: 100 }}
        options={item.options.map((opt: string) => ({ label: opt, value: opt }))}
      />
    );
  }
  if (item.data_type === 'number') {
    return (
      <Input
        size="small"
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={item.placeholder || '输入数字'}
        style={{ width: '100%', minWidth: 100 }}
      />
    );
  }
  if (item.data_type === 'boolean') {
    return (
      <Select
        size="small"
        value={value === true ? '是' : value === false ? '否' : undefined}
        onChange={(v) => onChange(v === '是')}
        style={{ width: 80 }}
        options={[
          { label: '是', value: '是' },
          { label: '否', value: '否' },
        ]}
      />
    );
  }
  return (
    <Input
      size="small"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={item.placeholder || '输入...'}
      style={{ width: '100%', minWidth: 100 }}
    />
  );
};

export default ProcedurePage;
