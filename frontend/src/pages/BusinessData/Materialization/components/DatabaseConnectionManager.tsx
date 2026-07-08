import { DeleteOutlined, EditOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tooltip,
  message,
} from 'antd';
import React, { useState } from 'react';
import { TableActionButton, TableActions, TABLE_ACTION_COLUMN_BASE } from '@/components/TableActions';
import {
  deleteDatabaseConnection,
  postDatabaseConnection,
  putDatabaseConnection,
  testDatabaseConnection,
} from '@/services/UAC/api/businessData';
import { getApiErrorMessage, isApiSuccess } from '@/utils/apiResponse';
import { dbConnectionTestStatusEnum, dbConnectionUntestedEnum } from '@/enums';
import { renderStatusBadge } from '@/utils/statusBadge';

const DB_TYPE_OPTIONS = [
  { label: 'PostgreSQL', value: 'postgresql' },
  { label: 'MongoDB', value: 'mongodb' },
  { label: 'Redis', value: 'redis' },
];

const DEFAULT_PORTS: Record<string, number> = {
  postgresql: 5432,
  mongodb: 27017,
  redis: 6379,
};

interface DatabaseConnectionManagerProps {
  connections: API.DatabaseConnection[];
  loading?: boolean;
  onRefresh: () => void;
}

const DatabaseConnectionManager: React.FC<DatabaseConnectionManagerProps> = ({
  connections,
  loading,
  onRefresh,
}) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<API.DatabaseConnection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string>();
  const [form] = Form.useForm();

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ dbType: 'postgresql', port: 5432, targetSchema: 'bizdata_mat' });
    setOpen(true);
  };

  const openEdit = (record: API.DatabaseConnection) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      dbType: record.dbType,
      host: record.host,
      port: record.port,
      username: record.username,
      databaseName: record.databaseName,
      targetSchema: record.targetSchema,
      isDefault: record.isDefault,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const body = {
        name: values.name,
        dbType: values.dbType,
        host: values.host,
        port: values.port,
        username: values.username,
        password: values.password,
        databaseName: values.databaseName,
        targetSchema: values.targetSchema,
        isDefault: values.isDefault,
      };
      const res = editing
        ? await putDatabaseConnection(editing.id!, body)
        : await postDatabaseConnection(body);
      if (isApiSuccess(res)) {
        message.success(editing ? '连接已更新' : '连接已创建');
        setOpen(false);
        onRefresh();
      } else {
        message.error(getApiErrorMessage(res, '保存失败'));
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const res = await testDatabaseConnection(id);
      if (isApiSuccess(res)) {
        message.success('连接测试成功');
        onRefresh();
      } else {
        message.error(getApiErrorMessage(res, '连接测试失败'));
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, '连接测试失败'));
    } finally {
      setTestingId(undefined);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteDatabaseConnection(id);
      if (isApiSuccess(res)) {
        message.success('已删除');
        onRefresh();
      } else {
        message.error(getApiErrorMessage(res, '删除失败'));
      }
    } catch (error) {
      message.error(getApiErrorMessage(error, '删除失败'));
    }
  };

  const columns: ProColumns<API.DatabaseConnection>[] = [
    { title: '名称', dataIndex: 'name', ellipsis: true },
    {
      title: '类型',
      dataIndex: 'dbType',
      width: 110,
      render: (_, r) => {
        const opt = DB_TYPE_OPTIONS.find((o) => o.value === r.dbType);
        return opt?.label || r.dbType;
      },
    },
    { title: 'Host', dataIndex: 'host', width: 120, ellipsis: true },
    { title: '库/DB', dataIndex: 'databaseName', width: 100, ellipsis: true },
    { title: 'Schema/前缀', dataIndex: 'targetSchema', width: 110 },
    {
      title: '状态',
      width: 90,
      render: (_, r) =>
        r.lastTestStatus
          ? renderStatusBadge(r.lastTestStatus, dbConnectionTestStatusEnum)
          : renderStatusBadge('pending', dbConnectionUntestedEnum),
    },
    {
      ...TABLE_ACTION_COLUMN_BASE,
      width: 120,
      render: (_, record) => (
        <TableActions>
          <TableActionButton
            title="测试连接"
            icon={<ThunderboltOutlined />}
            loading={testingId === record.id}
            onClick={() => handleTest(record.id!)}
          />
          <TableActionButton
            title="编辑"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          />
          {!record.isDefault && (
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id!)}>
              <Tooltip title="删除">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </TableActions>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建连接
        </Button>
      </Space>
      <ProTable<API.DatabaseConnection>
        size="small"
        rowKey="id"
        loading={loading}
        scroll={{ x: 'max-content' }}
        columns={columns}
        dataSource={connections}
        search={false}
        options={false}
        pagination={false}
      />
      <Modal
        title={editing ? '编辑数据库连接' : '新建数据库连接'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="连接名称" rules={[{ required: true }]}>
            <Input placeholder="如：生产 PostgreSQL" />
          </Form.Item>
          <Form.Item name="dbType" label="数据库类型" rules={[{ required: true }]}>
            <Select
              options={DB_TYPE_OPTIONS}
              onChange={(v) => form.setFieldValue('port', DEFAULT_PORTS[v] || 5432)}
            />
          </Form.Item>
          <Form.Item name="host" label="Host" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="port" label="Port" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? '密码（留空则不修改）' : '密码'}
            rules={editing ? [] : [{ required: true }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="databaseName"
            label="数据库名 / Redis DB 索引"
            rules={[{ required: true }]}
            extra="Redis 填 0-15 的数字索引"
          >
            <Input />
          </Form.Item>
          <Form.Item name="targetSchema" label="Schema / Key 前缀" rules={[{ required: true }]}>
            <Input placeholder="PostgreSQL: schema；MongoDB: 库名；Redis: key 前缀" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default DatabaseConnectionManager;
