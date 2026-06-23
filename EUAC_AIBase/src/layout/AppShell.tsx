import { LogoutOutlined } from '@ant-design/icons';
import { Button, Layout, Menu, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearAuth } from '@/auth/auth';
import './AppShell.css';

const { Header, Content } = Layout;

const menuItems = [
  { key: '/demo/dashboard', label: 'Dashboard' },
  { key: '/demo/orders', label: '订单' },
  { key: '/demo/users', label: '用户' },
  { key: '/demo/products', label: '产品' },
  { key: '/demo/complaints', label: '投诉' },
];

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout className="aibase-shell">
      <Header
        className="aibase-shell-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#001529' }}
      >
        <Typography.Text style={{ color: '#fff', fontWeight: 600 }}>EUAC 销售管理系统 Demo</Typography.Text>
        <Button type="text" icon={<LogoutOutlined />} style={{ color: '#fff' }} onClick={() => {
          clearAuth();
          navigate('/auth/login');
        }}>
          退出
        </Button>
      </Header>
      <Layout className="aibase-shell-body">
        <Layout.Sider width={200} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Layout.Sider>
        <Content style={{ padding: 24, overflow: 'auto', minWidth: 0 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
