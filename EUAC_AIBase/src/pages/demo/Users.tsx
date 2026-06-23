import { Card, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { fetchDemoUsers, type DemoUser } from './demoApi';

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DemoUser[]>([]);

  useEffect(() => {
    fetchDemoUsers()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Typography.Title level={3}>用户管理</Typography.Title>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 60 },
            { title: '姓名', dataIndex: 'name' },
            { title: '手机', dataIndex: 'phone' },
            { title: '邮箱', dataIndex: 'email' },
            { title: '城市', dataIndex: 'city' },
            {
              title: '等级',
              dataIndex: 'level',
              render: (v: string) => <Tag color={v === 'vip' ? 'gold' : 'default'}>{v}</Tag>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
