import React, { useRef, useState } from 'react';
import {
  ActionType as ProActionType,
  PageContainer,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { Button, message, Space, Modal, Drawer, Spin, Radio, Typography } from 'antd';
import { EyeOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined } from "@ant-design/icons";
import { Form } from 'antd';
import { useSetState } from "ahooks";
import SearchForm from '@/components/SearchForm';
import { Permission, PermissionTableProps, ActionType } from '../../types';
import { getPermissions, postPermissions, putPermissionsPermissionId, deletePermissionsPermissionId, getPermissionsPermissionId } from "@/services/UAC/api/permissions";
import { buildPermissionTree, getAllPermissionIds, processDataWithSearch, getNodeLevel, getCurrentLevelCode } from '../../utils';
import { RESOURCE_TYPES, ACTION_LABELS } from '../../constants';
import PermissionForm from '../PermissionForm';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';

const PermissionTable: React.FC<PermissionTableProps> = ({
  resourceType,
  allowedActions,
  title,
}) => {
  const actionRef = useRef<ProActionType | undefined>(undefined);
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

  const [state, setState] = useSetState<{
    isCreateModalOpen: boolean;
    createValue: Partial<Permission>;
    isDetailsViewOpen: boolean;
    isDetailsEditable: boolean;
    detailsValue: Partial<Permission>;
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

  // 处理保存详情
  const handleSaveDetails = async (values: any) => {
    try {
      setLoading(true);
      setSaving(true);
      if (!detailsValue.permission_id) {
        messageApi.error('权限ID不存在');
        return;
      }

      const updateData = {
        code: values.code,
        description: values.description,
        actions: values.actions as ActionType[],
        resource_type: resourceType,
      };
      
      const response = await putPermissionsPermissionId(
        { permission_id: detailsValue.permission_id },
        updateData
      );

      if (response.code && response.code >= 200 && response.code < 300) {
        messageApi.success('更新成功');
        setState({ 
          isDetailsEditable: false,
          detailsValue: { 
            ...detailsValue, 
            ...updateData,
          } as Permission,
        });
        if (actionRef.current) {
          actionRef.current.reload();
        }
      } else {
        messageApi.error(response.message || '更新失败');
      }
    } catch (error) {
      console.error('更新权限信息失败:', error);
      messageApi.error('更新失败');
    } finally {
      setLoading(false);
      setSaving(false);
    }
  };

  // 添加操作列
  const columns: ProColumns<Permission>[] = [
    {
      title: "权限编码",
      dataIndex: "code",
      width: 120,
      render: (dom: React.ReactNode, record: Permission) => {
        const text = String(dom || '');
        const searchText = record._searchText || '';
        
        const nodeLevel = getNodeLevel(record);
        const displayCode = getCurrentLevelCode(text, nodeLevel);

        // 如果是禁用状态，添加删除线
        const content = record.status === 'DISABLED' ? (
          <Typography.Text delete>{displayCode}</Typography.Text>
        ) : displayCode;

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
    {
      title: "描述",
      dataIndex: "description",
      width: 200,
      render: (_, record: Permission) => {
        if (record.permission_id.startsWith('virtual-')) {
          return '-';
        }
        return record.description;
      },
    },
    {
      title: "操作权限",
      dataIndex: "actions",
      width: 200,
      render: (_: unknown, record: Permission) => {
        if (!record.actions || !Array.isArray(record.actions)) {
          return '-';
        }
        return record.actions.map(action => ACTION_LABELS[action]).join(', ');
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (_, record: Permission) => {
        if (record.permission_id.startsWith('virtual-')) {
          return '-';
        }
        const statusMap = {
          ACTIVE: { text: '启用', status: 'Success' },
          DISABLED: { text: '禁用', status: 'Error' },
        };
        return statusMap[record.status || 'ACTIVE']?.text || '-';
      },
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option' as const,
      width: 120,
      render: (_: unknown, record: Permission) => {
        if (record.permission_id.startsWith('virtual-')) {
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
                setState({
                  isDetailsViewOpen: false,
                  detailsValue: {},
                  isDetailsEditable: false,
                });
                
                const response = await getPermissionsPermissionId({
                  permission_id: record.permission_id,
                });
                
                if (response.code === 200 && response.data) {
                  const processedData = {
                    ...response.data,
                    resource_type: resourceType,
                    actions: response.data.actions as ActionType[],
                  } as Permission;
                  
                  setTimeout(() => {
                    setState({
                      detailsValue: processedData,
                      isDetailsViewOpen: true,
                      isDetailsEditable: false,
                    });
                  }, 0);

                  editform.setFieldsValue(processedData);
                } else {
                  messageApi.error('获取权限详情失败');
                }
              } catch (error) {
                messageApi.error('获取权限详情失败');
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
                content: '确定要删除该权限吗？',
                onOk: async () => {
                  try {
                    setDeleteLoading(true);
                    const response = await deletePermissionsPermissionId({
                      permission_id: record.permission_id,
                    });
                    if (response.code && response.code >= 200 && response.code < 300) {
                      messageApi.success('删除权限成功');
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

  const handleCreate = () => {
    setState({
      isCreateModalOpen: true,
      createValue: {
        actions: ['read'],
        status: 'ACTIVE',
      },
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
          actionRef={actionRef}
          rowKey="permission_id"
          onRow={(record) => ({
            id: `permission-row-${record.permission_id}`,
            style: {
              backgroundColor: record.status === 'DISABLED' ? '#f5f5f5' : 
                highlightedRowId === record.permission_id && isHighlighted ? '#fffbe6' : undefined,
              transition: 'background-color 0.3s',
              opacity: record.status === 'DISABLED' ? 0.8 : 1,
            },
          })}
          search={false}
          headerTitle={
            <SearchForm
              key="search"
              onSearch={handleSearch}
              onReset={handleReset}
              placeholder="请输入权限编码"
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
              <Radio.Button value="ACTIVE">有效权限</Radio.Button>
              <Radio.Button value="ALL">全部权限</Radio.Button>
            </Radio.Group>,
            <Button
              type="primary"
              key="create"
              icon={<PlusOutlined />}
              loading={createLoading}
              onClick={handleCreate}
            >
              新建
            </Button>
          ]}
          request={async () => {
            try {
              setLoading(true);
              const params = {
                resource_type: resourceType,
                status: statusFilter === 'ALL' ? undefined : statusFilter,
              } as any;
              const response:any = await getPermissions(params);

              if (response.code === 200 && response.data?.items) {
                const treeData = buildPermissionTree(response.data.items);
                const allIds = getAllPermissionIds(treeData);
                setExpandedRowKeys(allIds);
                const processedData = processDataWithSearch(treeData, searchText);

                return {
                  data: processedData,
                  success: true,
                  total: processedData.length,
                };
              }
              
              messageApi.error(response.message || `获取${RESOURCE_TYPES[resourceType].label}列表失败`);
              return {
                data: [],
                success: false,
                total: 0,
              };
            } catch (error) {
              console.error('获取权限数据时发生错误:', error);
              messageApi.error(`获取${RESOURCE_TYPES[resourceType].label}列表失败`);
              return {
                data: [],
                success: false,
                total: 0,
              };
            } finally {
              setLoading(false);
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

        {/* 权限详情 */}
        <Drawer
          key={`${detailsValue?.permission_id || ''}-${isDetailsViewOpen}`}
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
          title={`${RESOURCE_TYPES[resourceType].label}详情 ${detailsValue?.code || ''}`}
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
                      if (!detailsValue?.permission_id) return;
                      Modal.confirm({
                        title: '确认删除',
                        content: '确定要删除该权限吗？',
                        onOk: async () => {
                          try {
                            setDeleteLoading(true);
                            const response = await deletePermissionsPermissionId({
                              permission_id: detailsValue.permission_id,
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
            {detailsValue?.permission_id && (
              <PermissionForm
                resourceType={resourceType}
                allowedActions={allowedActions}
                initialValues={detailsValue}
                onFinish={async (values) => {
                  try {
                    setSaving(true);
                    const response = await putPermissionsPermissionId({
                      permission_id: detailsValue.permission_id!,
                    }, {
                      ...values,
                      resource_type: resourceType,
                    });
                    
                    if (response.code === 200) {
                      messageApi.success('更新权限成功');
                      setState({
                        isDetailsViewOpen: false,
                        detailsValue: {},
                        isDetailsEditable: false,
                      });
                      if (actionRef.current) {
                        actionRef.current.reload();
                      }
                      return true;
                    } else {
                      messageApi.error(response.message || '更新权限失败');
                      return false;
                    }
                  } catch (error: any) {
                    const errMsg = error?.response?.data?.message || '更新权限失败';
                    messageApi.error(errMsg);
                    return false;
                  } finally {
                    setSaving(false);
                  }
                }}
                loading={saving}
                readonly={!isDetailsEditable}
                form={editform}
              />
            )}
          </Spin>
        </Drawer>

        {/* 新建权限 */}
        <Modal
          title={`新建${RESOURCE_TYPES[resourceType].label}`}
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
          <PermissionForm
            resourceType={resourceType}
            allowedActions={allowedActions}
            initialValues={createValue}
            onFinish={async (values: any) => {
              try {
                setCreateLoading(true);
                const response = await postPermissions({
                  code: values.code,
                  description: values.description,
                  resource_type: resourceType,
                  actions: values.actions as ActionType[],
                });
                
                if (response.code && response.code >= 200 && response.code < 300) {
                  messageApi.success('创建成功');
                  setState({
                    isCreateModalOpen: false,
                    createValue: {},
                  });
                  if (actionRef.current) {
                    setHighlightedRowId(response.data?.permission_id || null);
                    setIsHighlighted(true);
                    actionRef.current.reload();
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
            loading={createLoading}
          />
        </Modal>
      </PageContainer>
    </>
  );
};

export default PermissionTable; 