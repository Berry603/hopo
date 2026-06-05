import React, { useState } from 'react';
import {
  Card,
  Form,
  Switch,
  Select,
  Button,
  Space,
  Divider,
  Input,
  message,
  Row,
  Col,
  Typography,
  Radio,
  Slider,
  Tag,
  Popconfirm,
  Alert,
} from 'antd';
import {
  BellOutlined,
  SafetyOutlined,
  EyeOutlined,
  GlobalOutlined,
  DatabaseOutlined,
  SoundOutlined,
  ThunderboltOutlined,
  RestOutlined,
  SaveOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();

  const handleSave = (section: string) => {
    form.validateFields().then((values) => {
      console.log(`保存${section}设置:`, values);
      message.success(`${section}设置已保存`);
    });
  };

  return (
    <div className="page-container">
      <Row gutter={24}>
        <Col span={24}>
          <Card
            title={<Space><BellOutlined /> 通知设置</Space>}
            extra={
              <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave('通知')}>保存</Button>
            }
          >
            <Form form={form} layout="vertical">
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name="riskAlert" label="风险预警通知" valuePropName="checked" initialValue={true}>
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="auditRemind" label="审计任务提醒" valuePropName="checked" initialValue={true}>
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="rectNotify" label="整改到期提醒" valuePropName="checked" initialValue={true}>
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="systemNotice" label="系统公告" valuePropName="checked" initialValue={false}>
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="notifyMethod" label="通知方式" initialValue="in_app">
                    <Select>
                      <Option value="in_app">站内通知</Option>
                      <Option value="email">邮件通知</Option>
                      <Option value="sms">短信通知</Option>
                      <Option value="all">全部方式</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="notifySound" label="提示音" valuePropName="checked" initialValue={true}>
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        <Col span={24} style={{ marginTop: 24 }}>
          <Card
            title={<Space><SafetyOutlined /> 安全设置</Space>}
            extra={
              <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave('安全')}>保存</Button>
            }
          >
            <Form form={form} layout="vertical">
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name="sessionTimeout" label="会话超时（分钟）" initialValue={30}>
                    <Select>
                      <Option value={15}>15 分钟</Option>
                      <Option value={30}>30 分钟</Option>
                      <Option value={60}>60 分钟</Option>
                      <Option value={120}>120 分钟</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="loginNotify" label="异地登录提醒" valuePropName="checked" initialValue={true}>
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="ipWhitelistEnabled" label="IP白名单限制" valuePropName="checked" initialValue={false}>
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="passwordExpire" label="密码过期天数">
                    <Select defaultValue={90}>
                      <Option value={30}>30 天</Option>
                      <Option value={60}>60 天</Option>
                      <Option value={90}>90 天</Option>
                      <Option value={0}>永不过期</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        <Col span={24} style={{ marginTop: 24 }}>
          <Card
            title={<Space><EyeOutlined /> 显示设置</Space>}
            extra={
              <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave('显示')}>保存</Button>
            }
          >
            <Form form={form} layout="vertical">
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name="theme" label="主题模式" initialValue="light">
                    <Radio.Group>
                      <Radio.Button value="light">浅色模式</Radio.Button>
                      <Radio.Button value="dark">深色模式</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="language" label="语言" initialValue="zh-CN">
                    <Select>
                      <Option value="zh-CN">简体中文</Option>
                      <Option value="en-US">English</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="pageSize" label="每页显示条数" initialValue={20}>
                    <Select>
                      <Option value={10}>10 条</Option>
                      <Option value={20}>20 条</Option>
                      <Option value={50}>50 条</Option>
                      <Option value={100}>100 条</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="showSiderCollapsed" label="默认收起侧边栏" valuePropName="checked" initialValue={false}>
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        <Col span={24} style={{ marginTop: 24 }}>
          <Card
            title={<Space><DatabaseOutlined /> 数据与缓存</Space>}
          >
            <Row gutter={24}>
              <Col span={24}>
                <Alert
                  message="清除缓存将重置本地存储的筛选条件和临时数据，不会影响系统数据。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Space size="middle">
                  <Popconfirm
                    title="确认清除本地缓存？"
                    onConfirm={() => message.success('缓存已清除')}
                    okText="确认"
                    cancelText="取消"
                  >
                    <Button icon={<RestOutlined />} danger>清除本地缓存</Button>
                  </Popconfirm>
                  <Popconfirm
                    title="确认重置所有设置？此操作不可逆！"
                    onConfirm={() => message.success('设置已重置为默认值')}
                    okText="确认"
                    cancelText="取消"
                  >
                    <Button icon={<ReloadOutlined />}>恢复默认设置</Button>
                  </Popconfirm>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SettingsPage;
