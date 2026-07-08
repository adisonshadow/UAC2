import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import type { MixedFieldType } from '@/types/schema';

export function formatTableDateTime(value?: string | null): string {
  if (!value) return '-';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : String(value);
}

/** 是否发生过更新（updated_at 与 created_at 不同） */
export function hasRecordBeenUpdated(
  createdAt?: string | null,
  updatedAt?: string | null,
): boolean {
  if (!updatedAt) return false;
  if (!createdAt) return true;
  const created = dayjs(createdAt);
  const updated = dayjs(updatedAt);
  if (!created.isValid() || !updated.isValid()) {
    return updatedAt !== createdAt;
  }
  return !updated.isSame(created);
}

export function renderCreatedUpdatedAtCell(
  record: { created_at?: string | null; updated_at?: string | null },
): ReactNode {
  const updated = hasRecordBeenUpdated(record.created_at, record.updated_at);
  const value = updated ? record.updated_at : record.created_at;

  return (
    <span>
      {formatTableDateTime(value)}
    </span>
  );
}

export const createdUpdatedAtTableField: MixedFieldType = {
  title: '创建/更新',
  dataIndex: 'created_updated_at',
  hideInSearch: true,
  readonly: true,
  ifShowInTable: true,
  ifShowInDetail: false,
  ifShowInForm: false,
  width: 130,
};

export function attachCreatedUpdatedAtColumnRender(columns: Record<string, unknown>[]) {
  return columns.map((col) => {
    if (col.dataIndex === 'created_updated_at') {
      return {
        ...col,
        render: (_: unknown, record: { created_at?: string; updated_at?: string }) =>
          renderCreatedUpdatedAtCell(record),
      };
    }
    return col;
  });
}
