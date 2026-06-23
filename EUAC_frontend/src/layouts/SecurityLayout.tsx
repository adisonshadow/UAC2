import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useModel } from '@umijs/max';
import { Spin } from 'antd';
import { AUTH_PAGES, LOGIN_PATH, DEFAULT_REDIRECT } from '@/constants/auth';
import { checkAuth } from '@/utils/auth';

const ACCOUNT_CENTER_PATH = '/account/center';

const SecurityLayout: React.FC = () => {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();
  const { pathname, search } = location;
  const { initialState, setInitialState } = useModel('@@initialState');

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const isAuthPage = AUTH_PAGES.includes(pathname as (typeof AUTH_PAGES)[number]);
        const hasAppParam = new URLSearchParams(search).has('app');

        if (isAuthPage && hasAppParam) {
          setIsAuthenticated(true);
          setIsAuthChecking(false);
          return;
        }

        const isValid = await checkAuth(setInitialState);
        setIsAuthenticated(isValid);
      } catch (error) {
        console.error('认证检查失败:', error);
        setIsAuthenticated(false);
      } finally {
        setIsAuthChecking(false);
      }
    };

    checkAuthentication();
  }, [pathname, search, setInitialState]);

  if (isAuthChecking) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" tip="正在检查认证状态..." />
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
