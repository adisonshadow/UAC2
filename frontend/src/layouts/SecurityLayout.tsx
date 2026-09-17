import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useInitialState } from '@/providers/InitialStateProvider';
import { Spin } from 'antd';
import { AUTH_PAGES, LOGIN_PATH, DEFAULT_REDIRECT } from '@/constants/auth';
import { checkAuth } from '@/utils/auth';

const ACCOUNT_CENTER_PATH = '/account/center';

const SecurityLayout: React.FC = () => {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();
  const { pathname, search } = location;
  const { initialState, setInitialState } = useInitialState();
  const setInitialStateRef = useRef(setInitialState);
  setInitialStateRef.current = setInitialState;
  /** 仅首次进入受保护树时全屏 Spin；之后路径变化不卸载 Outlet */
  const hasCompletedInitialCheckRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const checkAuthentication = async () => {
      const isFirstCheck = !hasCompletedInitialCheckRef.current;
      if (isFirstCheck) {
        setIsAuthChecking(true);
      }

      try {
        const isAuthPage = AUTH_PAGES.includes(pathname as (typeof AUTH_PAGES)[number]);
        const hasAppParam = new URLSearchParams(search).has('app');

        if (isAuthPage && hasAppParam) {
          if (!cancelled) {
            setIsAuthenticated(true);
            hasCompletedInitialCheckRef.current = true;
          }
          return;
        }

        const isValid = await checkAuth(setInitialStateRef.current);
        if (!cancelled) {
          setIsAuthenticated(isValid);
          hasCompletedInitialCheckRef.current = true;
        }
      } catch (error) {
        console.error('认证检查失败:', error);
        if (!cancelled) setIsAuthenticated(false);
      } finally {
        if (!cancelled) setIsAuthChecking(false);
      }
    };

    checkAuthentication();
    return () => {
      cancelled = true;
    };
    // 路径变化可后台重验，但不因 search（表格 query）重跑；setInitialState 用 ref
  }, [pathname]);

  if (isAuthChecking && !hasCompletedInitialCheckRef.current) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" description="正在检查认证状态..." />
      </div>
    );
  }

  if (!isAuthenticated && !AUTH_PAGES.includes(pathname as (typeof AUTH_PAGES)[number])) {
    const redirect = encodeURIComponent(`${pathname}${search}`);
    return <Navigate to={`${LOGIN_PATH}?redirect=${redirect}`} replace />;
  }

  if (isAuthenticated && AUTH_PAGES.includes(pathname as (typeof AUTH_PAGES)[number])) {
    return <Navigate to={DEFAULT_REDIRECT} replace />;
  }

  if (
    isAuthenticated &&
    initialState?.currentUser?.must_change_password &&
    pathname !== ACCOUNT_CENTER_PATH
  ) {
    return <Navigate to={ACCOUNT_CENTER_PATH} replace />;
  }

  return <Outlet />;
};

export default SecurityLayout;
