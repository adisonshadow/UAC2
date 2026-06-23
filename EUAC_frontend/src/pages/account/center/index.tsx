import React, { useState } from 'react';
import { Space, Tabs, Button } from 'antd';
import Lottie from 'react-lottie-player';
import ProfileForm from './components/ProfileForm';
import PasswordForm from './components/PasswordForm';
import FirstLoginSetupModal from './components/FirstLoginSetupModal';
import styles from './index.scss';
import { LeftOutlined, LogoutOutlined } from '@ant-design/icons';
import api from '@/services/UAC/api';
import { history, useModel } from '@umijs/max';

const AccountCenter: React.FC = () => {
  const { initialState, refresh } = useModel('@@initialState');
  const [activeTab, setActiveTab] = useState('profile');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      refresh();
    }, 2000);
  };

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
      const urlParams = new URL(window.location.href).searchParams;
      const app_id = urlParams.get('app');
      if (app_id) {
        history.push(`/auth/login?app=${app_id}`);
      } else {
        history.push('/auth/login');
      }
    }
  };

  if (!initialState?.currentUser) {
    return null;
  }

  const mustChangePassword = !!initialState.currentUser.must_change_password;

  return (
    <div className={styles.container}>
      <FirstLoginSetupModal open={mustChangePassword} />
      <div className='d-flex justify-content-between align-items-center'>
        <Button type='link' onClick={() => {
          history.back();
        }}>
          <LeftOutlined /> 返回
        </Button>

        <img src="/images/logo.svg" alt="UAC" className={styles.logo} />
        
        <Button type='link' onClick={() => {
          loginOut();
        }}>
          <LogoutOutlined /> 退出
        </Button>
      </div>
      <div className='mt-4'>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: 'profile',
              label: '修改资料',
              children: <ProfileForm onSuccess={handleSuccess} />,
            },
            {
              key: 'password',
              label: '修改密码',
              children: <PasswordForm onSuccess={handleSuccess} />,
            },
          ]}
        />
      </div>
      {showSuccess && (
        <div className={styles.successAnimation}>
          <Lottie
            animationData={require('/public/lotties/good-job.json')}
            loop={false}
            play
            style={{ width: 200, height: 200 }}
          />
        </div>
      )}
    </div>
  );
};

export default AccountCenter; 