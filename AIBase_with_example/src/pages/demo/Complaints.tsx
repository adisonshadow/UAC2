import { Card, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { fetchDemoComplaints, type DemoComplaint } from './demoApi';

const typeLabels: Record<string, string> = {
  quality: '质量',
  logistics: '物流',
  service: '服务',
  refund: '退款',
};

export default function ComplaintsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DemoComplaint[]>([]);

  useEffect(() => {
    fetchDemoComplaints()
      .then((res) => setData(res.items || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Typography.Title level={3}>订单投诉</Typography.Title>
      <Typography.Paragraph type="secondary">
        共 10 条演示投诉，可在右侧 Chat 使用「售后分析」Skill 查询或统计。
      </Typography.Paragraph>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          pagination={false}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 60 },
            { title: '订单号', dataIndex: 'order_no' },
            { title: '用户', dataIndex: 'user_name' },
            {
              title: '类型',
              dataIndex: 'type',
              render: (v: string) => typeLabels[v] || v,
            },
            { title: '内容', dataIndex: 'content', ellipsis: true },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v: string) => <Tag>{v}</Tag>,
            },
            { title: '创建时间', dataIndex: 'created_at' },
          ]}
        />
      </Card>
    </div>
  );
}
