import Editor from '@monaco-editor/react';
import { ProForm, ProFormRadio, ProFormSelect, ProFormSwitch, ProFormText } from '@ant-design/pro-components';
import { Alert, Card, Col, Form, Row, Typography } from 'antd';
import type { FormInstance } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import ApiServiceScopeLookup from '@/pages/ApiServices/components/ApiServiceScopeLookup';
import { getApplications } from '@/services/UAC/api/applications';
import { getBusinessDataSchema } from '@/services/UAC/api/businessData';
import { getApiData, isApiSuccess } from '@/utils/apiResponse';

const { Text, Paragraph } = Typography;

const TARGET_STRUCTURE_PLACEHOLDER = `interface SensorReading {
  /** 设备编号 */
  deviceId: string;
  /** 温度 */
  temperature: number;
  /** 采集时间 ISO8601 */
  collectedAt: string;
}`;

const PARSE_SCRIPT_PLACEHOLDER = `export function parse(raw, ctx) {
  // raw: 请求 body 字符串；application/octet-stream 时为 hex
  // ctx.protocolType: serial | modbus_rtu | modbus_tcp
  return { deviceId: 'DEV-01', temperature: 25.6, collectedAt: new Date().toISOString() };
}`;

const STORE_SCRIPT_PLACEHOLDER = `export async function store(data, ctx) {
  const { queryPg, tableQualified } = ctx;
  const rows = await queryPg(
    \`INSERT INTO \${tableQualified} (id, device_id, temperature, collected_at)
     VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id\`,
    [data.deviceId, data.temperature, data.collectedAt],
  );
  return { insertedId: rows[0]?.id, rowCount: 1 };
}`;

const CODE_SEGMENT_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

function codeToRoutePath(code: string) {
  return code.trim().split(':').join('/');
}

function buildPreviewCode(scopeCode?: string, pipelineSlug?: string) {
  const scope = String(scopeCode || '').trim();
  const slug = String(pipelineSlug || '').trim();
  if (!scope || !slug || !CODE_SEGMENT_RE.test(slug)) return '';
  return `${scope}:${slug}`;
}

export type CollectionPipelineFormValues = {
  scopeCode?: string;
  pipelineSlug?: string;
  name?: string;
  description?: string;
  protocolType?: API.CollectionPipelineProtocolType;
  restrictSources?: boolean;
  applicationIds?: string[];
  entityId?: string;
};

export type CollectionPipelineFormProps = {
  form: FormInstance<CollectionPipelineFormValues>;
  mode: 'create' | 'edit';
  sampleData: string;
  onSampleDataChange: (value: string) => void;
  targetStructure: string;
  onTargetStructureChange: (value: string) => void;
  parseScript: string;
  onParseScriptChange: (value: string) => void;
  storeScript: string;
  onStoreScriptChange: (value: string) => void;
  readonlyCode?: string;
  readonlyBasePath?: string;
  readonlyRoutePath?: string;
  entityId?: string;
  onEntityIdChange?: (entityId?: string) => void;
};

