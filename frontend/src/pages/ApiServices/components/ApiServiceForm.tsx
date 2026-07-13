import Editor from '@monaco-editor/react';
import { ProForm, ProFormCheckbox, ProFormRadio, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { Alert, Card, Col, Form, Row, Segmented, Spin, Tag, Typography } from 'antd';
import type { FormInstance } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import TitleWithHelp from '@/components/TitleWithHelp';
import ApiServiceScopeLookup from './ApiServiceScopeLookup';
import DepartmentLookup from './DepartmentLookup';
import DataModelReferenceTree from './DataModelReferenceTree';
import { useRoleOptions } from '@/hooks/useRoleOptions';
import { postApiServiceResolveConnection } from '@/services/UAC/api/apiServices';
import { getApiData, getApiErrorMessage, isApiSuccess } from '@/utils/apiResponse';
import {
  API_SERVICE_TRANSPORT_OPTIONS,
  buildTransportEndpointPreview,
  normalizeTransportProtocols,
  type ApiServiceTransportProtocol,
} from '../utils/apiServiceTransport';

const { Text } = Typography;

const PARAM_INTERFACE_HELP = (
  <div style={{ maxWidth: 360 }}>
    <p style={{ margin: '0 0 8px' }}>
      设计期在此声明参数结构；运行时客户端仍传 JSON。
    </p>
    <p style={{ margin: 0 }}>
      文件字段须标注 <Text code>@file</Text> 或注明 storage objectId，值为 storage objectId（UUID）。
    </p>
  </div>
);

const SQL_SCRIPT_HELP = (
  <div style={{ maxWidth: 360 }}>
    <p style={{ margin: 0 }}>编写 SQL；命名参数可用 :limit、:skip 及自定义 :paramName。</p>
  </div>
);

const HANDLER_SCRIPT_HELP = (
  <div style={{ maxWidth: 360 }}>
    <p style={{ margin: 0 }}>
      导出 <Text code>async function handler(ctx)</Text>，ctx 提供 params、queryPg(sql, bindings) 等；服务端沙箱执行，超时 5s。
    </p>
  </div>
);

const TRANSPORT_HELP = (
  <div style={{ maxWidth: 380 }}>
    <p style={{ margin: '0 0 8px' }}>可同时启用多种访问协议，至少选择一种。</p>
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      <li><Text strong>HTTP REST</Text>：常规 REST 调用</li>
      <li><Text strong>SSE</Text>：读操作流式推送（find/count 等）</li>
      <li><Text strong>WebSocket</Text>：双向 JSON 消息，适合实时交互</li>
    </ul>
  </div>
);

const CATEGORY_LABEL: Record<string, string> = {
  read: '读操作',
  create: '写操作（增）',
  update: '写操作（改）',
  delete: '写操作（删）',
  aggregate: '聚合统计',
};

const SQL_PLACEHOLDER = `-- 在此编写服务 SQL，可跨多张物化表 JOIN、聚合、子查询
-- 命名参数示例：WHERE o.status = :status LIMIT :limit OFFSET :skip`;

const PARAM_INTERFACE_PLACEHOLDER = `interface RequestParams {
  /** 分页条数 */
  limit?: number;
  /** 文件字段须填 storage objectId（UUID） */
  avatarId?: string; // @file storage objectId
}`;

const HANDLER_PLACEHOLDER = `export async function handler(ctx) {
  const { params, queryPg } = ctx;
  const rows = await queryPg('SELECT 1 AS ok', []);
  return { items: rows };
}`;

const CODE_SEGMENT_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

function codeToRoutePath(code: string) {
  return code.trim().split(':').join('/');
}

function buildPreviewCode(scopeCode?: string, serviceSlug?: string) {
  const scope = String(scopeCode || '').trim();
  const slug = String(serviceSlug || '').trim();
  if (!scope || !slug || !CODE_SEGMENT_RE.test(slug)) return '';
  return `${scope}:${slug}`;
}

export type ApiServiceAccessRestrictionMode = 'none' | 'role' | 'department';

export type ApiServiceFormValues = {
  primaryOperation?: string;
  scopeCode?: string;
  serviceSlug?: string;
  name?: string;
  tags?: string;
  transportProtocols?: ApiServiceTransportProtocol[];
  accessRestrictionMode?: ApiServiceAccessRestrictionMode;
  roleIds?: string[];
  departmentIds?: string[];
  scriptMode?: 'sql' | 'typescript';
};

export type ApiServiceFormProps = {
  form: FormInstance<ApiServiceFormValues>;
  mode: 'create' | 'edit';
  operationCatalog: API.ApiServiceOperationMeta[];
  definitionScript: string;
  onDefinitionScriptChange: (value: string) => void;
  handlerScript: string;
  onHandlerScriptChange: (value: string) => void;
  requestParameterInterface: string;
  onRequestParameterInterfaceChange: (value: string) => void;
  readonlyCode?: string;
  entityId?: string;
};

const ApiServiceForm: React.FC<ApiServiceFormProps> = ({
  form,
  mode,
  operationCatalog,
  definitionScript,
  onDefinitionScriptChange,
  handlerScript,
  onHandlerScriptChange,
  requestParameterInterface,
  onRequestParameterInterfaceChange,
  readonlyCode,
  entityId,
}) => {
  const { roleOptions, roleOptionsLoading } = useRoleOptions();
  const scopeCode = Form.useWatch('scopeCode', form);
  const serviceSlug = Form.useWatch('serviceSlug', form);
  const accessRestrictionMode = Form.useWatch('accessRestrictionMode', form);
  const scriptMode = Form.useWatch('scriptMode', form) || 'sql';
  const transportProtocols = Form.useWatch('transportProtocols', form) as ApiServiceTransportProtocol[] | undefined;

  const [resolvedConnection, setResolvedConnection] = useState<API.ApiServiceResolvedConnection | null>(null);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const operationSelectOptions = useMemo(() => {
    const groups = new Map<string, API.ApiServiceOperationMeta[]>();
    operationCatalog.forEach((item) => {
      const key = item.category || 'read';
      const list = groups.get(key) || [];
      list.push(item);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).map(([category, items]) => ({
      label: CATEGORY_LABEL[category] || category,
      options: items.map((item) => ({
        label: item.label || item.operation,
        value: item.operation,
      })),
    }));
  }, [operationCatalog]);

  const previewCode = useMemo(() => {
    if (mode === 'edit' && readonlyCode) return readonlyCode;
    return buildPreviewCode(scopeCode, serviceSlug);
  }, [mode, readonlyCode, scopeCode, serviceSlug]);

  useEffect(() => {
    if (!scopeCode) {
      setResolvedConnection(null);
      setResolveError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setResolveLoading(true);
      setResolveError(null);
      try {
        const res = await postApiServiceResolveConnection({
          scopeCode,
          entityId,
        });
        if (cancelled) return;
        if (!isApiSuccess(res)) {
          setResolvedConnection(null);
          setResolveError(getApiErrorMessage(res, '无法推断数据库连接'));
          return;
        }
        setResolvedConnection(getApiData<API.ApiServiceResolvedConnection>(res) || null);
      } catch (error) {
        if (!cancelled) {
          setResolvedConnection(null);
          setResolveError(getApiErrorMessage(error, '无法推断数据库连接'));
        }
      } finally {
        if (!cancelled) setResolveLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scopeCode, entityId]);

  const scriptHelp = scriptMode === 'typescript' ? HANDLER_SCRIPT_HELP : SQL_SCRIPT_HELP;

  const endpointPreview = useMemo(() => {
    const routePath = previewCode ? previewCode.split(':').join('/') : '';
    const protocols = normalizeTransportProtocols(transportProtocols);
    return buildTransportEndpointPreview(routePath, protocols);
  }, [previewCode, transportProtocols]);

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={24}>
            <ProFormSelect
              label="主操作类型"
              name="primaryOperation"
              rules={[{ required: true, message: '请选择主操作类型' }]}
              options={operationSelectOptions}
              fieldProps={{
                showSearch: true,
                placeholder: '选择 API 主操作（find / aggregate / create 等）',
                optionFilterProp: 'label',
              }}
            />
          </Col>
          <Col span={12}>
            <Form.Item
              label="数据模型 Scope"
              name="scopeCode"
              rules={[{ required: mode === 'create', message: '请选择 Scope' }]}
            >
              <ApiServiceScopeLookup />
            </Form.Item>
          </Col>
          <Col span={12}>
            <ProFormText
              label="服务短名"
              name="serviceSlug"
              rules={[
                { required: mode === 'create', message: '请输入服务短名' },
                {
                  pattern: CODE_SEGMENT_RE,
                  message: '须为字母开头且仅含字母数字下划线',
                },
              ]}
              fieldProps={{ placeholder: 'OrderSummary' }}
              tooltip="与 Scope 组合生成 code，如 sales:OrderSummary"
            />
          </Col>
          <Col span={24}>
            {previewCode ? (
              <Alert
                type="info"
                showIcon
                message={
                  <span>
                    服务 code：<Text code>{previewCode}</Text>
                    {' · '}
                    路径：<Text code>/api/v1/data/{codeToRoutePath(previewCode)}</Text>
                  </span>
                }
              />
            ) : (
              <Text type="secondary">选择 Scope 并填写服务短名后将自动生成 code</Text>
            )}
          </Col>
          <Col span={24} style={{ marginTop: 8 }}>
            {resolveLoading && <Spin size="small" description="正在推断数据库连接…" />}
            {!resolveLoading && scopeCode && resolvedConnection && (
              <Text type="secondary">
                将使用连接：{resolvedConnection.connectionName}（{resolvedConnection.dbType}，自动推断）
              </Text>
            )}
            {!resolveLoading && resolveError && (
              <Text type="danger">{resolveError}</Text>
            )}
          </Col>
          <Col span={12}>
            <ProFormText
              label="显示名称"
              name="name"
              placeholder="订单汇总 API"
              rules={[{ required: true, message: '请输入显示名称' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText label="标签" name="tags" placeholder="report, readonly（逗号分隔）" />
          </Col>
        </Row>
      </Card>

      <Card title="API 访问限制" style={{ marginBottom: 16 }}>
        <ProFormRadio.Group
          name="accessRestrictionMode"
          label="访问策略"
          options={[
            { label: '无限制', value: 'none' },
            { label: '限制用户角色', value: 'role' },
            { label: '限制用户组织', value: 'department' },
          ]}
        />
        {accessRestrictionMode === 'role' && (
          <ProFormSelect
            name="roleIds"
            label="允许的角色"
            mode="multiple"
            rules={[{ required: true, message: '请选择至少一个角色' }]}
            options={roleOptions}
            fieldProps={{
              loading: roleOptionsLoading,
              placeholder: '选择可访问该 API 的角色',
            }}
          />
        )}
        {accessRestrictionMode === 'department' && (
          <Form.Item
            name="departmentIds"
            label="允许的组织"
            rules={[{ required: true, message: '请选择至少一个组织' }]}
          >
            <DepartmentLookup />
          </Form.Item>
        )}
        <Text type="secondary">测试页发送测试请求时默认绕过访问限制</Text>
      </Card>

      <Card
        title={<TitleWithHelp title="访问协议" help={TRANSPORT_HELP} />}
        style={{ marginBottom: 16 }}
      >
        <ProFormCheckbox.Group
          name="transportProtocols"
          rules={[
            {
              validator: (_, value) => {
                const list = normalizeTransportProtocols(value as string[] | undefined);
                return list.length ? Promise.resolve() : Promise.reject(new Error('至少选择一种访问协议'));
              },
            },
          ]}
          options={API_SERVICE_TRANSPORT_OPTIONS.map((item) => ({
            label: (
              <span>
                {item.label}
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  {item.description}
                </Text>
              </span>
            ),
            value: item.value,
          }))}
        />
        {endpointPreview.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {endpointPreview.map((item) => (
              <div key={item.protocol} style={{ marginBottom: 4 }}>
                <Tag color="blue">{item.label}</Tag>
                <Text code copyable>{item.url}</Text>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title={<TitleWithHelp title="请求参数结构（TypeScript interface）" help={PARAM_INTERFACE_HELP} />}
        style={{ marginBottom: 16 }}
      >
        <Editor
          height="220px"
          language="typescript"
          value={requestParameterInterface}
          onChange={(val) => onRequestParameterInterfaceChange(val || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            wordWrap: 'on',
            placeholder: PARAM_INTERFACE_PLACEHOLDER,
          }}
        />
      </Card>

      <Card title="数据模型" style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
          点击右侧按钮添加 AI 引用，辅助推断实体与物化
        </Text>
        <DataModelReferenceTree />
      </Card>

      <Card
        title={<TitleWithHelp title="服务脚本" help={scriptHelp} />}
        style={{ marginBottom: 16 }}
        extra={
          <Form.Item name="scriptMode" noStyle>
            <Segmented
              options={[
                { label: 'SQL', value: 'sql' },
                { label: 'TypeScript Handler', value: 'typescript' },
              ]}
            />
          </Form.Item>
        }
      >
        {scriptMode === 'typescript' ? (
          <Editor
            height="320px"
            language="typescript"
            value={handlerScript}
            onChange={(val) => onHandlerScriptChange(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
              placeholder: HANDLER_PLACEHOLDER,
            }}
          />
        ) : (
          <Editor
            height="320px"
            language="sql"
            value={definitionScript}
            onChange={(val) => onDefinitionScriptChange(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
              placeholder: SQL_PLACEHOLDER,
            }}
          />
        )}
      </Card>
    </>
  );
};

export default ApiServiceForm;

export function buildAccessRestrictionPayload(values: ApiServiceFormValues): API.ApiServiceAccessRestriction {
  const mode = values.accessRestrictionMode || 'none';
  if (mode === 'role') {
    return { mode: 'role', roleIds: values.roleIds || [], departmentIds: [] };
  }
  if (mode === 'department') {
    return { mode: 'department', roleIds: [], departmentIds: values.departmentIds || [] };
  }
  return { mode: 'none', roleIds: [], departmentIds: [] };
}

export function parseTagsInput(tags?: string) {
  return tags
    ? String(tags)
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
}
