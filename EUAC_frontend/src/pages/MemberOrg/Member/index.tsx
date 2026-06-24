import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SaveOutlined,
  CloseOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import {
  ActionType,
  BetaSchemaForm,
  PageContainer,
  ProTable,
} from '@ant-design/pro-components';
import { useSetState } from "ahooks";
import { Button, Drawer, Modal, Spin, Space, message, Form, Input } from 'antd';
import React, { useRef, useState } from "react";
import { history } from '@/utils/navigation';
import { useLocation } from 'react-router-dom';
import { useInitialState } from '@/providers/InitialStateProvider';
import { tableColumns, userDetailFormColumns, userEditFormColumns, useDepartmentOptions } from "./Schemas";
import { getUsers, postUsers, putUsersUserId, deleteUsersUserId, getUsersUserId } from "@/services/UAC/api/users";
import { getDepartmentPath } from '@/utils/department';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';

const PAGE_SIZE: number = 30;

interface UserRecord {
  user_id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  status: string;
  department_id: string;
  created_at: string;
  updated_at: string;
  avatar?: string;
  gender?: string;
}

const Page: React.FC = () => {
  const { initialState } = useInitialState();
  const departmentOptions = useDepartmentOptions();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const currentPage = parseInt(query.get('page') || '1', 10);
  const [editform] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  // 生成6位随机数字密码
  const generateRandomPassword = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const [state, setState] = useSetState<any>({
    tableColumns: [...tableColumns, {
      title: "操作",
      dataIndex: "option",
      valueType: "option",
      width: 120,
      render: (_: unknown, record: UserRecord) => [
        <Button
          title="详情"
          key="view"
          type="primary"
          ghost
          icon={<EyeOutlined />}
          onClick={async () => {
            try {
              setLoading(true);
              // 先关闭抽屉，确保状态被重置
              setState({
                isDetailsViewOpen: false,
                detailsValue: {},
                isDetailsEditable: false,
              });
              
              const response = await getUsersUserId({
                user_id: record.user_id,
              });
              
              if (response.code === 200 && response.data) {
                const processedData = {
                  ...response.data,
                  // 获取部门路径（从根部门到当前部门的所有部门ID）
                  department_id: getDepartmentPath(response.data.department_id || '', initialState?.departments || []),
                };
                console.log('processedData', processedData);
                // 使用 setTimeout 确保状态更新和抽屉重新打开的顺序
                setTimeout(() => {
                  setState({
                    detailsValue: processedData,
                    isDetailsViewOpen: true,
                    isDetailsEditable: false,
                  });
                }, 0);

                // 强制更新表单字段值
                /* 【 不可以删除 】
                * 在使用 Ant Design 的 BetaSchemaForm 时，initialValues 是用于初始化表单数据的，它只会在表单组件首次渲染时生效。当外部的 detailsValue 更新后，表单不会自动同步这些变化，主要有以下原因：
                * - 单向数据流机制：React 组件遵循单向数据流，initialValues 的更新不会触发表单内部状态的更新
                * - 表单状态隔离：BetaSchemaForm 内部维护自己的状态，初始值设置后就与外部数据解耦了
                */
                editform.setFieldsValue(processedData);

              } else {
                messageApi.error('获取用户详情失败');
              }
            } catch (error) {
              messageApi.error('获取用户详情失败');
            } finally {
              setLoading(false);
            }
          }}
        />,
        <Button
          title="删除"
          key="delete"
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            Modal.confirm({
              title: '确认删除',
              content: '确定要删除该成员吗？',
              onOk: async () => {
                try {
                  await deleteUsersUserId({
                    user_id: record.user_id,
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
    isPasswordModalOpen: false,
    generatedPassword: '',
    isResetPasswordModalOpen: false,
  });

  const {
    tableColumns: columns,
    isUpdate,
    isUpdateModalOpen,
    isDetailsViewOpen,
    isDetailsEditable,
    updateValue,
    detailsValue,
    isPasswordModalOpen,
    generatedPassword,
    isResetPasswordModalOpen,
  } = state;

  const handleSaveDetails = async (values: any) => {
    try {
      setLoading(true);
      setSaving(true);
      const updateData = {
        name: values.name,
        email: values.email,
        avatar: values.avatar,
        gender: values.gender,
        phone: values.phone,
        status: values.status,
        department_id: Array.isArray(values.department_id) ? values.department_id[values.department_id.length - 1] : values.department_id,
      };
      
      const response = await putUsersUserId(
        { user_id: detailsValue.user_id },
        updateData
      );

      if (response.code === 200) {
        messageApi.success('更新成功');
        setState({ 
          isDetailsEditable: false,
          detailsValue: { 
            ...detailsValue, 
            ...updateData,
          },
        });
        if (actionRef.current) {
          actionRef.current.reload();
        }
      } else {
        messageApi.error(response.message || '更新失败');
      }
    } catch (error) {
      console.error('更新用户信息失败:', error);
      messageApi.error('更新失败');
    } finally {
      setLoading(false);
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setResetPasswordLoading(true);
      const newPassword = generateRandomPassword();
      const response = await putUsersUserId(
        { user_id: detailsValue.user_id },
        { password: newPassword } as any
      );

      if (response.code === 200) {
        setState({
          isResetPasswordModalOpen: true,
          generatedPassword: newPassword,
        });
        messageApi.success('密码重置成功');
      } else {
        messageApi.error(response.message || '密码重置失败');
      }
    } catch (error) {
      messageApi.error('密码重置失败');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // 修改表单列配置，注入部门选项
  const getFormColumns = (columns: any[]) => {
    return columns.map(column => {
      if (column.dataIndex === 'department_id') {
        return {
          ...column,
          fieldProps: {
            ...column.fieldProps,
            options: departmentOptions,
          },
        };
      }
      return column;
    });
  };

  return (
    <>
      {contextHolder}
      <PageContainer
        pageHeaderRender={() => {
          return <></>;
        }}
      >
        <ProTable
          defaultSize="small"
          headerTitle="成员列表"
          actionRef={actionRef}
          rowKey="user_id"
          search={{
            labelWidth: 'auto',
            defaultCollapsed: false,
          }}
          toolBarRender={() => [
            <Button
              type="primary"
              key="create"
              icon={<PlusOutlined />}
              loading={createLoading}
              onClick={() => {
                setState({
                  isUpdate: false,
                  isUpdateModalOpen: true,
                  updateValue: {
                    status: 'ACTIVE', // 新建用户，默认状态为在职
                  }
                });
              }}
            >
              新建
            </Button>,
            // <Button
            //   type="primary"
            //   key="sync"
            //   ghost
            //   icon={<RedoOutlined />}
            //   loading={loading}
            //   onClick={() => {
            //     if (actionRef.current) {
            //       actionRef.current.reload();
            //       messageApi.success('同步成功');
            //     }
            //   }}
            // >
            //   批量导入
            // </Button>,
          ]}
          request={async (params:any) => {
            try {
              // 更新 URL 参数
              const newQuery = new URLSearchParams(location.search);
              newQuery.set('page', params.current?.toString() || '1');
              history.push(`${location.pathname}?${newQuery.toString()}`);

              // 处理部门 ID
              const department_id = Array.isArray(params.department_id) 
                ? params.department_id[params.department_id.length - 1] 
                : params.department_id;

              const response = await getUsers({
                size: PAGE_SIZE,
                page: params.current,
                user_id: params.user_id,
                username: params.username,
                name: params.name,
                email: params.email,
                phone: params.phone,
                status: params.status,
                gender: params.gender,
                department_id,
              });
              if (response.code === 200 && response.data) {
                return {
                  data: response.data.items || [],
                  success: true,
                  total: response.data.total || 0,
                };
              }
              return {
                data: [],
                success: false,
                total: 0,
              };
            } catch (error) {
              messageApi.error('获取成员列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          columns={columns.map((column: any) => {
            if (column.dataIndex === 'department_id') {
              return {
                ...column,
                fieldProps: {
                  ...column.fieldProps,
                  options: departmentOptions,
                },
              };
            }
            return column;
          })}
          pagination={{
            pageSize: PAGE_SIZE,
            showQuickJumper: false,
            showSizeChanger: false,
            current: currentPage,
          }}
          options={DEFAULT_PRO_TABLE_OPTIONS}
        />

        {/* 新建用户 */}
        <Modal
          title={isUpdate ? "编辑" : "新建"}
          open={isUpdateModalOpen}
          onCancel={() => {
            setState({ isUpdateModalOpen: false });
          }}
          footer={null}
          width={800}
        >
          <BetaSchemaForm
            layoutType = "Form"
            columns={getFormColumns(userEditFormColumns)}
            initialValues={updateValue}
            grid={true}
            rowProps={{
              gutter: [16, 16],
            }}
            colProps={{
              span: 12,
            }}
            onFinish={async (value: any) => {
              try {
                setCreateLoading(true);
                if (isUpdate) {
                  await putUsersUserId({
                    user_id: updateValue.user_id,
                  }, {
                    status: value.status,
                  });
                  messageApi.success('更新成功');
                } else {
                  const password = generateRandomPassword();
                  
                  // 处理表单数据
                  const processedValue = Object.entries(value).reduce((acc, [key, val]) => {
                    // 对字符串类型的值进行trim
                    if (typeof val === 'string') {
                      acc[key] = val.trim();
                    }
                    // 处理department_id数组
                    else if (key === 'department_id' && Array.isArray(val)) {
                      acc[key] = val[val.length - 1];
                    }
                    // 其他类型的值保持不变
                    else {
                      acc[key] = val;
                    }
                    return acc;
                  }, {} as Record<string, any>);

                  // 确保包含必需的字段
                  const userData = {
                    username: processedValue.username || '',
                    password,
                    name: processedValue.name || '',
                    email: processedValue.email,
                    phone: processedValue.phone,
                    gender: processedValue.gender,
                    department_id: processedValue.department_id,
                    role_ids: processedValue.role_ids,
                  };

                  const response = await postUsers(userData);
                  
                  if (response.code === 200) {
                    setState({
                      isUpdateModalOpen: false,
                      isPasswordModalOpen: true,
                      generatedPassword: password,
                    });
                    if (actionRef.current) {
                      actionRef.current.reload();
                    }
                  } else {
                    messageApi.error(response.message || '创建失败');
                  }
                }
              } catch (error: any) {
                messageApi.error(error.message || (isUpdate ? '更新失败' : '创建失败'));
              } finally {
                setCreateLoading(false);
              }
            }}
          />
        </Modal>

        {/* 用户创建成功提示 */}
        <Modal
          title="用户创建成功"
          open={isPasswordModalOpen}
          onCancel={() => {
            setState({ isPasswordModalOpen: false });
          }}
          footer={[
            <Button
              key="close"
              onClick={() => {
                setState({ isPasswordModalOpen: false });
              }}
            >
              关闭
            </Button>
          ]}
        >
          <p>用户创建成功！请记录以下初始密码：</p>
          <Space>
            <Input.Password
              value={generatedPassword}
              readOnly
              style={{ width: '200px' }}
            />
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(generatedPassword);
                messageApi.success('密码已复制到剪贴板');
              }}
            >
              复制
            </Button>
          </Space>
          <p style={{ marginTop: '16px', color: '#ff4d4f' }}>
            注意：请妥善保管此密码，建议用户首次登录后立即修改密码。
          </p>
        </Modal>
        
        {/* 用户详情 */}
        <Drawer
          key={detailsValue.user_id + isDetailsViewOpen}  // 添加 key 属性，强制 Drawer 重新渲染
          width={800}
          forceRender={true}
          open={isDetailsViewOpen}
          destroyOnHidden={true}
          onClose={() => {
            setState({ 
              isDetailsViewOpen: false,
              isDetailsEditable: false,
              detailsValue: {},
            });
          }}
          title= {"用户详情 "+detailsValue.name}
          extra={
            <Space>
              {isDetailsEditable ? (
                <>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving}
                    onClick={() => {
                      editform.submit();
                    }}
                  >
                    保存
                  </Button>
                  <Button
                    icon={<CloseOutlined />}
                    onClick={() => {
                      setState({ isDetailsEditable: false });
                    }}
                  >
                    取消
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setState({ isDetailsEditable: true });
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    type="primary"
                    danger
                    ghost
                    loading={resetPasswordLoading}
                    onClick={handleResetPassword}
                  >
                    重置密码
                  </Button>
                  <Button
                    danger
                    ghost
                    icon={<DeleteOutlined />}
                    loading={deleteLoading}
                    onClick={() => {
                      Modal.confirm({
                        title: '确认删除',
                        content: '确定要删除该成员吗？',
                        onOk: async () => {
                          try {
                            setDeleteLoading(true);
                            await deleteUsersUserId({
                              user_id: detailsValue.user_id,
                            });
                            messageApi.success('删除成功');
                            setState({ 
                              isDetailsViewOpen: false,
                              detailsValue: {},
                              isDetailsEditable: false,
                            });
                            if (actionRef.current) {
                              actionRef.current.reload();
                            }
                          } catch (error) {
                            messageApi.error('删除失败');
                          } finally {
                            setDeleteLoading(false);
                          }
                        },
                      });
                    }}
                  >
                    删除
                  </Button>
                </>
              )}
            </Space>
          }
        >
          <Spin spinning={loading}>
            {detailsValue?.user_id && (
              <BetaSchemaForm
                key={`form-` + detailsValue.user_id} // 添加 key 属性，强制 Form 重新渲染
                layoutType="Form"
                columns={isDetailsEditable ? getFormColumns(userEditFormColumns) : getFormColumns(userDetailFormColumns)}
                readonly={!isDetailsEditable}
                title={detailsValue.username}
                initialValues={detailsValue}
                grid={true}
                rowProps={{
                  gutter: [16, 16],
                }}
                colProps={{
                  span: 12,
                }}
                onFinish={handleSaveDetails}
                submitter={false}
                form={editform}
              />
            )}
          </Spin>
        </Drawer>

        {/* 密码重置成功提示 */}
        <Modal
          title="密码重置成功"
          open={isResetPasswordModalOpen}
          onCancel={() => {
            setState({ isResetPasswordModalOpen: false });
          }}
          footer={[
            <Button
              key="close"
              onClick={() => {
                setState({ isResetPasswordModalOpen: false });
              }}
            >
              关闭
            </Button>
          ]}
        >
          <p>密码重置成功！请记录以下新密码：</p>
          <Space>
            <Input.Password
              value={generatedPassword}
              readOnly
              style={{ width: '200px' }}
            />
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(generatedPassword);
                messageApi.success('密码已复制到剪贴板');
              }}
            >
              复制
            </Button>
          </Space>
          <p style={{ marginTop: '16px', color: '#ff4d4f' }}>
            注意：请妥善保管此密码，建议用户首次登录后立即修改密码。
          </p>
        </Modal>
      </PageContainer>
    </>
  );
};

export default Page;
