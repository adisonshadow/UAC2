import { Typography } from 'antd';
import React from 'react';

const { Paragraph, Text, Title } = Typography;

const preStyle: React.CSSProperties = {
  margin: '0 0 12px',
  padding: 12,
  background: 'var(--ant-color-fill-quaternary, #f5f5f5)',
  borderRadius: 6,
  fontSize: 12,
  lineHeight: 1.5,
  overflow: 'auto',
  whiteSpace: 'pre',
};

/**
 * TypeScript Handler「服务脚本」帮助 Modal 正文（含 SDK 示例）。
 */
export const HandlerSdkHelpModalContent: React.FC = () => (
  <div>
    <Title level={5} style={{ marginTop: 0 }}>写法</Title>
    <Paragraph>
      编辑器展示完整 <Text code>export async function handler</Text> 壳层，灰色区域只读；
      <strong>仅函数体内可编辑</strong>。存库时自动剥离壳层，运行时注入 <Text code>params</Text> 与 <Text code>db</Text>。
    </Paragraph>

    <Title level={5}>params 安全边界</Title>
    <Paragraph>
      网关已按「请求参数结构」校验并只读注入 <Text code>params</Text>。
      经 <Text code>db().where / paginate / insert</Text> 使用时，值会参数化绑定，防 SQL 注入。
      SDK <strong>不会</strong>自动把 params 转成 where；<strong>禁止</strong>把 params 拼进字符串或使用 queryPg。
    </Paragraph>

    <Title level={5}>常用 API</Title>
    <Paragraph>
      <Text code>where / andWhere</Text>（支持 <Text code>$gte / $in / $ilike</Text> 等）、
      <Text code>leftJoin / innerJoin</Text>、<Text code>orderBy / take / skip / select</Text>、
      <Text code>getMany / getOne / getCount</Text>（别名 <Text code>find / findOne / count</Text>）、
      <Text code>getManyAndCount / paginate</Text>、<Text code>insert / update / delete</Text>。
    </Paragraph>

    <Title level={5}>分页 + 计数（推荐，避免过滤写两遍）</Title>
    <pre style={preStyle}>{`const result = await db('fmms:production:WorkCard')
  .where({ status: params.status })
  .orderBy('created_at', 'DESC')
  .paginate({ limit: params.limit, skip: params.skip });

// result = { items, pagination: { total, page, pageSize, totalPages, hasNext } }
return result;`}</pre>

    <Title level={5}>JOIN</Title>
    <pre style={preStyle}>{`return await db('order:Order', 'o')
  .leftJoin('order:OrderItem', 'oi', 'o.id', 'oi.order_id')
  .where({ 'o.status': params.status, 'oi.qty': { $gte: 1 } })
  .orderBy('o.created_at', 'DESC')
  .paginate({ limit: params.limit, skip: params.skip });`}</pre>

    <Title level={5}>where 操作符</Title>
    <pre style={preStyle}>{`await db('A')
  .where({
    status: 'open',
    name: { $ilike: '%foo%' },
    age: { $gte: 18, $lte: 60 },
    id: { $in: ['a', 'b'] },
    deleted_at: { $isNull: true },
  })
  .count();`}</pre>

    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
      更多细节见锁定壳注释与 AI Skill；保存/测试前须通过语法检查。
    </Paragraph>
  </div>
);

export default HandlerSdkHelpModalContent;
