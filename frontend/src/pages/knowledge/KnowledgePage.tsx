import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Layout, Table, Button, Space, Tag, Input, Select, Card,
  Modal, Form, Drawer, Descriptions, Rate, Popconfirm, message,
  Row, Col, List, Typography, Empty, Divider, Tooltip, DatePicker,
  Upload, Statistic, Dropdown,
} from 'antd';
import type { UploadProps } from 'antd';
import type { RcFile, UploadFile } from 'antd/es/upload';
import {
  BookOutlined, SearchOutlined, FileTextOutlined, PlusOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, StarOutlined,
  CloudUploadOutlined, TagsOutlined, FilePdfOutlined,
  TeamOutlined, BulbOutlined, ReloadOutlined, DownloadOutlined,
  SwapOutlined, UploadOutlined, InboxOutlined,
  FileWordOutlined, FileExcelOutlined, FileImageOutlined,
  FileUnknownOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useParams } from 'react-router-dom';
import { getTemplates, getTemplateCategories, uploadTemplate, deleteTemplate, getTemplateDownloadUrl } from '@/services/knowledge';
import './KnowledgePage.less';

const { Content } = Layout;
const { TextArea } = Input;
const { Text, Title } = Typography;

// ---- 模拟数据 ----
interface KnowledgeItem {
  id: string; title: string; type: 'regulation' | 'case' | 'template' | 'guide' | 'article';
  category: string; author: string; createdAt: string; updatedAt: string;
  tags: string[]; content: string; rating: number; views: number; status: 'published' | 'draft';
  fileType?: string; relatedTo?: string; attachments?: UploadFile[];
}
interface KnowledgeUploadFile { uid: string; name: string; status: 'done' | 'uploading' | 'error'; url?: string; size?: number; type?: string; }
const mockKnowledge: KnowledgeItem[] = [
  { id: 'KB-001', title: '企业内部控制基本规范（2025版）', type: 'regulation', category: '内控规范',
    author: '法规库', createdAt: '2025-01-01', updatedAt: '2025-06-01', tags: ['内控', '法规', '规范'],
    content: '财政部发布的企业内部控制基本规范及配套指引，适用于上市公司及大中型企业...', rating: 4.8, views: 1523, status: 'published', fileType: 'PDF' },
  { id: 'KB-002', title: '采购舞弊审计案例：虚假供应商识别', type: 'case', category: '采购审计',
    author: '张敏', createdAt: '2025-03-15', updatedAt: '2025-04-20', tags: ['采购', '舞弊', '案例'],
    content: '本案例记录了采购部虚假供应商的审计发现过程，通过交叉比对工商信息...', rating: 4.5, views: 890, status: 'published', relatedTo: 'AUD-20250002' },
  { id: 'KB-003', title: '费用报销审计底稿模板 V3', type: 'template', category: '底稿模板',
    author: '李芳', createdAt: '2025-02-10', updatedAt: '2025-05-15', tags: ['底稿', '模板', '费用'],
    content: '标准费用报销审计底稿模板，包含差旅费、招待费、办公费等检查清单...', rating: 4.3, views: 2341, status: 'published', fileType: 'XLSX' },
  { id: 'KB-004', title: '应收账款审计实务指南', type: 'guide', category: '审计指南',
    author: '王刚', createdAt: '2025-04-01', updatedAt: '2025-04-01', tags: ['应收', '审计', '指南'],
    content: '详细介绍了应收账款审计的方法论，包括函证程序、账龄分析...', rating: 4.0, views: 567, status: 'published' },
  { id: 'KB-005', title: 'ISO 37301:2025 合规管理体系要求', type: 'regulation', category: '国际标准',
    author: '法规库', createdAt: '2025-03-01', updatedAt: '2025-03-01', tags: ['ISO', '合规', '国际标准'],
    content: '最新版ISO合规管理体系标准，涵盖组织环境、领导力、策划...', rating: 4.6, views: 400, status: 'published', fileType: 'PDF' },
  { id: 'KB-006', title: '固定资产盘点流程优化案例', type: 'case', category: '资产管理',
    author: '陈婷', createdAt: '2025-05-10', updatedAt: '2025-05-20', tags: ['固定资产', '盘点', '案例'],
    content: '通过RFID技术实现固定资产自动化盘点，盘点效率提升80%的实践经验...', rating: 4.2, views: 320, status: 'published', relatedTo: 'AUD-20250003' },
  { id: 'KB-007', title: '审计报告标准模板', type: 'template', category: '报告模板',
    author: '审计部', createdAt: '2025-01-20', updatedAt: '2025-06-01', tags: ['报告', '模板', '标准'],
    content: '标准化审计报告模板，包含执行摘要、审计范围、发现、建议、整改要求等...', rating: 4.7, views: 3456, status: 'published', fileType: 'DOC' },
  { id: 'KB-008', title: 'IT系统审计检查清单', type: 'guide', category: 'IT审计',
    author: '刘洋', createdAt: '2025-06-01', updatedAt: '2025-06-01', tags: ['IT', '系统', '检查清单'],
    content: 'IT一般控制和应用控制检查清单，覆盖访问控制、变更管理、系统运维...', rating: 4.1, views: 180, status: 'draft' },
];

const typeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  regulation: { color: 'red', text: '法规', icon: <BookOutlined /> },
  case: { color: 'blue', text: '案例', icon: <FileTextOutlined /> },
  template: { color: 'green', text: '模板', icon: <FilePdfOutlined /> },
  guide: { color: 'orange', text: '指南', icon: <BulbOutlined /> },
  article: { color: 'purple', text: '文章', icon: <StarOutlined /> },
};

// ---- 模板库类型与辅助函数 ----
interface TemplateItem {
  id: string; name: string; category: string; category_label: string;
  description: string | null; file_name: string; file_path: string;
  file_size: number; file_type: string; is_preset: boolean;
  download_count: number; created_at: string; updated_at: string; created_by: string;
}
interface CategoryItem { value: string; label: string; }
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function getFileIcon(fileType: string): React.ReactNode {
  const t = fileType.toLowerCase();
  if (['doc', 'docx'].includes(t)) return <FileWordOutlined style={{ color: '#2b579a', fontSize: 24 }} />;
  if (['xls', 'xlsx'].includes(t)) return <FileExcelOutlined style={{ color: '#217346', fontSize: 24 }} />;
  if (t === 'csv') return <FileExcelOutlined style={{ color: '#217346', fontSize: 24 }} />;
  if (t === 'pdf') return <FilePdfOutlined style={{ color: '#f5222d', fontSize: 24 }} />;
  if (t === 'txt') return <FileTextOutlined style={{ color: '#595959', fontSize: 24 }} />;
  if (['png', 'jpg', 'jpeg'].includes(t)) return <FileImageOutlined style={{ color: '#52c41a', fontSize: 24 }} />;
  return <FileUnknownOutlined style={{ color: '#999', fontSize: 24 }} />;
}
const categoryColorMap: Record<string, string> = {
  financial: '#1890ff', operational: '#52c41a', compliance: '#faad14',
  purchase: '#722ed1', sales: '#eb2f96', asset: '#13c2c2', fund: '#fa8c16', other: '#8c8c8c',
};

