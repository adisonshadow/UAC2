import { Badge } from 'antd';
import type { ProSchemaValueEnumType } from '@ant-design/pro-components';
import type { ReactNode } from 'react';

type BadgeStatus = 'success' | 'processing' | 'default' | 'error' | 'warning';

function normalizeBadgeStatus(status?: ProSchemaValueEnumType['status']): BadgeStatus {
  if (!status) return 'default';
  const normalized = String(status).toLowerCase();
  if (normalized === 'success') return 'success';
  if (normalized === 'processing') return 'processing';
  if (normalized === 'error') return 'error';
  if (normalized === 'warning') return 'warning';
  return 'default';
}

/** 根据 valueEnum 渲染 ant-badge-status */
export function renderStatusBadge(
  value: string | boolean | number | undefined | null,
  valueEnum: Record<string, ProSchemaValueEnumType>,
  fallback: ReactNode = '-',
) {
  if (value === undefined || value === null || value === '') return fallback;
  const item = valueEnum[String(value)];
  if (!item) return fallback;
  const text = typeof item.text === 'string' ? item.text : String(value);
  return <Badge status={normalizeBadgeStatus(item.status)} text={text} />;
}

/** ProTable 带 valueEnum 的列：虚拟行显示 fallback，其余保留 Pro 默认 Badge */
export function passthroughStatusCell(
  dom: ReactNode,
  isVirtual: boolean,
  fallback: ReactNode = '-',
) {
  return isVirtual ? fallback : dom;
}

/** 状态列通用 ProTable 配置片段 */
export function statusColumnProps(valueEnum: Record<string, ProSchemaValueEnumType>) {
  return {
    valueType: 'select' as const,
    valueEnum,
  };
}
