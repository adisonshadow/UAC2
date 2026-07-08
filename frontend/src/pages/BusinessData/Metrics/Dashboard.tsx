import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Col, Empty, Row, Spin, Statistic, message } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIChatPrompts, useAISurface } from '@EADAF/ai-base';
import { buildMetricDashboardPrompts } from '@/ai/pageChatPrompts';
import PageContainerTitleWithBack from '@/components/PageContainerTitleWithBack';
import { getBizdataMetricsDashboard } from '@/services/UAC/api/businessData';
import { getApiData, isApiSuccess } from '@/utils/apiResponse';

const MetricsDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<API.BizdataMetricDashboard | null>(null);

  const loadDashboard = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const response = await getBizdataMetricsDashboard({ refresh });
        if (!isApiSuccess(response)) {
          messageApi.error(response.message || '加载看板失败');
          return;
        }
        setDashboard(getApiData<API.BizdataMetricDashboard>(response) || { categories: [] });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  useAIChatPrompts(buildMetricDashboardPrompts());

  useAISurface({
    id: 'bizdata.metrics.dashboard',
    domain: 'bizdata',
    label: '指标看板',
    read: () => ({
      path: '/business_data/metrics/dashboard',
      categoryCount: dashboard?.categories?.length ?? 0,
    }),
    refresh: () => loadDashboard(false),
    matchMutation: (mutation) =>
      mutation.domain === 'bizdata'
      && (mutation.type === 'metric.dashboard_refreshed' || mutation.type === 'metric.executed'),
    applyMutation: async () => {
      await loadDashboard(false);
    },
  });

  const categories = dashboard?.categories || [];

  return (
    <PageContainer
      title={<PageContainerTitleWithBack title="指标看板" />}
      extra={[
        <Button key="refresh" loading={refreshing} onClick={() => loadDashboard(true)}>
          刷新数据
        </Button>,
        <Button key="manage" type="primary" onClick={() => navigate('/business_data/metrics')}>
          指标管理
        </Button>,
      ]}
    >
      {contextHolder}
      <Spin spinning={loading}>
        {categories.length === 0 ? (
          <Empty description="暂无指标，请先创建并执行" />
        ) : (
          categories.map((cat) => (
            <Card key={cat.name || 'default'} title={cat.name || '未分类'} style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                {(cat.metrics || []).map((metric) => (
                  <Col key={metric.id} xs={24} sm={12} md={8} lg={6}>
                    <Card size="small" hoverable>
                      <Statistic
                        title={metric.label}
                        value={metric.lastValue ?? '-'}
                        suffix={metric.unit}
                        precision={metric.lastValue != null && metric.lastValue % 1 !== 0 ? 2 : 0}
                      />
                      <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                        {metric.code}
                        {metric.lastComputedAt
                          ? ` · ${new Date(metric.lastComputedAt).toLocaleString()}`
                          : ''}
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          ))
        )}
      </Spin>
    </PageContainer>
  );
};

export default MetricsDashboardPage;
