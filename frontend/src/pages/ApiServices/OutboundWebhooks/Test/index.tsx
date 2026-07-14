import { PlayCircleOutlined, BulbOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Alert, Button, Collapse, Descriptions, Spin, Tag, Typography } from 'antd';
import { message } from '@/utils/antdAppApis';
import Editor from '@monaco-editor/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAISurface, useChatReference, useAIChatPrompts, sendMockUserMessage } from '@EADAF/ai-base';
import PageContainerTitleWithBack from '@/components/PageContainerTitleWithBack';
import {
  getOutboundWebhookTestProfile,
  postOutboundWebhookTest,
} from '@/services/UAC/api/outboundWebhooks';
import { isApiSuccess, getApiData } from '@/utils/apiResponse';
import { buildOutboundWebhookTestPrompt } from '../ai/buildOutboundWebhookTestPrompt';

const { Text, Paragraph } = Typography;
const MONACO_OPTIONS = { minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' as const };

const OutboundWebhookTestPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [profile, setProfile] = useState<API.OutboundWebhookTestProfile>();
  const [mockData, setMockData] = useState('{}');
  const [result, setResult] = useState<API.OutboundWebhookTestResult | null>(null);
  const mockDataRef = useRef(mockData);
  mockDataRef.current = mockData;

  const { references } = useChatReference();
  const chatPrompts = useMemo(() => [], []);
  useAIChatPrompts(chatPrompts);

  useAISurface({
    id: 'apiservice.outbound_webhook.test',
    domain: 'apiservice',
    label: '提交外部API测试',
    read: () => ({ mockData: mockDataRef.current, webhookId: id }),
    refresh: () => void loadProfile(),
  });

  const loadProfile = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getOutboundWebhookTestProfile(id);
      if (isApiSuccess(res)) {
        const data = getApiData<API.OutboundWebhookTestProfile>(res);
        setProfile(data);
        setMockData(data?.mockData || '{}');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [id]);

  const handleRunTest = async () => {
    if (!id) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await postOutboundWebhookTest(id, { mockData });
      if (isApiSuccess(res)) {
        setResult(getApiData<API.OutboundWebhookTestResult>(res) || null);
        message.success('测试完成');
      } else {
        message.error(res.message || '测试失败');
      }
    } catch {
      message.error('测试失败');
    } finally {
      setRunning(false);
    }
  };

  const handleAiTest = () => {
    if (!id) return;
    sendMockUserMessage(buildOutboundWebhookTestPrompt({ mockData, webhookId: id }));
  };

  if (loading) {
    return (
      <PageContainer title={<PageContainerTitleWithBack title="测试提交外部API" backTo="/api_services/outbound-webhooks" />}>
        <Spin />
      </PageContainer>
    );
  }

  if (!profile) {
    return (
      <PageContainer title={<PageContainerTitleWithBack title="测试提交外部API" backTo="/api_services/outbound-webhooks" />}>
        <Alert type="error" message="未找到配置" />
      </PageContainer>
    );
  }

  return (
    <>
      <PageContainer title={<PageContainerTitleWithBack title={`测试 - ${profile.name}`} backTo="/api_services/outbound-webhooks" />}>
        <Alert
          type="warning"
          showIcon
          message="测试将真实调用外部 API"
          description="系统会用 Mock Data 运行处置脚本，然后真实 POST 到目标 URL。请确保目标 URL 可达且可承受测试请求。"
          style={{ marginBottom: 16 }}
        />

        <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="名称">{profile.name}</Descriptions.Item>
          <Descriptions.Item label="编码">{profile.code}</Descriptions.Item>
          <Descriptions.Item label="目标 URL" span={2}>
            <Text copyable>{profile.targetUrl}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="触发业务 API">{profile.triggerApiServiceCode || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={profile.status === 'published' ? 'success' : 'default'}>{profile.status}</Tag>
          </Descriptions.Item>
        </Descriptions>

        {profile.requestStructure ? (
          <Collapse
            defaultActiveKey={[]}
            style={{ marginBottom: 16 }}
            items={[{
              key: 'structure',
              label: '请求结构（TypeScript interface）',
              children: (
                <Editor
                  height={160}
                  language="typescript"
                  theme="vs"
                  value={profile.requestStructure}
                  options={{ ...MONACO_OPTIONS, readOnly: true }}
                />
              ),
            }]}
          />
        ) : null}

        <Text strong>Mock Data（模拟业务 API 返回的数据）</Text>
        <Editor
          height={160}
          language="json"
          theme="vs"
          value={mockData}
          onChange={(v) => setMockData(v || '{}')}
          options={MONACO_OPTIONS}
        />

        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <Button type="primary" icon={<PlayCircleOutlined />} loading={running} onClick={handleRunTest}>
            运行测试
          </Button>
          <Button icon={<BulbOutlined />} style={{ marginLeft: 8 }} onClick={handleAiTest}>
            AI 自动测试
          </Button>
        </div>

        {result ? (
          <Collapse
            defaultActiveKey={['all']}
            items={[
              {
                key: 'all',
                label: `测试结果（${result.status === 'success' ? '成功' : '失败'}，耗时 ${result.durationMs}ms）`,
                children: (
                  <>
                    <Descriptions bordered size="small" column={1} style={{ marginBottom: 12 }}>
                      <Descriptions.Item label="处置脚本输出（发给外部 API 的 body）">
                        <pre style={{ margin: 0, maxHeight: 200, overflow: 'auto' }}>
                          {JSON.stringify(result.transformedBody, null, 2)}
                        </pre>
                      </Descriptions.Item>
                      <Descriptions.Item label="外部 API 响应状态码">
                        {result.responseStatus ? (
                          <Tag color={result.responseStatus >= 200 && result.responseStatus < 300 ? 'success' : 'error'}>
                            {result.responseStatus}
                          </Tag>
                        ) : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="外部 API 响应体">
                        <pre style={{ margin: 0, maxHeight: 200, overflow: 'auto' }}>
                          {result.responseBody || '(空)'}
                        </pre>
                      </Descriptions.Item>
                      {result.errorMessage ? (
                        <Descriptions.Item label="错误信息">
                          <Text type="danger">{result.errorMessage}</Text>
                        </Descriptions.Item>
                      ) : null}
                    </Descriptions>
                  </>
                ),
              },
            ]}
          />
        ) : null}
      </PageContainer>
    </>
  );
};

export default OutboundWebhookTestPage;
