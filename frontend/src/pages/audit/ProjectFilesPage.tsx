import React, { useState, useEffect } from 'react';
import {
  Card, Table, Tree, Button, Upload, message, Modal, Typography,
  Space, Tag, Breadcrumb, Spin, Empty, Tooltip, Image, Popconfirm,
} from 'antd';
import {
  UploadOutlined, FolderOutlined, FileOutlined, DownloadOutlined,
  DeleteOutlined, PictureOutlined, FileExcelOutlined, FilePdfOutlined,
  FileWordOutlined, FileTextOutlined, HomeOutlined, ReloadOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import request from '../../services/request';

const { Text, Title } = Typography;
const { DirectoryTree } = Tree;

interface TreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: TreeNode[];
  size?: number;
  ext?: string;
  file_count?: number;
}

interface StageFiles {
  stage_code: string;
  stage_name: string;
  files: FileItem[];
  file_count: number;
}

interface FileItem {
  name: string;
  path: string;
  size: number;
  ext: string;
  modified: string;
}

const stageNames: Record<string, string> = {
  '00': '立项与通知', '01': '制度依据', '02': '访谈与沟通记录',
  '03': '被审计单位资料', '04': '系统关联数据', '05': '测试与底稿',
  '06': '审计报告与沟通', '99': '归档与说明',
};

