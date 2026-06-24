import type { ReactNode } from 'react';
import {
  AuditOutlined,
  DatabaseOutlined,
  PartitionOutlined,
  RobotOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuDataItem } from '@ant-design/pro-components';
import { ProLayout } from '@ant-design/pro-components';
import { Suspense } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AvatarDropdown, Footer } from '@/components';
import defaultSettings from '../../config/defaultSettings';
import { buildMenuData, findRouteMeta } from '@/routes/config';
import { useInitialState } from '@/providers/InitialStateProvider';

const iconMap: Record<string, ReactNode> = {
  TeamOutlined: <TeamOutlined />,
  AuditOutlined: <AuditOutlined />,
  PartitionOutlined: <PartitionOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  RobotOutlined: <RobotOutlined />,
  UserOutlined: <UserOutlined />,
};

function decorateMenuIcons(items: MenuDataItem[]): MenuDataItem[] {
  return items.map((item) => ({
    ...item,
    icon: typeof item.icon === 'string' ? iconMap[item.icon] : item.icon,
    children: item.children ? decorateMenuIcons(item.children) : undefined,
  }));
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { initialState } = useInitialState();
  const routeMeta = findRouteMeta(location.pathname);
  const menuData = decorateMenuIcons(buildMenuData());

  return (
    <ProLayout
      {...defaultSettings}
      {...initialState?.settings}
      location={location}
      route={{ routes: menuData }}
      menuDataRender={() => menuData}
      menuItemRender={(item, dom) =>
        item.path ? <Link to={item.path}>{dom}</Link> : dom
      }
      actionsRender={() => (
        <div style={{ marginRight: 16, display: 'flex', alignItems: 'center' }}>
          <AvatarDropdown menu />
        </div>
      )}
      footerRender={() => <Footer />}
      menuRender={routeMeta?.hideMenu ? false : undefined}
      pure={routeMeta?.layout === false}
      contentStyle={routeMeta?.hideMenu ? { margin: 0 } : undefined}
      onMenuHeaderClick={() => navigate('/')}
    >
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </ProLayout>
  );
}
