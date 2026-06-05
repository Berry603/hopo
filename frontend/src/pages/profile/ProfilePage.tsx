import React, { useState } from 'react';
import {
  Card,
  Descriptions,
  Avatar,
  Tag,
  Button,
  Space,
  Divider,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Row,
  Col,
  Typography,
  Upload,
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  TeamOutlined,
  CalendarOutlined,
  EditOutlined,
  UploadOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;

const ProfilePage: React.FC = () => {
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();

  const userInfo = {
    name: '张三',
    employeeId: 'HOPO-202300156',
    department: '审计监察部',
    position: '高级审计经理',
    email: 'zhangsan@hopo.com',
    phone: '138****6789',
    joinDate: '2020-03-15',
    location: '肇庆总部',
    role: '系统管理员',
    status: 'active',
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      console.log('保存个人信息:', values);
      message.success('个人信息已保存');
      setEditing(false);
    });
  };

  return (
    <div className="page-container">
      <Row gutter={24}>
        {/* 左侧 - 头像卡片 */}
        <Col xs={24} md={8}>
          <Card className="profile-card">
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Avatar
                size={100}
                icon={<UserOutlined />}
                style={{ backgroundColor: '#E34D59', marginBottom: 16 }}
              />
              <Title level={3} style={{ marginBottom: 4 }}>{userInfo.name}</Title>
              <Tag color="red">{userInfo.position}</Tag>
              <Tag color={userInfo.status === 'active' ? 'green' : 'default'}>
                {userInfo.status === 'active' ? '在职' : '离职'}
              </Tag>
              <Divider />
              <Space direction="vertical" size="small">
                <Space>
                  <TeamOutlined /> {userInfo.department}
                </Space>
                <Space>
                  <IdcardOutlined /> {userInfo.employeeId}
                </Space>
                <Space>
                  <EnvironmentOutlined /> {userInfo.location}
                </Space>
                <Space>
                  <CalendarOutlined /> 入职：{userInfo.joinDate}
                </Space>
              </Space>
            </div>
          </Card>

          {/* 联系方式卡片 */}
          <Card title="联系方式" style={{ marginTop: 24 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Space>
                <MailOutlined style={{ color: '#E34D59' }} />
                <span>{userInfo.email}</span>
              </Space>
              <Space>
                <PhoneOutlined style={{ color: '#E34D59' }} />
                <span>{userInfo.phone}</span>
              </Space>
            </Space>
          </Card>
        </Col>

        {/* 右侧 - 详细信息 */}
        <Col xs={24} md={16}>
          <Card
            title="基本信息"
            extra={
              editing ? (
                <Space>
                  <Button
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setEditing(false);
                      form.resetFields();
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                  >
                    保存
                  </Button>
                </Space>
              ) : (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setEditing(true)}
                >
                  编辑资料
                </Button>
              )
            }
          >
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                name: userInfo.name,
                email: userInfo.email,
                phone: userInfo.phone,
                department: userInfo.department,
                position: userInfo.position,
                location: userInfo.location,
                joinDate: dayjs(userInfo.joinDate),
              }}
              disabled={!editing}
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="email" label="邮箱">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="phone" label="手机号">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="department" label="部门">
                    <Select>
                      <Option value="审计监察部">审计监察部</Option>
                      <Option value="财务部">财务部</Option>
                      <Option value="技术部">技术部</Option>
                      <Option value="行政部">行政部</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="position" label="职位">
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="location" label="工作地点">
                    <Select>
                      <Option value="肇庆总部">肇庆总部</Option>
                      <Option value="阳江">阳江</Option>
                      <Option value="深圳">深圳</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="joinDate" label="入职日期">
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>

          {/* 账号安全 */}
          <Card title="账号安全" style={{ marginTop: 24 }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="登录密码">
                <Space>
                  <span>********</span>
                  <Button type="link" size="small">修改密码</Button>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="二次验证">
                <Tag color="orange">未开启</Tag>
                <Button type="link" size="small">立即开启</Button>
              </Descriptions.Item>
              <Descriptions.Item label="最近登录">
                <div>
                  <div>2026-06-05 08:30 - 肇庆总部 · 192.168.1.100</div>
                  <div>2026-06-04 17:45 - 肇庆总部 · 192.168.1.100</div>
                </div>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ProfilePage;
