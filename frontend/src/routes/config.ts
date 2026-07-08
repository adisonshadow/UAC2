import type { MenuDataItem } from '@ant-design/pro-components';

export interface AppRouteMeta {
  path: string;
  name?: string;
  icon?: string;
  hideInMenu?: boolean;
  hideMenu?: boolean;
  layout?: false;
  /** 主内容区无内边距（用于全屏编辑类页面） */
  noContentPadding?: boolean;
  redirect?: string;
  /** 依赖系统功能开关，未开启时不展示菜单 */
  requiresFeature?: 'metadataEnabled';
}

function pathSegmentCount(path: string) {
  return path.split('/').filter(Boolean).length;
}

/** 判断是否为某一级菜单下的可展示子项（支持 materialization/execute 等三级路径） */
function isMenuChildOf(rootPath: string, item: AppRouteMeta, allItems: AppRouteMeta[]) {
  if (!item.name || item.hideInMenu) return false;
  if (!item.path.startsWith(`${rootPath}/`)) return false;

  const rootDepth = pathSegmentCount(rootPath);
  const itemDepth = pathSegmentCount(item.path);
  const depthDiff = itemDepth - rootDepth;

  if (depthDiff === 1) return true;

  if (depthDiff === 2) {
    const parentPath = item.path.split('/').slice(0, -1).join('/');
    const parentIsMenu = allItems.some(
      (candidate) => candidate.path === parentPath && candidate.name && !candidate.hideInMenu,
    );
    return !parentIsMenu;
  }

  return false;
}

/** 应用菜单与路由元数据（由 config/routes.ts 迁移） */
export const appRouteMeta: AppRouteMeta[] = [
  { path: '/member_org', name: '成员与组织', icon: 'TeamOutlined' },
  { path: '/member_org/member', name: '成员管理' },
  { path: '/member_org/organization', name: '组织架构管理' },
  { path: '/member_org/role', name: '角色管理' },
  { path: '/permissions', name: '权限', icon: 'AuditOutlined' },
  { path: '/permissions/menu', name: '菜单权限' },
  { path: '/permissions/button', name: '按钮权限' },
  { path: '/permissions/api', name: 'API权限' },
  { path: '/service_provider', name: '应用', icon: 'PartitionOutlined' },
  { path: '/file_storage', name: '文件', icon: 'FolderOutlined' },
  { path: '/file_storage/buckets', name: 'Bucket 管理' },
  { path: '/file_storage/browser', name: '文件浏览器' },
  { path: '/business_data', name: '业务数据', icon: 'DatabaseOutlined' },
  { path: '/business_data/model-design', name: '数据模型', noContentPadding: true },
  { path: '/business_data/materialization/execute', name: '执行物化' },
  
  { path: '/business_data/metrics', name: '指标管理' },
  { path: '/business_data/metrics/dashboard', name: '指标看板', noContentPadding: true },
  { path: '/business_data/metrics/create', name: '新建指标', hideInMenu: true },
  { path: '/business_data/metrics/:id/edit', name: '编辑指标', hideInMenu: true },
  { path: '/business_data/data-standards', name: '数据标准', requiresFeature: 'metadataEnabled' },
  { path: '/business_data/metadata', name: '元数据', requiresFeature: 'metadataEnabled' },
  { path: '/business_data/database', name: '数据库预览' },

  
  { path: '/api_services', name: 'API服务', icon: 'ApiOutlined' },
  { path: '/api_services/create', name: '新建' },
  { path: '/api_services/list', name: '服务列表' },
  { path: '/api_services/collection-pipelines', name: '采集数据结构化' },
  { path: '/api_services/collection-pipelines/create', name: '新建采集管道', hideInMenu: true },
  { path: '/api_services/collection-pipelines/:id/edit', name: '编辑采集管道', hideInMenu: true },
  { path: '/api_services/collection-pipelines/:id/test', name: '测试采集管道', hideInMenu: true },
  { path: '/api_services/:id/edit', name: '编辑 API 服务', hideInMenu: true },
  { path: '/api_services/:id/test', name: '测试 API', hideInMenu: true },
  { path: '/ai_management', name: 'AI管理', icon: 'RobotOutlined' },
  { path: '/ai_management/providers', name: 'AI服务商' },
  { path: '/ai_management/models', name: 'AI模型' },
  { path: '/ai_management/chat-demo', name: 'AI Chat Demo' },
  { path: '/ai_management/scopes', name: 'Scopes', hideInMenu: true },
  { path: '/ai_management/tools', name: 'Tools' },
  { path: '/ai_management/skills', name: 'Skills' },
  { path: '/ai_management/request-logs', name: '请求日志' },
  { path: '/account/center', name: '个人中心', icon: 'UserOutlined', hideInMenu: true, hideMenu: true, layout: false },
  { path: '/system/settings', name: '系统设置', hideInMenu: true },
];

export function buildMenuData(features?: API.SystemFeatures): MenuDataItem[] {
  const visibleRoutes = appRouteMeta.filter((item) => {
    if (!item.requiresFeature) return true;
    if (item.requiresFeature === 'metadataEnabled') return Boolean(features?.metadataEnabled);
    return true;
  });

  const roots = visibleRoutes.filter(
    (item) => item.path.split('/').filter(Boolean).length === 1 && item.name,
  );

  return roots.map((root) => {
    const prefix = root.path;
    const children = visibleRoutes
      .filter((item) => isMenuChildOf(prefix, item, visibleRoutes))
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
  const exact = appRouteMeta.find((item) => item.path === pathname);
  if (exact) return exact;
  // 最长前缀匹配（用于嵌套路由元数据）
  return [...appRouteMeta]
    .filter((item) => pathname.startsWith(`${item.path}/`) || pathname === item.path)
    .sort((a, b) => b.path.length - a.path.length)[0];
}
