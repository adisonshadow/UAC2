import type { ProColumns, ProFormColumnsType } from '@ant-design/pro-components';

export const dataStandardTableColumns: ProColumns<API.BizdataDataStandard>[] = [
  { title: '标准名', dataIndex: 'name', width: 160, ellipsis: true },
  { title: '标准编码', dataIndex: 'code', width: 140, copyable: true, ellipsis: true },
  { title: '版本', dataIndex: 'version', width: 100 },
  {
    title: '状态',
    dataIndex: 'status',
    width: 90,
    valueEnum: {
      enabled: { text: '启用', status: 'Success' },
      disabled: { text: '停用', status: 'Default' },
    },
  },
  { title: '描述', dataIndex: 'description', ellipsis: true },
  { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime', width: 170 },
  { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime', width: 170 },
];

export const dataStandardFormColumns: ProFormColumnsType<API.BizdataDataStandard>[] = [
  {
    title: '标准名',
    dataIndex: 'name',
    formItemProps: { rules: [{ required: true, message: '请输入标准名' }] },
  },
  {
    title: '标准编码',
    dataIndex: 'code',
    formItemProps: { rules: [{ required: true, message: '请输入标准编码' }] },
  },
  {
    title: '版本',
    dataIndex: 'version',
    formItemProps: { rules: [{ required: true, message: '请输入版本' }] },
  },
  {
    title: '状态',
    dataIndex: 'status',
    valueType: 'radioButton',
    initialValue: 'enabled',
    valueEnum: {
      enabled: '启用',
      disabled: '停用',
    },
  },
  {
    title: '描述',
    dataIndex: 'description',
    valueType: 'textarea',
    colProps: { span: 24 },
  },
];
