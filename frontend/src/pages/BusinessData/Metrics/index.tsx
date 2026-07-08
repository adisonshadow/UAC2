import {
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { ActionType, PageContainer, ProTable } from '@ant-design/pro-components';
import { Button, Card, Drawer, Modal, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useAIChatPrompts, useAISurface, useChatReference } from '@EADAF/ai-base';
import { buildMetricPrompts } from '@/ai/pageChatPrompts';
import { useNavigate } from 'react-router-dom';
import { TableActionButton, TableActions, TABLE_ACTION_COLUMN_BASE } from '@/components/TableActions';
import CodePathTreeTable from '../components/CodePathTreeTable';
import type { FlatCodePathRow } from '../utils/buildCodePathTree';
import { buildCodeScopeReference, buildMetricReference } from '@/ai/chatReferenceBuilders';
import {
  deleteBizdataMetric,
  getBizdataMetricRuns,
  getBizdataMetrics,
  postBizdataMetricExecute,
} from '@/services/UAC/api/businessData';
import { isApiSuccess, parseApiListResponse } from '@/utils/apiResponse';
import { metricRunColumns, metricTableColumns } from './schema';

const MetricsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [metrics, setMetrics] = useState<API.BizdataMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsOpen, setRunsOpen] = useState(false);
  const [runsMetric, setRunsMetric] = useState<API.BizdataMetric | null>(null);
  const runsActionRef = useRef<ActionType | undefined>(undefined);
  const { references } = useChatReference();
  const chatPrompts = useMemo(() => buildMetricPrompts(references), [references]);
  useAIChatPrompts(chatPrompts);

  useAISurface({
    id: 'bizdata.metrics.list',
    domain: 'bizdata',
    label: '指标列表',
    read: () => ({ path: '/business_data/metrics', count: metrics.length }),
    refresh: () => loadMetrics(),
    matchMutation: (mutation) =>
      mutation.domain === 'bizdata'
      && (mutation.type === 'metric.updated'
        || mutation.type === 'metric.deleted'
        || mutation.type === 'metric.executed'),
    applyMutation: async () => {
      await loadMetrics();
    },
  });

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getBizdataMetrics({ page: 1, size: 500 });
      const { items } = parseApiListResponse<API.BizdataMetric>(response);
      setMetrics(items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const handleExecute = async (record: API.BizdataMetric) => {
    if (!record.id) return;
    const response = await postBizdataMetricExecute(record.id);
    if (isApiSuccess(response)) {
      messageApi.success('执行成功');
      await loadMetrics();
    } else {
      messageApi.error(response.message || '执行失败');
    }
  };

  const handleDelete = (record: API.BizdataMetric) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除指标「${record.label}」吗？`,
      onOk: async () => {
        if (!record.id) return;
        const response = await deleteBizdataMetric(record.id);
        if (isApiSuccess(response)) {
          messageApi.success('已删除');
          await loadMetrics();
        } else {
          messageApi.error(response.message || '删除失败');
        }
      },
    });
  };

  const dataColumns = metricTableColumns.filter((col) => col.dataIndex !== 'code');
  const treeExtraColumns: ColumnsType<FlatCodePathRow<API.BizdataMetric>> = [
    ...dataColumns as ColumnsType<FlatCodePathRow<API.BizdataMetric>>,
    {
      ...TABLE_ACTION_COLUMN_BASE,
      width: 160,
      render: (_, item) => {
        if (!item) return null;
        return (
          <TableActions>
            <TableActionButton
              title="执行"
              icon={<PlayCircleOutlined />}
              onClick={() => handleExecute(item)}
            />
            <TableActionButton
              title="运行记录"
              icon={<UnorderedListOutlined />}
              onClick={() => {
                setRunsMetric(item);
                setRunsOpen(true);
                runsActionRef.current?.reload();
              }}
            />
            <TableActionButton
              title="编辑"
              icon={<EditOutlined />}
              onClick={() => navigate(`/business_data/metrics/${item.id}/edit`)}
            />
            <TableActionButton
              title="删除"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(item)}
            />
          </TableActions>
        );
      },
    },
  ];

  return (
    <PageContainer pageHeaderRender={() => <></>}>
      {contextHolder}
      <Card
        styles={{ body: { paddingTop: 0 } }}
        extra={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => navigate('/business_data/metrics/dashboard')}>
              指标看板
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/business_data/metrics/create')}
            >
              新建指标
            </Button>
          </div>
        }
      >
        <CodePathTreeTable<API.BizdataMetric>
          items={metrics}
          loading={loading}
          nameColumnTitle="Scope / 指标"
          scroll={{ x: 'max-content' }}
          getLeafReference={buildMetricReference}
          getScopeReference={buildCodeScopeReference}
          extraColumns={treeExtraColumns}
        />
      </Card>

      <Drawer
        title={`运行记录 - ${runsMetric?.label || ''}`}
        width={720}
        open={runsOpen}
        onClose={() => setRunsOpen(false)}
        destroyOnClose
      >
        <ProTable<API.BizdataMetricRun>
          actionRef={runsActionRef}
          rowKey="id"
          search={false}
          options={false}
          columns={metricRunColumns}
          request={async (params) => {
            if (!runsMetric?.id) return { data: [], total: 0, success: true };
            const response = await getBizdataMetricRuns(runsMetric.id, {
              page: params.current,
              size: params.pageSize,
            });
            const { items, total, success } = parseApiListResponse<API.BizdataMetricRun>(response);
            return { data: items, total, success };
          }}
          pagination={{ pageSize: 10 }}
        />
      </Drawer>
    </PageContainer>
  );
};

export default MetricsListPage;
