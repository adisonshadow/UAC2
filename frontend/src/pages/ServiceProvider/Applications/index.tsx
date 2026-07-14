import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  FileDoneOutlined,
  PartitionOutlined,
  QuestionCircleOutlined,
  ApiOutlined,
  SecurityScanOutlined,
  UserSwitchOutlined,
  BulbOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import {
  ActionType,
  PageContainer,
  ProColumns,
  ProForm,
  ProFormText,
  ProFormTextArea,
  ProFormSelect,
  ProFormSwitch,
  ProFormDependency,
} from '@ant-design/pro-components';
import { UrlSyncedProTable } from '@/components/UrlSyncedProTable';
import { useSetState } from "ahooks";
import { Button, Modal, Space, Form, Typography, Tabs } from 'antd';
import { message, modal } from '@/utils/antdAppApis';
import { LinkOutlined } from '@ant-design/icons';
import React, { useRef, useState, useMemo, useEffect } from "react";
import { useAIChatPrompts, useChatReference } from '@EADAF/ai-base';
import { buildApplicationPrompts } from '@/ai/pageChatPrompts';
import { useNavigate } from 'react-router-dom';
import { tableColumns, SYSTEM_APPLICATION_CODE } from "./Schemas";
import { BizdataScopePickerModal } from '@/components/BizdataScopePicker';
import AppSecretUsageModal from './AppSecretUsageModal';
import {
  buildApiDataScopePayload,
  parseApiDataScopeValue,
  useApiDomainTreeData,
} from '@/components/ApiDomainTreePicker';
import SearchableScopeTree, { fromApiDomainTree, fromBuiltinApiTree } from '@/components/SearchableScopeTree';
import { getBuiltinApis, type BuiltinApiTreeNode } from '@/services/UAC/api/builtinApis';
import { buildApplicationApiDocsUrl } from '@/utils/applicationApiDocsUrl';
import { getApplications, putApplicationsId, deleteApplicationsId, postApplicationsIdGenerateSecret } from '@/services/UAC/api/applications';
import { isApiSuccess, parseApiListResponse, getApiData } from '@/utils/apiResponse';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import { useProTableSearchCollapse } from '@/hooks/useProTableSearchCollapse';
import { TableActionButton, TableActions, TABLE_ACTION_COLUMN_BASE } from '@/components/TableActions';
import { augmentColumnsWithChatReference } from '@/utils/augmentColumnsWithChatReference';
import { buildApplicationReference } from '@/ai/chatReferenceBuilders';

const { Text } = Typography;
const PAGE_SIZE: number = 30;

interface ApplicationRecord extends API.Application {
  application_id: string;
  api_connect_config?: API.APIConnectConfig;
  api_data_scope?: API.APIDataScope;
  builtin_api_scope?: API.BuiltinApiScope;
  bizdata_scope_codes?: string[];
}

