import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  LoadingOutlined,
  FileDoneOutlined,
} from "@ant-design/icons";
import {
  ActionType,
  BetaSchemaForm,
  PageContainer,
  ProTable,
  ProForm,
  ProFormText,
  ProFormTextArea,
  ProFormSelect,
  ProFormSwitch,
  ProFormDependency,
} from '@ant-design/pro-components';
import { useSetState } from "ahooks";
import { Button, Drawer, Modal, Spin, Space, message, Form, Typography, Upload } from 'antd';
import React, { useRef, useState, useEffect } from "react";
import { useLocation } from '@umijs/max';
import { tableColumns, applicationEditFormColumns } from "./Schemas";
import { getApplications, postApplications, putApplicationsId, deleteApplicationsId, getApplicationsId, postApplicationsIdGenerateSecret } from "@/services/UAC/api/applications";
import { postUploadsImage } from "@/services/UAC/api/uploads";
import { getImageUrlIfValid } from "@/utils/image";
import ImgCrop from 'antd-img-crop';
import { isApiSuccess, parseApiListResponse, getApiData } from '@/utils/apiResponse';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';

const { Text } = Typography;
const PAGE_SIZE: number = 30;

interface ApplicationRecord extends API.Application {
  application_id: string;
  api_connect_config?: API.APIConnectConfig;
  api_data_scope?: API.APIDataScope;
}

