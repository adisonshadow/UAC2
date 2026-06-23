import { Alert, Button, Form, Input, Modal, message } from 'antd';
import React, { useState } from 'react';
import { useModel, request } from '@umijs/max';
import api from '@/services/UAC/api';
import { parseAuthUser } from '@/utils/auth';
import { getAuthCheck } from '@/services/UAC/api/auth';

interface FirstLoginSetupModalProps {
  open: boolean;
}

const FirstLoginSetupModal: React.FC<FirstLoginSetupModalProps> = ({ open }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { initialState, setInitialState } = useModel('@@initialState');

  const handleSubmit = async (values: {
    oldPassword: string;
    newPassword: string;
    confirmPassword: string;
    email?: string;
  }) => {
    const userId = initialState?.currentUser?.user_id;
    if (!userId) {
      message.error('用户信息不存在');
      return;
    }

    try {
      setLoading(true);

      const pwdRes = await request<{ code?: number; message?: string }>(
        `/api/v1/users/${userId}/change-password`,
        {
          method: 'POST',
          data: {
            old_password: values.oldPassword,
            new_password: values.newPassword,
          },
        },
      );

      if (pwdRes.code !== 200) {
        message.error(pwdRes.message || '密码修改失败');
        return;
      }

      const email = values.email?.trim();
      if (email) {
        const profileRes = await api.users.putUsersUserId(
          { user_id: userId },
          { email },
        );
        if (profileRes.code !== 200) {
          message.warning(profileRes.message || '密码已修改，但邮箱保存失败');
        }
      }

      const authRes = await getAuthCheck({});
      const currentUser = parseAuthUser(authRes);
      if (currentUser) {
        setInitialState((s: any) => ({ ...s, currentUser }));
      }

      message.success('密码已更新，欢迎使用系统');
      form.resetFields();
    } catch (error: any) {
      message.error(error?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="首次登录：请修改默认密码"
      open={open}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={null}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="为保障账户安全，首次登录必须修改默认密码。"
        description="建议同时设置邮箱，用于找回密码和接收系统通知（可选，可稍后在个人资料中补充）。"
      />

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="oldPassword"
          label="当前密码（默认密码）"
          rules={[{ required: true, message: '请输入当前密码' }]}
        >
          <Input.Password placeholder="请输入管理员提供的默认密码" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码至少 8 位' },
          ]}
        >
          <Input.Password placeholder="请设置新密码" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="确认新密码"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请确认新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password placeholder="请再次输入新密码" />
        </Form.Item>
        <Form.Item
          name="email"
          label="邮箱（推荐设置）"
          extra="设置邮箱可用于找回密码和接收通知，非必填。"
          rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
        >
          <Input placeholder="name@example.com（可选）" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            完成设置
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FirstLoginSetupModal;
