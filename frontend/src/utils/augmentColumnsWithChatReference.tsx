import type { ProColumns } from '@ant-design/pro-components';
import type { AddReferenceParams } from '@EADAF/ai-base';
import type { ReactNode } from 'react';
import ChatReferenceCell from '@/components/ChatReferenceCell';

function columnKey(dataIndex: ProColumns<unknown>['dataIndex']): string | undefined {
  if (!dataIndex) return undefined;
  return Array.isArray(dataIndex) ? dataIndex.join('.') : String(dataIndex);
}

/**
 * 为 ProTable 指定列追加「添加到 AI」引用按钮（保留原有 render）
 */
export function augmentColumnsWithChatReference<T>(
  columns: ProColumns<T>[],
  dataIndex: keyof T | string,
  buildReference: (record: T) => AddReferenceParams,
): ProColumns<T>[] {
  const targetKey = String(dataIndex);
  return columns.map((col) => {
    if (columnKey(col.dataIndex) !== targetKey) return col;
    const prevRender = col.render;
    return {
      ...col,
      render: (dom, record, index, action, schema) => {
        const content = prevRender
          ? prevRender(dom, record, index, action, schema)
          : dom ?? (record as Record<string, unknown>)[targetKey];
        return (
          <ChatReferenceCell label={content} reference={buildReference(record)} />
        );
      },
    };
  });
}

/**
 * 在自定义 render 结果旁追加引用按钮
 */
export function wrapWithChatReference<T>(
  content: ReactNode,
  record: T,
  buildReference: (record: T) => AddReferenceParams,
): ReactNode {
  return <ChatReferenceCell label={content} reference={buildReference(record)} />;
}