const Page: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [apiConfigModalVisible, setApiConfigModalVisible] = useState(false);
  const [ssoConfigModalVisible, setSsoConfigModalVisible] = useState(false);
  const [keyManagementModalVisible, setKeyManagementModalVisible] = useState(false);
  const [currentApplication, setCurrentApplication] = useState<ApplicationRecord | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoFileList, setLogoFileList] = useState<any[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [apiConfigForm] = Form.useForm();
  const [ssoConfigForm] = Form.useForm();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const currentPage = parseInt(query.get('page') || '1', 10);
  const [basicForm] = Form.useForm();


  useEffect(() => {
    // 

  }, []);

  const [state, setState] = useSetState<any>({
    tableColumns: [...tableColumns, {
      title: "操作",
      dataIndex: "option",
      valueType: "option",
      width: 120,
      render: (_: unknown, record: ApplicationRecord) => [
        <Button
          title="详情"
          key="view"
          type="primary"
          ghost
          icon={<EyeOutlined />}
          onClick={async () => {
            try {
              setLoading(true);
              setState({
                isDetailsViewOpen: false,
                detailsValue: {},
                isDetailsEditable: false,
              });
              
              const response = await getApplicationsId({
                id: record.application_id || '',
              });
              
              if (isApiSuccess(response)) {
                const data = getApiData<API.Application>(response);
                setTimeout(() => {
                  setState({
                    detailsValue: data ?? {},
                    isDetailsViewOpen: true,
                    isDetailsEditable: false,
                  });
                }, 0);
                basicForm.setFieldsValue(data ?? {});
              } else {
                messageApi.error('获取应用详情失败');
              }
            } catch (error) {
              messageApi.error('获取应用详情失败');
            } finally {
              setLoading(false);
            }
          }}
        />,
        <Button
          title="密钥管理"
          key="key-management"
          type="primary"
          ghost
          onClick={() => {
            setCurrentApplication(record);
            setKeyManagementModalVisible(true);
          }}
        >
          密钥
        </Button>,
        <Button
          title="API 配置"
          key="api-config"
          type="primary"
          ghost
          onClick={() => {
            setCurrentApplication(record);
            apiConfigForm.setFieldsValue({
              api_enabled: record.api_enabled,
              api_data_scope: record.api_data_scope,
            });
            setApiConfigModalVisible(true);
          }}
        >
          API
        </Button>,
        <Button
          title="SSO 配置"
          key="sso-config"
          type="primary"
          ghost
          onClick={() => {
            setCurrentApplication(record);
        ssoConfigForm.setFieldsValue({
          sso_enabled: record.sso_enabled,
          sso_config: {
            ...record.sso_config,
            redirect_mode: record.sso_config?.redirect_mode ?? 'POST_REDIRECT',
            base_url: window.location.origin, // 自动使用当前域名作为IAM系统URL
            client_id: record.code, // 使用应用代码作为客户端ID
            issuer: window.location.origin, // 使用当前域名作为发行者URL
            frontend_url: record.sso_config?.frontend_url,
            logo: record.sso_config?.logo,
          },
        });
        
        // 初始化logo文件列表
        if (record.sso_config?.logo) {
          const logoUrl = getImageUrlIfValid(record.sso_config.logo);
          setLogoFileList(logoUrl ? [
            {
              uid: '-1',
              name: 'logo',
              status: 'done',
              url: logoUrl,
            },
          ] : []);
        } else {
          setLogoFileList([]);
        }
        
            setSsoConfigModalVisible(true);
          }}
        >
          SSO
        </Button>,
        <Button
          title="删除"
          key="delete"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            Modal.confirm({
              title: '确认删除',
              content: '确定要删除该应用吗？',
              onOk: async () => {
                try {
                  await deleteApplicationsId({
                    id: record.application_id || '',
                  });
                  messageApi.success('删除成功');
                  if (actionRef.current) {
                    actionRef.current.reload();
                  }
                } catch (error) {
                  messageApi.error('删除失败');
                }
              },
            });
          }}
        />,
      ],
    }],
    isUpdate: false,
    isUpdateModalOpen: false,
    isDetailsViewOpen: false,
    isDetailsEditable: false,
    updateValue: {},
    detailsValue: {},
  });

  const {
    tableColumns: columns,
    isUpdate,
    isUpdateModalOpen,
    isDetailsViewOpen,
    isDetailsEditable,
    updateValue,
    detailsValue,
  } = state;

  const handleSaveDetails = async () => {
    try {
      setLoading(true);
      setSaving(true);
      
      // 获取表单的值
      const values = await basicForm.validateFields();
      
      const response = await putApplicationsId(
        { id: detailsValue.application_id },
        values
      );

      if (isApiSuccess(response)) {
        messageApi.success('更新成功');
        setState({ 
          isDetailsEditable: false,
          detailsValue: { 
            ...detailsValue, 
            ...values,
          },
        });
        if (actionRef.current) {
          actionRef.current.reload();
        }
      } else {
        messageApi.error(response.message || '更新失败');
      }
    } catch (error) {
      console.error('更新应用信息失败:', error);
      messageApi.error('更新失败');
    } finally {
      setLoading(false);
      setSaving(false);
    }
  };

  const saveApiConfig = async (values: any) => {
    try {
      const response = await putApplicationsId(
        { id: currentApplication?.application_id || '' },
        {
          api_enabled: values.api_enabled,
          api_data_scope: values.api_data_scope,
        }
      );

      if (isApiSuccess(response)) {
        messageApi.success('保存成功');
        setApiConfigModalVisible(false);
        if (actionRef.current) {
          actionRef.current.reload();
        }
      } else {
        messageApi.error(response.message || '保存失败');
      }
    } catch (error) {
      messageApi.error('保存失败');
    }
  };

  const handleSaveApiConfig = async () => {
    try {
      if (!currentApplication) return;
      
      const values = await apiConfigForm.validateFields();
      
      // 正常保存
      await saveApiConfig(values);
    } catch (error) {
      messageApi.error('保存失败');
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
          messageApi.success('生成统一密钥成功');
          if (actionRef.current) {
            actionRef.current.reload();
          }
        } else {
          messageApi.error('生成失败');
        }
      } else {
        messageApi.error((res as { message?: string }).message || '生成失败');
      }
    } catch (e) {
      messageApi.error('生成失败');
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
        logo: values.sso_config?.logo,
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
        messageApi.success('保存成功');
        setSsoConfigModalVisible(false);
        if (actionRef.current) {
          actionRef.current.reload();
        }
      } else {
        messageApi.error(response.message || '保存失败');
      }
    } catch (error) {
      messageApi.error('保存失败');
    }
  };

  const handleLogoChange = ({ fileList: newFileList, file }: any) => {
    // 只保留最新上传的文件
    const latestFile = newFileList[newFileList.length - 1];
    setLogoFileList(latestFile ? [latestFile] : []);
    
    if (file.status === 'done') {
      if (file.response?.code === 200) {
        messageApi.success('Logo上传成功');
        // 从响应中获取图片 ID
        const imageId = file.response.data?.id;
        if (imageId) {
          ssoConfigForm.setFieldValue(['sso_config', 'logo'], imageId);
        }
      } else {
        messageApi.error(file.response?.message || '上传失败');
      }
    } else if (file.status === 'error') {
      messageApi.error('上传失败');
    }
  };

  const handleLogoUpload = async ({ file, onSuccess, onError }: any) => {
    try {
      setLogoLoading(true);
      const response = await postUploadsImage({
        compress: true,
        format: 'webp',
        quality: 90,
        width: 200,
        height: 200,
      }, file as File);
      onSuccess?.(response);
    } catch (error: any) {
      onError?.(error);
      messageApi.error(error.message || '上传失败');
    } finally {
      setLogoLoading(false);
    }
  };

  const handleLogoBeforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      messageApi.error('只能上传图片文件！');
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      messageApi.error('图片大小不能超过 2MB！');
    }
    return isImage && isLt2M;
  };

  return (
    <PageContainer pageHeaderRender={() => {
      return <></>;
    }}>
      {contextHolder}
      <ProTable<ApplicationRecord, API.getApplicationsParams, API.Application>
        headerTitle="应用列表"
        actionRef={actionRef}
        rowKey="application_id"
        search={{
          labelWidth: 120,
        }}
        toolBarRender={() => [
          <Button
            key="button"
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => {
              setState({
                isUpdate: false,
                isUpdateModalOpen: true,
                updateValue: {},
              });
            }}
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
            frontend_url: item.sso_config.frontend_url,
            additional_params: item.sso_config.additional_params,
          } : undefined,
              api_connect_config: item.api_connect_config,
              api_data_scope: item.api_data_scope,
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
        pagination={{
          pageSize: PAGE_SIZE,
          current: currentPage,
        }}
        options={DEFAULT_PRO_TABLE_OPTIONS}
      />

      <Drawer
        title={isDetailsEditable ? "编辑应用" : "应用详情"}
        width={800}
        open={isDetailsViewOpen}
        onClose={() => {
          setState({
            isDetailsViewOpen: false,
            isDetailsEditable: false,
          });
        }}
        extra={
          <Space>
            {!isDetailsEditable ? (
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setState({
                    isDetailsEditable: true,
                  });
                }}
              >
                编辑
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => {
                    setState({
                      isDetailsEditable: false,
                    });
                  }}
                >
                  取消
                </Button>
                <Button
                  type="primary"
                  loading={saving}
                  onClick={handleSaveDetails}
                >
                  保存
                </Button>
              </>
            )}
          </Space>
        }
      >
        <Spin spinning={loading}>
          <Form.Provider>
            <ProForm
              form={basicForm}
              submitter={false}
              initialValues={detailsValue}
              disabled={!isDetailsEditable}
              grid={true}
              rowProps={{
                gutter: [16, 16],
              }}
              colProps={{
                span: 12,
              }}
            >
              <ProFormText
                name="name"
                label="应用名称"
                rules={[
                  { required: true, message: '请输入应用名称' },
                  { min: 2, message: '应用名称至少2个字符' },
                  { max: 50, message: '应用名称最多50个字符' },
                ]}
              />
              <ProFormText
                name="code"
                label="应用代码"
                rules={[
                  { required: true, message: '请输入应用代码' },
                  { pattern: /^[a-zA-Z0-9_-]+$/, message: '应用代码只能包含字母、数字、下划线和连字符' },
                ]}
              />
              <ProFormSelect
                name="status"
                label="状态"
                valueEnum={{
                  ACTIVE: { text: "启用", status: "Success" },
                  DISABLED: { text: "禁用", status: "Error" },
                }}
              />
              <ProFormTextArea
                name="description"
                label="描述"
                colProps={{
                  span: 24,
                }}
              />
            </ProForm>
          </Form.Provider>
        </Spin>
      </Drawer>

      <Modal
        title={isUpdate ? "编辑应用" : "新建应用"}
        open={isUpdateModalOpen}
        onCancel={() => {
          setState({
            isUpdateModalOpen: false,
            updateValue: {},
          });
        }}
        footer={null}
        destroyOnClose={true}
      >
        <BetaSchemaForm
          layout="vertical"
          columns={applicationEditFormColumns}
          initialValues={updateValue}
          submitter={{
            searchConfig: {
              submitText: isUpdate ? '保存' : '提交',
            },
            submitButtonProps: {
              loading: createLoading,
            },
          }}
          onFinish={async (values: {
            name: string;
            code: string;
            status?: 'ACTIVE' | 'DISABLED';
            sso_enabled?: boolean;
            sso_config?: API.SSOConfig;
            api_enabled?: boolean;
            api_connect_config?: API.APIConnectConfig;
            api_data_scope?: API.APIDataScope;
            description?: string;
          }) => {
            try {
              setCreateLoading(true);
              const response = await postApplications(values);
              if (isApiSuccess(response)) {
                messageApi.success('创建成功');
                setState({
                  isUpdateModalOpen: false,
                  updateValue: {},
                });
                actionRef.current?.reload();
                return true;
              }
              messageApi.error(
                (response as API.Application & { message?: string }).message || '创建失败',
              );
              return false;
            } catch (error) {
              messageApi.error('创建失败');
              return false;
            } finally {
              setCreateLoading(false);
            }
          }}
          grid={true}
          rowProps={{
            gutter: [16, 16],
          }}
          colProps={{
            span: 24,
          }}
        />
      </Modal>

      <Modal
        title="API 配置"
        open={apiConfigModalVisible}
        onCancel={() => setApiConfigModalVisible(false)}
        width={600}
        onOk={handleSaveApiConfig}
        okText="保存"
        cancelText="取消"
      >
        <ProForm
          form={apiConfigForm}
          submitter={false}
          grid={true}
          rowProps={{
            gutter: [16, 16],
          }}
          colProps={{
            span: 24,
          }}
        >
          <ProFormSwitch
            name="api_enabled"
            label="启用 API"
            colProps={{
              span: 24,
            }}
          />
          <ProFormDependency name={['api_enabled']}>
            {({ api_enabled }) => {
              if (!api_enabled) return null;
              return (
                <>
                  <ProFormTextArea
                    name="api_data_scope"
                    label="数据范围"
                    colProps={{
                      span: 24,
                    }}
                  />
                </>
              );
            }}
          </ProFormDependency>
        </ProForm>
      </Modal>

      <Modal
        title="API 配置"
        open={apiConfigModalVisible}
        onCancel={() => setApiConfigModalVisible(false)}
        width={600}
        onOk={handleSaveApiConfig}
        okText="保存"
        cancelText="取消"
      >
        <ProForm
          form={apiConfigForm}
          submitter={false}
          grid={true}
          rowProps={{
            gutter: [16, 16],
          }}
          colProps={{
            span: 24,
          }}
        >
          <ProFormSwitch
            name="api_enabled"
            label="启用 API"
            colProps={{
              span: 24,
            }}
          />
          <ProFormDependency name={['api_enabled']}>
            {({ api_enabled }) => {
              if (!api_enabled) return null;
              return (
                <>
                  <ProFormTextArea
                    name="api_data_scope"
                    label="数据范围"
                    colProps={{
                      span: 24,
                    }}
                  />
                </>
              );
            }}
          </ProFormDependency>
        </ProForm>
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
                    tooltip="SSO登录成功后的回调地址"
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
                  
                  {/* 业务系统配置 */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                      业务系统Logo
                    </label>
                    <ImgCrop rotationSlider>
                      <Upload
                        name="logo"
                        listType="picture-card"
                        fileList={logoFileList}
                        onChange={handleLogoChange}
                        customRequest={handleLogoUpload}
                        beforeUpload={handleLogoBeforeUpload}
                        maxCount={1}
                        hasControlInside={false}
                        pastable={false}
                        showUploadList={{
                          showPreviewIcon: true,
                          showRemoveIcon: true,
                        }}
                      >
                        {logoFileList.length >= 1 ? null : (
                          <div>
                            {logoLoading ? <LoadingOutlined /> : <PlusOutlined />}
                            <div style={{ marginTop: 8 }}>上传Logo</div>
                          </div>
                        )}
                      </Upload>
                    </ImgCrop>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
                      支持 jpg、png、gif 格式，大小不超过 2MB
                    </div>
                  </div>
                  
                  <ProFormText
                    name={['sso_config', 'frontend_url']}
                    label="业务系统URL"
                    placeholder="https://my-app.com"
                    tooltip="业务系统的访问地址，SSO登录成功后重定向回此地址"
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
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                      IAM系统URL
                    </label>
                    <Text 
                      copyable
                      style={{ fontSize: 14 }}
                    >
                      {window.location.origin}
                    </Text>
                  </div>
                  <div style={{ marginBottom: 16 }}>
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
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Page; 