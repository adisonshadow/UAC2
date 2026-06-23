// 运行时配置

// 全局初始化数据配置，用于 Layout 用户信息和权限初始化
// 更多信息见文档：https://umijs.org/docs/api/runtime-config#getinitialstate
import { getDepartments } from './services/UAC/api/departments';
import { getAuthCheck } from './services/UAC/api/auth';
import { AIChatProvider } from '@euac/ai-base';
import '@euac/ai-base/style.css';
import { ConfigProvider, theme } from 'antd';
import { Footer, AvatarDropdown } from '@/components';
import defaultSettings from '@/../config/defaultSettings';
import { requestInterceptors, responseInterceptors, errorConfig } from '@/utils/requestInterceptors';
import { clearAuth, getAuth, parseAuthUser } from '@/utils/auth';
import { API_BASE_URL } from '@/constants/env';

// 忽略 findDOMNode 警告
const originalError = console.error;
console.error = (...args) => {
  if (args[0]?.includes('is deprecated') || 
      args[0]?.includes('net::ERR_FILE_NOT_FOUND') ||
      args[0]?.includes('[antd: ConfigProvider]') ||
      args[0]?.includes('[antd: Tabs] `indicatorSize`') ||
      args[0]?.includes('Unchecked runtime.lastError: The message port closed before a response was received.')) {
    return;
  }
  originalError.call(console, ...args);
};

// 请求配置（开发环境走 proxy，生产环境使用 config/env.ts 中的 prodApiBaseUrl）
export const request = {
  timeout: 10000,
  ...(process.env.NODE_ENV !== 'development' && API_BASE_URL
    ? { baseURL: API_BASE_URL }
    : {}),
  errorConfig: {
    errorHandler: errorConfig.errorHandler,
    errorThrower: errorConfig.errorThrower,
  },
  requestInterceptors: [requestInterceptors],
  responseInterceptors: [responseInterceptors],
};

interface DepartmentTreeOption {
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

interface DepartmentsResult {
  departments: {
    department_id: string;
    name: string;
    code: string;
    parent_id: string | null;
    status: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
    description: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }[];
  departmentsTreeData: DepartmentTreeOption[];
}

export async function getInitialState() {
  const fetchUserInfo = async () => {
    try {
      const { token } = getAuth();
      if (!token) {
        return undefined;
      }

      const response = await getAuthCheck({}, { skipErrorHandler: true });
      const user = parseAuthUser(response);
      if (user) {
        return user;
      }

      throw new Error('获取用户信息失败');
    } catch (error: any) {
      if (error?.response?.status === 401) {
        clearAuth();
      }
      return undefined;
    }
  };

  const fetchDepartments = async (): Promise<DepartmentsResult | undefined> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return undefined;
      }

      const response = await getDepartments({});
      if (response.code === 200 && response.data?.items) {
        const departments = response.data.items.map((item:any) => ({
          department_id: item.department_id || '',
          name: item.name || '',
          code: item.code || '',
          parent_id: item.parent_id || null,
          status: (item.status as 'ACTIVE' | 'DISABLED' | 'ARCHIVED') || 'ACTIVE',
          description: item.description || '',
          created_at: item.created_at || '',
          updated_at: item.updated_at || '',
          deleted_at: item.deleted_at || null,
        }));

        // 构建树状结构
        const buildTree = (parentId: string | null): DepartmentTreeOption[] => {
          return departments
            .filter((dept: Department) => dept.parent_id === parentId)
            .map((dept: Department) => ({
              value: dept.department_id,
              label: dept.name,
              disabled: dept.status !== 'ACTIVE',
              children: buildTree(dept.department_id),
            }));
        };

        const departmentsTreeData = buildTree(null);
        return { departments, departmentsTreeData };
      }
      return undefined;
    } catch (error) {
      console.error('获取部门列表失败:', error);
      return undefined;
    }
  };

  // 先获取用户信息
  const currentUser = await fetchUserInfo();
  
  // 只有在用户登录成功后才获取部门信息
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

// 布局配置
export const layout = () => ({
  layout: 'side',
  title: 'UAC Admin',
  rightContentRender: () => <div style={{ marginRight: 16, display: 'flex', alignItems: 'center' }}><AvatarDropdown menu /></div>,
  footerRender: () => <Footer />,
  ...defaultSettings,
});

// 根容器配置
export function rootContainer(container: React.ReactNode) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AIChatProvider
        config={{
          apiBase: '/api',
          getToken: () => getAuth().token || null,
          headerOffset: 64,
          hiddenPaths: ['/auth/login', '/auth/reset-password', '/account/center'],
        }}
      >
        {container}
      </AIChatProvider>
    </ConfigProvider>
  );
}