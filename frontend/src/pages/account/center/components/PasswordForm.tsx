import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { useInitialState } from '@/providers/InitialStateProvider';
import { request } from '@/utils/request';

interface PasswordFormProps {
  onSuccess: () => void;
}

const PasswordForm: React.FC<PasswordFormProps> = ({ onSuccess }) => {
  const { initialState } = useInitialState();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (values: any) => {
    if (!initialState?.currentUser?.user_id) {
      message.error('用户信息不存在');
      return;
    }

    try {
      setLoading(true);
      const response = await request<{ code?: number; message?: string; data?: any }>(
        `/api/v1/users/${initialState.currentUser.user_id}/change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            old_password: values.oldPassword,
            new_password: values.newPassword,
          },
        }
      );

      if (response.code === 200) {
        message.success('密码修改成功');
        form.resetFields();
        onSuccess();
      } else {
        message.error(response.message || '密码修改失败');
      }
    } catch (error: any) {
      message.error(error.message || '密码修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleChangePassword}
      style={{ maxWidth: 400, margin: '0 auto' }}
    >
      <Form.Item
        name="oldPassword"
        label="当前密码"
        rules={[
          { required: true, message: '请输入当前密码' },
          { min: 6, message: '密码长度不能小于6位' },
        ]}
      >
        <Input.Password
          placeholder="请输入当前密码"
          visibilityToggle
        />
      </Form.Item>
      <Form.Item
        name="newPassword"
        label="新密码"
        rules={[
          { required: true, message: '请输入新密码' },
          { min: 6, message: '密码长度不能小于6位' },
        ]}
      >
        <Input.Password
          placeholder="请输入新密码"
          visibilityToggle
        />
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
        <Input.Password
          placeholder="请再次输入新密码"
          visibilityToggle
        />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          修改密码
        </Button>
      </Form.Item>
    </Form>
  );
};

export default PasswordForm; 