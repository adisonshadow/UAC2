import DepartmentPath from '@/components/DepartmentPath';
import UUIDDisplay from "@/components/UUIDDisplay";
import AvatarUpload from "@/components/AvatarUpload";
import { Image } from 'antd';
import { getImageUrlIfValid } from '@/utils/image';
import { useModel } from '@umijs/max';
import { statusEnum, genderEnum } from '@/enums';
import type { MixedFieldType } from "@/types/schema";

// 1、 所有字段定义
export const fieldDefinitions: MixedFieldType[] = [
  {
    title: "用户ID",
    dataIndex: "user_id",
    valueType: 'text',
    copyable: true,
    ifShowInTable: true,
    ifShowInDetail: true,
    ifShowInForm: false,
    width: 90,
  },
  {
    title: "用户名",
    dataIndex: "username",
    formItemProps: {
      rules: [
        { required: true, message: '请输入用户名' },
        { min: 3, message: '用户名至少3个字符' },
        { max: 16, message: '用户名最多16个字符' },
        { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' },
      ]
    },
    ifShowInTable: true,
    ifShowInDetail: true,
    ifShowInForm: true,
    width: 120,
  },
  {
    title: "姓名",
    dataIndex: "name",
    formItemProps: {
      rules: [{ required: true, message: '请输入姓名' }]
    },
    ifShowInTable: true,
    ifShowInDetail: true,
    ifShowInForm: true,
    width: 90,
  },
  {
    title: "所属部门",
    dataIndex: "department_id",
    valueType: 'cascader',
    formItemProps: {
      rules: [{ required: true, message: '请选择一个部门' }]
    },
    fieldProps: {
      changeOnSelect: false,
      expandTrigger: 'hover',
      showSearch: {
        filter: (inputValue: string, path: any[]) => {
          return path.some(option => 
            String(option.label).toLowerCase().indexOf(inputValue.toLowerCase()) > -1
          );
        },
      },
      options: [], // 这里先设置为空数组，实际值会在组件中动态设置
    },
    ifShowInTable: true,
    ifShowInDetail: true,
    ifShowInForm: true,
    width: 200,
  },
  {
    title: "头像",
    dataIndex: "avatar",
    valueType: 'text',
    fieldProps: {
      listType: 'picture-card',
      maxCount: 1,
    },
    ifShowInTable: false,
    ifShowInDetail: true,
    ifShowInForm: true,
  },
  {
    title: "性别",
    dataIndex: "gender",
    valueType: 'select',
    valueEnum: genderEnum,
    ifShowInTable: false,
    ifShowInDetail: true,
    ifShowInForm: true,
  },
  
  {
    title: "邮箱",
    dataIndex: "email",
    valueType: 'text',
    formItemProps: {
      rules: [
        // { required: true, message: '请输入邮箱' },
        { type: 'email', message: '请输入有效的邮箱地址' }
      ]
    },
    ifShowInTable: true,
    ifShowInDetail: true,
    ifShowInForm: true,
    width: 200,
  },
  {
    title: "电话",
    dataIndex: "phone",
    valueType: 'text',
    ifShowInTable: true,
    ifShowInDetail: true,
    ifShowInForm: true,
    width: 120,
  },
  {
    title: "状态",
    dataIndex: "status",
    valueType: 'select',
    valueEnum: statusEnum,
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
    ifShowInTable: true,
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
    ifShowInTable: true,
    ifShowInDetail: true,
    ifShowInForm: false,
    width: 180,
  },
];

// 创建一个自定义 hook 来获取部门数据
export const useDepartmentOptions = () => {
  const { initialState } = useModel('@@initialState');
  return initialState?.departmentsTreeData || [];
};

// 2、 从所有字段定义中，过滤出需要显示在表格中的字段
export const tableColumns = fieldDefinitions
  .filter(field => field.ifShowInTable)
  .map(field => {
    if (field.dataIndex === 'user_id') {
      return {
        ...field,
        width: field.width,
        render: (text: any, record: any) => {
          const user_id = record.user_id;
          if (!user_id || user_id === '') return null;
          return <UUIDDisplay uuid={String(user_id)} />;
        },
      };
    }
    if (field.dataIndex === 'department_id') {
      return {
        ...field,
        width: field.width,
        render: (text: any, record: any) => {
          const department_id = record.department_id;
          if (!department_id || department_id === '') return null;
          return <DepartmentPath departmentId={String(department_id)} />;
        },
      };
    }
    if (['user_id', 'username', 'name', 'email', 'phone'].includes(field.dataIndex as string)) {
      return {
        ...field,
        width: field.width,
        filters: false,
        onFilter: true,
        filterMode: 'menu',
        filterSearch: true,
      };
    }
    if (['status', 'gender', 'department_id'].includes(field.dataIndex as string)) {
      return {
        ...field,
        width: field.width,
        filters: true,
        onFilter: true,
        filterMode: 'menu',
        filterSearch: true,
      };
    }
    return {
      ...field,
      width: field.width,
    };
  });

// 3、 从所有字段定义中，过滤出需要显示在详情表单中的字段
export const userDetailFormColumns = fieldDefinitions
  .filter(field => field.ifShowInDetail)
  .map(field => {
    const { width, ...rest } = field;
    if (field.dataIndex === 'avatar') {
      return {
        ...rest,
        render: (dom: any) => {
          if (!dom) return null;
          const imageUrl = getImageUrlIfValid(String(dom));
          if (!imageUrl) return null;
          return (
            <Image
              src={imageUrl}
              alt="用户头像"
              width={64}
              height={64}
              style={{ objectFit: 'cover', borderRadius: '50%' }}
              preview={{
                mask: '预览',
                maskClassName: 'custom-image-mask',
              }}
            />
          );
        },
      };
    }
    if (field.dataIndex === 'department_id') {
      return {
        ...rest,
        render: (text: any, record: any) => {
          if (text.length === 0) return null;
          const department_id = text[text.length - 1];
          if (!department_id || department_id === '') return null;
          return <DepartmentPath isOnlyShowTail={false} departmentId={String(department_id)} />;
        },
      };
    }
    return {
      ...rest,
    };
  });

// 用户编辑表单配置
export const userEditFormColumns = fieldDefinitions
  .filter(field => field.ifShowInForm)
  .map(field => {
    const { width, ...rest } = field;
    if (field.dataIndex === 'avatar') {
      return {
        ...rest,
        renderFormItem: () => <AvatarUpload />,
      };
    }
    return {
      ...rest,
    };
  });
