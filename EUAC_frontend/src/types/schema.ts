import type { ProFormColumnsType } from "@ant-design/pro-components";

// 自定义字段类型
export interface MixedFieldType extends Omit<ProFormColumnsType<any>, 'valueType'> {
  ifShowInTable?: boolean;
  ifShowInDetail?: boolean;
  ifShowInForm?: boolean;
  valueType?: ProFormColumnsType<any>['valueType'];
  copyable?: boolean;
}

// 基础字段配置类型
export interface BaseFieldConfig {
  title: string;
  width?: number;
  required?: boolean;
  valueType?: ProFormColumnsType<any>['valueType'];
  valueEnum?: Record<string, { text: string; status?: string }>;
}

// 基础字段配置对象类型
export type BaseFieldConfigMap = {
  [key: string]: BaseFieldConfig;
};

export {}; 