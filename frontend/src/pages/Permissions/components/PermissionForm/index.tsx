import React, { useEffect, useState } from 'react';
import { BetaSchemaForm } from '@ant-design/pro-components';
import type { ProFormColumnsType } from '@ant-design/pro-components';
import { Button } from 'antd';
import { PermissionFormProps, Permission, ActionType } from '../../types';
import { ACTION_LABELS } from '../../constants';

const PermissionForm: React.FC<PermissionFormProps> = ({
  allowedActions,
  initialValues,
  onFinish,
  loading,
  readonly,
  form,
}) => {
  const [selectedActions, setSelectedActions] = useState<ActionType[]>(initialValues?.actions || []);

  // 处理全选/取消全选
  const handleSelectAll = () => {
    if (selectedActions.length === allowedActions.length) {
      // 如果当前是全选状态，则取消全选
      setSelectedActions([]);
      form?.setFieldValue('actions', []);
    } else {
      // 否则全选
      setSelectedActions([...allowedActions]);
      form?.setFieldValue('actions', [...allowedActions]);
    }
  };

  const columns: ProFormColumnsType<Permission>[] = [
    {
      title: '权限编码',
      dataIndex: 'code',
      formItemProps: {
        rules: [
          { required: true, message: '请输入权限编码' },
          { min: 2, message: '权限编码至少2个字符' },
          { max: 50, message: '权限编码最多50个字符' },
          { pattern: /^[A-Za-z0-9:_]+$/, message: '权限编码只能包含大小写字母、数字、冒号和下划线' },
        ],
      },
      readonly: readonly,
    },
    {
      title: '描述',
      dataIndex: 'description',
      valueType: 'textarea',
      formItemProps: {
        rules: [
          { max: 200, message: '描述最多200个字符' },
        ],
      },
      readonly: readonly,
    },
    {
      title: '操作权限',
      dataIndex: 'actions',
      valueType: 'select',
      fieldProps: {
        mode: 'multiple',
        options: allowedActions.map(action => ({
          label: ACTION_LABELS[action],
          value: action,
        })),
        onChange: (values: ActionType[]) => {
          setSelectedActions(values);
        },
        value: selectedActions,
      },
      formItemProps: {
        rules: [
          { required: true, message: '请选择操作权限' },
        ],
        extra: !readonly && (
          <Button
            type="link"
            onClick={handleSelectAll}
            style={{ padding: 0, marginTop: 4 }}
          >
            {selectedActions.length === allowedActions.length ? '取消全选' : '全选'}
          </Button>
        ),
      },
      readonly: readonly,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {
        ACTIVE: { text: '启用', status: 'Success' },
        DISABLED: { text: '禁用', status: 'Error' },
      },
      initialValue: 'ACTIVE',
      formItemProps: {
        rules: [
          { required: true, message: '请选择状态' },
        ],
      },
      readonly: readonly,
    },
  ];

  // 当初始值变化时更新选中状态
  useEffect(() => {
    if (initialValues?.actions) {
      setSelectedActions(initialValues.actions);
    }
  }, [initialValues?.actions]);

  return (
    <BetaSchemaForm<Permission>
      columns={columns}
      onFinish={onFinish}
      submitter={{
        searchConfig: {
          submitText: '保存',
          resetText: '取消',
        },
        submitButtonProps: {
          loading: loading,
        },
      }}
      initialValues={initialValues}
      form={form}
    />
  );
};

export default PermissionForm; 