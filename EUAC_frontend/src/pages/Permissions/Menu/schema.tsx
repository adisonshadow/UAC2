import type { ProColumns } from '@ant-design/pro-components';
import type { MenuPermission } from "./types";
import type { MixedFieldType } from "@/types/schema";
import { actionEnum, actionMap } from "@/enums";

// 只包含 read 的操作权限枚举
const menuActionEnum = {
  read: actionEnum.read,
};

// 字段定义
export const fieldDefinitions: MixedFieldType[] = [
  {
    title: "权限ID",
    dataIndex: "permission_id",
    valueType: 'text',
    copyable: true,
    ifShowInTable: false,
    ifShowInDetail: true,
    ifShowInForm: false,
    width: 90,
  },
  {
    title: "权限编码(多级用:分隔)",
    dataIndex: "code",
    formItemProps: {
      rules: [
        { required: true, message: '请输入权限编码' },
        { min: 2, message: '权限编码至少2个字符' },
        { max: 50, message: '权限编码最多50个字符' },
        { pattern: /^[A-Za-z0-9:_]+$/, message: '权限编码只能包含大小写字母、数字、冒号和下划线' },
      ]
    },
    ifShowInTable: true,
    ifShowInDetail: true,
    ifShowInForm: true,
    width: 120,
  },
  {
    title: "描述",
    dataIndex: "description",
    valueType: 'textarea',
    ifShowInTable: true,
    ifShowInDetail: true,
    ifShowInForm: true,
    width: 200,
  },
  {
    title: "操作权限",
    dataIndex: "actions",
    valueType: 'checkbox',
    valueEnum: menuActionEnum,
    formItemProps: {
      rules: [
        { required: true, message: '请至少选择一个操作权限' },
      ],
    },
    initialValue: ['read'],
    ifShowInTable: true,
    ifShowInDetail: true,
    ifShowInForm: true,
    width: 120,
  },
  {
    title: "状态",
    dataIndex: "status",
    valueType: 'select',
    valueEnum: {
      ACTIVE: { text: '启用', status: 'Success' },
      DISABLED: { text: '禁用', status: 'Error' },
    },
    initialValue: 'ACTIVE',
    ifShowInTable: true,
    ifShowInDetail: true,
    ifShowInForm: true,
    width: 100,
  },
  {
    title: "创建时间",
    dataIndex: "created_at",
    valueType: 'dateTime',
    readonly: true,
    hideInSearch: true,
    ifShowInTable: false,
    ifShowInDetail: true,
    ifShowInForm: false,
    width: 180,
  },
  {
    title: "更新时间",
    dataIndex: "updated_at",
    valueType: 'dateTime',
    readonly: true,
    hideInSearch: true,
    ifShowInTable: false,
    ifShowInDetail: true,
    ifShowInForm: false,
    width: 180,
  },
  {
    title: "资源类型",
    dataIndex: "resource_type",
    valueType: 'text',
    initialValue: 'MENU',
    ifShowInForm: false,
    ifShowInTable: false,
    ifShowInDetail: false,
  },
];

// 表格列定义
export const tableColumns: ProColumns<MenuPermission>[] = [
  {
    title: "权限编码",
    dataIndex: "code",
    width: 120,
    search: false,
  },
  {
    title: "描述",
    dataIndex: "description",
    valueType: 'textarea',
    width: 200,
    search: false,
    render: (_:any, record: MenuPermission) => {
      if (record.permission_id.startsWith('virtual-')) {
        return '-';
      }
      return record.description;
    },
  },
  {
    title: "操作权限",
    dataIndex: "actions",
    width: 120,
    search: false,
    render: (_:any, record: MenuPermission) => {
      if (record.permission_id.startsWith('virtual-')) {
        return '-';
      }
      if (!record.actions || !Array.isArray(record.actions)) {
        return '-';
      }
      return record.actions.map(action => actionMap[action] || action).join('、');
    },
  },
  {
    title: "状态",
    dataIndex: "status",
    valueType: 'select',
    width: 100,
    search: false,
    render: (_:any, record: MenuPermission) => {
      if (record.permission_id.startsWith('virtual-')) {
        return '-';
      }
      const statusMap = {
        ACTIVE: { text: '启用', status: 'Success' },
        DISABLED: { text: '禁用', status: 'Error' },
      };
      return statusMap[record.status as keyof typeof statusMap]?.text || '-';
    },
  },
];

// 详情表单配置
export const detailFields = fieldDefinitions
  .filter(field => field.ifShowInDetail)
  .map(field => {
    const { width, ifShowInTable, ifShowInDetail, ifShowInForm, ...rest } = field;
    return rest;
  });

// 编辑表单配置
export const formFields = fieldDefinitions
  .filter(field => field.ifShowInForm)
  .map(field => {
    const { width, ifShowInTable, ifShowInDetail, ifShowInForm, ...rest } = field;
    return rest;
  });

export {}; 