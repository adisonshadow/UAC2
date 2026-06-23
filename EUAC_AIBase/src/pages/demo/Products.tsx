import { Card, Table, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { fetchDemoProducts, type DemoProduct } from './demoApi';

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DemoProduct[]>([]);

  useEffect(() => {
    fetchDemoProducts()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Typography.Title level={3}>产品管理</Typography.Title>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: 'SKU', dataIndex: 'sku' },
            { title: '名称', dataIndex: 'name' },
            { title: '分类', dataIndex: 'category' },
            { title: '价格', dataIndex: 'price', render: (v: number) => `¥${v}` },
            { title: '库存', dataIndex: 'stock' },
          ]}
        />
      </Card>
    </div>
  );
}
