import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SaveOutlined,
  CloseOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import {
  ActionType,
  BetaSchemaForm,
  PageContainer,
  ProTable,
} from '@ant-design/pro-components';
import { useSetState } from "ahooks";
import { Button, Drawer, Modal, Spin, Space, message, Form } from 'antd';
import React, { useRef, useState, useEffect } from "react";
import { tableColumns, departmentDetailFormColumns, departmentEditFormColumns } from "./Schemas";
import { getDepartmentsTree, postDepartments, putDepartmentsDepartmentId, deleteDepartmentsDepartmentId, getDepartmentsDepartmentId } from "@/services/UAC/api/departments";
import { useDepartmentOptions } from "@/hooks/useDepartmentOptions";
import { highlightTableRow } from '@/utils/highlight';
import SearchForm from '@/components/SearchForm';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';

interface DepartmentRecord {
  department_id: string;
  name: string;
  parent_id: string;
  created_at: string;
  updated_at: string;
  children?: DepartmentRecord[];
}

// 扩展 API.Department 类型
interface DepartmentWithChildren extends API.Department {
  children?: DepartmentWithChildren[];
  _searchText?: string;
}

interface DepartmentTreeResponse {
  code: number;
  message: string;
  data: {
    items: API.DepartmentTreeItem[];
  };
}

