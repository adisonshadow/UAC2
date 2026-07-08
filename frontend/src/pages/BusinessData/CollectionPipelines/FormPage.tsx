import { PageContainer, ProForm } from '@ant-design/pro-components';
import { useAISurface } from '@EADAF/ai-base';
import { Button, Space, Spin, message } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageContainerTitleWithBack from '@/components/PageContainerTitleWithBack';
import CollectionPipelineForm, {
  type CollectionPipelineFormValues,
} from './components/CollectionPipelineForm';
import {
  getCollectionPipeline,
  patchCollectionPipeline,
  postCollectionPipeline,
  postCollectionPipelinePublish,
} from '@/services/UAC/api/businessData';
import { getApiData, getApiErrorMessage, isApiSuccess } from '@/utils/apiResponse';

export type CollectionPipelinePageMode = 'create' | 'edit';

interface CollectionPipelineFormPageProps {
  mode: CollectionPipelinePageMode;
}

const CollectionPipelineFormPage: React.FC<CollectionPipelineFormPageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = ProForm.useForm<CollectionPipelineFormValues>();
  const [loading, setLoading] = useState(mode !== 'create');
  const [submitting, setSubmitting] = useState(false);
  const [meta, setMeta] = useState<API.CollectionPipeline | null>(null);
  const [sampleData, setSampleData] = useState('');
  const [targetStructure, setTargetStructure] = useState('');
  const [parseScript, setParseScript] = useState('');
  const [storeScript, setStoreScript] = useState('');
  const [entityId, setEntityId] = useState<string | undefined>();

  const sampleDataRef = useRef(sampleData);
  sampleDataRef.current = sampleData;
  const targetStructureRef = useRef(targetStructure);
  targetStructureRef.current = targetStructure;
  const parseScriptRef = useRef(parseScript);
  parseScriptRef.current = parseScript;
  const storeScriptRef = useRef(storeScript);
  storeScriptRef.current = storeScript;
  const pipelineIdRef = useRef(id);
  pipelineIdRef.current = id;

  const listPath = '/api_services/collection-pipelines';

  const loadPipeline = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getCollectionPipeline(id);
      if (!isApiSuccess(res)) {
        messageApi.error(getApiErrorMessage(res, '加载失败'));
        return;
      }
      const data = getApiData<API.CollectionPipeline>(res);
      if (!data) {
        messageApi.error('采集管道不存在');
        return;
      }
      setMeta(data);
      setSampleData(data.sampleData || '');
      setTargetStructure(data.targetStructure || '');
      setParseScript(data.parseScript || '');
      setStoreScript(data.storeScript || '');
      setEntityId(data.entityId);
      form.setFieldsValue({
        scopeCode: data.scopeCode,
        pipelineSlug: data.pipelineSlug,
        name: data.name,
        description: data.description,
        protocolType: data.protocolType || 'serial',
        restrictSources: data.restrictSources,
        applicationIds: data.applicationIds,
        entityId: data.entityId,
      });
    } finally {
      setLoading(false);
    }
  }, [form, id, messageApi]);

  useEffect(() => {
    if (mode === 'edit') void loadPipeline();
  }, [loadPipeline, mode]);

  useAISurface({
    id: mode === 'create' ? 'bizdata.collection-pipeline.create' : 'bizdata.collection-pipeline.edit',
    domain: 'bizdata',
    label: mode === 'create' ? '新建采集管道' : '编辑采集管道',
    read: () => {
      const values = form.getFieldsValue();
      return {
        pipelineId: pipelineIdRef.current,
        mode,
        code: meta?.code,
        scopeCode: values.scopeCode || meta?.scopeCode,
        pipelineSlug: values.pipelineSlug || meta?.pipelineSlug,
        name: values.name || meta?.name,
        protocolType: values.protocolType || meta?.protocolType,
        entityId: values.entityId || entityId,
        sampleData: sampleDataRef.current,
        targetStructure: targetStructureRef.current,
        parseScript: parseScriptRef.current,
        storeScript: storeScriptRef.current,
        restrictSources: values.restrictSources,
        applicationIds: values.applicationIds,
      };
    },
    applyMutation: (mutation) => {
      if (mutation.domain !== 'bizdata' || mutation.type !== 'collection_pipeline.updated') return;
      const payload = mutation.payload as API.CollectionPipeline | undefined;
      if (!payload) return;
      if (mutation.resourceId && mutation.resourceId !== pipelineIdRef.current) return;
      if (payload.sampleData != null) setSampleData(payload.sampleData);
      if (payload.targetStructure != null) setTargetStructure(payload.targetStructure);
      if (payload.parseScript != null) setParseScript(payload.parseScript);
      if (payload.storeScript != null) setStoreScript(payload.storeScript);
      setMeta((prev) => ({ ...prev, ...payload }));
      form.setFieldsValue({
        name: payload.name ?? form.getFieldValue('name'),
        protocolType: payload.protocolType ?? form.getFieldValue('protocolType'),
      });
    },
    matchMutation: (mutation) =>
      mutation.domain === 'bizdata' && mutation.type === 'collection_pipeline.updated',
  });

  const buildPayload = (values: CollectionPipelineFormValues) => ({
    scopeCode: values.scopeCode,
    pipelineSlug: values.pipelineSlug,
    name: String(values.name || '').trim(),
    description: values.description,
    protocolType: values.protocolType,
    restrictSources: values.restrictSources,
    applicationIds: values.applicationIds,
    entityId: values.entityId || entityId,
    sampleData: sampleData.trim() || undefined,
    targetStructure: targetStructure.trim() || undefined,
    parseScript: parseScript.trim() || undefined,
    storeScript: storeScript.trim() || undefined,
  });

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload = buildPayload(values);
      const res =
        mode === 'create'
          ? await postCollectionPipeline(payload)
          : await patchCollectionPipeline(id!, payload);

      if (!isApiSuccess(res)) {
        messageApi.error(getApiErrorMessage(res, '保存失败'));
        return;
      }
      messageApi.success('已保存');
      const data = getApiData<API.CollectionPipeline>(res);
      if (mode === 'create' && data?.id) {
        navigate(`${listPath}/${data.id}/edit`, { replace: true });
        return;
      }
      if (data) setMeta(data);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      messageApi.error(getApiErrorMessage(error, '保存失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const publish = async () => {
    if (!id) {
      messageApi.warning('请先保存管道');
      return;
    }
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await patchCollectionPipeline(id, buildPayload(values));
      const res = await postCollectionPipelinePublish(id);
      if (!isApiSuccess(res)) {
        messageApi.error(getApiErrorMessage(res, '发布失败'));
        return;
      }
      messageApi.success('已发布');
      await loadPipeline();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageContainer title={mode === 'create' ? '新建采集管道' : '编辑采集管道'}>
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
          title={mode === 'create' ? '新建采集管道' : '编辑采集管道'}
        />
      }
      extra={
        <Space>
          {mode === 'edit' && id ? (
            <Button onClick={() => navigate(`${listPath}/${id}/test`)}>测试</Button>
          ) : null}
          <Button type="primary" loading={submitting} onClick={() => void submit()}>
            保存
          </Button>
          {mode === 'edit' ? (
            <Button loading={submitting} onClick={() => void publish()}>
              发布
            </Button>
          ) : null}
        </Space>
      }
    >
      {contextHolder}
      <ProForm
        form={form}
        submitter={false}
        layout="vertical"
        initialValues={{ protocolType: 'serial', restrictSources: false }}
      >
        <CollectionPipelineForm
          form={form}
          mode={mode}
          sampleData={sampleData}
          onSampleDataChange={setSampleData}
          targetStructure={targetStructure}
          onTargetStructureChange={setTargetStructure}
          parseScript={parseScript}
          onParseScriptChange={setParseScript}
          storeScript={storeScript}
          onStoreScriptChange={setStoreScript}
          readonlyCode={meta?.code}
          readonlyBasePath={meta?.basePath}
          readonlyRoutePath={meta?.routePath}
          entityId={entityId}
          onEntityIdChange={setEntityId}
        />
      </ProForm>
    </PageContainer>
  );
};

export default CollectionPipelineFormPage;