const ProjectFilesPage: React.FC<{ projectId: string; projectCode: string; projectName: string }> = ({
  projectId, projectCode, projectName,
}) => {
  const [treeData, setTreeData] = useState<any[]>([]);
  const [stagedFiles, setStagedFiles] = useState<StageFiles[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>('05');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  useEffect(() => {
    loadTree();
    loadFiles();
  }, [projectId]);

  const loadTree = async () => {
    try {
      const res = await request.get(`/audit/projects/${projectId}/files/tree`);
      const data = (res.data as any[]) || [];
      setTreeData(formatTreeData(data));
    } catch { /* ignore */ }
  };

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await request.get(`/audit/projects/${projectId}/files`);
      setStagedFiles((res.data as StageFiles[]) || []);
    } catch { message.error('加载文件列表失败'); }
    setLoading(false);
  };

  const formatTreeData = (nodes: TreeNode[]): any[] => {
    return nodes.map((node) => ({
      title: node.is_dir ? (
        <Space>
          <FolderOutlined style={{ color: '#faad14' }} />
          <Text>{node.name}</Text>
          {node.file_count !== undefined && (
            <Text type="secondary" style={{ fontSize: 12 }}>({node.file_count} 文件)</Text>
          )}
        </Space>
      ) : (
        <Space>
          <FileIcon ext={node.ext || ''} />
          <Text>{node.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {(node.size || 0) > 1024 ? `${((node.size || 0) / 1024).toFixed(1)} KB` : `${node.size || 0} B`}
          </Text>
        </Space>
      ),
      key: node.path,
      isLeaf: !node.is_dir,
      children: node.children ? formatTreeData(node.children) : undefined,
    }));
  };

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append('file', file as Blob);
    formData.append('stage', selectedStage);
    try {
      await request.post(`/audit/projects/${projectId}/files/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(`${(file as File).name} 上传成功`);
      onSuccess?.(null);
      loadFiles();
      loadTree();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '上传失败');
      onError?.(e);
    }
  };

  const handleDownload = async (filePath: string) => {
    try {
      const res = await request.get(`/audit/projects/${projectId}/files/download`, {
        params: { file_path: filePath },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('/').pop() || 'file';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { message.error('下载失败'); }
  };

  const handleDelete = async (filePath: string) => {
    try {
      await request.delete(`/audit/projects/${projectId}/files`, {
        params: { file_path: filePath },
      });
      message.success('删除成功');
      loadFiles();
      loadTree();
    } catch { message.error('删除失败'); }
  };

  const handlePreview = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
      setPreviewImage(`/audit/projects/${projectId}/files/download?file_path=${encodeURIComponent(filePath)}`);
      setPreviewVisible(true);
    } else {
      handleDownload(filePath);
    }
  };

  const getDownloadUrl = (filePath: string) => {
    return `http://localhost:8001/api/v1/audit/projects/${projectId}/files/download?file_path=${encodeURIComponent(filePath)}`;
  };

  // 按阶段分组的文件列表
  const currentStageFiles = stagedFiles.find(s => s.stage_code === selectedStage);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={() => { loadTree(); loadFiles(); }}>
          刷新
        </Button>
        <Upload
          customRequest={handleUpload}
          showUploadList={false}
          accept=".xlsx,.xls,.docx,.doc,.pdf,.png,.jpg,.jpeg,.gif,.csv,.txt,.sql,.pptx"
        >
          <Button type="primary" icon={<UploadOutlined />}>
            上传文件到当前阶段
          </Button>
        </Upload>
      </Space>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* 左侧：阶段目录树 */}
        <Card title="项目目录结构" size="small" style={{ width: 340, minHeight: 400 }}>
          {treeData.length > 0 ? (
            <DirectoryTree
              treeData={treeData}
              defaultExpandAll={false}
              onSelect={(keys) => {
                const key = keys[0] as string;
                if (key) setSelectedStage(key.slice(0, 2));
              }}
            />
          ) : (
            <Empty description="暂无文件夹结构" />
          )}
        </Card>

        {/* 右侧：文件列表 */}
        <Card
          title={`${stageNames[selectedStage] || selectedStage} - 文件列表`}
          size="small"
          style={{ flex: 1, minHeight: 400 }}
          extra={
            <Text type="secondary">
              {currentStageFiles?.file_count || 0} 个文件
            </Text>
          }
        >
          <Table
            dataSource={currentStageFiles?.files || []}
            rowKey="path"
            loading={loading}
            size="small"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            columns={[
              {
                title: '', width: 36,
                render: (_: any, record: FileItem) => <FileIcon ext={record.ext} />,
              },
              { title: '文件名', dataIndex: 'name', ellipsis: true },
              {
                title: '大小', width: 100,
                render: (_: any, record: FileItem) => (
                  <Text type="secondary">{formatSize(record.size)}</Text>
                ),
              },
              {
                title: '操作', width: 160,
                render: (_: any, record: FileItem) => (
                  <Space>
                    <Tooltip title="预览/下载">
                      <Button size="small" icon={<DownloadOutlined />}
                        onClick={() => handlePreview(record.path)} />
                    </Tooltip>
                    <Popconfirm title="确定删除此文件?" onConfirm={() => handleDelete(record.path)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
            locale={{ emptyText: <Empty description="此阶段暂无文件" /> }}
          />
        </Card>
      </div>

      {/* 图片预览 */}
      <Image
        style={{ display: 'none' }}
        preview={{
          visible: previewVisible,
          src: previewImage,
          onVisibleChange: setPreviewVisible,
        }}
      />
    </div>
  );
};

const FileIcon: React.FC<{ ext: string }> = ({ ext }) => {
  const iconMap: Record<string, React.ReactNode> = {
    '.xlsx': <FileExcelOutlined style={{ color: '#52c41a' }} />,
    '.xls': <FileExcelOutlined style={{ color: '#52c41a' }} />,
    '.docx': <FileWordOutlined style={{ color: '#1890ff' }} />,
    '.doc': <FileWordOutlined style={{ color: '#1890ff' }} />,
    '.pdf': <FilePdfOutlined style={{ color: '#f5222d' }} />,
    '.png': <PictureOutlined style={{ color: '#722ed1' }} />,
    '.jpg': <PictureOutlined style={{ color: '#722ed1' }} />,
    '.jpeg': <PictureOutlined style={{ color: '#722ed1' }} />,
    '.gif': <PictureOutlined style={{ color: '#722ed1' }} />,
    '.csv': <FileTextOutlined style={{ color: '#fa8c16' }} />,
    '.txt': <FileTextOutlined style={{ color: '#595959' }} />,
  };
  return iconMap[ext] || <FileOutlined />;
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default ProjectFilesPage;
