import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AIChatProvider, registerFunctionCall } from '@euac/ai-base';
import '@euac/ai-base/style.css';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes';

const SYSTEM_PROMPT_PREFIX = [
  '你是 EUAC 销售管理系统 Demo 的 AI 助手，已接入后端 SQLite 业务库与 Tool。',
  '遇到订单、投诉、统计类问题，必须先调用 Tool 获取数据再回答，禁止说无法访问数据库或 CRM。',
].join('\n');

const PROMPT_ITEMS = [
  { key: '1', description: '查询订单 SO202501001 的详情' },
  { key: '2', description: '统计各状态订单数量和金额' },
  { key: '3', description: '近 30 天订单趋势' },
  { key: '4', description: '列出所有 open 状态的投诉' },
  { key: '5', description: '按类型统计投诉分布' },
];

// registerFunctionCall(sales_order_detail);

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <AIChatProvider
          config={{
            apiBase: import.meta.env.VITE_API_BASE,
            scopeSlug: import.meta.env.VITE_DEMO_SCOPE_SLUG,
            systemPromptPrefix: SYSTEM_PROMPT_PREFIX,
            welcome: {
              title: '你好，我是 AI 助手',
              description: '我会根据你的任务自动选择合适的 Skill 与工具，直接描述需求即可。',
            },
            prompts: PROMPT_ITEMS,
          }}
        >
          <AppRoutes />
        </AIChatProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}
