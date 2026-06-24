import { LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { history } from '@/utils/navigation';
import { useInitialState } from '@/providers/InitialStateProvider';
import { Spin, Avatar } from 'antd';
import type { MenuInfo } from 'rc-menu/lib/interface';
import React, { useCallback } from 'react';
import { flushSync } from 'react-dom';
import HeaderDropdown from '../HeaderDropdown';
import api from '@/services/UAC/api';
import { getImageUrlIfValid } from '@/utils/image';

export type GlobalHeaderRightProps = {
  menu?: boolean;
  children?: React.ReactNode;
};

export const AvatarName = () => {
  const { initialState } = useInitialState();
  const { currentUser } = initialState || {};
  return <span className="anticon">{currentUser?.username}</span>;
};

export const AvatarDropdown: React.FC<GlobalHeaderRightProps> = ({ menu, children }) => {
  /**
   * 退出登录，并且将当前的 url 保存
   */
  const loginOut = async () => {
    try {
      const refresh_token = localStorage.getItem('refresh_token');
      if (refresh_token) {
        await api.auth.postAuthLogout({ refresh_token });
      }
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      // 清除本地存储的 token
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      // 跳转到登录页
      history.push('/auth/login');
    }
  };

  const { initialState, setInitialState } = useInitialState();

  const onMenuClick = useCallback(
    (event: MenuInfo) => {
      const { key } = event;
      if (key === 'logout') {
        flushSync(() => {
          setInitialState((s) => {
            if (!s) return s;
            return { ...s, currentUser: undefined };
          });
        });
        loginOut();
        return;
      }
      if (key === 'center') {
        history.push('/account/center');
        return;
      }
    },
    [setInitialState],
  );

  const loading = (
    <span>
      <Spin
        size="small"
        style={{
          marginLeft: 8,
          marginRight: 8,
          display: 'flex',
          height: '48px',
          overflow: 'hidden',
          alignItems: 'center',
          padding: '0 8px',
          cursor: 'pointer',
        }}
      />
    </span>
  );

  if (!initialState) {
    return loading;
  }

  const { currentUser } = initialState;

  if (!currentUser || !currentUser.username) {
    return loading;
  }

  const menuItems = [
    ...(menu
      ? [
          {
            key: 'center',
            icon: <UserOutlined />,
            label: '个人中心',
          },
          {
            key: 'settings',
            icon: <SettingOutlined />,
            label: '个人设置',
          },
          {
            type: 'divider' as const,
          },
        ]
      : []),
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
    },
  ];

  return (
    <HeaderDropdown
      menu={{
        selectedKeys: [],
        onClick: onMenuClick,
        items: menuItems,
      }}
    >
      <span className="anticon">
        {children || (
          <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Avatar
              src={getImageUrlIfValid(currentUser?.avatar)}
              icon={<UserOutlined />}
              style={{ marginRight: 8 }}
            />
            <span>{currentUser?.name || currentUser?.username}</span>
          </span>
        )}
      </span>
    </HeaderDropdown>
  );
};
