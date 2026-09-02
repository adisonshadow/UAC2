import type { ReactNode } from 'react';
import {
  ApiOutlined,
  AuditOutlined,
  DatabaseOutlined,
  FolderOutlined,
  PartitionOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuDataItem } from '@ant-design/pro-components';
import { ProLayout } from '@ant-design/pro-components';
import { Suspense } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AnimatedOutlet from '@/components/AnimatedOutlet';
import { AvatarDropdown, Footer } from '@/components';
import defaultSettings from '../../config/defaultSettings';
import { buildMenuData, findRouteMeta } from '@/routes/config';
import { useInitialState } from '@/providers/InitialStateProvider';

const iconMap: Record<string, ReactNode> = {
  TeamOutlined: <TeamOutlined />,
  AuditOutlined: <AuditOutlined />,
  PartitionOutlined: <PartitionOutlined />,
  FolderOutlined: <FolderOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  ApiOutlined: <ApiOutlined />,
  RobotOutlined: <RobotOutlined />,
  SettingOutlined: <SettingOutlined />,
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
  const currentUser = initialState?.currentUser;
  const metadataEnabled = Boolean(initialState?.systemFeatures?.metadataEnabled);
  const menuData = decorateMenuIcons(
    buildMenuData(
      initialState?.systemFeatures,
      initialState?.menuPermissions as Parameters<typeof buildMenuData>[1],
      {
        roleIds: currentUser?.role_ids,
        roleCodes: currentUser?.role_codes,
        departmentId: currentUser?.department_id,
        isSuperAdmin: currentUser?.role_codes?.includes('SUPER_ADMIN'),
      },
    ),
  );

  return (
    <ProLayout
      {...defaultSettings}
      {...initialState?.settings}
      location={location}
      route={{ routes: menuData }}
      menu={{
        ...defaultSettings.menu,
        ...initialState?.settings?.menu,
        params: { metadataEnabled },
      }}
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
      contentStyle={
        routeMeta?.hideMenu || routeMeta?.noContentPadding
          ? {
              ...(routeMeta?.hideMenu ? { margin: 0 } : {}),
              ...(routeMeta?.noContentPadding ? { padding: 0 } : {}),
            }
          : undefined
      }
      onMenuHeaderClick={() => navigate('/')}
    >
      <Suspense fallback={null}>
        <AnimatedOutlet />
      </Suspense>
    </ProLayout>
  );
}
