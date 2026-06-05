import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Space, Badge, Popover, List, Tabs, Tag } from 'antd';
import {
  DashboardOutlined,
  AlertOutlined,
  AuditOutlined,
  FileDoneOutlined,
  BookOutlined,
  DatabaseOutlined,
  SearchOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import './MainLayout.less';

const { Header, Sider, Content } = Layout;

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
}

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // 模拟通知数据
  const notifications = [
    { id: 1, title: '费用异常预警', desc: '差旅费科目本月同比增长42%，触发MECE费用审计规则', time: '10分钟前', type: 'warning' as const, read: false },
    { id: 2, title: '合同到期提醒', desc: '供应商「深圳恒达建材」框架协议将于7天后到期', time: '30分钟前', type: 'info' as const, read: false },
    { id: 3, title: '审计任务分配', desc: 'Berry 将「2026年Q2采购审计」任务分配给你', time: '1小时前', type: 'info' as const, read: false },
    { id: 4, title: '整改工单超期', desc: '3个整改工单已超过截止日期，请及时处理', time: '2小时前', type: 'error' as const, read: false },
    { id: 5, title: '数据同步完成', desc: '金蝶ERP数据同步已完成，新增127条凭证记录', time: '3小时前', type: 'success' as const, read: false },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  // 菜单配置
  const menuItems: MenuItem[] = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '系统概览',
      path: '/dashboard',
    },
    {
      key: 'risk',
      icon: <AlertOutlined />,
      label: '风险预警中心',
      path: '/risk',
    },
    {
      key: 'audit',
      icon: <AuditOutlined />,
      label: '审计作业中心',
      path: '/audit',
    },
    {
      key: 'rectification',
      icon: <FileDoneOutlined />,
      label: '整改跟踪中心',
      path: '/rectification',
    },
    {
      key: 'knowledge',
      icon: <BookOutlined />,
      label: '知识管理中心',
      path: '/knowledge',
    },
    {
      key: 'data-quality',
      icon: <DatabaseOutlined />,
      label: '数据治理中心',
      path: '/data-quality',
    },
    {
      key: 'query',
      icon: <SearchOutlined />,
      label: '智能查询中心',
      path: '/query',
    },
  ];

  // 获取当前选中的菜单项
  const currentPath = location.pathname;
  const selectedKey = currentPath.split('/')[1] || 'dashboard';

  // 用户菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  const handleMenuClick = (item: MenuItem) => {
    navigate(item.path);
  };

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      navigate('/login');
    } else if (key === 'profile') {
      navigate('/profile');
    } else if (key === 'settings') {
      navigate('/settings');
    }
  };

  return (
    <Layout className="main-layout">
      {/* 侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        className="main-sider"
      >
        {/* Logo */}
        <div className="sider-logo">
          <div className="logo-icon">
            <AuditOutlined />
          </div>
          {!collapsed && (
            <div className="logo-text">
              <div className="logo-title">HOPO ICMS</div>
              <div className="logo-subtitle">智能审计系统</div>
            </div>
          )}
        </div>

        {/* 菜单 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          className="sider-menu"
          items={menuItems.map(item => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            onClick: () => handleMenuClick(item),
          }))}
        />
      </Sider>

      {/* 主区域 */}
      <Layout className="main-content-area">
        {/* 顶部导航 */}
        <Header className="main-header">
          <div className="header-left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="header-trigger"
            />
            <span className="header-title">HOPO 企业智能审计系统</span>
          </div>

          <div className="header-right">
            <Space size="middle">
              <Popover
                trigger="click"
                open={noticeOpen}
                onOpenChange={setNoticeOpen}
                placement="bottomRight"
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 280 }}>
                    <span>通知消息</span>
                    <Button type="link" size="small" onClick={() => setNoticeOpen(false)}>
                      查看全部
                    </Button>
                  </div>
                }
                content={
                  <List
                    size="small"
                    style={{ width: 340, maxHeight: 360, overflow: 'auto' }}
                    dataSource={notifications}
                    renderItem={(item) => (
                      <List.Item
                        style={{ cursor: 'pointer', background: item.read ? '#fff' : '#fafafa' }}
                        onClick={() => { setNoticeOpen(false); navigate('/risk'); }}
                      >
                        <List.Item.Meta
                          avatar={
                            <Tag color={
                              item.type === 'warning' ? 'orange' :
                              item.type === 'error' ? 'red' :
                              item.type === 'success' ? 'green' : 'blue'
                            } style={{ borderRadius: '50%', width: 28, height: 28, textAlign: 'center', lineHeight: '26px', padding: 0 }}>
                              {item.type === 'warning' ? '⚠' :
                               item.type === 'error' ? '✕' :
                               item.type === 'success' ? '✓' : 'i'}
                            </Tag>
                          }
                          title={item.title}
                          description={
                            <div>
                              <div style={{ color: '#666', fontSize: 12 }}>{item.desc}</div>
                              <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>{item.time}</div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                }
              >
                <Badge count={unreadCount} size="small">
                  <BellOutlined className="header-icon" />
                </Badge>
              </Popover>
              <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }}>
                <Space className="user-info">
                  <Avatar size="small" icon={<UserOutlined />} />
                  <span className="user-name">张三</span>
                </Space>
              </Dropdown>
            </Space>
          </div>
        </Header>

        {/* 内容区域 */}
        <Content className="main-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;