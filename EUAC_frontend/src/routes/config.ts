import type { MenuDataItem } from '@ant-design/pro-components';

export interface AppRouteMeta {
  path: string;
  name?: string;
  icon?: string;
  hideInMenu?: boolean;
  hideMenu?: boolean;
  layout?: false;
  redirect?: string;
}

/** 应用菜单与路由元数据（由 config/routes.ts 迁移） */
export const appRouteMeta: AppRouteMeta[] = [
  { path: '/member_org', name: '成员与组织管理', icon: 'TeamOutlined' },
  { path: '/member_org/member', name: '成员管理' },
  { path: '/member_org/organization', name: '组织架构管理' },
  { path: '/member_org/role', name: '角色管理' },
  { path: '/permissions', name: '权限基础数据', icon: 'AuditOutlined' },
  { path: '/permissions/menu', name: '菜单权限' },
  { path: '/permissions/button', name: '按钮权限' },
  { path: '/permissions/api', name: 'API权限' },
  { path: '/service_provider', name: '三方应用管理', icon: 'PartitionOutlined' },
  { path: '/business_data', name: '业务数据', icon: 'DatabaseOutlined' },
  { path: '/business_data/model-design', name: '模型设计' },
  { path: '/business_data/materialization', name: '数据物化' },
  { path: '/ai_management', name: 'AI管理', icon: 'RobotOutlined' },
  { path: '/ai_management/providers', name: 'AI服务商' },
  { path: '/ai_management/models', name: 'AI模型' },
  { path: '/ai_management/chat-demo', name: 'AI Chat Demo' },
  { path: '/ai_management/scopes', name: 'Scopes' },
  { path: '/ai_management/tools', name: 'Tools' },
  { path: '/ai_management/skills', name: 'Skills' },
  { path: '/ai_management/request-logs', name: '请求日志' },
  { path: '/account/center', name: '个人中心', icon: 'UserOutlined', hideInMenu: true, hideMenu: true, layout: false },
];

export function buildMenuData(): MenuDataItem[] {
  const roots = appRouteMeta.filter(
    (item) => item.path.split('/').filter(Boolean).length === 1 && item.name,
  );

  return roots.map((root) => {
    const prefix = root.path;
    const children = appRouteMeta
      .filter(
        (item) =>
          item.path.startsWith(`${prefix}/`) &&
          item.path.split('/').filter(Boolean).length === 2 &&
          item.name,
      )
      .map((child) => ({
        path: child.path,
        name: child.name,
      }));

    return {
      path: prefix,
      name: root.name,
      icon: root.icon,
      children: children.length ? children : undefined,
    };
  });
}

export function findRouteMeta(pathname: string): AppRouteMeta | undefined {
  return appRouteMeta.find((item) => item.path === pathname);
}
