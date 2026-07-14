import { RobotOutlined } from '@ant-design/icons';
import { PageContainer, ProForm } from '@ant-design/pro-components';
import { sendMockUserMessage, useAISurface, useChatReference } from '@EADAF/ai-base';
import { Alert, Button, Space, Spin } from 'antd';
import { message } from '@/utils/antdAppApis';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { buildApiServiceReference } from '@/ai/chatReferenceBuilders';
import PageContainerTitleWithBack from '@/components/PageContainerTitleWithBack';
import { buildApiServiceEditPolishPrompt } from '@/pages/ApiServices/ai/buildApiServiceEditPolishPrompt';
import ApiServiceForm, {
  buildAccessRestrictionPayload,
  parseTagsInput,
  type ApiServiceFormValues,
} from '../components/ApiServiceForm';
import {
  getApiService,
  getApiServiceOperationCatalog,
  patchApiService,
} from '@/services/UAC/api/apiServices';
import {
  getApiData,
  getApiErrorMessage,
  isApiSuccess,
} from '@/utils/apiResponse';
import { apiServiceStatusEnum } from '@/enums';
import { renderStatusBadge } from '@/utils/statusBadge';

type EditLocationState = {
  autoRunTest?: boolean;
  fixContext?: { errorMessage?: string };
  fromAutoFix?: boolean;
};

const ApiServiceEditPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state || {}) as EditLocationState;
  const { id: serviceId } = useParams<{ id: string }>();
  const [form] = ProForm.useForm<ApiServiceFormValues>();

  const [loading, setLoading] = useState(true);
  const [operationCatalog, setOperationCatalog] = useState<API.ApiServiceOperationMeta[]>([]);
  const [definitionScript, setDefinitionScript] = useState('');
  const [handlerScript, setHandlerScript] = useState('');
  const [requestParameterInterface, setRequestParameterInterface] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serviceMeta, setServiceMeta] = useState<API.ApiService | null>(null);

  const definitionScriptRef = useRef(definitionScript);
  definitionScriptRef.current = definitionScript;
  const handlerScriptRef = useRef(handlerScript);
  handlerScriptRef.current = handlerScript;
  const requestParameterInterfaceRef = useRef(requestParameterInterface);
  requestParameterInterfaceRef.current = requestParameterInterface;
  const serviceIdRef = useRef(serviceId);
  serviceIdRef.current = serviceId;
  const { references, addReference } = useChatReference();

  const loadService = useCallback(async () => {
    if (!serviceId) return;
    setLoading(true);
    try {
      const res = await getApiService(serviceId);
      if (!isApiSuccess(res)) {
        message.error(getApiErrorMessage(res, '加载 API 服务失败'));
        return;
      }
      const data = getApiData<API.ApiService>(res);
      if (!data) {
        message.error('API 服务不存在');
        return;
      }
      setServiceMeta(data);
      setDefinitionScript(data.definitionScript || '');
      setHandlerScript(data.handlerScript || '');
      setRequestParameterInterface(data.requestParameterInterface || '');
      const restriction = data.accessRestriction || { mode: 'none' as const };
      form.setFieldsValue({
        scopeCode: data.scopeCode,
        serviceSlug: data.serviceSlug,
        name: data.name,
        tags: data.tags?.join(', '),
        primaryOperation: data.enabledOperations?.[0],
        accessRestrictionMode: restriction.mode || 'none',
        roleIds: restriction.roleIds,
        departmentIds: restriction.departmentIds,
        scriptMode: data.scriptMode || 'sql',
        transportProtocols: data.transportProtocols?.length ? data.transportProtocols : ['http'],
      });
    } catch (error) {
      message.error(getApiErrorMessage(error, '加载 API 服务失败'));
    } finally {
      setLoading(false);
    }
  }, [form, serviceId]);

  useEffect(() => {
    void loadService();
    void getApiServiceOperationCatalog().then((res) => {
      const data = getApiData<API.ApiServiceOperationMeta[]>(res);
      if (isApiSuccess(res) && data) setOperationCatalog(data);
    });
  }, [loadService]);

  useAISurface({
    id: 'api-services.edit',
    domain: 'bizdata',
    label: '编辑 API 服务',
    read: () => {
      const values = form.getFieldsValue();
      const scopeRefs = references
        .filter((r: any) => r.type === 'scope')
        .map((r: any) => (r.content as { code?: string })?.code)
        .filter(Boolean);
      const entityRefs = references
        .filter((r: any) => r.type === 'entity')
        .map((r: any) => {
          const c = r.content as { code?: string; label?: string; id?: string };
          return { code: c.code, label: c.label, id: c.id };
        });
      return {
        serviceId: serviceIdRef.current,
        code: serviceMeta?.code,
        scopeCode: values.scopeCode || serviceMeta?.scopeCode,
        serviceSlug: values.serviceSlug || serviceMeta?.serviceSlug,
        name: values.name || serviceMeta?.name,
        status: serviceMeta?.status,
        entityCode: serviceMeta?.entityCode,
        primaryOperation: values.primaryOperation,
        scriptMode: values.scriptMode || serviceMeta?.scriptMode,
        definitionScript: definitionScriptRef.current,
        handlerScript: handlerScriptRef.current,
        requestParameterInterface: requestParameterInterfaceRef.current,
        accessRestriction: buildAccessRestrictionPayload(values),
        fixContext: locationState.fixContext,
        chatReferences: { scopes: scopeRefs, entities: entityRefs },
      };
    },
    applyMutation: (mutation: any) => {
      if (mutation.type !== 'apiservice.updated') return;
      if (mutation.resourceId && mutation.resourceId !== serviceIdRef.current) return;
      const payload = mutation.payload as API.ApiService | undefined;
      if (payload?.definitionScript != null) {
        setDefinitionScript(payload.definitionScript);
      }
      if (payload?.handlerScript != null) {
        setHandlerScript(payload.handlerScript);
      }
      if (payload?.requestParameterInterface != null) {
        setRequestParameterInterface(payload.requestParameterInterface);
      }
      if (payload) {
        setServiceMeta((prev) => ({ ...prev, ...payload }));
        form.setFieldsValue({
          name: payload.name ?? form.getFieldValue('name'),
          tags: payload.tags?.join(', ') ?? form.getFieldValue('tags'),
          scopeCode: payload.scopeCode ?? form.getFieldValue('scopeCode'),
          serviceSlug: payload.serviceSlug ?? form.getFieldValue('serviceSlug'),
          scriptMode: payload.scriptMode ?? form.getFieldValue('scriptMode'),
        });
      }
    },
    matchMutation: (mutation: any) =>
      mutation.domain === 'bizdata' && mutation.type === 'apiservice.updated',
  });

  const submit = async () => {
    if (!serviceId) return;
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const res = await patchApiService(serviceId, {
        scopeCode: values.scopeCode,
        serviceSlug: values.serviceSlug,
        name: String(values.name || '').trim(),
        tags: parseTagsInput(values.tags),
        scriptMode: values.scriptMode,
        definitionScript: values.scriptMode === 'typescript' ? undefined : definitionScript.trim() || undefined,
        handlerScript: values.scriptMode === 'typescript' ? handlerScript.trim() || undefined : undefined,
        requestParameterInterface: requestParameterInterface.trim() || undefined,
        accessRestriction: buildAccessRestrictionPayload(values),
        enabledOperations: values.primaryOperation ? [String(values.primaryOperation)] : undefined,
        transportProtocols: values.transportProtocols,
      });

      if (!isApiSuccess(res)) {
        message.error(getApiErrorMessage(res, '保存失败'));
        return;
      }
      const updated = getApiData<API.ApiService>(res);
      if (updated) setServiceMeta(updated);
      if (updated?.status === 'draft' && serviceMeta?.status === 'published') {
        message.success('已保存，服务已回到草稿状态，请重新发布');
      } else {
        message.success('API 服务已保存');
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error(getApiErrorMessage(error, '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiPolish = () => {
    if (!serviceMeta) return;
    addReference(
      buildApiServiceReference({
        id: serviceMeta.id,
        code: serviceMeta.code,
        name: serviceMeta.name,
        routePath: serviceMeta.routePath,
        status: serviceMeta.status,
        entityCode: serviceMeta.entityCode,
      }),
    );
    sendMockUserMessage(
      buildApiServiceEditPolishPrompt({
        serviceId: serviceMeta.id,
        code: serviceMeta.code,
        name: serviceMeta.name,
        primaryOperation: form.getFieldValue('primaryOperation') || serviceMeta.enabledOperations?.[0],
        scriptMode: form.getFieldValue('scriptMode') || serviceMeta.scriptMode,
        entityCode: serviceMeta.entityCode,
      }),
    );
  };

  if (loading) {
    return (
      <PageContainer
        title={
          <PageContainerTitleWithBack title="编辑 API 服务" />
        }
      >
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Spin description="加载中…" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={
        <PageContainerTitleWithBack
          title={`编辑 API 服务${serviceMeta?.code ? ` · ${serviceMeta.code}` : ''}`}
        />
      }
      subTitle={
        serviceMeta ? (
          <Space size={8} wrap>
            <span>版本 v{serviceMeta.version ?? 0}</span>
            {renderStatusBadge(serviceMeta.status || 'draft', apiServiceStatusEnum)}
          </Space>
        ) : (
          '修改 Scope、访问限制、参数 interface 与 SQL/TypeScript Handler'
        )
      }
      extra={
        <Space>
          {serviceId && (
            <Button onClick={() => navigate(`/api_services/${serviceId}/test`)}>去测试</Button>
          )}
          {serviceMeta && (
            <Button className="ai-btn" icon={<RobotOutlined />} onClick={handleAiPolish}>
              AI 完善
            </Button>
          )}
          <Button type="primary" loading={submitting} onClick={() => void submit()}>
            保存
          </Button>
        </Space>
      }
    >
      {locationState.fixContext?.errorMessage && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="AI 正在修复以下测试错误"
          description={
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {locationState.fixContext.errorMessage}
            </pre>
          }
        />
      )}

      <ProForm form={form} submitter={false} layout="vertical">
        <ApiServiceForm
          form={form}
          mode="edit"
          operationCatalog={operationCatalog}
          definitionScript={definitionScript}
          onDefinitionScriptChange={setDefinitionScript}
          handlerScript={handlerScript}
          onHandlerScriptChange={setHandlerScript}
          requestParameterInterface={requestParameterInterface}
          onRequestParameterInterfaceChange={setRequestParameterInterface}
          readonlyCode={serviceMeta?.code}
          entityId={serviceMeta?.entityId}
        />
      </ProForm>
    </PageContainer>
  );
};

export default ApiServiceEditPage;
