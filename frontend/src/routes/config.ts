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
  { path: '/permissions/api', name: '内置API权限' },
  { path: '/service_provider', name: '应用', icon: 'PartitionOutlined' },
  { path: '/file_storage', name: '文件', icon: 'FolderOutlined' },
  { path: '/file_storage/buckets', name: 'Bucket 管理' },
  { path: '/file_storage/browser', name: '文件浏览器' },
  { path: '/business_data', name: '业务数据', icon: 'DatabaseOutlined' },
  { path: '/business_data/model-design', name: '数据模型', noContentPadding: true },
  { path: '/business_data/materialization/execute', name: '执行物化', noContentPadding: true },

  { path: '/business_data/metrics', name: '指标管理', noContentPadding: true },
  { path: '/business_data/metrics/dashboard', name: '指标看板', noContentPadding: true },
  { path: '/business_data/metrics/create', name: '新建指标', hideInMenu: true },
  { path: '/business_data/metrics/:id/edit', name: '编辑指标', hideInMenu: true },
  { path: '/business_data/data-standards', name: '数据标准', requiresFeature: 'metadataEnabled' },
  { path: '/business_data/metadata', name: '元数据', requiresFeature: 'metadataEnabled', noContentPadding: true },
  { path: '/business_data/database-connections', name: '数据库连接' },
  { path: '/business_data/database', name: '数据库预览', noContentPadding: true },


  { path: '/api_services', name: 'API', icon: 'ApiOutlined' },
  { path: '/api_services/create', name: '新建', hideInMenu: true },
  { path: '/api_services/list', name: 'API服务', noContentPadding: true },
  { path: '/api_services/collection-pipelines', name: '采集数据结构化', noContentPadding: true },
  { path: '/api_services/outbound-webhooks', name: '提交外部API' },
  { path: '/api_services/collection-pipelines/create', name: '新建采集管道', hideInMenu: true },
  { path: '/api_services/collection-pipelines/:id/edit', name: '编辑采集管道', hideInMenu: true },
  { path: '/api_services/collection-pipelines/:id/test', name: '测试采集管道', hideInMenu: true },
  { path: '/api_services/:id/edit', name: '编辑 API 服务', hideInMenu: true },
  { path: '/api_services/:id/test', name: '测试 API', hideInMenu: true },
  { path: '/ai_management', name: 'AI管理', icon: 'RobotOutlined' },
  { path: '/ai_management/providers', name: 'AI服务商' },
  { path: '/ai_management/models', name: 'AI模型' },
  { path: '/ai_management/scopes', name: 'Scopes', hideInMenu: true },
  { path: '/ai_management/tools', name: 'Tools' },
  { path: '/ai_management/skills', name: 'Skills' },
  { path: '/ai_management/request-logs', name: '请求日志' },
  { path: '/ai_management/chat-demo', name: 'AI Chat Demo' },
  { path: '/account/center', name: '个人中心', icon: 'UserOutlined', hideInMenu: true, hideMenu: true, layout: false },
  { path: '/system/settings', name: '系统设置', hideInMenu: true },
];

interface MenuAccessContext {
  /** 用户角色 id 列表 */
  roleIds?: string[];
  /** 用户角色 code 列表（含 SUPER_ADMIN 时拥有全部权限） */
  roleCodes?: string[];
  /** 用户所属组织 id */
  departmentId?: string | null;
  /** 是否超级管理员 */
  isSuperAdmin?: boolean;
}

interface MenuPermissionEntry {
  code: string;
  access_restriction?: { mode: 'none' | 'role' | 'department'; roleIds?: string[]; departmentIds?: string[] } | null;
}

/**
 * 按 access_restriction 判断当前用户是否可访问某菜单根（对应 MENU 权限 code）。
 * - 超级管理员：始终可见
 * - mode=none / 未配置：可见
 * - mode=role：用户角色命中允许角色
 * - mode=department：用户组织命中允许组织
 */
function isMenuAllowed(
  permissionCode: string,
  menuPermissions: MenuPermissionEntry[] | undefined,
  ctx: MenuAccessContext | undefined,
): boolean {
  if (ctx?.isSuperAdmin) return true;
  if (!menuPermissions || !menuPermissions.length) return true; // 无菜单权限配置 → 放行（兼容）
  const perm = menuPermissions.find((p) => p.code === permissionCode);
  if (!perm) return true; // 该菜单无对应权限记录 → 放行
  const r = perm.access_restriction;
  if (!r || r.mode === 'none') return true;
  if (r.mode === 'role') {
    const userRoleIds = ctx?.roleIds || [];
    return (r.roleIds || []).some((id) => userRoleIds.includes(id));
  }
  if (r.mode === 'department') {
    const deptId = ctx?.departmentId ? String(ctx.departmentId) : null;
    return Boolean(deptId) && (r.departmentIds || []).includes(deptId!);
  }
  return true;
}

export function buildMenuData(
  features?: API.SystemFeatures,
  menuPermissions?: MenuPermissionEntry[],
  accessCtx?: MenuAccessContext,
): MenuDataItem[] {
  const visibleRoutes = appRouteMeta.filter((item) => {
    if (!item.requiresFeature) return true;
    if (item.requiresFeature === 'metadataEnabled') return Boolean(features?.metadataEnabled);
    return true;
  });

  // 菜单根 path（如 /member_org）→ MENU 权限 code（member_org:manage）
  const rootToPermissionCode = (rootPath: string) => {
    const seg = rootPath.replace(/^\//, '');
    return `${seg}:manage`;
  };

  const roots = visibleRoutes.filter(
    (item) => item.path.split('/').filter(Boolean).length === 1 && item.name,
  );

  return roots
    .filter((root) => isMenuAllowed(rootToPermissionCode(root.path), menuPermissions, accessCtx))
    .map((root) => {
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
