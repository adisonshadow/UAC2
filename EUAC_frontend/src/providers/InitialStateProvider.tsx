import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import defaultSettings from '../../config/defaultSettings';
import { getDepartments } from '@/services/UAC/api/departments';
import { getAuthCheck } from '@/services/UAC/api/auth';
import { clearAuth, getAuth, parseAuthUser, type CurrentUser } from '@/utils/auth';

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
  name: string;
  settings: typeof defaultSettings;
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

    const response = await getDepartments({});
    if (response.code === 200 && response.data?.items) {
      const departments = response.data.items.map((item: Record<string, unknown>) => ({
        department_id: String(item.department_id || ''),
        name: String(item.name || ''),
        code: String(item.code || ''),
        parent_id: (item.parent_id as string | null) ?? null,
        status: (item.status as Department['status']) || 'ACTIVE',
        description: String(item.description || ''),
        created_at: String(item.created_at || ''),
        updated_at: String(item.updated_at || ''),
        deleted_at: (item.deleted_at as string | null) ?? null,
      }));

      const buildTree = (parentId: string | null): DepartmentTreeOption[] =>
        departments
          .filter((dept) => dept.parent_id === parentId)
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

async function loadInitialState(): Promise<InitialState> {
  const currentUser = await fetchUserInfo();
  let departmentsResult;
  if (currentUser) {
    departmentsResult = await fetchDepartments();
  }

  return {
    fetchUserInfo,
    fetchDepartments,
    currentUser,
    departments: departmentsResult?.departments,
    departmentsTreeData: departmentsResult?.departmentsTreeData,
    departmentsLastUpdate: departmentsResult?.departments ? Date.now() : undefined,
    name: currentUser?.username || '未有效登录',
    settings: defaultSettings,
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
