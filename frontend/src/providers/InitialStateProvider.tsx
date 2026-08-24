import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import defaultSettings from '../../config/defaultSettings';
import { getDepartments } from '@/services/UAC/api/departments';
import { getAuthCheck } from '@/services/UAC/api/auth';
import { getSystemFeatures } from '@/services/UAC/api/system';
import { getPermissions } from '@/services/UAC/api/permissions';
import { clearAuth, getAuth, parseAuthUser, type CurrentUser } from '@/utils/auth';
import { getApiData, isApiSuccess } from '@/utils/apiResponse';
import {
  applyDocumentBranding,
  fetchSystemBranding,
  resolveBrandingDisplay,
  type AppBranding,
} from '@/utils/appBranding';

export interface DepartmentTreeOption {
  value: string;
  label: string;
  children?: DepartmentTreeOption[];
  disabled?: boolean;
}

interface Department {
  department_id: string;
  name: string;
  code: string;
  parent_id: string | null;
  status: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
  description: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MenuPermissionItem {
  permission_id: string;
  code: string;
  access_restriction?: { mode: 'none' | 'role' | 'department'; roleIds?: string[]; departmentIds?: string[] } | null;
}

export interface InitialState {
  fetchUserInfo: () => Promise<CurrentUser | undefined>;
  fetchDepartments: () => Promise<
    | {
        departments: Department[];
        departmentsTreeData: DepartmentTreeOption[];
      }
    | undefined
  >;
  currentUser?: CurrentUser;
  departments?: Department[];
  departmentsTreeData?: DepartmentTreeOption[];
  departmentsLastUpdate?: number;
  /** 菜单权限（含 access_restriction），用于运行时过滤菜单可见性 */
  menuPermissions?: MenuPermissionItem[];
  name: string;
  settings: typeof defaultSettings;
  appBranding?: AppBranding;
  systemFeatures?: API.SystemFeatures;
}

interface InitialStateContextValue {
  initialState?: InitialState;
  setInitialState: (updater: InitialState | ((prev?: InitialState) => InitialState | undefined)) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const InitialStateContext = createContext<InitialStateContextValue | null>(null);

async function fetchUserInfo() {
  try {
    const { token } = getAuth();
    if (!token) return undefined;

    const response = await getAuthCheck({}, { skipErrorHandler: true });
    const user = parseAuthUser(response);
    if (user) return user;
    throw new Error('获取用户信息失败');
  } catch (error: unknown) {
    const err = error as { response?: { status?: number } };
    if (err?.response?.status === 401) {
      clearAuth();
    }
    return undefined;
  }
}

async function fetchDepartments() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    const response = await getDepartments({ size: -1 });
    if (!isApiSuccess(response)) return undefined;

    const payload = getApiData<{ items?: Record<string, unknown>[] }>(response);
    if (payload?.items) {
      const departments = payload.items.map((item: Record<string, unknown>) => ({
        department_id: String(item.department_id || ''),
        name: String(item.name || ''),
        code: String(item.code || ''),
        parent_id: item.parent_id ? String(item.parent_id) : null,
        status: (item.status as Department['status']) || 'ACTIVE',
        description: String(item.description || ''),
        created_at: String(item.created_at || ''),
        updated_at: String(item.updated_at || ''),
        deleted_at: (item.deleted_at as string | null) ?? null,
      }));

      const buildTree = (parentId: string | null): DepartmentTreeOption[] =>
        departments
          .filter((dept) => (dept.parent_id || null) === parentId)
          .map((dept) => ({
            value: dept.department_id,
            label: dept.name,
            disabled: dept.status !== 'ACTIVE',
            children: buildTree(dept.department_id),
          }));

      return { departments, departmentsTreeData: buildTree(null) };
    }
    return undefined;
  } catch (error) {
    console.error('获取部门列表失败:', error);
    return undefined;
  }
}

async function fetchMenuPermissions(): Promise<MenuPermissionItem[] | undefined> {
  try {
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    const res = await getPermissions({ page: 1, size: -1, resource_type: 'MENU', status: 'ACTIVE' });
    if (!isApiSuccess(res)) return undefined;
    const items = (res.data?.items || []) as unknown as MenuPermissionItem[];
    return items.filter((i) => i && i.code);
  } catch {
    return undefined;
  }
}

async function loadInitialState(): Promise<InitialState> {
  const [currentUser, appBranding, featuresRes] = await Promise.all([
    fetchUserInfo(),
    fetchSystemBranding(),
    getSystemFeatures().catch(() => null),
  ]);
  let departmentsResult;
  let menuPermissions: MenuPermissionItem[] | undefined;
  if (currentUser) {
    departmentsResult = await fetchDepartments();
    menuPermissions = await fetchMenuPermissions();
  }

  const brandingDisplay = resolveBrandingDisplay(appBranding);
  const systemFeatures = isApiSuccess(featuresRes)
    ? (getApiData<API.SystemFeatures>(featuresRes) ?? { metadataEnabled: false })
    : { metadataEnabled: false };

  return {
    fetchUserInfo,
    fetchDepartments,
    currentUser,
    departments: departmentsResult?.departments,
    departmentsTreeData: departmentsResult?.departmentsTreeData,
    departmentsLastUpdate: departmentsResult?.departments ? Date.now() : undefined,
    menuPermissions,
    name: currentUser?.username || '未有效登录',
    appBranding,
    systemFeatures,
    settings: {
      ...defaultSettings,
      title: brandingDisplay.name,
      logo: brandingDisplay.logo,
    },
  };
}

export function InitialStateProvider({ children }: { children: ReactNode }) {
  const [initialState, setInitialStateInner] = useState<InitialState | undefined>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadInitialState();
      setInitialStateInner(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (initialState?.settings) {
      applyDocumentBranding(resolveBrandingDisplay(initialState.appBranding));
    }
  }, [initialState?.appBranding, initialState?.settings?.logo, initialState?.settings?.title]);

  const setInitialState = useCallback(
    (updater: InitialState | ((prev?: InitialState) => InitialState | undefined)) => {
      setInitialStateInner((prev) =>
        typeof updater === 'function' ? updater(prev) : updater,
      );
    },
    [],
  );

  const value = useMemo(
    () => ({ initialState, setInitialState, loading, refresh }),
    [initialState, setInitialState, loading, refresh],
  );

  return <InitialStateContext.Provider value={value}>{children}</InitialStateContext.Provider>;
}

export function useInitialState() {
  const ctx = useContext(InitialStateContext);
  if (!ctx) {
    throw new Error('useInitialState must be used within InitialStateProvider');
  }
  return ctx;
}
