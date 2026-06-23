import { Button, Form, Input, Modal, Table } from 'antd';
import React, { useState } from 'react';
import {
  deleteBusinessDataEnum,
  postBusinessDataEnum,
} from '@/services/UAC/api/businessData';

interface EnumManagerProps {
  enums: API.BusinessDataEnum[];
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const EnumManager: React.FC<EnumManagerProps> = ({ enums, open, onClose, onRefresh }) => {
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const values = await form.validateFields();
    setCreating(true);
    try {
      await postBusinessDataEnum({
        code: values.code,
        enumInfo: { label: values.label, code: values.code },
        values: values.values ? JSON.parse(values.values) : {},
        items: {},
      });
      form.resetFields();
      onRefresh();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBusinessDataEnum(id);
    onRefresh();
  };

  return (
    <Modal title="枚举管理" open={open} onCancel={onClose} footer={null} width={720}>
      <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="code" rules={[{ required: true }]}>
          <Input placeholder="枚举 code" />
        </Form.Item>
        <Form.Item name="label" rules={[{ required: true }]}>
          <Input placeholder="显示名" />
        </Form.Item>
        <Form.Item name="values">
          <Input placeholder='values JSON，如 {"A":"a"}' style={{ width: 200 }} />
        </Form.Item>
        <Button type="primary" loading={creating} onClick={handleCreate}>
          添加
        </Button>
      </Form>
      <Table
        size="small"
        rowKey="id"
        dataSource={enums}
        pagination={false}
        columns={[
          { title: 'Code', dataIndex: 'code' },
          { title: 'Label', render: (_, r) => r.enumInfo?.label },
          {
            title: '操作',
            render: (_, r) => (
              <Button type="link" danger size="small" onClick={() => handleDelete(r.id!)}>
                删除
              </Button>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default EnumManager;