const KnowledgePage: React.FC = () => {
  const { tab = 'search' } = useParams<{ tab: string }>();
  const [items, setItems] = useState<KnowledgeItem[]>(mockKnowledge);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // ---- 模板库状态 ----
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templateCategories, setTemplateCategories] = useState<CategoryItem[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateSearchKeyword, setTemplateSearchKeyword] = useState('');
  const [templateFilterCategory, setTemplateFilterCategory] = useState<string | null>(null);
  const [templateUploadModalVisible, setTemplateUploadModalVisible] = useState(false);
  const [templateDetailModalVisible, setTemplateDetailModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [templateFileList, setTemplateFileList] = useState<UploadFile[]>([]);
  const [templateUploadForm] = Form.useForm();

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      if (searchText && !i.title.includes(searchText) && !i.tags.some(t => t.includes(searchText)) && !i.category.includes(searchText)) return false;
      if (typeFilter.length > 0 && !typeFilter.includes(i.type)) return false;
      return true;
    });
  }, [items, searchText, typeFilter]);

  // 法规筛选
  const regulations = useMemo(() => items.filter(i => i.type === 'regulation'), [items]);
  const cases = useMemo(() => items.filter(i => i.type === 'case'), [items]);

  const handleView = (record: KnowledgeItem) => {
    setSelectedItem(record);
    setDrawerVisible(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setFileList([]);
    setModalVisible(true);
  };

  const handleEdit = (record: KnowledgeItem) => {
    setEditingItem(record);
    form.setFieldsValue(record);
    setFileList(record.attachments || []);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    messageApi.success('已删除');
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...values, updatedAt: new Date().toISOString().split('T')[0], attachments: fileList } : i));
        messageApi.success('已更新');
      } else {
        const newItem: KnowledgeItem = {
          id: `KB-${Date.now()}`,
          ...values,
          author: '当前用户',
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
          rating: 0, views: 0,
          attachments: fileList,
        };
        setItems(prev => [newItem, ...prev]);
        messageApi.success('已创建');
      }
      setModalVisible(false);
    } catch {}
  };

  // ---- 模板库 API ----
  const fetchTemplates = useCallback(async () => {
    setTemplateLoading(true);
    try {
      const data = await getTemplates({
        category: templateFilterCategory || undefined,
        keyword: templateSearchKeyword || undefined,
      });
      setTemplates((data?.data as any)?.items || []);
    } catch { messageApi.error('获取模板列表失败'); }
    finally { setTemplateLoading(false); }
  }, [templateFilterCategory, templateSearchKeyword, messageApi]);

  const fetchTemplateCategories = useCallback(async () => {
    try {
      const data = await getTemplateCategories();
      setTemplateCategories((data?.data as any)?.items || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchTemplateCategories(); fetchTemplates(); }, [fetchTemplateCategories, fetchTemplates]);

  const handleTemplateUpload = () => {
    templateUploadForm.resetFields();
    setTemplateFileList([]);
    setTemplateUploadModalVisible(true);
  };

  const handleTemplateUploadSubmit = async () => {
    try {
      const values = await templateUploadForm.validateFields();
      if (templateFileList.length === 0) { messageApi.warning('请选择要上传的文件'); return; }
      setTemplateUploading(true);
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('category', values.category || 'other');
      if (values.description) formData.append('description', values.description);
      const file = templateFileList[0].originFileObj as RcFile;
      formData.append('file', file);
      const data = await uploadTemplate(formData);
      if (data?.code === 200) { messageApi.success(data.message || '模板上传成功'); setTemplateUploadModalVisible(false); fetchTemplates(); }
      else { messageApi.error(data?.message || '上传失败'); }
    } catch (err: any) {
      if (err.errorFields) return;
      messageApi.error('上传失败');
    } finally { setTemplateUploading(false); }
  };

  const handleTemplateDownload = async (tmpl: TemplateItem, format?: string) => {
    try {
      const fmt = format || tmpl.file_type;
      const url = getTemplateDownloadUrl(tmpl.id, fmt !== tmpl.file_type ? fmt : undefined);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      });
      if (!response.ok) throw new Error('下载失败');
      const blob = await response.blob();
      const ext = fmt === 'csv' ? '.csv' : `.${tmpl.file_type}`;
      const downloadName = tmpl.file_name.replace(/\.[^.]+$/, ext);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadName;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      messageApi.success(`模板「${tmpl.name}」下载已开始（.${fmt}）`);
      setTimeout(() => fetchTemplates(), 500);
    } catch { messageApi.error('下载失败'); }
  };

  const handleTemplateDelete = async (tmpl: TemplateItem) => {
    if (tmpl.is_preset) { messageApi.warning('系统预设模板不可删除'); return; }
    try {
      const data = await deleteTemplate(tmpl.id);
      if (data?.code === 200) { messageApi.success(data.message || '删除成功'); fetchTemplates(); }
      else { messageApi.error(data?.message || '删除失败'); }
    } catch { messageApi.error('删除失败'); }
  };

  const handleTemplateViewDetail = (tmpl: TemplateItem) => {
    setSelectedTemplate(tmpl);
    setTemplateDetailModalVisible(true);
  };

  // 模板上传配置
  const templateUploadProps = {
    fileList: templateFileList,
    beforeUpload: (file: RcFile) => {
      const allowed = ['doc', 'docx', 'xls', 'xlsx', 'csv', 'pdf', 'txt', 'png', 'jpg', 'jpeg'];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!allowed.includes(ext)) { messageApi.error(`不支持的文件格式: .${ext}`); return Upload.LIST_IGNORE; }
      if (file.size > 50 * 1024 * 1024) { messageApi.error('文件大小不能超过 50MB'); return Upload.LIST_IGNORE; }
      setTemplateFileList([{ uid: '-1', name: file.name, status: 'done', originFileObj: file }]);
      return false;
    },
    onRemove: () => setTemplateFileList([]),
    maxCount: 1,
  };

  // 模板统计
  const templateStats = {
    total: templates.length,
    presets: templates.filter(t => t.is_preset).length,
    custom: templates.filter(t => !t.is_preset).length,
    totalDownloads: templates.reduce((sum, t) => sum + t.download_count, 0),
  };

  // 模板表格列
  const templateColumns: ColumnsType<TemplateItem> = [
    { title: '模板编号', dataIndex: 'id', width: 110, render: (t: string) => <code style={{ fontSize: 12 }}>{t}</code> },
    { title: '模板名称', dataIndex: 'name', render: (text: string, record) => (
        <div><div style={{ fontWeight: 500 }}>{text}</div><div style={{ fontSize: 12, color: '#999' }}>{record.description || '-'}</div></div>) },
    { title: '分类', dataIndex: 'category', width: 110, render: (c: string, record) => <Tag color={categoryColorMap[c] || '#8c8c8c'}>{record.category_label}</Tag> },

    { title: '下载次数', dataIndex: 'download_count', width: 100, align: 'right' as const, render: (n: number) => <Text>{n}</Text> },
    { title: '类型', dataIndex: 'is_preset', width: 90, render: (v: boolean) => v ? <Tag color="gold">系统预设</Tag> : <Tag color="blue">自建</Tag> },
    { title: '创建时间', dataIndex: 'created_at', width: 170, render: (t: string) => <span style={{ fontSize: 12 }}><ClockCircleOutlined style={{ marginRight: 4 }} />{t ? new Date(t).toLocaleString('zh-CN') : '-'}</span> },
    { title: '操作', key: 'action', width: 240, fixed: 'right' as const, render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleTemplateViewDetail(record)}>查看</Button>
          <Dropdown menu={{ items: [
            { key: 'xlsx', label: '下载 .xlsx', icon: <FileExcelOutlined /> },
            { key: 'csv', label: '下载 .csv', icon: <FileExcelOutlined /> },
          ], onClick: ({ key }) => handleTemplateDownload(record, key) }}>
            <Button size="small" icon={<DownloadOutlined />}>下载</Button>
          </Dropdown>
          {!record.is_preset && (
            <Button size="small" danger icon={<DeleteOutlined />}
              onClick={() => Modal.confirm({ title: '确认删除', icon: <ExclamationCircleOutlined />,
                content: `确定要删除模板「${record.name}」吗？此操作不可恢复。`, okText: '确认删除', okType: 'danger', cancelText: '取消',
                onOk: () => handleTemplateDelete(record) })}>删除</Button>)}
        </Space>) },
  ];

  // 通用列表渲染
  const renderKnowledgeList = (list: KnowledgeItem[]) => (
    <List grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4 }}
      dataSource={list}
      renderItem={(item: KnowledgeItem) => (
        <List.Item>
          <Card hoverable size="small" actions={[
            <Tooltip title="查看"><EyeOutlined onClick={() => handleView(item)} /></Tooltip>,
            <Tooltip title="编辑"><EditOutlined onClick={() => handleEdit(item)} /></Tooltip>,
            <Tooltip title="删除"><Popconfirm title="确定删除?" onConfirm={() => handleDelete(item.id)}><DeleteOutlined style={{ color: '#f5222d' }} /></Popconfirm></Tooltip>,
          ]}>
            <Card.Meta
              title={<Space><Tag color={typeMap[item.type]?.color}>{typeMap[item.type]?.text}</Tag><Text ellipsis style={{ maxWidth: 180 }}>{item.title}</Text></Space>}
              description={
                <div>
                  <Text type="secondary" ellipsis style={{ display: 'block', minHeight: 40 }}>{item.content}</Text>
                  <Space size={4} style={{ marginTop: 8 }}>{item.tags.map(t => <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>)}</Space>
                  <Row justify="space-between" style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.author}</Text>
                    <Space size={8}>
                      <Text type="secondary" style={{ fontSize: 12 }}><StarOutlined /> {item.rating}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}><EyeOutlined /> {item.views}</Text>
                    </Space>
                  </Row>
                </div>
              }
            />
          </Card>
        </List.Item>
      )}
    />
  );

  // 常见列
  const baseColumns: ColumnsType<KnowledgeItem> = [
    { title: '编号', dataIndex: 'id', width: 110 },
    { title: '标题', dataIndex: 'title', ellipsis: true, render: (t, r) => <a onClick={() => handleView(r)}>{t}</a> },
    { title: '类型', dataIndex: 'type', width: 80, render: (t: string) => <Tag color={typeMap[t]?.color}>{typeMap[t]?.text}</Tag> },
    { title: '分类', dataIndex: 'category', width: 100 },
    { title: '作者', dataIndex: 'author', width: 80 },
    { title: '更新时间', dataIndex: 'updatedAt', width: 110 },
    { title: '评分', dataIndex: 'rating', width: 80, render: (v: number) => <Rate disabled defaultValue={v} style={{ fontSize: 14 }} /> },
    { title: '浏览', dataIndex: 'views', width: 70 },
  ];

  return (
    <Layout>
      {contextHolder}
      <Content className="page-content">
        {tab === 'search' && (
          <div className="content-card">
            {/* 搜索栏 */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col flex="auto">
                <Input.Search placeholder="搜索标题、标签、分类..." allowClear size="large"
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  prefix={<SearchOutlined />}
                  enterButton="搜索" />
              </Col>
              <Col>
                <Select placeholder="知识类型" allowClear mode="multiple" value={typeFilter}
                  onChange={setTypeFilter} style={{ width: 200 }}
                  options={Object.entries(typeMap).map(([k, v]) => ({ value: k, label: v.text }))} />
              </Col>
              <Col>
                <Button type="primary" icon={<PlusOutlined />} size="large" onClick={handleAdd}>新增知识</Button>
              </Col>
            </Row>
            {filteredItems.length > 0 ? renderKnowledgeList(filteredItems) : (
              <Empty description="未找到匹配的知识条目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        )}
        {tab === 'regulations' && (
          <div className="content-card">
            <Space style={{ marginBottom: 16 }}>
              <Input.Search placeholder="搜索法规" allowClear style={{ width: 250 }} />
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增法规</Button>
            </Space>
            <Table columns={[...baseColumns,
              { title: '文件类型', dataIndex: 'fileType', width: 80, render: (v: string) => v ? <Tag>{v}</Tag> : null },
              { title: '操作', width: 180, render: (_, r) => (
                <Space size="small">
                  <Button size="small" type="link" onClick={() => handleView(r)}><EyeOutlined /> 查看</Button>
                  <Button size="small" type="link" onClick={() => handleEdit(r)}><EditOutlined /> 编辑</Button>
                  <Popconfirm title="确定删除?" onConfirm={() => handleDelete(r.id)}>
                    <Button size="small" type="link" danger><DeleteOutlined /></Button>
                  </Popconfirm>
                </Space>
              )},
            ]} dataSource={regulations} rowKey="id" pagination={false} size="middle" />
          </div>
        )}
        {tab === 'cases' && (
          <div className="content-card">
            <Space style={{ marginBottom: 16 }}>
              <Input.Search placeholder="搜索案例" allowClear style={{ width: 250 }} />
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增案例</Button>
              <Button icon={<SwapOutlined />} onClick={() => messageApi.info('请选择要转化的审计发现记录')}>从审计发现转化</Button>
            </Space>
            <Table columns={[...baseColumns,
              { title: '关联项目', dataIndex: 'relatedTo', width: 140, render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '-' },
              { title: '操作', width: 180, render: (_, r) => (
                <Space size="small">
                  <Button size="small" type="link" onClick={() => handleView(r)}><EyeOutlined /> 查看</Button>
                  <Button size="small" type="link" onClick={() => handleEdit(r)}><EditOutlined /> 编辑</Button>
                  <Popconfirm title="确定删除?" onConfirm={() => handleDelete(r.id)}>
                    <Button size="small" type="link" danger><DeleteOutlined /></Button>
                  </Popconfirm>
                </Space>
              )},
            ]} dataSource={cases} rowKey="id" pagination={false} size="middle" />
          </div>
        )}
        {tab === 'templates' && (
          <div className="content-card">
            {/* 统计卡片 */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={12} sm={6}>
                <Card><Statistic title="模板总数" value={templateStats.total} prefix={<FileTextOutlined />} valueStyle={{ color: '#D7011D' }} /></Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card><Statistic title="系统预设" value={templateStats.presets} prefix={<FileWordOutlined />} valueStyle={{ color: '#faad14' }} /></Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card><Statistic title="自建模板" value={templateStats.custom} prefix={<FileExcelOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card><Statistic title="累计下载" value={templateStats.totalDownloads} prefix={<DownloadOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
              </Col>
            </Row>

            {/* 工具栏 */}
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <Space>
                <Input.Search placeholder="搜索模板名称..." allowClear style={{ width: 280 }}
                  prefix={<SearchOutlined />}
                  onSearch={(val) => setTemplateSearchKeyword(val)}
                  onPressEnter={(e) => setTemplateSearchKeyword((e.target as HTMLInputElement).value)}
                  onChange={(e) => { if (!e.target.value) setTemplateSearchKeyword(''); }} />
                <Select placeholder="选择分类" allowClear style={{ width: 140 }}
                  value={templateFilterCategory}
                  onChange={(val) => setTemplateFilterCategory(val || null)}>
                  {templateCategories.map((c) => <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>)}
                </Select>
              </Space>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={fetchTemplates}>刷新</Button>
                <Button type="primary" icon={<UploadOutlined />} onClick={handleTemplateUpload}
                  style={{ background: '#D7011D', borderColor: '#D7011D' }}>上传模板</Button>
              </Space>
            </div>

            {/* 表格 */}
            <Table columns={templateColumns} dataSource={templates} rowKey="id"
              loading={templateLoading}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 个模板` }}
              scroll={{ x: 1300 }} />
          </div>
        )}

        {/* 查看详情抽屉 */}
        <Drawer title="知识详情" width={620} open={drawerVisible} onClose={() => setDrawerVisible(false)}>
          {selectedItem && (
            <div>
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="编号">{selectedItem.id}</Descriptions.Item>
                <Descriptions.Item label="类型"><Tag color={typeMap[selectedItem.type]?.color}>{typeMap[selectedItem.type]?.text}</Tag></Descriptions.Item>
                <Descriptions.Item label="标题" span={2}>{selectedItem.title}</Descriptions.Item>
                <Descriptions.Item label="分类">{selectedItem.category}</Descriptions.Item>
                <Descriptions.Item label="状态"><Tag color={selectedItem.status === 'published' ? 'green' : 'orange'}>{selectedItem.status === 'published' ? '已发布' : '草稿'}</Tag></Descriptions.Item>
                <Descriptions.Item label="作者">{selectedItem.author}</Descriptions.Item>
                <Descriptions.Item label="更新">{selectedItem.updatedAt}</Descriptions.Item>
                <Descriptions.Item label="评分" span={2}><Rate disabled value={selectedItem.rating} /></Descriptions.Item>
                <Descriptions.Item label="浏览">{selectedItem.views}</Descriptions.Item>
                <Descriptions.Item label="文件">{selectedItem.fileType || '无'}</Descriptions.Item>
                <Descriptions.Item label="标签" span={2}>{selectedItem.tags.map(t => <Tag key={t}>{t}</Tag>)}</Descriptions.Item>
                <Descriptions.Item label="内容" span={2}><div style={{ whiteSpace: 'pre-wrap' }}>{selectedItem.content}</div></Descriptions.Item>
                {selectedItem.attachments && selectedItem.attachments.length > 0 && (
                  <Descriptions.Item label="附件" span={2}>
                    <List size="small" dataSource={selectedItem.attachments} renderItem={(f: UploadFile) => (
                      <List.Item
                        actions={f.url ? [<a key="dl" href={f.url} download={f.name} target="_blank" rel="noreferrer"><DownloadOutlined /></a>] : []}
                      >
                        <Space><Tag icon={<FileTextOutlined />} color="blue">{f.name}</Tag>
                        {f.size && <Text type="secondary" style={{ fontSize: 12 }}>({(f.size / 1024).toFixed(1)} KB)</Text>}</Space>
                      </List.Item>
                    )} />
                  </Descriptions.Item>
                )}
              </Descriptions>
              {selectedItem.relatedTo && (
                <Card size="small" title="关联审计项目" style={{ marginTop: 16 }}>
                  <Text>来自审计发现 <Tag color="blue">{selectedItem.relatedTo}</Tag></Text>
                </Card>
              )}
            </div>
          )}
        </Drawer>

        {/* 新建/编辑弹窗 */}
        <Modal title={editingItem ? '编辑知识条目' : '新增知识条目'} open={modalVisible}
          onOk={handleModalOk} onCancel={() => setModalVisible(false)} width={600} destroyOnClose>
          <Form form={form} layout="vertical" initialValues={{ type: 'regulation', status: 'published' }}>
            <Form.Item name="title" label="标题" rules={[{ required: true }]}>
              <Input placeholder="请输入标题" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                  <Select options={Object.entries(typeMap).map(([k, v]) => ({ value: k, label: v.text }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="category" label="分类" rules={[{ required: true }]}>
                  <Select options={['内控规范', '国际标准', '采购审计', '资产管理', '底稿模板', '报告模板', '审计指南', 'IT审计'].map(c => ({ value: c, label: c }))} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="status" label="状态">
                  <Select options={[{ value: 'published', label: '已发布' }, { value: 'draft', label: '草稿' }]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="fileType" label="文件格式">
                  <Input placeholder="如 PDF/DOC/XLSX" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="tags" label="标签">
              <Select mode="tags" placeholder="输入标签后回车添加" />
            </Form.Item>
            <Form.Item label="附件上传">
              <Upload.Dragger
                fileList={fileList as any}
                multiple
                beforeUpload={(file) => {
                  const reader = new FileReader();
                  reader.readAsDataURL(file);
                  reader.onload = () => {
                    const newFile: UploadFile = {
                      uid: `${Date.now()}-${Math.random()}`,
                      name: file.name,
                      status: 'done',
                      size: file.size,
                      type: file.type,
                      url: reader.result as string,
                    };
                    setFileList(prev => [...prev, newFile]);
                  };
                  return false; // 阻止自动上传，手动管理
                }}
                onRemove={(file) => {
                  setFileList(prev => prev.filter(f => f.uid !== file.uid));
                }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.zip,.rar"
                showUploadList={{ showPreviewIcon: true, showRemoveIcon: true, showDownloadIcon: false }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽文件至此区域上传</p>
                <p className="ant-upload-hint">支持 PDF / Word / Excel / PPT / 图片 / 压缩包</p>
              </Upload.Dragger>
            </Form.Item>
            <Form.Item name="content" label="内容" rules={[{ required: true }]}>
              <TextArea rows={6} placeholder="请输入知识内容..." />
            </Form.Item>
          </Form>
        </Modal>

        {/* ---- 模板上传弹窗 ---- */}
        <Modal title="上传底稿模板" open={templateUploadModalVisible}
          onOk={handleTemplateUploadSubmit} onCancel={() => setTemplateUploadModalVisible(false)}
          confirmLoading={templateUploading} okText="确认上传" cancelText="取消" width={560}>
          <Form form={templateUploadForm} layout="vertical" style={{ marginTop: 12 }}>
            <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
              <Input placeholder="如: 审计底稿-费用分析表" />
            </Form.Item>
            <Form.Item name="category" label="模板分类" initialValue="other" rules={[{ required: true, message: '请选择分类' }]}>
              <Select placeholder="选择分类">
                {templateCategories.map((c) => <Select.Option key={c.value} value={c.value}>{c.label}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="description" label="模板描述">
              <Input.TextArea rows={3} placeholder="简要描述模板用途..." />
            </Form.Item>
            <Form.Item label="选择文件" required>
              <Upload.Dragger {...templateUploadProps} accept=".doc,.docx,.xls,.xlsx,.csv,.pdf,.txt,.png,.jpg,.jpeg">
                <p className="ant-upload-drag-icon"><UploadOutlined style={{ fontSize: 36, color: '#D7011D' }} /></p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">支持 Word、Excel、CSV、PDF、TXT、图片格式，单个文件不超过 50MB</p>
              </Upload.Dragger>
            </Form.Item>
          </Form>
        </Modal>

        {/* ---- 模板详情弹窗 ---- */}
        <Modal title={`模板详情: ${selectedTemplate?.name || ''}`} open={templateDetailModalVisible}
          onCancel={() => setTemplateDetailModalVisible(false)}
          footer={<Space>
            {selectedTemplate && (
              <Dropdown menu={{ items: [
                { key: 'xlsx', label: '下载 .xlsx', icon: <FileExcelOutlined /> },
                { key: 'csv', label: '下载 .csv', icon: <FileExcelOutlined /> },
              ], onClick: ({ key }) => handleTemplateDownload(selectedTemplate, key) }}>
                <Button icon={<DownloadOutlined />}>下载文件</Button>
              </Dropdown>
            )}
            <Button onClick={() => setTemplateDetailModalVisible(false)}>关闭</Button>
          </Space>} width={640}>
          {selectedTemplate && (
            <div>
              <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="模板编号" span={2}><code>{selectedTemplate.id}</code></Descriptions.Item>
                <Descriptions.Item label="模板名称">{selectedTemplate.name}</Descriptions.Item>
                <Descriptions.Item label="分类"><Tag color={categoryColorMap[selectedTemplate.category] || '#8c8c8c'}>{selectedTemplate.category_label}</Tag></Descriptions.Item>
                <Descriptions.Item label="原始文件名" span={2}>{selectedTemplate.file_name}</Descriptions.Item>
                <Descriptions.Item label="文件类型">.{selectedTemplate.file_type}</Descriptions.Item>
                <Descriptions.Item label="文件大小">{formatFileSize(selectedTemplate.file_size)}</Descriptions.Item>
                <Descriptions.Item label="模板类型">{selectedTemplate.is_preset ? <Tag color="gold">系统预设</Tag> : <Tag color="blue">自建</Tag>}</Descriptions.Item>
                <Descriptions.Item label="下载次数">{selectedTemplate.download_count}</Descriptions.Item>
                <Descriptions.Item label="创建人">{selectedTemplate.created_by || '-'}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{selectedTemplate.created_at ? new Date(selectedTemplate.created_at).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
                <Descriptions.Item label="描述" span={2}><Text>{selectedTemplate.description || '暂无描述'}</Text></Descriptions.Item>
              </Descriptions>
              <Card size="small" title="文件预览" style={{ marginTop: 16 }}>
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  {getFileIcon(selectedTemplate.file_type)}
                  <div style={{ marginTop: 12, fontWeight: 500 }}>{selectedTemplate.file_name}</div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>.{selectedTemplate.file_type} · {formatFileSize(selectedTemplate.file_size)} · 下载 {selectedTemplate.download_count} 次</div>
                </div>
              </Card>
            </div>
          )}
        </Modal>
      </Content>
    </Layout>
  );
};

export default KnowledgePage;
