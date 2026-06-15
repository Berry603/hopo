import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Space, Badge, Popover, List, Tag } from 'antd';
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
import { useAuthStore } from '../store/authStore';
import './MainLayout.less';

const { Header, Sider, Content } = Layout;

// 面包屑路径配置
const breadcrumbMap: Record<string, { label: string }> = {
  'dashboard': { label: '系统概览' },
  'risk/alerts': { label: '预警事件' },
  'risk/rules': { label: '规则管理' },
  'risk/charts': { label: '风险看板' },
  'audit/projects': { label: '审计项目' },
  'audit/tasks': { label: '审计任务' },
  'audit/findings': { label: '审计发现' },
  'audit/reports': { label: '审计报告' },
  'rectification/orders': { label: '整改工单' },
  'rectification/verify': { label: '验证管理' },
  'rectification/stats': { label: '统计看板' },
  'knowledge/search': { label: '知识检索' },
  'knowledge/regulations': { label: '法规库' },
  'knowledge/cases': { label: '案例库' },
  'knowledge/templates': { label: '模板库' },
  'data-quality/dashboard': { label: '质量总览' },
  'data-quality/rules': { label: '质量规则' },
  'data-quality/sync': { label: '同步监控' },
  'data-quality/lineage': { label: '数据血缘' },
  'query/nl2sql': { label: 'NL2SQL查询' },
  'query/agent': { label: '审计Agent' },
  'audit/procedure': { label: '穿行测试' },
};

