import { BulbOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Form, Input, Select, Space, Typography } from 'antd';
import { message } from '@/utils/antdAppApis';
import { ProForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import Editor from '@monaco-editor/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAISurface, useChatReference, useAIChatPrompts, sendMockUserMessage } from '@EADAF/ai-base';
import PageContainerTitleWithBack from '@/components/PageContainerTitleWithBack';
import {
  getOutboundWebhook,
  patchOutboundWebhook,
  postOutboundWebhook,
} from '@/services/UAC/api/outboundWebhooks';
import { getApiServices } from '@/services/UAC/api/apiServices';
import { isApiSuccess, getApiData } from '@/utils/apiResponse';
import { buildOutboundWebhookGeneratePrompt } from '../ai/buildOutboundWebhookGeneratePrompt';
import { buildOutboundWebhookFormPrompts } from '../ai/buildOutboundWebhookFormPrompts';

const { Text, Paragraph } = Typography;

const MONACO_OPTIONS = { minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' as const };

interface FormPageProps {
  mode: 'create' | 'edit';
}

const OutboundWebhookFormPage: React.FC<FormPageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit');

  // 脚本字段 lift 到页面状态（Monaco 编辑器）
  const [requestStructure, setRequestStructure] = useState('');
  const [transformScript, setTransformScript] = useState('');
  const [mockData, setMockData] = useState('');
  const [apiServiceOptions, setApiServiceOptions] = useState<{ label: string; value: string }[]>([]);

  // ref mirror for AI surface read
  const requestStructureRef = useRef(requestStructure);
  requestStructureRef.current = requestStructure;
  const transformScriptRef = useRef(transformScript);
  transformScriptRef.current = transformScript;
  const mockDataRef = useRef(mockData);
  mockDataRef.current = mockData;
  const formValuesRef = useRef<Record<string, any>>({});

  const { references, addReference } = useChatReference();
  const chatPrompts = useMemo(
    () => buildOutboundWebhookFormPrompts(references),
    [references],
  );
  useAIChatPrompts(chatPrompts);

  // 加载已发布业务 API 列表（供绑定选择）
  useEffect(() => {
    void (async () => {
      try {
        const res = await getApiServices({ size: -1, status: 'published' });
        if (isApiSuccess(res)) {
          const items = getApiData<any>(res)?.items || [];
          setApiServiceOptions(
            items.map((s: any) => ({
              label: `${s.name} (${s.code})`,
              value: s.id,
            })),
          );
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // 编辑模式加载数据
  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await getOutboundWebhook(id);
        if (isApiSuccess(res)) {
          const data = getApiData<API.OutboundWebhook>(res);
          if (data) {
            form.setFieldsValue({
              code: data.code,
              name: data.name,
              description: data.description,
              triggerApiServiceId: data.triggerApiServiceId,
              triggerApiServiceCode: data.triggerApiServiceCode,
              targetUrl: data.targetUrl,
            });
            formValuesRef.current = {
              code: data.code,
              name: data.name,
              description: data.description,
              triggerApiServiceId: data.triggerApiServiceId,
              triggerApiServiceCode: data.triggerApiServiceCode,
              targetUrl: data.targetUrl,
            };
            setRequestStructure(data.requestStructure || '');
            setTransformScript(data.transformScript || '');
            setMockData(data.mockData || '{}');
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, id, form]);

  // AI Surface
  useAISurface({
    id: mode === 'create' ? 'apiservice.outbound_webhook.create' : 'apiservice.outbound_webhook.edit',
    domain: 'apiservice',
    label: '提交外部API编辑',
    read: () => ({
      ...formValuesRef.current,
      requestStructure: requestStructureRef.current,
      transformScript: transformScriptRef.current,
      mockData: mockDataRef.current,
    }),
    applyMutation: (mutation) => {
      if (mutation.type === 'outbound_webhook.updated') {
        const p = mutation.payload || {};
        if (p.requestStructure != null) setRequestStructure(p.requestStructure);
        if (p.transformScript != null) setTransformScript(p.transformScript);
        if (p.mockData != null) setMockData(p.mockData);
      }
    },
    matchMutation: (mutation) => mutation.type === 'outbound_webhook.updated',
  });

  const handleSave = async (publish = false) => {
    try {
      const values = await form.validateFields();
      const selectedService = apiServiceOptions.find((o) => o.value === values.triggerApiServiceId);
      const body: Partial<API.OutboundWebhook> = {
        ...values,
        triggerApiServiceCode: selectedService?.label?.match(/\(([^)]+)\)/)?.[1] || values.triggerApiServiceCode,
        requestStructure,
        transformScript,
        mockData,
      };

      setSaving(true);
      let res;
      if (mode === 'create') {
        res = await postOutboundWebhook(body);
        if (isApiSuccess(res)) {
          message.success('创建成功');
          navigate(`/api_services/outbound-webhooks/${res.data?.id}/edit`, { replace: true });
        }
      } else {
        res = await patchOutboundWebhook(id!, body);
        if (isApiSuccess(res)) {
          message.success('保存成功');
        }
      }
      if (!isApiSuccess(res)) {
        message.error(res.message || '保存失败');
      }
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAiGenerate = () => {
    addReference({
      type: 'outbound_webhook',
      label: '提交外部API',
      content: formValuesRef.current.name || formValuesRef.current.code || '',
      unique: true,
    });
    sendMockUserMessage(
      buildOutboundWebhookGeneratePrompt({
        targetUrl: formValuesRef.current.targetUrl,
        triggerApiServiceCode: formValuesRef.current.triggerApiServiceCode,
      }),
    );
  };

  const isEdit = mode === 'edit';

  return (
    <>
      <PageContainer
        title={
          <PageContainerTitleWithBack
            title={isEdit ? '编辑提交外部API' : '新建提交外部API'}
            backTo="/api_services/outbound-webhooks"
          />
        }
      >
        <ProForm
          form={form}
          submitter={false}
          layout="vertical"
        >
          <Card title="基础信息" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <ProFormText
                    name="code"
                    label="编码"
                    placeholder="域:slug，如 fmms:notifyOrder"
                    rules={[{ required: true, message: '请输入编码' }]}
                    disabled={isEdit}
                    tooltip="冒号分层，唯一标识"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <ProFormText
                    name="name"
                    label="名称"
                    placeholder="提交外部API名称"
                    rules={[{ required: true, message: '请输入名称' }]}
                  />
                </div>
              </div>
              <ProFormTextArea name="description" label="描述" placeholder="可选" />
            </Space>
          </Card>

          <Card title="目标 API" style={{ marginBottom: 16 }}>
            <ProFormText
              name="targetUrl"
              label="外部 API 地址"
              placeholder="https://example.com/api/notify"
              rules={[{ required: true, message: '请输入外部 API 地址' }]}
              tooltip="请求方式：POST，请求结构：JSON"
            />
            <Form.Item label="触发方式">
              <Select disabled value="api_hook" options={[{ label: '业务 API HOOK（业务 API 成功后触发）', value: 'api_hook' }]} />
            </Form.Item>
            <Form.Item
              name="triggerApiServiceId"
              label="绑定的业务 API"
              rules={[{ required: true, message: '请选择绑定的业务 API' }]}
              tooltip="当绑定的业务 API 请求成功后，自动触发本提交"
            >
              <Select
                showSearch
                allowClear
                placeholder="选择已发布的业务 API 服务"
                options={apiServiceOptions}
                loading={loading}
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Card>

          <Card
            title="请求结构 & 处置脚本"
            style={{ marginBottom: 16 }}
            extra={
              <Button icon={<BulbOutlined />} onClick={handleAiGenerate}>
                AI 一键编写
              </Button>
            }
          >
            <Paragraph type="secondary" style={{ marginBottom: 12 }}>
              处置脚本将业务 API 返回的数据（<Text code>data</Text>）转换为请求结构，然后 POST 到目标 URL。
            </Paragraph>
            <Text strong>请求结构（TypeScript interface）</Text>
            <Editor
              height={180}
              language="typescript"
              theme="vs"
              value={requestStructure}
              onChange={(v) => setRequestStructure(v || '')}
              options={MONACO_OPTIONS}
            />
            <div style={{ height: 16 }} />
            <Text strong>处置脚本（export function transform(data, ctx)）</Text>
            <Editor
              height={240}
              language="typescript"
              theme="vs"
              value={transformScript}
              onChange={(v) => setTransformScript(v || '')}
              options={MONACO_OPTIONS}
            />
          </Card>

          <Card title="Mock Data" style={{ marginBottom: 16 }}>
            <Text strong>模拟数据（JSON，模拟业务 API 返回的数据）</Text>
            <Editor
              height={160}
              language="json"
              theme="vs"
              value={mockData}
              onChange={(v) => setMockData(v || '')}
              options={MONACO_OPTIONS}
            />
          </Card>
        </ProForm>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Space size="middle">
            <Button onClick={() => navigate('/api_services/outbound-webhooks')}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => handleSave(false)}>
              保存
            </Button>
          </Space>
        </div>
      </PageContainer>
    </>
  );
};

export default OutboundWebhookFormPage;
