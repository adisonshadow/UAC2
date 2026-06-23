import {
  ActionType,
  BetaSchemaForm,
  PageContainer,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { Button, message, Space, Modal, Drawer, Spin, Radio, Typography } from 'antd';
import { EyeOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined } from "@ant-design/icons";
import React, { useRef, useState, useEffect } from "react";
import { 
  getRoles, 
  postRoles, 
  putRolesRoleId, 
  deleteRolesRoleId, 
  getRolesRoleId,
  postRolesRoleIdPermissions,
  putRolesRoleIdPermissions,
} from "@/services/UAC/api/roles";
import { getPermissions } from "@/services/UAC/api/permissions";
import { tableColumns, formFields, detailFields } from "./schema";
import { buildRoleTree } from "./utils";
import type { Role } from "./types";
import { useSetState } from "ahooks";
import SearchForm from '@/components/SearchForm';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import { Form } from 'antd';

const Page: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const highlightTimerRef = useRef<number | undefined>(undefined);
  const [editform] = Form.useForm();
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  // 递归获取所有角色的 ID
  const getAllRoleIds = (roles: Role[]): string[] => {
    return roles.reduce((acc: string[], role: Role) => {
      if (role.role_id) {
        acc.push(role.role_id);
      }
      if (role.children && role.children.length > 0) {
        acc.push(...getAllRoleIds(role.children));
      }
      return acc;
    }, []);
  };

  // 递归处理数据，添加搜索文本
  const processDataWithSearch = (data: Role[], searchText: string): Role[] => {
    return data.map(item => {
      const processedItem = {
        ...item,
        _searchText: searchText,
      };
      if (item.children && item.children.length > 0) {
        processedItem.children = processDataWithSearch(item.children, searchText);
      }
      return processedItem;
    });
  };

  const [state, setState] = useSetState<{
    isCreateModalOpen: boolean;
    createValue: Partial<Role>;
    isDetailsViewOpen: boolean;
    isDetailsEditable: boolean;
    detailsValue: Partial<Role> & { role_id?: string };
  }>({
    isCreateModalOpen: false,
    createValue: {},
    isDetailsViewOpen: false,
    isDetailsEditable: false,
    detailsValue: {},
  });

  const {
    isCreateModalOpen,
    createValue,
    isDetailsViewOpen,
    isDetailsEditable,
    detailsValue,
  } = state;

  const handleSearch = (value: string) => {
    setSearchText(value);
    if (actionRef.current) {
      actionRef.current.reload();
    }
  };

  const handleReset = () => {
    setSearchText('');
    if (actionRef.current) {
      actionRef.current.reload();
    }
  };

  // 获取权限列表
  const fetchPermissions = async () => {
    try {
      const response = await getPermissions({});
      if (response.code === 200 && response.data?.items) {
        return response.data.items.map((item:any) => ({
          label: item.name,
          value: item.permission_id,
        }));
      }
      return [];
    } catch (error) {
      console.error('获取权限列表失败:', error);
      return [];
    }
  };

  // 更新权限字段的 request 函数
  const updatePermissionsRequest = async () => {
    const permissions = await fetchPermissions();
    // 更新 schema 中的权限字段
    const permissionField = formFields.find(field => field.dataIndex === 'permissions');
    if (permissionField) {
      permissionField.request = async () => permissions;
    }
    return permissions;
  };

  // 处理保存详情
  const handleSaveDetails = async (values: any) => {
    try {
      setLoading(true);
      setSaving(true);
      if (!detailsValue.role_id) {
        messageApi.error('角色ID不存在');
        return;
      }

      // 更新基本信息
      const updateData = {
        role_name: values.role_name,
        description: values.description,
        status: values.status,
      };
      
      const response = await putRolesRoleId(
        { role_id: detailsValue.role_id },
        updateData
      );

      if (response.code && response.code >= 200 && response.code < 300) {
        // 更新权限
        if (values.permissions) {
          const currentPermissions = detailsValue.permissions?.map(p => p.permission_id) || [];
          const newPermissions = values.permissions;
          
          const addPermissions = newPermissions.filter((id: string) => !currentPermissions.includes(id));
          const removePermissions = currentPermissions.filter(id => !newPermissions.includes(id));

          if (addPermissions.length > 0 || removePermissions.length > 0) {
            await putRolesRoleIdPermissions(
              { role_id: detailsValue.role_id },
              {
                add_permissions: addPermissions,
                remove_permissions: removePermissions,
              }
            );
          }
        }

        messageApi.success('更新成功');
        setState({ 
          isDetailsEditable: false,
          detailsValue: { 
            ...detailsValue, 
            ...updateData,
            permissions: values.permissions ? 
              (await fetchPermissions()).filter(p => values.permissions.includes(p.value))
                .map(p => ({ permission_id: p.value, name: p.label, code: '' })) : 
              detailsValue.permissions,
          } as Role,
        });
        if (actionRef.current) {
          actionRef.current.reload();
        }
      } else {
        messageApi.error(response.message || '更新失败');
      }
    } catch (error) {
      console.error('更新角色信息失败:', error);
      messageApi.error('更新失败');
    } finally {
      setLoading(false);
      setSaving(false);
    }
  };

  // 在组件挂载时获取权限列表
  useEffect(() => {
    updatePermissionsRequest();
  }, []);

  // 添加操作列
  const columns: ProColumns<Role>[] = [
    {
      title: "角色名称",
      dataIndex: "role_name",
      width: 220,
      render: (dom: React.ReactNode, record: Role) => {
        const text = String(dom || '');
        const searchText = record._searchText || '';
        
        // 如果是虚拟节点，直接返回文本
        if (record.role_id.startsWith('virtual-')) {
          return text;
        }

        // 如果有搜索文本，添加高亮
        if (!searchText) return text;
        
        const index = text.toLowerCase().indexOf(searchText.toLowerCase());
        if (index === -1) return text;
        
        const beforeStr = text.substring(0, index);
        const matchStr = text.substring(index, index + searchText.length);
        const afterStr = text.substring(index + searchText.length);
        
        return (
          <span>
            {beforeStr}
            <span style={{ color: '#f50', backgroundColor: '#ffd591' }}>{matchStr}</span>
            {afterStr}
          </span>
        );
      },
    },
    {
      title: "角色编码",
      dataIndex: "code",
      width: 120,
      render: (dom: React.ReactNode, record: Role) => {
        const text = String(dom || '');
        const searchText = record._searchText || '';
        
        // 如果是虚拟节点，直接返回文本
        if (record.role_id.startsWith('virtual-')) {
          return text;
        }

        // 获取当前节点的层级
        const getNodeLevel = (node: Role): number => {
          let level = 0;
          let current = node;
          while (current.code.includes(':')) {
            level++;
            current = {
              ...current,
              code: current.code.substring(0, current.code.lastIndexOf(':')),
            };
          }
          return level;
        };

        // 获取当前层级对应的编码部分
        const getCurrentLevelCode = (code: string, level: number): string => {
          const parts = code.split(':');
          return parts[level] || code;
        };

        const nodeLevel = getNodeLevel(record);
        const displayCode = getCurrentLevelCode(text, nodeLevel);

        // 如果是禁用状态，添加删除线
        const content = record.status === 'ARCHIVED' ? (
          <Typography.Text delete>{displayCode}</Typography.Text>
        ) : displayCode;

        // 如果有搜索文本，添加高亮
        if (!searchText) return content;
        
        const index = displayCode.toLowerCase().indexOf(searchText.toLowerCase());
        if (index === -1) return content;
        
        const beforeStr = displayCode.substring(0, index);
        const matchStr = displayCode.substring(index, index + searchText.length);
        const afterStr = displayCode.substring(index + searchText.length);
        
        return (
          <span>
            {beforeStr}
            <span style={{ color: '#f50', backgroundColor: '#ffd591' }}>{matchStr}</span>
            {afterStr}
          </span>
        );
      },
    },
    ...tableColumns.filter((col: any) => !['role_name', 'code'].includes(col.dataIndex)),
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option' as const,
      width: 120,
      render: (_: unknown, record: Role) => {
        // 虚拟节点不显示操作按钮
        if (record.role_id.startsWith('virtual-')) {
          return null;
        }
        return [
          <Button
            title="查看"
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
                
                const response = await getRolesRoleId({
                  role_id: record.role_id,
                });
                
                if (response.code === 200 && response.data) {
                  const processedData = {
                    ...response.data,
                  } as Role;
                  
                  setTimeout(() => {
                    setState({
                      detailsValue: processedData,
                      isDetailsViewOpen: true,
                      isDetailsEditable: false,  // 默认是查看模式
                    });
                  }, 0);

                  editform.setFieldsValue(processedData);
                } else {
                  messageApi.error('获取角色详情失败');
                }
              } catch (error) {
                messageApi.error('获取角色详情失败');
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
            loading={deleteLoading}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: '确定要删除该角色吗？',
                onOk: async () => {
                  try {
                    setDeleteLoading(true);
                    const response = await deleteRolesRoleId({
                      role_id: record.role_id,
                    });
                    if (response.code && response.code >= 200 && response.code < 300) {
                      messageApi.success('删除角色成功');
                      if (actionRef.current) {
                        actionRef.current.reload();
                      }
                    } else {
                      messageApi.error(response.message || '删除失败');
                    }
                  } catch (error: any) {
                    const errMsg = error?.response?.data?.message || '删除失败';
                    messageApi.error(errMsg);
                  } finally {
                    setDeleteLoading(false);
                  }
                },
              });
            }}
          />,
        ];
      },
    },
  ];

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
          actionRef={actionRef}
          rowKey="role_id"
          onRow={(record) => ({
            id: `role-row-${record.role_id}`,
            style: {
              backgroundColor: record.status === 'ARCHIVED' ? '#f5f5f5' : 
                highlightedRowId === record.role_id && isHighlighted ? '#fffbe6' : undefined,
              transition: 'background-color 0.3s',
              opacity: record.status === 'ARCHIVED' ? 0.8 : 1,
            },
          })}
          search={false}
          headerTitle={
            <SearchForm
              key="search"
              onSearch={handleSearch}
              onReset={handleReset}
              placeholder="请输入角色名称"
            />
          }
          toolBarRender={() => [
            <Radio.Group
              key="status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                if (actionRef.current) {
                  actionRef.current.reload();
                }
              }}
              style={{ marginRight: 16 }}
            >
              <Radio.Button value="ACTIVE">有效角色</Radio.Button>
              <Radio.Button value="ALL">全部角色</Radio.Button>
            </Radio.Group>,
            <Button
              type="primary"
              key="create"
              icon={<PlusOutlined />}
              loading={createLoading}
              onClick={() => {
                setState({
                  isCreateModalOpen: true,
                  createValue: {
                    status: 'ACTIVE',
                  },
                });
              }}
            >
              新建
            </Button>
          ]}
          request={async () => {
            try {
              console.log('开始请求角色数据...');
              setLoading(true);
              const response = await getRoles({
                status: statusFilter === 'ALL' ? undefined : statusFilter,
              });

              if (response.code === 200 && response.data?.items) {
                // 转换 API 返回的数据格式，确保所有必需字段都有值
                const roles = response.data.items.map(item => ({
                  role_id: item.role_id || '',
                  role_name: item.role_name || '',
                  code: item.code || '',
                  description: item.description,
                  status: (item.status || 'ACTIVE') as 'ACTIVE' | 'ARCHIVED',
                  permissions: item.permissions?.map(p => ({
                    permission_id: p.permission_id || '',
                    name: p.name || '',
                    code: p.code || '',
                  })) || [],
                }));

                if (roles.length === 0) {
                  console.log('警告: API 返回的 items 数组为空');
                }

                // 构建树形数据
                const treeData = buildRoleTree(roles);
                console.log('树形数据构建完成:', treeData);
                
                if (treeData.length === 0) {
                  console.log('警告: 构建的树形数据为空');
                }

                // 设置所有角色的 ID 为展开状态
                const allIds = getAllRoleIds(treeData);
                setExpandedRowKeys(allIds);

                // 处理数据，添加搜索文本
                const processedData = processDataWithSearch(treeData, searchText);

                return {
                  data: processedData,
                  success: true,
                  total: processedData.length,
                };
              }
              
              console.log('API 响应异常:', {
                code: response.code,
                message: response.message,
                hasData: !!response.data,
                hasItems: !!response.data?.items,
              });
              
              messageApi.error(response.message || '获取角色列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            } catch (error) {
              console.error('获取角色数据时发生错误:', error);
              if (error instanceof Error) {
                console.error('错误详情:', {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                });
              }
              messageApi.error('获取角色列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            } finally {
              setLoading(false);
              console.log('请求完成，loading 状态已重置');
            }
          }}
          columns={columns}
          pagination={false}
          options={DEFAULT_PRO_TABLE_OPTIONS}
          expandable={{
            expandedRowKeys,
            onExpandedRowsChange: (expandedRows) => {
              setExpandedRowKeys(expandedRows as string[]);
            },
            childrenColumnName: 'children',
            indentSize: 20,
          }}
          loading={loading}
        />

        {/* 角色详情 */}
        {detailsValue?.role_id && (
          <Drawer
            key={`${detailsValue.role_id}-${isDetailsViewOpen}`}
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
            title={"角色详情 " + (detailsValue?.role_name || '')}
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
                      danger
                      ghost
                      icon={<DeleteOutlined />}
                      loading={deleteLoading}
                      onClick={() => {
                        if (!detailsValue?.role_id) return;
                        Modal.confirm({
                          title: '确认删除',
                          content: '确定要删除该角色吗？',
                          onOk: async () => {
                            try {
                              setDeleteLoading(true);
                              const response = await deleteRolesRoleId({
                                role_id: detailsValue.role_id,
                              });
                              if (response.code && response.code >= 200 && response.code < 300) {
                                messageApi.success('删除成功');
                                setState({ 
                                  isDetailsViewOpen: false,
                                  detailsValue: {},
                                  isDetailsEditable: false,
                                });
                                if (actionRef.current) {
                                  actionRef.current.reload();
                                }
                              } else {
                                messageApi.error(response.message || '删除失败');
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
              <BetaSchemaForm
                key={`form-${detailsValue.role_id}`}
                layoutType="Form"
                columns={isDetailsEditable ? formFields : detailFields}
                readonly={!isDetailsEditable}
                title={detailsValue.role_name}
                initialValues={{
                  ...detailsValue,
                  permissions: detailsValue.permissions?.map(p => p.permission_id),
                }}
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
            </Spin>
          </Drawer>
        )}

        {/* 新建角色 */}
        <Modal
          title="新建角色"
          open={isCreateModalOpen}
          onCancel={() => {
            setState({ 
              isCreateModalOpen: false,
              createValue: {},
            });
          }}
          footer={null}
          width={800}
        >
          <BetaSchemaForm
            layoutType="Form"
            columns={formFields}
            initialValues={createValue}
            grid={true}
            rowProps={{
              gutter: [16, 16],
            }}
            colProps={{
              span: 12,
            }}
            submitter={{
              searchConfig: {
                submitText: '创建',
              },
              submitButtonProps: {
                loading: createLoading,
              },
            }}
            onFinish={async (values: any) => {
              try {
                setCreateLoading(true);
                console.log('提交的表单数据:', values);
                const response = await postRoles({
                  role_name: values.role_name,
                  code: values.code,
                  description: values.description,
                  status: values.status,
                });
                
                console.log('提交到 API 的数据:', {
                  role_name: values.role_name,
                  code: values.code,
                  description: values.description,
                  status: values.status,
                });
                
                if (response.code && response.code >= 200 && response.code < 300) {
                  messageApi.success('创建成功');
                  setState({
                    isCreateModalOpen: false,
                    createValue: {},
                  });
                  if (actionRef.current) {
                    // 设置要高亮的行 ID
                    setHighlightedRowId(response.data?.role_id || null);
                    setIsHighlighted(true);
                    // 重新加载表格
                    actionRef.current.reload();
                    // 3秒后清除高亮状态
                    if (highlightTimerRef.current) {
                      window.clearTimeout(highlightTimerRef.current);
                    }
                    highlightTimerRef.current = window.setTimeout(() => {
                      setIsHighlighted(false);
                      setHighlightedRowId(null);
                    }, 3000);
                  }
                  return true;
                } else {
                  messageApi.error(response.message || '创建失败');
                  return false;
                }
              } catch (error: any) {
                messageApi.error(error.message || '创建失败');
                return false;
              } finally {
                setCreateLoading(false);
              }
            }}
          />
        </Modal>
      </PageContainer>
    </>
  );
};

export default Page; 