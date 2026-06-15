import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Select, Table, Tag, Space, Modal, Form, Input, InputNumber,
  message, Empty, Descriptions, Divider, Row, Col, Radio, Popconfirm,
  Spin, Result, Steps,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, PlayCircleOutlined,
  CheckCircleOutlined, DownloadOutlined, SaveOutlined,
  FileTextOutlined, InfoCircleOutlined, WarningOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getProcedures, getProcedureDetail, listExecutions,
  createExecution, saveExecutionRows, completeExecution,
  getExecutionDetail, exportExecutionExcel,
} from '@/services';

const { Option } = Select;
const { TextArea } = Input;

interface ProcedureItem {
  id: string;
  sort_order: number;
  field_name: string;
  field_label: string;
  data_type: string;
  data_source?: string;
  expected_result?: string;
  options?: string[];
  is_required: boolean;
  placeholder?: string;
  remark?: string;
}

interface ProcedureTemplate {
  id: string;
  procedure_code: string;
  name: string;
  procedure_type: string;
  description?: string;
  target_process?: string;
  items: ProcedureItem[];
}

interface DataRow {
  row_index: number;
  data: Record<string, unknown>;
  conclusion?: string;
  remark?: string;
}

interface ExecutionRecord {
  id: string;
  project_id: string;
  procedure_id: string;
  procedure_name?: string;
  status: string;
  sample_count: number;
  conclusion?: string;
  output_file_path?: string;
  items?: ProcedureItem[];
  rows?: DataRow[];
}

const statusColors: Record<string, string> = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
  reviewed: 'blue',
};
const statusLabels: Record<string, string> = {
  pending: '待执行',
  in_progress: '执行中',
  completed: '已完成',
  reviewed: '已复核',
};

interface Props {
  projectId: string;
  projectName?: string;
}

