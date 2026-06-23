import type { ProColumns } from "@ant-design/pro-components";
import type { Role } from "./types";
import type { MixedFieldType } from "@/types/schema";

// 字段定义
export const fieldDefinitions: MixedFieldType[] = [
  {
    title: "角色ID",
    dataIndex: "role_id",
    valueType: 'text',
    copyable: true,
    ifShowInTable: false,
    ifShowInDetail: true,
    ifShowInForm: false,
    width: 90,
  },
  {
    title: "角色名称",
    dataIndex: "role_name",
    formItemProps: {
      rules: [
        { required: true, message: '请输入角色名称' },
        { min: 2, message: '角色名称至少2个字符' },
        { max: 50, message: '角色名称最多50个字符' },
      ]
    },
    ifShowInTable: true,
    ifShowInDetail: true,
    ifShowInForm: true,
    width: 220,
  },
  {
    title: "角色编码",
    dataIndex: "code",
    formItemProps: {
      rules: [
        { required: true, message: '请输入角色编码' },
        { min: 2, message: '角色编码至少2个字符' },
        { max: 50, message: '角色编码最多50个字符' },
        { pattern: /^[A-Za-z0-9:_]+$/, message: '角色编码只能包含大小写字母、数字、冒号和下划线' },
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
    title: "状态",
    dataIndex: "status",
    valueType: 'select',
    valueEnum: {
      ACTIVE: { text: '启用', status: 'Success' },
      ARCHIVED: { text: '禁用', status: 'Error' },
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
    title: "权限列表",
    dataIndex: "permissions",
    valueType: 'select',
    fieldProps: {
      showSearch: true,
      filterOption: (input: string, option: any) =>
        (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
    },
    ifShowInTable: false,
    ifShowInDetail: true,
    ifShowInForm: false,
    width: 300,
  },
];

// 表格列定义
export const tableColumns: ProColumns<Role>[] = [
  {
    title: "角色名称",
    dataIndex: "role_name",
    width: 220,
    search: false,
  },
  {
    title: "角色编码",
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
    render: (_, record: Role) => {
      if (record.role_id.startsWith('virtual-')) {
        return '-';
      }
      return record.description;
    },
  },
  {
    title: "状态",
    dataIndex: "status",
    valueType: 'select',
    width: 100,
    search: false,
    render: (_, record: Role) => {
      if (record.role_id.startsWith('virtual-')) {
        return '-';
      }
      const statusMap = {
        ACTIVE: { text: '启用', status: 'Success' },
        ARCHIVED: { text: '禁用', status: 'Error' },
      };
      return statusMap[record.status]?.text || '-';
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