const Page: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const navigate = useNavigate();
  const [apiConfigModalVisible, setApiConfigModalVisible] = useState(false);
  const [ssoConfigModalVisible, setSsoConfigModalVisible] = useState(false);
  const [keyManagementModalVisible, setKeyManagementModalVisible] = useState(false);
  const [secretUsageModalVisible, setSecretUsageModalVisible] = useState(false);
  const [scopeModalVisible, setScopeModalVisible] = useState(false);
  const [scopeSaving, setScopeSaving] = useState(false);
  const [currentApplication, setCurrentApplication] = useState<ApplicationRecord | null>(null);
  const [apiConfigForm] = Form.useForm();
  const apiEnabledInConfig = Form.useWatch('api_enabled', apiConfigForm);
  const [ssoConfigForm] = Form.useForm();
  const [apiScopeSelection, setApiScopeSelection] = useState<string[]>([]);
  const [builtinApiSelection, setBuiltinApiSelection] = useState<string[]>([]);
  const [builtinApiTree, setBuiltinApiTree] = useState<BuiltinApiTreeNode[]>([]);
  const [builtinApiTreeLoading, setBuiltinApiTreeLoading] = useState(false);
  const [activeApiTab, setActiveApiTab] = useState<'business' | 'builtin'>('business');
  // 业务 API 配置：展示具体 API（叶子），域节点可勾选并级联到子节点
  const apiDomainTree = useApiDomainTreeData({
    showApiSelectable: true,
    enabled: apiConfigModalVisible,
  });

  // 内置 API 树数据（自行加载，供 SearchableScopeTree 使用）
  useEffect(() => {
    if (!apiConfigModalVisible) return;
    let cancelled = false;
    const load = async () => {
      setBuiltinApiTreeLoading(true);
      try {
        const res = await getBuiltinApis();
        if (!cancelled && isApiSuccess(res)) {
          setBuiltinApiTree(getApiData(res)?.tree || []);
        }
      } catch {
        if (!cancelled) setBuiltinApiTree([]);
      } finally {
        if (!cancelled) setBuiltinApiTreeLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiConfigModalVisible]);

  const businessScopeTree = useMemo(
    () => fromApiDomainTree(apiDomainTree.treeData),
    [apiDomainTree.treeData],
  );
  const builtinScopeTree = useMemo(() => fromBuiltinApiTree(builtinApiTree), [builtinApiTree]);
  const { references } = useChatReference();
  const chatPrompts = useMemo(() => buildApplicationPrompts(references), [references]);
  useAIChatPrompts(chatPrompts);
  const search = useProTableSearchCollapse('service-provider.applications', { labelWidth: 120 });
  const apiDocsPreviewUrl = useMemo(
    () => (currentApplication?.code ? buildApplicationApiDocsUrl(currentApplication.code) : ''),
    [currentApplication?.code],
  );

  const [state, setState] = useSetState<any>({
    tableColumns: augmentColumnsWithChatReference<ApplicationRecord>(
      [
        ...(tableColumns as ProColumns<ApplicationRecord>[]),
        {
      ...TABLE_ACTION_COLUMN_BASE,
      dataIndex: "option",
      width: 180,
      render: (_: unknown, record: ApplicationRecord) => (
        <TableActions>
          <TableActionButton
            title="编辑"
            key="edit"
            icon={<EditOutlined />}
            onClick={() => navigate(`/service_provider/${record.application_id}/edit`)}
          />
          <TableActionButton
            title="顶层SKILL"
            key="top-level-skill"
            icon={<BulbOutlined />}
            onClick={() => navigate(`/service_provider/${record.application_id}/top-level-skill`)}
          />
          <TableActionButton
            title="密钥管理"
            key="key-management"
            icon={<SecurityScanOutlined />}
            onClick={() => {
              setCurrentApplication(record);
              setKeyManagementModalVisible(true);
            }}
          />
          <TableActionButton
            title="Scope 设置"
            key="scope-config"
            icon={<PartitionOutlined />}
            disabled={record.code === SYSTEM_APPLICATION_CODE}
            onClick={() => {
              setCurrentApplication(record);
              setScopeModalVisible(true);
            }}
          />
          <TableActionButton
            title="API 配置"
            key="api-config"
            icon={<ApiOutlined />}
            disabled={record.code === SYSTEM_APPLICATION_CODE}
            onClick={() => {
              setCurrentApplication(record);
              setApiScopeSelection(parseApiDataScopeValue(record.api_data_scope));
              setBuiltinApiSelection(record.builtin_api_scope?.permissionCodes ?? []);
              apiConfigForm.setFieldsValue({
                api_enabled: record.api_enabled,
              });
              setApiConfigModalVisible(true);
            }}
          />
          <TableActionButton
            title="SSO 配置"
            key="sso-config"
            icon={<UserSwitchOutlined />}
            disabled={record.code === SYSTEM_APPLICATION_CODE}
            onClick={() => {
              setCurrentApplication(record);
        ssoConfigForm.setFieldsValue({
          sso_enabled: record.sso_enabled,
          sso_config: {
            ...record.sso_config,
            redirect_mode: record.sso_config?.redirect_mode ?? 'POST_REDIRECT',
            base_url: window.location.origin,
            client_id: record.code,
            issuer: window.location.origin,
          },
        });

              setSsoConfigModalVisible(true);
            }}
          />
          <TableActionButton
            title="删除"
            key="delete"
            danger
            icon={<DeleteOutlined />}
            disabled={record.code === SYSTEM_APPLICATION_CODE}
            onClick={() => {
            if (record.code === SYSTEM_APPLICATION_CODE) {
              message.warning('系统内置应用不可删除');
              return;
            }
            modal.confirm({
              title: '确认删除',
              content: '确定要删除该应用吗？',
              onOk: async () => {
                try {
                  await deleteApplicationsId({
                    id: record.application_id || '',
                  });
                  message.success('删除成功');
                  if (actionRef.current) {
                    actionRef.current.reload();
                  }
                } catch (error) {
                  message.error('删除失败');
                }
              },
            });
          }}
          />
        </TableActions>
      ),
    },
      ],
      'name',
      buildApplicationReference,
    ),
  });

  const { tableColumns: columns } = state;

  const saveApiConfig = async (values: { api_enabled?: boolean }) => {
    try {
      const response = await putApplicationsId(
        { id: currentApplication?.application_id || '' },
        {
          api_enabled: values.api_enabled,
          api_data_scope: buildApiDataScopePayload(apiScopeSelection, apiDomainTree.domainCodes),
          // 系统应用拥有全部内置 API，不发送 builtin_api_scope（避免清空语义混淆）
          ...(currentApplication?.code === SYSTEM_APPLICATION_CODE
            ? {}
            : { builtin_api_scope: { permissionCodes: builtinApiSelection } }),
        }
      );

      if (isApiSuccess(response)) {
        message.success('保存成功');
        setApiConfigModalVisible(false);
        if (actionRef.current) {
          actionRef.current.reload();
        }
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleSaveApiConfig = async () => {
    try {
      if (!currentApplication) return;
      
      const values = await apiConfigForm.validateFields();
      
      // 正常保存
      await saveApiConfig(values);
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleGenerateAppSecret = async () => {
    try {
      if (!currentApplication) return;

      const res = await postApplicationsIdGenerateSecret(
        { id: currentApplication.application_id },
        {}
      );

      if (isApiSuccess(res)) {
        const secret = getApiData<{ app_secret?: string }>(res)?.app_secret;
        if (secret) {
          setCurrentApplication({
            ...currentApplication,
            api_connect_config: {
              app_secret: secret,
            },
            sso_config: {
              ...currentApplication.sso_config,
              protocol: 'OIDC',
              redirect_uri: currentApplication.sso_config?.redirect_uri || '',
              client_secret: secret,
            },
          });
          message.success('生成统一密钥成功');
          if (actionRef.current) {
            actionRef.current.reload();
          }
        } else {
          message.error('生成失败');
        }
      } else {
        message.error((res as { message?: string }).message || '生成失败');
      }
    } catch (e) {
      message.error('生成失败');
    }
  };

  const handleSaveSsoConfig = async () => {
    try {
      if (!currentApplication) return;
      
      const values = await ssoConfigForm.validateFields();
      
      // 构建SSO配置，包含自动生成的字段
      const ssoConfig = {
        ...currentApplication.sso_config,
        ...values.sso_config,
        protocol: 'OIDC',
        base_url: window.location.origin,
        client_id: currentApplication.code,
        issuer: window.location.origin,
        client_secret: currentApplication.sso_config?.client_secret
          || currentApplication.api_connect_config?.app_secret,
      };
      
      const response = await putApplicationsId(
        { id: currentApplication.application_id || '' },
        {
          sso_enabled: values.sso_enabled,
          sso_config: ssoConfig,
        }
      );

      if (isApiSuccess(response)) {
        message.success('保存成功');
        setSsoConfigModalVisible(false);
        if (actionRef.current) {
          actionRef.current.reload();
        }
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      message.error('保存失败');
    }
  };

  return (
    <PageContainer pageHeaderRender={() => {
      return <></>;
    }}>
      <UrlSyncedProTable<ApplicationRecord, API.getApplicationsParams, API.Application>
        defaultPageSize={PAGE_SIZE}
        headerTitle="应用列表"
        actionRef={actionRef}
        rowKey="application_id"
        scroll={{ x: 'max-content' }}
        search={search}
        toolBarRender={() => [
          <Button
            key="button"
            icon={<PlusOutlined />}
            type="primary" className="btn-gradient-primary"
            onClick={() => navigate('/service_provider/create')}
          >
            新建
          </Button>,
        ]}
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          try {
            const response = await getApplications({
              page: current,
              size: pageSize,
              ...rest,
            });
            const { items, total, success } = parseApiListResponse<API.Application>(response);
            const mappedItems = items.map((item: API.Application) => ({
              ...item,
              application_id: item.application_id || '',
          sso_config: item.sso_config ? {
            ...item.sso_config,
            redirect_uri: item.sso_config.redirect_uri,
            redirect_mode: item.sso_config.redirect_mode || 'POST_REDIRECT',
            salt: item.sso_config.salt,
            base_url: item.sso_config.base_url,
            client_id: item.sso_config.client_id,
            client_secret: item.sso_config.client_secret,
            issuer: item.sso_config.issuer,
            additional_params: item.sso_config.additional_params,
          } : undefined,
              api_connect_config: item.api_connect_config,
              api_data_scope: item.api_data_scope,
              builtin_api_scope: item.builtin_api_scope,
            } as ApplicationRecord));
            return {
              data: mappedItems,
              success,
              total,
            };
          } catch (error) {
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        columns={columns}
        options={DEFAULT_PRO_TABLE_OPTIONS}
      />

      <Modal
        title="API 配置"
        open={apiConfigModalVisible}
        onCancel={() => setApiConfigModalVisible(false)}
        width={640}
        onOk={handleSaveApiConfig}
        okText="保存"
        cancelText="取消"
        centered
        destroyOnHidden
      >
        <ProForm
          form={apiConfigForm}
          submitter={false}
          layout="horizontal"
        >
          <ProFormSwitch
            name="api_enabled"
            label="启用 API"
          />
          {apiEnabledInConfig ? (
            <Tabs
              activeKey={activeApiTab}
              onChange={(k) => setActiveApiTab(k as 'business' | 'builtin')}
              items={[
                {
                  key: 'business',
                  label: '业务API配置',
                  children: (
                    <SearchableScopeTree
                      treeData={businessScopeTree}
                      value={apiScopeSelection}
                      onChange={setApiScopeSelection}
                      loading={apiDomainTree.loading}
                      valueStrategy="all"
                      emptyText="暂无 API 域，请先在 API 服务中创建服务"
                      searchPlaceholder="检索域 / API 名称"
                    />
                  ),
                },
                ...(currentApplication?.code === SYSTEM_APPLICATION_CODE
                  ? []
                  : [
                      {
                        key: 'builtin',
                        label: '内置API配置',
                        children: (
                          <SearchableScopeTree
                            treeData={builtinScopeTree}
                            value={builtinApiSelection}
                            onChange={setBuiltinApiSelection}
                            loading={builtinApiTreeLoading}
                            valueStrategy="leaf"
                            emptyText="暂无内置 API 清单"
                            searchPlaceholder="检索内置 API 名称 / code"
                          />
                        ),
                      },
                    ]),
              ]}
            />
          ) : null}
        </ProForm>
        {apiEnabledInConfig && apiDocsPreviewUrl ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              <span style={{ marginRight: 8 }}>API 地址</span>
              <Typography.Link href={apiDocsPreviewUrl} target="_blank" rel="noopener noreferrer">
                <EyeOutlined /> 打开 API 文档
              </Typography.Link>
            </div>
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Paragraph copyable={{ text: apiDocsPreviewUrl }} style={{ marginBottom: 0 }}>
                <LinkOutlined /> {apiDocsPreviewUrl}
              </Typography.Paragraph>
            </Space>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="SSO 配置"
        open={ssoConfigModalVisible}
        onCancel={() => setSsoConfigModalVisible(false)}
        width={800}
        onOk={handleSaveSsoConfig}
        okText="保存"
        cancelText="取消"
      >
        <ProForm
          form={ssoConfigForm}
          submitter={false}
          grid={true}
          rowProps={{
            gutter: [16, 16],
          }}
          colProps={{
            span: 12,
          }}
        >
          <ProFormSwitch
            name="sso_enabled"
            label="启用 SSO"
            colProps={{
              span: 24,
            }}
          />
          <ProFormDependency name={['sso_enabled']}>
            {({ sso_enabled }) => {
              if (!sso_enabled) return null;
              return (
                <>
                  {/* 基础配置 */}
                  <ProFormText
                    name={['sso_config', 'redirect_uri']}
                    label="重定向 URI"
                    rules={[{ required: true, message: '请输入重定向 URI' }]}
                    placeholder="https://your-app.com/auth/callback"
                    tooltip="SSO 登录成功后，将携带 Token 跳转到此地址（POST 或 302 方式由跳转模式决定）"
                  />
                  <ProFormSelect
                    name={['sso_config', 'redirect_mode']}
                    label="跳转模式"
                    valueEnum={{
                      'POST_REDIRECT': 'POST 跳转',
                      'HEADER_REDIRECT': '302 重定向 + URL参数',
                    }}
                    initialValue="POST_REDIRECT"
                    tooltip="POST跳转模式：JWT信息在请求体中传递；302重定向模式：JWT信息在URL参数中传递"
                  />

                  {/* 额外参数 */}
                  <ProFormTextArea
                    name={['sso_config', 'additional_params']}
                    label="额外参数"
                    placeholder='{"scope": "openid profile email", "response_type": "code"}'
                    tooltip="其他SSO协议特定的参数，JSON格式"
                    colProps={{
                      span: 24,
                    }}
                    rows={3}
                  />
                  
                  {/* OIDC配置 - 移到额外参数下面 */}
                  <div style={{ marginBottom: 16, marginRight: 20 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                      客户端ID
                    </label>
                    <Text 
                      copyable
                      style={{ fontSize: 14 }}
                    >
                      {currentApplication?.code}
                    </Text>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                      发行者URL
                    </label>
                    <Text 
                      copyable
                      style={{ fontSize: 14 }}
                    >
                      {window.location.origin}
                    </Text>
                  </div>
                </>
              );
            }}
          </ProFormDependency>
        </ProForm>
      </Modal>

      <Modal
        title="密钥管理"
        open={keyManagementModalVisible}
        onCancel={() => setKeyManagementModalVisible(false)}
        width={600}
        footer={null}
      >
        <div style={{ padding: '20px 0' }}>
          
          <div style={{ marginBottom: 20 }}>
            {(currentApplication?.api_connect_config?.app_secret
              || currentApplication?.sso_config?.client_secret) ? (
              <>
                <h5><FileDoneOutlined /> 已经生成的密钥</h5>
                <Text
                  copyable
                  style={{ fontSize: 14 }}
                >
                  {currentApplication?.api_connect_config?.app_secret
                    || currentApplication?.sso_config?.client_secret}
                </Text>
              </>
            ) : null}
            <div style={{ marginTop: 10 }}>
              <Button 
                type="primary" 
                onClick={handleGenerateAppSecret}
              >
                生成密钥
              </Button>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
              此密钥同时用于API认证和SSO认证
            </div>
            <div style={{ marginTop: 12 }}>
              <Button icon={<QuestionCircleOutlined />} onClick={() => setSecretUsageModalVisible(true)}>
                密钥使用说明
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <AppSecretUsageModal
        open={secretUsageModalVisible}
        application={currentApplication}
        onClose={() => setSecretUsageModalVisible(false)}
      />

      <BizdataScopePickerModal
        open={scopeModalVisible}
        title={currentApplication ? `Scope 设置 - ${currentApplication.name}` : 'Scope 设置'}
        value={currentApplication?.bizdata_scope_codes || []}
        onCancel={() => setScopeModalVisible(false)}
        onOk={async (codes) => {
          if (!currentApplication?.application_id) return;
          try {
            setScopeSaving(true);
            const res = await putApplicationsId(
              { id: currentApplication.application_id },
              { bizdata_scope_codes: codes },
            );
            if (isApiSuccess(res)) {
              message.success('Scope 已保存');
              setScopeModalVisible(false);
              actionRef.current?.reload();
            } else {
              message.error('保存失败');
            }
          } catch {
            message.error('保存失败');
          } finally {
            setScopeSaving(false);
          }
        }}
      />
    </PageContainer>
  );
};

export default Page; 