const WalkthroughTab: React.FC<Props> = ({ projectId, projectName }) => {
  // Template selection
  const [templates, setTemplates] = useState<ProcedureTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Execution state
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [currentExec, setCurrentExec] = useState<ExecutionRecord | null>(null);
  const [items, setItems] = useState<ProcedureItem[]>([]);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [selectedRowIdx, setSelectedRowIdx] = useState(0);
  const [selectedItemIdx, setSelectedItemIdx] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Modals
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [conclusionText, setConclusionText] = useState('');
  const [completeModalVisible, setCompleteModalVisible] = useState(false);

  // Load templates
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await getProcedures({ is_preset: true, page_size: 100 });
      const data = res;
      const list = (data as unknown as Record<string, unknown>)?.list
        || (data as unknown as Record<string, unknown>)?.items
        || (Array.isArray(data) ? data : []);
      if (Array.isArray(list)) setTemplates(list as ProcedureTemplate[]);
    } catch {
      console.log('Failed to load procedure templates');
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  // Load executions for this project
  const fetchExecutions = useCallback(async () => {
    try {
      const res = await listExecutions({ project_id: projectId, page_size: 50 });
      const data = res;
      const list = (data as unknown as Record<string, unknown>)?.list
        || (data as unknown as Record<string, unknown>)?.items
        || (Array.isArray(data) ? data : []);
      if (Array.isArray(list)) setExecutions(list as ExecutionRecord[]);
    } catch {
      console.log('Failed to load executions');
    }
  }, [projectId]);

  useEffect(() => { fetchTemplates(); fetchExecutions(); }, [fetchTemplates, fetchExecutions]);

  // Load full execution detail
  const loadExecution = async (execId: string) => {
    setLoading(true);
    try {
      const res = await getExecutionDetail(execId);
      const exec = res as ExecutionRecord;
      if (exec) {
        setCurrentExec(exec);
        setItems(exec.items || []);
        setRows(exec.rows || []);
        setSelectedRowIdx(0);
        setSelectedItemIdx(0);
      }
    } catch {
      message.error('加载执行详情失败');
    } finally {
      setLoading(false);
    }
  };

  // Start new execution
  const handleStartExecution = async () => {
    if (!selectedTemplateId) return;
    try {
      const res = await createExecution({ project_id: projectId, procedure_id: selectedTemplateId });
      const data = res as Record<string, unknown>;
      const execId = data?.id as string;
      if (execId) {
        message.success('穿行测试已启动');
        setStartModalVisible(false);
        await fetchExecutions();
        await loadExecution(execId);
      }
    } catch {
      message.error('启动失败');
    }
  };

  const openStartModal = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    // Load template items to preview
    try {
      const res = await getProcedureDetail(templateId);
      const tpl = res as ProcedureTemplate;
      setItems(tpl?.items || []);
    } catch { /* ignore */ }
    setStartModalVisible(true);
  };

  // Add sample row
  const handleAddRow = () => {
    const emptyData: Record<string, unknown> = {};
    items.forEach(item => {
      emptyData[item.field_name] = item.data_type === 'number' ? null : '';
    });
    const newRow: DataRow = { row_index: rows.length, data: emptyData, conclusion: '', remark: '' };
    const newRows = [...rows, newRow];
    setRows(newRows);
    setSelectedRowIdx(newRows.length - 1);
  };

  // Delete sample row
  const handleDeleteRow = (idx: number) => {
    const newRows = rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, row_index: i }));
    setRows(newRows);
    if (selectedRowIdx >= newRows.length) setSelectedRowIdx(Math.max(0, newRows.length - 1));
  };

  // Update cell value
  const handleCellChange = (rowIdx: number, fieldName: string, value: unknown) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      return { ...r, data: { ...r.data, [fieldName]: value } };
    }));
  };

  // Update row conclusion
  const handleRowConclusion = (rowIdx: number, conclusion: string) => {
    setRows(prev => prev.map((r, i) => i !== rowIdx ? r : { ...r, conclusion }));
  };

  // Update row remark
  const handleRowRemark = (rowIdx: number, remark: string) => {
    setRows(prev => prev.map((r, i) => i !== rowIdx ? r : { ...r, remark }));
  };

  // Save rows
  const handleSave = async () => {
    if (!currentExec) return;
    setSaving(true);
    try {
      await saveExecutionRows(currentExec.id, rows as unknown as Record<string, unknown>[]);
      message.success('数据已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // Complete execution
  const handleComplete = async () => {
    if (!currentExec) return;
    setCompleting(true);
    try {
      const res = await completeExecution(currentExec.id, { conclusion: conclusionText });
      message.success('穿行测试已完成');
      setCompleteModalVisible(false);
      const data = res as Record<string, unknown>;
      setCurrentExec(prev => prev ? {
        ...prev,
        status: 'completed',
        conclusion: conclusionText,
        output_file_path: data?.file_path as string,
      } : null);
      await fetchExecutions();
    } catch {
      message.error('提交失败');
    } finally {
      setCompleting(false);
    }
  };

  // Export Excel
  const handleExport = async () => {
    if (!currentExec) return;
    try {
      const res = await exportExecutionExcel(currentExec.id);
      const path = (res as Record<string, unknown>)?.file_path;
      if (path) {
        message.success(`Excel 已生成: ${path}`);
      } else {
        message.info('请先完成执行再下载');
      }
    } catch {
      message.error('导出失败');
    }
  };

  // Render field editor
  const renderFieldEditor = (item: ProcedureItem, value: unknown, onChange: (v: unknown) => void) => {
    switch (item.data_type) {
      case 'select':
        return (
          <Select
            value={value as string || undefined}
            onChange={onChange}
            allowClear
            placeholder={item.placeholder || `请选择${item.field_label}`}
            style={{ width: '100%' }}
          >
            {(item.options || []).map(opt => <Option key={opt} value={opt}>{opt}</Option>)}
          </Select>
        );
      case 'number':
        return (
          <InputNumber
            value={value as number || undefined}
            onChange={onChange}
            placeholder={item.placeholder}
            style={{ width: '100%' }}
          />
        );
      case 'boolean':
        return (
          <Radio.Group value={value as boolean} onChange={e => onChange(e.target.value)}>
            <Radio value={true}>是</Radio>
            <Radio value={false}>否</Radio>
          </Radio.Group>
        );
      case 'date':
        return (
          <Input
            type="date"
            value={value as string || ''}
            onChange={e => onChange(e.target.value)}
            style={{ width: '100%' }}
          />
        );
      default:
        return (
          <Input
            value={value as string || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={item.placeholder || `请输入${item.field_label}`}
          />
        );
    }
  };

  // Table columns for sample list
  const sampleColumns: ColumnsType<DataRow> = [
    { title: '#', dataIndex: 'row_index', key: 'row_index', width: 50, render: (i: number) => i + 1 },
    {
      title: '摘要', key: 'summary', ellipsis: true,
      render: (_, record) => {
        const firstVal = Object.values(record.data || {}).find(v => v !== null && v !== '');
        return <span style={{ color: firstVal !== undefined ? '#333' : '#ccc' }}>{firstVal !== undefined ? String(firstVal) : '(空)'}</span>;
      },
    },
    {
      title: '结论', dataIndex: 'conclusion', key: 'conclusion', width: 80,
      render: (c: string) => c === '异常' ? <Tag color="error">异常</Tag> : c === '正常' ? <Tag color="success">正常</Tag> : <Tag>待定</Tag>,
    },
    {
      title: '', key: 'action', width: 50,
      render: (_, __, idx) => (
        <Popconfirm title="删除此行?" onConfirm={() => handleDeleteRow(idx)}>
          <Button size="small" type="link" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // If no execution selected, show list
  if (!currentExec) {
    return (
      <div>
        <Row gutter={[16, 16]}>
          {/* Available templates */}
          <Col xs={24} md={14}>
            <Card title="预设审计程序模板" size="small">
              <Spin spinning={templatesLoading}>
                {templates.length === 0 ? (
                  <Empty description="暂无预设模板" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {templates.map(tpl => (
                      <Card key={tpl.id} size="small" hoverable style={{ cursor: 'default' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 500 }}>
                              <Tag color="blue">{tpl.procedure_code}</Tag>
                              {tpl.name}
                            </div>
                            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                              {tpl.target_process && `目标流程: ${tpl.target_process}  |  `}
                              检查节点: {tpl.items?.length || 0} 个
                            </div>
                          </div>
                          <Button type="primary" size="small" icon={<PlayCircleOutlined />}
                            onClick={() => openStartModal(tpl.id)}
                            style={{ background: '#E34D59', borderColor: '#E34D59' }}>
                            启动测试
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Spin>
            </Card>
          </Col>

          {/* Existing executions */}
          <Col xs={24} md={10}>
            <Card title="本项目执行记录" size="small">
              {executions.length === 0 ? (
                <Empty description="暂未执行任何程序" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {executions.map(exec => (
                    <Card key={exec.id} size="small" hoverable onClick={() => loadExecution(exec.id)}
                      style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 500 }}>{exec.procedure_name}</div>
                          <div style={{ fontSize: 12, color: '#999' }}>
                            样本: {exec.sample_count} 条 | {exec.conclusion ? `结论: ${exec.conclusion}` : '暂无结论'}
                          </div>
                        </div>
                        <Tag color={statusColors[exec.status]}>{statusLabels[exec.status]}</Tag>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* Start Modal */}
        <Modal title="启动穿行测试" open={startModalVisible}
          onOk={handleStartExecution} onCancel={() => setStartModalVisible(false)}
          okText="确认启动" cancelText="取消"
          okButtonProps={{ style: { background: '#E34D59', borderColor: '#E34D59' } }}>
          <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="程序模板">{templates.find(t => t.id === selectedTemplateId)?.name}</Descriptions.Item>
            <Descriptions.Item label="所属项目">{projectName || projectId}</Descriptions.Item>
            <Descriptions.Item label="检查节点数">{items.length} 个</Descriptions.Item>
          </Descriptions>
          <div style={{ padding: '8px 12px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, fontSize: 13 }}>
            <InfoCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
            启动后将创建执行记录，您可以逐条录入样本数据并填写检查结果。
          </div>
        </Modal>
      </div>
    );
  }

  // ==================== Three-Column Layout ====================
  const currentRow = rows[selectedRowIdx];

  return (
    <Spin spinning={loading}>
      {/* Header bar */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Button onClick={() => { setCurrentExec(null); setItems([]); setRows([]); }}>← 返回列表</Button>
          <Tag color={statusColors[currentExec.status]}>{statusLabels[currentExec.status]}</Tag>
          <span style={{ fontWeight: 500 }}>{currentExec.procedure_name}</span>
        </Space>
        <Space>
          {currentExec.status !== 'completed' && (
            <>
              <Button icon={<SaveOutlined />} onClick={handleSave} loading={saving}>保存数据</Button>
              <Button type="primary" icon={<CheckCircleOutlined />}
                onClick={() => { setConclusionText(currentExec.conclusion || ''); setCompleteModalVisible(true); }}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}>
                完成测试
              </Button>
            </>
          )}
          {currentExec.status === 'completed' && (
            <Button icon={<DownloadOutlined />} onClick={handleExport}>导出 Excel</Button>
          )}
        </Space>
      </div>

      {currentExec.status === 'completed' && currentExec.conclusion && (
        <Result
          status={currentExec.conclusion?.includes('异常') ? 'warning' : 'success'}
          title={currentExec.conclusion?.includes('异常') ? '存在异常发现' : '全部正常'}
          subTitle={`测试结论: ${currentExec.conclusion}`}
          style={{ padding: '16px 0' }}
        />
      )}

      <Row gutter={[16, 16]}>
        {/* Column 1: Sample List */}
        <Col xs={24} lg={6}>
          <Card title={`样本列表 (${rows.length})`} size="small"
            extra={<Button size="small" icon={<PlusOutlined />} onClick={handleAddRow}
              disabled={currentExec.status === 'completed'}>添加</Button>}
            style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
            {rows.length === 0 ? (
              <Empty description="点击「添加」录入样本" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                columns={sampleColumns}
                dataSource={rows}
                rowKey="row_index"
                size="small"
                pagination={false}
                showHeader={false}
                onRow={(_, idx) => ({
                  onClick: () => { setSelectedRowIdx(idx || 0); setSelectedItemIdx(0); },
                  style: { background: idx === selectedRowIdx ? '#fff1f0' : undefined, cursor: 'pointer' },
                })}
              />
            )}
          </Card>
        </Col>

        {/* Column 2: Check Form */}
        <Col xs={24} lg={13}>
          <Card title={currentRow ? `样本 #${selectedRowIdx + 1} 检查明细` : '检查明细'} size="small"
            style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
            {!currentRow ? (
              <Empty description="请选择左侧样本或点击「添加」创建" />
            ) : (
              <div>
                {/* Quick-nav item selector */}
                <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {items.map((item, idx) => (
                    <Tag
                      key={item.id}
                      color={selectedItemIdx === idx ? '#E34D59' : undefined}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedItemIdx(idx)}
                    >
                      {idx + 1}. {item.field_label}
                      {item.is_required && <span style={{ color: '#ff4d4f' }}> *</span>}
                    </Tag>
                  ))}
                </div>

                <Divider style={{ margin: '8px 0 16px' }} />

                {/* Focused single field editor (when selectedItemIdx is set) */}
                {selectedItemIdx !== null && items[selectedItemIdx] && (
                  <div style={{
                    padding: 16, background: '#fafafa', border: '1px solid #f0f0f0',
                    borderRadius: 6, marginBottom: 12,
                  }}>
                    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>
                        {items[selectedItemIdx].field_label}
                      </span>
                      {items[selectedItemIdx].is_required && <Tag color="error">必填</Tag>}
                      <Tag>{items[selectedItemIdx].data_source || '手工录入'}</Tag>
                    </div>
                    {renderFieldEditor(
                      items[selectedItemIdx],
                      currentRow.data[items[selectedItemIdx].field_name],
                      (v) => handleCellChange(selectedRowIdx, items[selectedItemIdx].field_name, v),
                    )}
                    {items[selectedItemIdx].placeholder && (
                      <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                        💡 {items[selectedItemIdx].placeholder}
                      </div>
                    )}
                  </div>
                )}

                {/* All fields compact view */}
                <Divider orientation="left" plain style={{ fontSize: 13 }}>全部字段</Divider>
                {items.map((item, idx) => (
                  <div key={item.id} style={{ marginBottom: 12 }}
                    onClick={() => setSelectedItemIdx(idx)}>
                    <div style={{ fontSize: 13, marginBottom: 2, color: '#666' }}>
                      {item.field_label}
                      {item.is_required && <span style={{ color: '#ff4d4f' }}> *</span>}
                      <span style={{ color: '#bbb', fontSize: 11, marginLeft: 8 }}>{item.data_source}</span>
                    </div>
                    {renderFieldEditor(
                      item,
                      currentRow.data[item.field_name],
                      (v) => handleCellChange(selectedRowIdx, item.field_name, v),
                    )}
                  </div>
                ))}

                <Divider />
                <Row gutter={12}>
                  <Col span={12}>
                    <div style={{ fontSize: 13, marginBottom: 4, color: '#666' }}>本条结论</div>
                    <Select
                      value={currentRow.conclusion || undefined}
                      onChange={(v) => handleRowConclusion(selectedRowIdx, v)}
                      placeholder="选择结论"
                      style={{ width: '100%' }}
                    >
                      <Option value="正常">✅ 正常</Option>
                      <Option value="异常">❌ 异常</Option>
                      <Option value="待确认">⚠️ 待确认</Option>
                    </Select>
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 13, marginBottom: 4, color: '#666' }}>备注</div>
                    <Input
                      value={currentRow.remark || ''}
                      onChange={(e) => handleRowRemark(selectedRowIdx, e.target.value)}
                      placeholder="补充说明..."
                    />
                  </Col>
                </Row>
              </div>
            )}
          </Card>
        </Col>

        {/* Column 3: Reference Panel */}
        <Col xs={24} lg={5}>
          <Card title="参考信息" size="small" style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
            {selectedItemIdx !== null && items[selectedItemIdx] ? (
              <div>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>
                  {items[selectedItemIdx].field_label}
                </div>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="数据来源">
                    <Tag>{items[selectedItemIdx].data_source || '手工录入'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="数据类型">
                    <Tag>{items[selectedItemIdx].data_type}</Tag>
                  </Descriptions.Item>
                  {items[selectedItemIdx].expected_result && (
                    <Descriptions.Item label="预期结果">
                      <span style={{ color: '#52c41a' }}>{items[selectedItemIdx].expected_result}</span>
                    </Descriptions.Item>
                  )}
                  {items[selectedItemIdx].remark && (
                    <Descriptions.Item label="说明">
                      {items[selectedItemIdx].remark}
                    </Descriptions.Item>
                  )}
                </Descriptions>

                {/* Policy reference placeholder */}
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ fontSize: 12, color: '#999' }}>
                  <InfoCircleOutlined /> 相关制度依据将在知识库模块中关联显示
                </div>

                {/* Quick row nav */}
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>快速跳转样本</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {rows.map((r, i) => (
                    <Tag
                      key={i}
                      color={selectedRowIdx === i ? '#E34D59' : r.conclusion === '异常' ? 'error' : r.conclusion === '正常' ? 'success' : undefined}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedRowIdx(i)}
                    >
                      #{i + 1}
                    </Tag>
                  ))}
                </div>
              </div>
            ) : (
              <Empty description="选择检查节点查看详情" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      {/* Complete Modal */}
      <Modal title="完成穿行测试" open={completeModalVisible}
        onOk={handleComplete} onCancel={() => setCompleteModalVisible(false)}
        okText="确认完成" cancelText="取消"
        okButtonProps={{ loading: completing, style: { background: '#E34D59', borderColor: '#E34D59' } }}>
        <div style={{ marginBottom: 16 }}>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="样本总数">{rows.length}</Descriptions.Item>
            <Descriptions.Item label="正常">{rows.filter(r => r.conclusion === '正常').length}</Descriptions.Item>
            <Descriptions.Item label="异常">{rows.filter(r => r.conclusion === '异常').length}</Descriptions.Item>
            <Descriptions.Item label="待确认">{rows.filter(r => r.conclusion === '待确认').length}</Descriptions.Item>
          </Descriptions>
        </div>
        <Form layout="vertical">
          <Form.Item label="测试结论" required>
            <TextArea
              rows={3}
              value={conclusionText}
              onChange={e => setConclusionText(e.target.value)}
              placeholder="请填写测试结论，如：经穿行测试，销售流程各控制节点运行有效，未发现重大异常。"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Spin>
  );
};

export default WalkthroughTab;
