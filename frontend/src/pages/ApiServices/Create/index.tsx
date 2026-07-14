import { PageContainer, ProForm } from '@ant-design/pro-components';
import { useAIChatPrompts, useAISurface, useChatReference } from '@EADAF/ai-base';
import { Button, Form, Space } from 'antd';
import { message } from '@/utils/antdAppApis';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainerTitleWithBack from '@/components/PageContainerTitleWithBack';
import {
  getApiServiceOperationCatalog,
  postApiService,
  postApiServicePublish,
} from '@/services/UAC/api/apiServices';
import {
  getApiData,
  getApiErrorMessage,
  isApiSuccess,
} from '@/utils/apiResponse';
import ApiServiceForm, {
  buildAccessRestrictionPayload,
  parseTagsInput,
  type ApiServiceFormValues,
} from '../components/ApiServiceForm';
import { buildApiServiceCreatePrompts } from '@/pages/ApiServices/ai/buildApiServiceCreatePrompts';

const DEFAULT_OPERATION = 'find';

const ApiServiceCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = ProForm.useForm<ApiServiceFormValues>();

  const [operationCatalog, setOperationCatalog] = useState<API.ApiServiceOperationMeta[]>([]);
  const [definitionScript, setDefinitionScript] = useState('');
  const [handlerScript, setHandlerScript] = useState('');
  const [requestParameterInterface, setRequestParameterInterface] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const primaryOperation = Form.useWatch('primaryOperation', form);
  const scopeCode = Form.useWatch('scopeCode', form);
  const serviceSlug = Form.useWatch('serviceSlug', form);
  const scriptMode = Form.useWatch('scriptMode', form) || 'sql';

  const definitionScriptRef = useRef(definitionScript);
  definitionScriptRef.current = definitionScript;
  const handlerScriptRef = useRef(handlerScript);
  handlerScriptRef.current = handlerScript;
  const requestParameterInterfaceRef = useRef(requestParameterInterface);
  requestParameterInterfaceRef.current = requestParameterInterface;
  const { references } = useChatReference();

  const previewCode = useMemo(() => {
    const scope = String(scopeCode || '').trim();
    const slug = String(serviceSlug || '').trim();
    if (!scope || !slug) return '';
    return `${scope}:${slug}`;
  }, [scopeCode, serviceSlug]);

  const chatPrompts = useMemo(
    () =>
      buildApiServiceCreatePrompts(references, {
        primaryOperation,
        hasDefinitionScript: Boolean(
          scriptMode === 'typescript' ? handlerScript.trim() : definitionScript.trim(),
        ),
        serviceCode: previewCode || undefined,
      }),
    [references, primaryOperation, definitionScript, handlerScript, scriptMode, previewCode],
  );

  useAIChatPrompts(chatPrompts);

  useAISurface({
    id: 'api-services.create',
    domain: 'bizdata',
    label: '新建 API 服务',
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
        scopeCode: values.scopeCode,
        serviceSlug: values.serviceSlug,
        code: previewCode || values.scopeCode,
        name: values.name,
        tags: values.tags,
        primaryOperation: values.primaryOperation,
        scriptMode: values.scriptMode,
        definitionScript: definitionScriptRef.current,
        handlerScript: handlerScriptRef.current,
        requestParameterInterface: requestParameterInterfaceRef.current,
        accessRestriction: buildAccessRestrictionPayload(values),
        chatReferences: { scopes: scopeRefs, entities: entityRefs },
      };
    },
    applyMutation: (mutation: any) => {
      if (
        mutation.type === 'apiservice.created'
        || mutation.type === 'apiservice.batch_created'
      ) {
        navigate('/api_services/list');
      }
    },
    matchMutation: (mutation: any) =>
      mutation.domain === 'bizdata'
      && (mutation.type === 'apiservice.created' || mutation.type === 'apiservice.batch_created'),
  });

  useEffect(() => {
    void getApiServiceOperationCatalog().then((res) => {
      const data = getApiData<API.ApiServiceOperationMeta[]>(res);
      if (isApiSuccess(res) && data) setOperationCatalog(data);
    });
  }, []);

  const submit = async (publishAfterCreate: boolean) => {
    const values = await form.validateFields();
    const operation = String(values.primaryOperation || '').trim();
    if (!operation) {
      message.error('请选择主操作类型');
      return;
    }

    setSubmitting(true);
    try {
      const createRes = await postApiService({
        scopeCode: values.scopeCode,
        serviceSlug: values.serviceSlug,
        name: String(values.name || '').trim(),
        tags: parseTagsInput(values.tags),
        scriptMode: values.scriptMode || 'sql',
        definitionScript: values.scriptMode === 'typescript' ? undefined : definitionScript.trim() || undefined,
        handlerScript: values.scriptMode === 'typescript' ? handlerScript.trim() || undefined : undefined,
        requestParameterInterface: requestParameterInterface.trim() || undefined,
        accessRestriction: buildAccessRestrictionPayload(values),
        enabledOperations: [operation],
        transportProtocols: values.transportProtocols,
      });

      if (!isApiSuccess(createRes)) {
        message.error(getApiErrorMessage(createRes, '创建失败'));
        return;
      }

      const created = getApiData<API.ApiService>(createRes);
      if (publishAfterCreate && created?.id) {
        const pubRes = await postApiServicePublish(created.id);
        if (!isApiSuccess(pubRes)) {
          message.warning(getApiErrorMessage(pubRes, '已创建 draft，但发布失败'));
        } else {
          message.success('API 服务已创建并发布');
          navigate('/api_services/list');
          return;
        }
      } else {
        message.success('API 服务已创建（draft）');
      }
      navigate('/api_services/list');
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error(getApiErrorMessage(error, '创建失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer
      title={
        <PageContainerTitleWithBack title="新建 API 服务" />
      }
      extra={
        <Space>
          <Button loading={submitting} onClick={() => void submit(false)}>
            保存为草稿
          </Button>
          <Button type="primary" loading={submitting} onClick={() => void submit(true)}>
            保存并发布
          </Button>
        </Space>
      }
    >
      <ProForm
        form={form}
        submitter={false}
        layout="vertical"
        initialValues={{
          primaryOperation: DEFAULT_OPERATION,
          accessRestrictionMode: 'none',
          scriptMode: 'sql',
          transportProtocols: ['http'],
        }}
      >
        <ApiServiceForm
          form={form}
          mode="create"
          operationCatalog={operationCatalog}
          definitionScript={definitionScript}
          onDefinitionScriptChange={setDefinitionScript}
          handlerScript={handlerScript}
          onHandlerScriptChange={setHandlerScript}
          requestParameterInterface={requestParameterInterface}
          onRequestParameterInterfaceChange={setRequestParameterInterface}
        />
      </ProForm>
    </PageContainer>
  );
};

export default ApiServiceCreatePage;