const Page: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [editform] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [departmentTree, setDepartmentTree] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const highlightTimerRef = useRef<number | undefined>(undefined);

  // 递归获取所有部门的 ID
  const getAllDepartmentIds = (departments: DepartmentWithChildren[]): string[] => {
    return departments.reduce((acc: string[], dept: DepartmentWithChildren) => {
      if (dept.department_id) {
        acc.push(dept.department_id);
      }
      if (dept.children && dept.children.length > 0) {
        acc.push(...getAllDepartmentIds(dept.children));
      }
      return acc;
    }, []);
  };

  // 递归处理数据，添加搜索文本
  const processDataWithSearch = (data: DepartmentWithChildren[], searchText: string): DepartmentWithChildren[] => {
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

  const [state, setState] = useSetState<any>({
    tableColumns: [...tableColumns, {
      title: "操作",
      dataIndex: "option",
      valueType: "option",
      width: 120,
      render: (_: unknown, record: DepartmentRecord) => [
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
              
              const response = await getDepartmentsDepartmentId({
                department_id: record.department_id,
              });
              
              if (response.code === 200 && response.data) {
                const processedData = {
                  ...response.data,
                };
                
                setTimeout(() => {
                  setState({
                    detailsValue: processedData,
                    isDetailsViewOpen: true,
                    isDetailsEditable: false,  // 默认是查看模式
                  });
                }, 0);

                editform.setFieldsValue(processedData);
              } else {
                messageApi.error('获取部门详情失败');
              }
            } catch (error) {
              messageApi.error('获取部门详情失败');
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
              content: '确定要删除该部门吗？',
              onOk: async () => {
                try {
                  setDeleteLoading(true);
                  const response = await deleteDepartmentsDepartmentId({
                    department_id: record.department_id,
                  });
                  if (response.code && response.code >= 200 && response.code < 300) {
                    messageApi.success('删除部门成功');
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

  // 修改表单配置，注入部门树数据
  const editFormColumns = departmentEditFormColumns.map(column => {
    if (column.dataIndex === 'parent_id') {
      return {
        ...column,
        fieldProps: {
          ...column.fieldProps,
          treeData: departmentTree,
        },
      };
    }
    return column;
  });

  const handleSaveDetails = async (values: any) => {
    try {
      setLoading(true);
      setSaving(true);
      const updateData = {
        name: values.name,
        parent_id: values.parent_id || null,
      };
      
      const response = await putDepartmentsDepartmentId(
        { department_id: detailsValue.department_id },
        updateData
      );

      if (response.code && response.code >= 200 && response.code < 300) {
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
      console.error('更新部门信息失败:', error);
      messageApi.error('更新失败');
    } finally {
      setLoading(false);
      setSaving(false);
    }
  };

  useEffect(() => {
    console.log("isUpdateModalOpen:", isUpdateModalOpen);
  }, [isUpdateModalOpen]);

  useEffect(() => {
    if (highlightedRowId) {
      let count = 0;
      const maxCount = 6; // 闪烁3次（亮暗各算一次）
      
      const blink = () => {
        if (count >= maxCount) {
          setHighlightedRowId(null);
          setIsHighlighted(false);
          return;
        }
        
        setIsHighlighted(prev => !prev);
        count++;
        highlightTimerRef.current = window.setTimeout(blink, 500); // 每500ms切换一次
      };
      
      blink();
    }
    
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, [highlightedRowId]);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
    if (actionRef.current) {
      actionRef.current.reload();
    }
  };

  // 处理重置
  const handleReset = () => {
    setSearchText('');
    if (actionRef.current) {
      actionRef.current.reload();
    }
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
          rowKey="department_id"
          onRow={(record) => ({
            id: `department-row-${record.department_id}`,
            style: {
              backgroundColor: highlightedRowId === record.department_id && isHighlighted ? '#fffbe6' : undefined,
              transition: 'background-color 0.3s',
            },
          })}
          headerTitle={
            <SearchForm
              key="search"
              onSearch={handleSearch}
              onReset={handleReset}
              placeholder="请输入部门名称"
            />
          }
          search={false}
          columns={[
            {
              title: '部门名称',
              dataIndex: 'name',
              width: 240,
              render: (text: string, record: any) => {
                const searchText = record._searchText || '';
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
            ...columns.filter((col: any) => col.dataIndex !== 'name'),
          ]}
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
                  updateValue: {}
                });
              }}
            >
              新建
            </Button>,
          ]}
          request={async () => {
            try {
              const response = await getDepartmentsTree() as unknown as DepartmentTreeResponse;
              if (response.code && response.code >= 200 && response.code < 300 && response.data?.items) {
                // 设置所有部门的 ID 为展开状态
                const allIds = getAllDepartmentIds(response.data.items);
                setExpandedRowKeys(allIds);
                // 更新部门树数据
                setDepartmentTree(response.data.items);
                // 处理数据，添加搜索文本
                const processedData = processDataWithSearch(response.data.items, searchText);
                return {
                  data: processedData,
                  success: true,
                };
              }
              messageApi.error(response.message || '获取部门列表失败');
              return {
                data: [],
                success: false,
              };
            } catch (error) {
              messageApi.error('获取部门列表失败');
              return {
                data: [],
                success: false,
              };
            }
          }}
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
        />

        {/* 新建部门 */}
        <Modal
          title={isUpdate ? "编辑" : "新建"}
          open={isUpdateModalOpen}
          onCancel={() => {
            setState({ 
              isUpdateModalOpen: false,
              updateValue: {},
            });
          }}
          footer={null}
          width={800}
        >
          <BetaSchemaForm
            layoutType="Form"
            columns={editFormColumns}
            initialValues={updateValue}
            grid={true}
            rowProps={{
              gutter: [16, 16],
            }}
            colProps={{
              span: 12,
            }}
            submitter={{
              searchConfig: {
                submitText: isUpdate ? '保存' : '创建',
              },
              submitButtonProps: {
                loading: createLoading,
              },
            }}
            onFinish={async (value: any) => {
              try {
                setCreateLoading(true);
                if (isUpdate) {
                  const response = await putDepartmentsDepartmentId({
                    department_id: updateValue.department_id,
                  }, {
                    name: value.name,
                    parent_id: value.parent_id || null,
                  });
                  
                  if (response.code && response.code >= 200 && response.code < 300) {
                    messageApi.success('更新成功');
                    setState({
                      isUpdateModalOpen: false,
                      updateValue: {},
                    });
                    if (actionRef.current) {
                      actionRef.current.reload();
                    }
                    return true;
                  } else {
                    messageApi.error(response.message || '更新失败');
                    return false;
                  }
                } else {
                  const response = await postDepartments({
                    name: value.name,
                    parent_id: value.parent_id || null,
                  });
                  
                  if (response.code && response.code >= 200 && response.code < 300) {
                    messageApi.success('创建成功');
                    setState({
                      isUpdateModalOpen: false,
                      updateValue: {},
                    });
                    if (actionRef.current) {
                      // 设置要高亮的行 ID
                      setHighlightedRowId(response.data?.department_id || null);
                      // 重新加载表格
                      actionRef.current.reload();
                      // 3秒后清除高亮状态
                      setTimeout(() => {
                        setHighlightedRowId(null);
                      }, 3000);
                    }
                    return true;
                  } else {
                    messageApi.error(response.message || '创建失败');
                    return false;
                  }
                }
              } catch (error: any) {
                messageApi.error(error.message || (isUpdate ? '更新失败' : '创建失败'));
                return false;
              } finally {
                setCreateLoading(false);
              }
            }}
          />
        </Modal>
        
        {/* 部门详情 */}
        <Drawer
          key={detailsValue.department_id + isDetailsViewOpen}
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
          title={"部门详情 " + detailsValue.name}
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
                      Modal.confirm({
                        title: '确认删除',
                        content: '确定要删除该部门吗？',
                        onOk: async () => {
                          try {
                            setDeleteLoading(true);
                            const response = await deleteDepartmentsDepartmentId({
                              department_id: detailsValue.department_id,
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
            {detailsValue?.department_id && (
              <BetaSchemaForm
                key={`form-` + detailsValue.department_id}
                layoutType="Form"
                columns={isDetailsEditable ? editFormColumns : departmentDetailFormColumns}
                readonly={!isDetailsEditable}
                title={detailsValue.name}
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
      </PageContainer>
    </>
  );
};

export default Page;