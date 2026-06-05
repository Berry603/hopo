import React from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, AuditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './LoginPage.less';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      // TODO: 调用登录API
      message.success('登录成功！');
      navigate('/dashboard');
    } catch (error) {
      message.error('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <AuditOutlined style={{ fontSize: 48, color: '#E34D59' }} />
          </div>
          <Title level={3} style={{ marginTop: 16, color: '#E34D59' }}>HOPO ICMS</Title>
          <Text type="secondary">企业智能审计系统</Text>
        </div>

        <Form
          form={form}
          onFinish={handleLogin}
          size="large"
          layout="vertical"
          style={{ marginTop: 32 }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 44 }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          <Text type="secondary">© 2026 HOPO Intelligent Audit System</Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;