// 根据当前路径推导父级 group key
function getGroupKey(pathKey: string): string | null {
  const parts = pathKey.split('/');
  if (parts.length < 2) return null;
  return `${parts[0]}-group`;
}

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // 模拟通知数据
  const notifications = [
    { id: 1, title: '费用异常预警', desc: '差旅费科目本月同比增长42%，触发MECE费用审计规则', time: '10分钟前', type: 'warning' as const, read: false, link: '/risk/alerts' },
    { id: 2, title: '合同到期提醒', desc: '供应商「深圳恒达建材」框架协议将于7天后到期', time: '30分钟前', type: 'info' as const, read: false, link: '/audit/projects' },
    { id: 3, title: '审计任务分配', desc: 'Berry 将「2026年Q2采购审计」任务分配给你', time: '1小时前', type: 'info' as const, read: false, link: '/audit/tasks' },
    { id: 4, title: '整改工单超期', desc: '3个整改工单已超过截止日期，请及时处理', time: '2小时前', type: 'error' as const, read: false, link: '/rectification/orders' },
    { id: 5, title: '数据同步完成', desc: '金蝶ERP数据同步已完成，新增127条凭证记录', time: '3小时前', type: 'success' as const, read: false, link: '/data-quality/sync' },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  // 当前路径
  const currentPath = location.pathname;
  const pathSegments = currentPath.split('/').filter(Boolean);
  const selectedKey = pathSegments.join('/') || 'dashboard';

  // 当前父级 group
  const parentGroup = getGroupKey(selectedKey);
  const [openKeys, setOpenKeys] = useState<string[]>(parentGroup ? [parentGroup] : []);

  // 手风琴：只允许一个分组展开，且不允许全部收起
  const handleOpenChange = (keys: string[]) => {
    if (keys.length === 0) {
      // 不允许全部关闭 → 回到当前路由所在分组
      setOpenKeys(parentGroup ? [parentGroup] : []);
      return;
    }
    setOpenKeys(keys.slice(-1));
  };

  // 路由变化后：同步 openKeys
  useEffect(() => {
    setOpenKeys(parentGroup ? [parentGroup] : []);
  }, [selectedKey]);

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(`/${key}`);
  };

  // 菜单配置 - 全部带子菜单
  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '系统概览' },
    {
      key: 'risk-group',
      icon: <AlertOutlined />,
      label: '风险预警中心',
      children: [
        { key: 'risk/alerts', label: '预警事件' },
        { key: 'risk/rules', label: '规则管理' },
        { key: 'risk/charts', label: '风险看板' },
      ],
    },
    {
      key: 'audit-group',
      icon: <AuditOutlined />,
      label: '审计作业中心',
      children: [
        { key: 'audit/projects', label: '审计项目' },
        { key: 'audit/tasks', label: '审计任务' },
        { key: 'audit/findings', label: '审计发现' },
        { key: 'audit/reports', label: '审计报告' },
        { key: 'audit/procedure', label: '穿行测试' },
      ],
    },
    {
      key: 'rectification-group',
      icon: <FileDoneOutlined />,
      label: '整改跟踪中心',
      children: [
        { key: 'rectification/orders', label: '整改工单' },
        { key: 'rectification/verify', label: '验证管理' },
        { key: 'rectification/stats', label: '统计看板' },
      ],
    },
    {
      key: 'knowledge-group',
      icon: <BookOutlined />,
      label: '知识管理中心',
      children: [
        { key: 'knowledge/search', label: '知识检索' },
        { key: 'knowledge/regulations', label: '法规库' },
        { key: 'knowledge/cases', label: '案例库' },
        { key: 'knowledge/templates', label: '模板库' },
      ],
    },
    {
      key: 'data-quality-group',
      icon: <DatabaseOutlined />,
      label: '数据治理中心',
      children: [
        { key: 'data-quality/dashboard', label: '质量总览' },
        { key: 'data-quality/rules', label: '质量规则' },
        { key: 'data-quality/sync', label: '同步监控' },
        { key: 'data-quality/lineage', label: '数据血缘' },
      ],
    },
    {
      key: 'query-group',
      icon: <SearchOutlined />,
      label: '智能查询中心',
      children: [
        { key: 'query/nl2sql', label: 'NL2SQL查询' },
        { key: 'query/agent', label: '审计Agent' },
      ],
    },
  ];

  // 面包屑：取最后一个路径段
  const currentBreadcrumb = breadcrumbMap[selectedKey] || { label: pathSegments[pathSegments.length - 1] || '首页' };

  // 用户菜单
  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人信息' },
    { key: 'settings', icon: <SettingOutlined />, label: '系统设置' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      logout();
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
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#D7011D"/>
            <path d="M8 11h16v2H8zM8 15h12v2H8zM8 19h16v2H8z" fill="#fff"/>
          </svg>
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
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
          className="sider-menu"
          onClick={handleMenuClick}
          items={menuItems}
        />
      </Sider>

      {/* 主区域 */}
      <Layout className="main-content-area">
        {/* 顶部导航（面包屑式） */}
        <Header className="main-header">
          <div className="header-left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="header-trigger"
            />
            {/* 面包屑导航 */}
            <div className="breadcrumb-nav">
              <span className="brand-link" onClick={() => navigate('/')}>系统概览</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{currentBreadcrumb.label}</span>
            </div>
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
                    <Button type="link" size="small" onClick={() => { setNoticeOpen(false); navigate('/risk/alerts'); }}>
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
                        onClick={() => { setNoticeOpen(false); navigate((item as any).link || '/risk/alerts'); }}
                      >
                        <List.Item.Meta
                          avatar={
                            <Tag color={
                              item.type === 'warning' ? 'orange' :
                              item.type === 'error' ? 'red' :
                              item.type === 'success' ? 'green' : 'blue'
                            } style={{ borderRadius: '50%', width: 28, height: 28, textAlign: 'center', lineHeight: '26px', padding: 0 }}>
                              {item.type === 'warning' ? '!' :
                               item.type === 'error' ? '!' :
                               item.type === 'success' ? 'OK' : 'i'}
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
                  <Avatar size="small" src={user?.avatar} icon={!user?.avatar ? <UserOutlined /> : undefined}>
                    {user?.displayName?.charAt(0)?.toUpperCase()}
                  </Avatar>
                  <span className="user-name">{user?.displayName || user?.username || '用户'}</span>
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