const CollectionPipelineForm: React.FC<CollectionPipelineFormProps> = ({
  form,
  mode,
  sampleData,
  onSampleDataChange,
  targetStructure,
  onTargetStructureChange,
  parseScript,
  onParseScriptChange,
  storeScript,
  onStoreScriptChange,
  readonlyCode,
  readonlyBasePath,
  readonlyRoutePath,
  entityId,
  onEntityIdChange,
}) => {
  const scopeCode = Form.useWatch('scopeCode', form);
  const pipelineSlug = Form.useWatch('pipelineSlug', form);
  const restrictSources = Form.useWatch('restrictSources', form);
  const selectedEntityId = Form.useWatch('entityId', form);
  const [applicationOptions, setApplicationOptions] = useState<{ label: string; value: string }[]>([]);
  const [entityOptions, setEntityOptions] = useState<{ label: string; value: string }[]>([]);

  const previewCode = useMemo(
    () => (mode === 'create' ? buildPreviewCode(scopeCode, pipelineSlug) : readonlyCode),
    [mode, scopeCode, pipelineSlug, readonlyCode],
  );

  const previewRoutePath = useMemo(() => {
    if (readonlyRoutePath) return readonlyRoutePath;
    if (!previewCode) return '';
    return codeToRoutePath(previewCode);
  }, [previewCode, readonlyRoutePath]);

  const ingestUrl = useMemo(() => {
    const base = readonlyBasePath || (previewRoutePath ? `/api/v1/ingest/${previewRoutePath}` : '');
    return base ? `POST ${base}` : '';
  }, [readonlyBasePath, previewRoutePath]);

  useEffect(() => {
    void getApplications({ page: 1, size: 500 }).then((res) => {
      if (!isApiSuccess(res)) return;
      const data = getApiData<{ items?: API.Application[] }>(res);
      setApplicationOptions(
        (data?.items || [])
          .filter((a) => a.status === 'ACTIVE')
          .map((a) => ({ label: `${a.name} (${a.code})`, value: a.application_id || '' }))
          .filter((o) => o.value),
      );
    });
  }, []);

  useEffect(() => {
    void getBusinessDataSchema().then((res) => {
      if (!isApiSuccess(res)) return;
      const schema = getApiData<API.BusinessDataSchema>(res);
      const entities = (schema?.entities || []).filter((e) => e.entityKind === 'er_table');
      const filtered = scopeCode
        ? entities.filter((e) => e.code?.startsWith(`${scopeCode}:`))
        : entities;
      setEntityOptions(
        filtered.map((e) => ({
          label: `${e.label || e.code} (${e.code})`,
          value: e.id || '',
        })).filter((o) => o.value),
      );
    });
  }, [scopeCode]);

  useEffect(() => {
    if (entityId && entityId !== selectedEntityId) {
      form.setFieldValue('entityId', entityId);
    }
  }, [entityId, form, selectedEntityId]);

  return (
    <>
      <Card title="基础信息" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Scope" name="scopeCode" rules={mode === 'create' ? [{ required: true }] : []}>
              <ApiServiceScopeLookup disabled={mode === 'edit'} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <ProFormText
              name="pipelineSlug"
              label="管道短名"
              disabled={mode === 'edit'}
              rules={mode === 'create' ? [{ required: true }] : []}
              placeholder="如 sensorIngest"
            />
          </Col>
        </Row>
        {previewCode && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`code: ${previewCode}`}
            description={ingestUrl ? `采集 API: ${ingestUrl}` : undefined}
          />
        )}
        <ProFormText name="name" label="名称" rules={[{ required: true }]} />
        <ProFormText name="description" label="描述" />
        <ProFormRadio.Group
          name="protocolType"
          label="协议类型"
          options={[
            { label: '串口', value: 'serial' },
            { label: 'Modbus RTU', value: 'modbus_rtu' },
            { label: 'Modbus TCP', value: 'modbus_tcp' },
          ]}
        />
      </Card>

      <Card title="来源业务系统" style={{ marginBottom: 16 }}>
        <ProFormSwitch name="restrictSources" label="限制来源业务系统" />
        {restrictSources && (
          <ProFormSelect
            name="applicationIds"
            label="允许的业务系统"
            mode="multiple"
            options={applicationOptions}
            rules={[{ required: true, message: '请至少选择一个业务系统' }]}
          />
        )}
        {!restrictSources && (
          <Text type="secondary">未限制时，所有已启用 API 的业务系统均可提交数据。</Text>
        )}
      </Card>

      <Card title="目标实体（物化表）" style={{ marginBottom: 16 }}>
        <ProFormSelect
          name="entityId"
          label="绑定实体"
          showSearch
          options={entityOptions}
          rules={[{ required: true, message: '请选择目标实体' }]}
          fieldProps={{
            onChange: (value: string) => onEntityIdChange?.(value),
          }}
        />
      </Card>

      <Card title="样本数据（plain text）" style={{ marginBottom: 16 }}>
        <Editor
          height="160px"
          language="plaintext"
          value={sampleData}
          onChange={(v) => onSampleDataChange(v || '')}
          options={{ minimap: { enabled: false }, wordWrap: 'on' }}
        />
      </Card>

      <Card title="目标数据结构（TypeScript interface）" style={{ marginBottom: 16 }}>
        <Editor
          height="200px"
          language="typescript"
          value={targetStructure}
          onChange={(v) => onTargetStructureChange(v || '')}
          options={{ minimap: { enabled: false }, wordWrap: 'on' }}
        />
        {!targetStructure.trim() && (
          <Paragraph type="secondary" style={{ marginTop: 8 }}>
            示例：{TARGET_STRUCTURE_PLACEHOLDER}
          </Paragraph>
        )}
      </Card>

      <Card title="解析脚本" style={{ marginBottom: 16 }}>
        <Editor
          height="240px"
          language="typescript"
          value={parseScript}
          onChange={(v) => onParseScriptChange(v || '')}
          options={{ minimap: { enabled: false }, wordWrap: 'on' }}
        />
        {!parseScript.trim() && (
          <Paragraph type="secondary" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
            {PARSE_SCRIPT_PLACEHOLDER}
          </Paragraph>
        )}
      </Card>

      <Card title="存储脚本" style={{ marginBottom: 16 }}>
        <Editor
          height="240px"
          language="typescript"
          value={storeScript}
          onChange={(v) => onStoreScriptChange(v || '')}
          options={{ minimap: { enabled: false }, wordWrap: 'on' }}
        />
        {!storeScript.trim() && (
          <Paragraph type="secondary" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
            {STORE_SCRIPT_PLACEHOLDER}
          </Paragraph>
        )}
      </Card>

      {ingestUrl && (
        <Card title="采集 API">
          <Paragraph copyable={{ text: ingestUrl.replace(/^POST\s+/, '') }}>{ingestUrl}</Paragraph>
          <Text type="secondary">
            鉴权：业务系统使用 application_id + app_secret 换取 JWT，请求头 Authorization: Bearer {'{token}'}。
            Body 为 text/plain 或 application/octet-stream（二进制在解析脚本中收到 hex 字符串）。
          </Text>
        </Card>
      )}
    </>
  );
};

export default CollectionPipelineForm;
