import { Card, Table, Tag, Typography } from 'antd';
import { useChatReference } from '@euac/ai-base';
import { useEffect, useState } from 'react';
import ChatReferenceTarget from '@/components/ChatReferenceTarget';
import { fetchDemoOrders, type DemoOrder } from './demoApi';

const statusColor: Record<string, string> = {
  pending: 'default',
  paid: 'processing',
  shipped: 'blue',
  completed: 'success',
  cancelled: 'error',
};

export default function OrdersPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DemoOrder[]>([]);
  const { addReference } = useChatReference();

  useEffect(() => {
    fetchDemoOrders()
      .then((res) => setData(res.items || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Typography.Title level={3}>订单管理</Typography.Title>
      <Typography.Paragraph type="secondary">
        共 60 条演示订单，点击订单号或客户名可添加 Chat 引用，再在右侧 AI 助手中提问。
      </Typography.Paragraph>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: '订单号',
              dataIndex: 'order_no',
              render: (orderNo: string, row: DemoOrder) => (
                <>
                  {orderNo}
                  <ChatReferenceTarget
                    onClick={() =>
                      addReference({
                        type: 'order',
                        label: orderNo,
                        content: {
                          id: row.id,
                          order_no: row.order_no,
                          status: row.status,
                          total_amount: row.total_amount,
                        },
                        unique: true,
                      })
                    }
                  />
                </>
              ),
            },
            {
              title: '客户',
              dataIndex: 'user_name',
              render: (userName: string | undefined, row: DemoOrder) => (
                <>
                 {userName || '-'}
                  <ChatReferenceTarget
                    onClick={() =>
                      addReference({
                        type: 'customer',
                        label: userName || '未知客户',
                        content: { user_id: row.user_id, user_name: userName },
                        unique: true,
                      })
                    }
                  />
                </>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag>,
            },
            { title: '金额', dataIndex: 'total_amount', render: (v: number) => `¥${v}` },
            { title: '下单时间', dataIndex: 'created_at' },
          ]}
        />
      </Card>
    </div>
  );
}
