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
                    <Select options={[{value:'in_app',label:'站内通知'},{value:'email',label:'邮件通知'},{value:'sms',label:'短信通知'},{value:'all',label:'全部方式'}]} />
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
                    <Select options={[{value:15,label:'15 分钟'},{value:30,label:'30 分钟'},{value:60,label:'60 分钟'},{value:120,label:'120 分钟'}]} />
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
                    <Select defaultValue={90} options={[{value:30,label:'30 天'},{value:60,label:'60 天'},{value:90,label:'90 天'},{value:0,label:'永不过期'}]} />
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
                    <Select options={[{value:'zh-CN',label:'简体中文'},{value:'en-US',label:'English'}]} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="pageSize" label="每页显示条数" initialValue={20}>
                    <Select options={[{value:10,label:'10 条'},{value:20,label:'20 条'},{value:50,label:'50 条'},{value:100,label:'100 条'}]} />
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
                    onConfirm={() => { form.resetFields(); message.success('设置已重置为默认值'); }}
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
