import React, { useState, useEffect } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  Upload, message, Card, Statistic, Row, Col, InputNumber,
  Descriptions, Typography, Layout,
} from 'antd';
import {
  FileTextOutlined, DownloadOutlined, DeleteOutlined,
  UploadOutlined, FileWordOutlined, FileExcelOutlined, FilePdfOutlined,
  FileImageOutlined, FileUnknownOutlined, ClockCircleOutlined,
  EyeOutlined, ExclamationCircleOutlined, SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload';
import type { RcFile } from 'antd/es/upload';
import { getTemplates, getTemplateCategories, uploadTemplate, deleteTemplate, getTemplateDownloadUrl } from '@/services/knowledge';
import './TemplatePage.less';

const { Content } = Layout;
const { Text, Paragraph } = Typography;

// ==================== Types ====================

interface TemplateItem {
  id: string;
  name: string;
  category: string;
  category_label: string;
  description: string | null;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  is_preset: boolean;
  download_count: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface CategoryItem {
  value: string;
  label: string;
}

// ==================== Helpers ====================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string): React.ReactNode {
  const type = fileType.toLowerCase();
  if (['doc', 'docx'].includes(type)) return <FileWordOutlined style={{ color: '#2b579a', fontSize: 24 }} />;
  if (['xls', 'xlsx'].includes(type)) return <FileExcelOutlined style={{ color: '#217346', fontSize: 24 }} />;
  if (type === 'pdf') return <FilePdfOutlined style={{ color: '#f5222d', fontSize: 24 }} />;
  if (['png', 'jpg', 'jpeg'].includes(type)) return <FileImageOutlined style={{ color: '#52c41a', fontSize: 24 }} />;
  return <FileUnknownOutlined style={{ color: '#999', fontSize: 24 }} />;
}

const categoryColorMap: Record<string, string> = {
  financial: '#1890ff',
  operational: '#52c41a',
  compliance: '#faad14',
  purchase: '#722ed1',
  sales: '#eb2f96',
  asset: '#13c2c2',
  fund: '#fa8c16',
  other: '#8c8c8c',
};

// ==================== Component ====================

const TemplatePage: React.FC = () => {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Filters
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Modals
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const [uploadForm] = Form.useForm();

  // ==================== API Calls ====================

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await getTemplates({
        category: filterCategory || undefined,
        keyword: searchKeyword || undefined,
      });
      setTemplates((data?.data as any)?.items || []);
    } catch (err) {
      message.error('获取模板列表失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await getTemplateCategories();
      setCategories((data?.data as any)?.items || []);
    } catch (err) {
      console.error('获取分类失败', err);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchTemplates();
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [filterCategory, searchKeyword]);

  // ==================== Actions ====================

  const handleUpload = () => {
    uploadForm.resetFields();
    setFileList([]);
    setUploadModalVisible(true);
  };

  const handleUploadSubmit = async () => {
    try {
      const values = await uploadForm.validateFields();
      if (fileList.length === 0) {
        message.warning('请选择要上传的文件');
        return;
      }

      setUploading(true);
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('category', values.category || 'other');
      if (values.description) formData.append('description', values.description);

      const file = fileList[0].originFileObj as RcFile;
      formData.append('file', file);

      const data = await uploadTemplate(formData);

      if (data?.code === 200) {
        message.success(data.message || '模板上传成功');
        setUploadModalVisible(false);
        fetchTemplates();
      } else {
        message.error(data?.message || '上传失败');
      }
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('上传失败: ' + (err.message || '未知错误'));
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (template: TemplateItem) => {
    try {
      const response = await fetch(getTemplateDownloadUrl(template.id), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      if (!response.ok) throw new Error('下载失败');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = template.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      message.success(`模板「${template.name}」下载已开始`);
      setTimeout(() => fetchTemplates(), 500);
    } catch {
      message.error('下载失败');
    }
  };

  const handleDelete = async (template: TemplateItem) => {
    if (template.is_preset) {
      message.warning('系统预设模板不可删除');
      return;
    }
    try {
      const data = await deleteTemplate(template.id);
      if (data?.code === 200) {
        message.success(data.message || '删除成功');
        fetchTemplates();
      } else {
        message.error(data?.message || '删除失败');
      }
    } catch (err) {
      message.error('删除失败');
      console.error(err);
    }
  };

  const handleViewDetail = (template: TemplateItem) => {
    setSelectedTemplate(template);
    setDetailModalVisible(true);
  };

  // ==================== Upload Props ====================

  const uploadProps = {
    fileList,
    beforeUpload: (file: RcFile) => {
      const allowed = ['doc', 'docx', 'xls', 'xlsx', 'pdf', 'png', 'jpg', 'jpeg'];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!allowed.includes(ext)) {
        message.error(`不支持的文件格式: .${ext}`);
        return Upload.LIST_IGNORE;
      }
      if (file.size > 50 * 1024 * 1024) {
        message.error('文件大小不能超过 50MB');
        return Upload.LIST_IGNORE;
      }
      setFileList([{ uid: '-1', name: file.name, status: 'done', originFileObj: file }]);
      return false; // 阻止自动上传，手动控制
    },
    onRemove: () => {
      setFileList([]);
    },
    maxCount: 1,
  };

  // ==================== Columns ====================

  const columns: ColumnsType<TemplateItem> = [
    {
      title: '模板编号',
      dataIndex: 'id',
      key: 'id',
      width: 110,
      render: (t: string) => <code style={{ fontSize: 12 }}>{t}</code>,
    },
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.description || '-'}</div>
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 110,
      render: (c: string, record) => (
        <Tag color={categoryColorMap[c] || '#8c8c8c'}>{record.category_label}</Tag>
      ),
    },
    {
      title: '文件类型',
      key: 'fileInfo',
      width: 150,
      render: (_, record) => (
        <Space>
          {getFileIcon(record.file_type)}
          <div>
            <div>{record.file_name}</div>
            <div style={{ fontSize: 12, color: '#999' }}>.{record.file_type} · {formatFileSize(record.file_size)}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '下载次数',
      dataIndex: 'download_count',
      key: 'download_count',
      width: 100,
      align: 'right',
      render: (n: number) => <Text>{n}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'is_preset',
      key: 'is_preset',
      width: 90,
      render: (v: boolean) =>
        v ? <Tag color="gold">系统预设</Tag> : <Tag color="blue">自建</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (t: string) => (
        <span style={{ fontSize: 12 }}>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {t ? new Date(t).toLocaleString('zh-CN') : '-'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            查看
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)}>
            下载
          </Button>
          {!record.is_preset && (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                Modal.confirm({
                  title: '确认删除',
                  icon: <ExclamationCircleOutlined />,
                  content: `确定要删除模板「${record.name}」吗？此操作不可恢复。`,
                  okText: '确认删除',
                  okType: 'danger',
                  cancelText: '取消',
                  onOk: () => handleDelete(record),
                })
              }
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // ==================== Stats ====================

  const stats = {
    total: templates.length,
    presets: templates.filter(t => t.is_preset).length,
    custom: templates.filter(t => !t.is_preset).length,
    totalDownloads: templates.reduce((sum, t) => sum + t.download_count, 0),
  };

  // ==================== Render ====================

  return (
    <Layout className="template-page">
      <Content className="page-content">
        {/* Stats Row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="模板总数" value={stats.total} prefix={<FileTextOutlined />} valueStyle={{ color: '#D7011D' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="系统预设" value={stats.presets} prefix={<FileWordOutlined />} valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="自建模板" value={stats.custom} prefix={<FileExcelOutlined />} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic title="累计下载" value={stats.totalDownloads} prefix={<DownloadOutlined />} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
        </Row>

        {/* Main Content */}
        <div className="content-card">
          {/* Toolbar */}
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <Space>
              <Input.Search
                placeholder="搜索模板名称..."
                allowClear
                style={{ width: 280 }}
                prefix={<SearchOutlined />}
                onSearch={(val) => setSearchKeyword(val)}
                onPressEnter={(e) => setSearchKeyword((e.target as HTMLInputElement).value)}
                onChange={(e) => { if (!e.target.value) setSearchKeyword(''); }}
              />
              <Select
                placeholder="选择分类"
                allowClear
                style={{ width: 140 }}
                options={categories.map(c => ({ value: c.value, label: c.label }))}
                value={filterCategory}
                onChange={(val) => setFilterCategory(val || null)}
              />
            </Space>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchTemplates}>刷新</Button>
              <Button type="primary" icon={<UploadOutlined />} onClick={handleUpload} style={{ background: '#D7011D', borderColor: '#D7011D' }}>
                上传模板
              </Button>
            </Space>
          </div>

          {/* Table */}
          <Table
            columns={columns}
            dataSource={templates}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个模板`,
            }}
            scroll={{ x: 1300 }}
          />
        </div>
      </Content>

      {/* Upload Modal */}
      <Modal
        title="上传底稿模板"
        open={uploadModalVisible}
        onOk={handleUploadSubmit}
        onCancel={() => setUploadModalVisible(false)}
        confirmLoading={uploading}
        okText="确认上传"
        cancelText="取消"
        width={560}
      >
        <Form form={uploadForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="如: 审计底稿-费用分析表" />
          </Form.Item>
          <Form.Item
            name="category"
            label="模板分类"
            initialValue="other"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="选择分类" options={categories.map(c => ({ value: c.value, label: c.label }))} />
          </Form.Item>
          <Form.Item name="description" label="模板描述">
            <Input.TextArea rows={3} placeholder="简要描述模板用途..." />
          </Form.Item>
          <Form.Item label="选择文件" required>
            <Upload.Dragger {...uploadProps} accept=".doc,.docx,.xls,.xlsx,.pdf,.png,.jpg,.jpeg">
              <p className="ant-upload-drag-icon">
                <UploadOutlined style={{ fontSize: 36, color: '#D7011D' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 Word、Excel、PDF、图片格式，单个文件不超过 50MB
              </p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={`模板详情: ${selectedTemplate?.name || ''}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          <Space>
            {selectedTemplate && (
              <Button icon={<DownloadOutlined />} onClick={() => handleDownload(selectedTemplate)}>
                下载文件
              </Button>
            )}
            <Button onClick={() => setDetailModalVisible(false)}>关闭</Button>
          </Space>
        }
        width={640}
      >
        {selectedTemplate && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="模板编号" span={2}>
                <code>{selectedTemplate.id}</code>
              </Descriptions.Item>
              <Descriptions.Item label="模板名称">{selectedTemplate.name}</Descriptions.Item>
              <Descriptions.Item label="分类">
                <Tag color={categoryColorMap[selectedTemplate.category] || '#8c8c8c'}>
                  {selectedTemplate.category_label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="原始文件名" span={2}>{selectedTemplate.file_name}</Descriptions.Item>
              <Descriptions.Item label="文件类型">.{selectedTemplate.file_type}</Descriptions.Item>
              <Descriptions.Item label="文件大小">{formatFileSize(selectedTemplate.file_size)}</Descriptions.Item>
              <Descriptions.Item label="模板类型">
                {selectedTemplate.is_preset ? <Tag color="gold">系统预设</Tag> : <Tag color="blue">自建</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="下载次数">{selectedTemplate.download_count}</Descriptions.Item>
              <Descriptions.Item label="创建人">{selectedTemplate.created_by || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {selectedTemplate.created_at ? new Date(selectedTemplate.created_at).toLocaleString('zh-CN') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                <Paragraph style={{ marginBottom: 0 }}>
                  {selectedTemplate.description || '暂无描述'}
                </Paragraph>
              </Descriptions.Item>
            </Descriptions>

            {/* File Preview Info */}
            <Card size="small" title="文件预览" style={{ marginTop: 16 }}>
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                {getFileIcon(selectedTemplate.file_type)}
                <div style={{ marginTop: 12, fontWeight: 500 }}>{selectedTemplate.file_name}</div>
                <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                  .{selectedTemplate.file_type} · {formatFileSize(selectedTemplate.file_size)} · 下载 {selectedTemplate.download_count} 次
                </div>
              </div>
            </Card>
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default TemplatePage;
