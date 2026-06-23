import React, { useState, useEffect } from 'react';
import { Alert, Form, Input, Button, message, Card, Space, Typography, Tabs } from 'antd';
import { history } from '@umijs/max';
import { LeftOutlined } from '@ant-design/icons';
import api from '@/services/UAC/api';
import {
  postUsersRequestPasswordReset,
  postUsersResetPasswordWithToken,
} from '@/services/UAC/api/users';
import '../Auth/index.scss';

interface ApplicationInfo {
  application_id?: string;
  name?: string;
}

const checkPasswordStrength = (password: string): number => {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  return strength;
};

const ResetPassword: React.FC = () => {
  const [requestForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [requestLoading, setRequestLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('1');
  const [applicationInfo, setApplicationInfo] = useState<ApplicationInfo | null>(null);

  useEffect(() => {
    const fetchApplicationInfo = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const appId = urlParams.get('app');
      if (appId) {
        try {
          const response = await api.applications.getApplicationsId({ id: appId });
          if (response.code === 200 && response.data) {
            setApplicationInfo(response.data);
          }
        } catch {
          message.error('获取应用信息失败');
        }
      }
    };

    fetchApplicationInfo();
  }, []);

  const pageTitle = applicationInfo?.name || 'IAM';

  const handleRequestReset = async (values: { username: string; email: string }) => {
    try {
      setRequestLoading(true);
      const response = await postUsersRequestPasswordReset({
        username: values.username.trim(),
        email: values.email.trim(),
      });

      if (response.code === 200) {
        message.success('重置码已发送，请查收邮件');
        resetForm.setFieldsValue({ username: values.username.trim() });
        requestForm.resetFields();
        setActiveTab('2');
      } else {
        message.error(response.message || '获取重置码失败');
      }
    } catch (error: any) {
      message.error(error?.data?.message || error?.message || '获取重置码失败');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleResetPassword = async (values: {
    username: string;
    token: string;
    new_password: string;
    confirm_password: string;
  }) => {
    try {
      setResetLoading(true);
      const response = await postUsersResetPasswordWithToken({
        username: values.username.trim(),
        token: values.token.trim(),
        new_password: values.new_password,
      });

      if (response.code === 200) {
        message.success('密码重置成功，请使用新密码登录');
        resetForm.resetFields();
        const urlParams = new URLSearchParams(window.location.search);
        const appId = urlParams.get('app');
        history.push(`/auth/login${appId ? `?app=${appId}` : ''}`);
      } else {
        message.error(response.message || '重置密码失败');
      }
    } catch (error: any) {
      message.error(error?.data?.message || error?.message || '重置密码失败');
    } finally {
      setResetLoading(false);
    }
  };

  const items = [
    {
      key: '1',
      label: '1. 获取重置码',
      children: (
        <Form form={requestForm} layout="vertical" onFinish={handleRequestReset} size="large">
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title="未设置邮箱的用户无法重置密码，请联系管理员手工修改。"
          />
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 16, message: '用户名最多16个字符' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' },
            ]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入注册邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入与账户绑定的邮箱" />
          </Form.Item>
          <Form.Item className="mb-0">
            <Button type="primary" htmlType="submit" loading={requestLoading} block>
              发送重置码
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: '2',
      label: '2. 开始重置密码',
      children: (
        <Form form={resetForm} layout="vertical" onFinish={handleResetPassword} size="large">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="token"
            label="重置码"
            rules={[{ required: true, message: '请输入系统通过邮件发送的重置码' }]}
          >
            <Input placeholder="请输入重置码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码至少8个字符' },
              { max: 16, message: '密码最多16个字符' },
              {
                pattern: /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/,
                message: '密码只能包含字母、数字和特殊字符',
              },
              {
                validator: (_, value) => {
                  if (!value || checkPasswordStrength(value) >= 4) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('密码强度不足，请包含大小写字母、数字和特殊字符'));
                },
              },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请输入确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请输入确认新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={resetLoading} block>
              重置密码
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <img src="/images/bg.svg" alt="background" className="bg-image" />
        <div className="bg-text">
          <Typography.Title level={1} className="title">
            {pageTitle}
          </Typography.Title>
        </div>
      </div>

      <div className="auth-content">
        <Card className="auth-card" variant="borderless">
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            {/* <div className="auth-header">
              <img src="/images/logo.svg" alt="UAC" className="logo" />
              <div className="title">{pageTitle}</div>
              <div className="description">请先获取重置码再进行密码重置</div>
            </div> */}

            <Tabs style={{ marginTop: '20px' }} tabPlacement="end" activeKey={activeTab} onChange={setActiveTab} items={items} tabBarExtraContent={
              <Button 
                type="link"
                icon={<LeftOutlined />}
                onClick={() => {
                  const urlParams = new URLSearchParams(window.location.search);
                  const appId = urlParams.get('app');
                  history.push(`/auth/login${appId ? `?app=${appId}` : ''}`);
                }}>返回登录
              </Button>
            } />

          </Space>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
