import { Card, Col, Row, Statistic, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { fetchDemoComplaintStats, fetchDemoOrderStats } from './demoApi';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [orderStats, setOrderStats] = useState<Record<string, unknown>>({});
  const [complaintStats, setComplaintStats] = useState<Record<string, unknown>>({});

  useEffect(() => {
    Promise.all([fetchDemoOrderStats(), fetchDemoComplaintStats()])
      .then(([orders, complaints]) => {
        setOrderStats(orders.dashboard || {});
        setComplaintStats(complaints.dashboard || {});
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Typography.Title level={3}>销售 Dashboard</Typography.Title>
      <Typography.Paragraph type="secondary">
        数据来自 SQLite 销售 Demo 库，右侧 AI 助手已绑定 sales-demo Scope 下的订单/售后 Skill。
      </Typography.Paragraph>
      <Row gutter={16}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="订单总数" value={Number(orderStats.total_orders || 0)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="待支付" value={Number(orderStats.pending_count || 0)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="已完成" value={Number(orderStats.completed_count || 0)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="待处理投诉" value={Number(complaintStats.open_count || 0)} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
