import type { ProSchemaValueEnumType } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Tooltip } from 'antd';
import React from 'react';

export const hookStatusEnum: Record<string, ProSchemaValueEnumType> = {
  draft: { text: '草稿', status: 'Default' },
  enabled: { text: '已启用', status: 'Processing' },
  disabled: { text: '已禁用', status: 'Warning' },
  auto_disabled: { text: '自动停用', status: 'Error' },
};

export const hookActionTypeEnum: Record<string, ProSchemaValueEnumType> = {
  http_request: { text: '调用外部 API' },
  internal_api: { text: '调用内部 API' },
  script: { text: '执行脚本' },
};

export const hookRunStatusEnum: Record<string, ProSchemaValueEnumType> = {
  success: { text: '成功', status: 'Success' },
  failed: { text: '失败', status: 'Error' },
  timeout: { text: '超时', status: 'Error' },
  skipped: { text: '未匹配', status: 'Warning' },
  suppressed: { text: '已抑制', status: 'Warning' },
};

export const hookTriggerSourceEnum: Record<string, ProSchemaValueEnumType> = {
  event: { text: '事件' },
  schedule: { text: '定时' },
  test: { text: '测试' },
  replay: { text: '重放' },
};

export function renderHookRunStatus(status?: string | null) {
  if (!status) return '-';
  const item = hookRunStatusEnum[status];
  if (!item) return status;
  const icon =
    status === 'success' ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
      : status === 'skipped' || status === 'suppressed' ? <MinusCircleOutlined style={{ color: '#faad14' }} />
        : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
  return (
    <span>
      {icon} {item.text}
    </span>
  );
}

export function renderSuccessRate(stats7d?: API.HookListItem['stats7d']) {
  if (!stats7d || !stats7d.total) return <span style={{ color: '#999' }}>暂无运行</span>;
  const rate = stats7d.successRate ?? 0;
  const color = rate >= 90 ? '#52c41a' : rate >= 60 ? '#faad14' : '#ff4d4f';
  return (
    <Tooltip title={`近 7 天正式触发 ${stats7d.total} 次，成功 ${stats7d.success} 次`}>
      <span style={{ color }}>{rate}%（{stats7d.total}次）</span>
    </Tooltip>
  );
}

/** 事件类型的中文标签映射（由列表数据驱动，避免硬编码两份目录） */
export function hookEventLabel(eventType: string, catalog: API.HookEventType[]) {
  const found = catalog.find((e) => e.type === eventType);
  return found ? `${found.label}（${eventType}）` : eventType;
}

export function buildHookTableColumns(options: {
  catalog: API.HookEventType[];
  onEdit: (record: API.HookListItem) => void;
  onRuns: (record: API.HookListItem) => void;
  onToggle: (record: API.HookListItem) => void;
  onDelete: (record: API.HookListItem) => void;
}): ProColumns<API.HookListItem>[] {
  const { catalog, onEdit, onRuns, onToggle, onDelete } = options;
  return [
    { title: '名称', dataIndex: 'name', width: 180, ellipsis: true },
    {
      title: '触发事件',
      dataIndex: 'eventType',
      width: 220,
      ellipsis: true,
      render: (_, r) => hookEventLabel(r.eventType, catalog),
    },
    {
      title: '动作',
      dataIndex: 'actionType',
      width: 130,
      valueType: 'select',
      valueEnum: hookActionTypeEnum,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      valueType: 'select',
      valueEnum: hookStatusEnum,
      render: (_, record) => {
        if (record.status === 'auto_disabled') {
          return (
            <Tooltip title={`连续失败 ${record.consecutiveFailures} 次已被自动停用，请检查后重新启用`}>
              <span style={{ color: '#ff4d4f' }}>
                <WarningOutlined /> 自动停用
              </span>
            </Tooltip>
          );
        }
        const item = hookStatusEnum[record.status];
        return item ? `${item.text}` : record.status;
      },
    },
    {
      title: '最近运行',
      dataIndex: ['latestRun', 'status'],
      width: 110,
      render: (_, r) => renderHookRunStatus(r.latestRun?.status),
    },
    {
      title: '近 7 天成功率',
      dataIndex: 'stats7d',
      width: 140,
      render: (_, r) => renderSuccessRate(r.stats7d),
    },
  ];
}
