import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  ActionType,
  PageContainer,
  ProTable,
} from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { useMemoizedFn, useSetState } from "ahooks";
import { Button, Modal, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAIChatPrompts, useChatReference } from '@EADAF/ai-base';
import { buildDepartmentPrompts } from '@/ai/pageChatPrompts';
import { tableColumns } from "./Schemas";
import { getDepartmentsTree, deleteDepartmentsDepartmentId } from "@/services/UAC/api/departments";
import SearchForm from '@/components/SearchForm';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import { TableActionButton, TableActions, TABLE_ACTION_COLUMN_BASE } from '@/components/TableActions';
import { augmentColumnsWithChatReference } from '@/utils/augmentColumnsWithChatReference';
import { buildDepartmentReference } from '@/ai/chatReferenceBuilders';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApiData, getApiErrorMessage, isApiSuccess } from '@/utils/apiResponse';

interface DepartmentRecord {
  department_id: string;
  name: string;
  parent_id: string;
  created_at: string;
  updated_at: string;
  children?: DepartmentRecord[];
}

interface DepartmentWithChildren extends API.Department {
  children?: DepartmentWithChildren[];
  _searchText?: string;
}

const getAllDepartmentIds = (departments: DepartmentWithChildren[]): string[] =>
  departments.reduce((acc: string[], dept: DepartmentWithChildren) => {
    if (dept.department_id) acc.push(dept.department_id);
    if (dept.children?.length) acc.push(...getAllDepartmentIds(dept.children));
    return acc;
  }, []);

const processDataWithSearch = (
  data: DepartmentWithChildren[],
  text: string,
): DepartmentWithChildren[] =>
  data.map((item) => {
    const processedItem = { ...item, _searchText: text };
    if (item.children?.length) {
      processedItem.children = processDataWithSearch(item.children, text);
    }
    return processedItem;
  });

const Page: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [messageApi, contextHolder] = message.useMessage();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const highlightTimerRef = useRef<number | undefined>(undefined);
  const initialExpandDoneRef = useRef(false);
  const { references } = useChatReference();
  const chatPrompts = useMemo(() => buildDepartmentPrompts(references), [references]);
  useAIChatPrompts(chatPrompts);

  const [state] = useSetState({
    tableColumns: augmentColumnsWithChatReference(
      [
        ...tableColumns,
        {
          ...TABLE_ACTION_COLUMN_BASE,
          dataIndex: "option",
          width: 100,
          render: (_: unknown, record: DepartmentRecord) => (
            <TableActions>
              <TableActionButton
                title="编辑"
                key="edit"
                icon={<EditOutlined />}
                onClick={() =>
                  navigate(`/member_org/organization/${record.department_id}/edit`)
                }
              />
              <TableActionButton
                title="删除"
                key="delete"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: '确认删除',
                    content: '确定要删除该部门吗？',
                    onOk: async () => {
                      try {
                        const response = await deleteDepartmentsDepartmentId({
                          department_id: record.department_id,
                        });
                        if (response.code && response.code >= 200 && response.code < 300) {
                          messageApi.success('删除部门成功');
                          initialExpandDoneRef.current = false;
                          actionRef.current?.reload();
                        } else {
                          messageApi.error(response.message || '删除失败');
                        }
                      } catch (error: unknown) {
                        messageApi.error(getApiErrorMessage(error, '删除失败'));
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
      buildDepartmentReference,
    ),
  });

  const { tableColumns: actionColumns } = state;

  useEffect(() => {
    const highlight = new URLSearchParams(location.search).get('highlight');
    if (highlight) {
      setHighlightedRowId(highlight);
      const nextSearch = new URLSearchParams(location.search);
      nextSearch.delete('highlight');
      navigate(
        { pathname: location.pathname, search: nextSearch.toString() },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!highlightedRowId) return;

    let count = 0;
    const maxCount = 6;

    const blink = () => {
      if (count >= maxCount) {
        setHighlightedRowId(null);
        setIsHighlighted(false);
        return;
      }
      setIsHighlighted((prev) => !prev);
      count += 1;
      highlightTimerRef.current = window.setTimeout(blink, 500);
    };

    blink();

    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [highlightedRowId]);

  const handleSearch = useMemoizedFn((value: string) => {
    setSearchText(value);
    actionRef.current?.reload();
  });

  const handleReset = useMemoizedFn(() => {
    setSearchText('');
    actionRef.current?.reload();
  });

  const loadDepartments = useCallback(async () => {
    try {
      const response = await getDepartmentsTree();
      if (!isApiSuccess(response)) {
        messageApi.error(getApiErrorMessage(response, '获取部门列表失败'));
        return { data: [], success: false };
      }

      const data = getApiData<{ items?: DepartmentWithChildren[] }>(response);
      const items = data?.items ?? [];

      if (!initialExpandDoneRef.current && items.length > 0) {
        initialExpandDoneRef.current = true;
        setExpandedRowKeys(getAllDepartmentIds(items));
      }

      return {
        data: processDataWithSearch(items, searchText),
        success: true,
      };
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, '获取部门列表失败'));
      return { data: [], success: false };
    }
  }, [messageApi, searchText]);

  const proTableColumns = useMemo((): ProColumns<DepartmentWithChildren>[] => {
    const nameColumn: ProColumns<DepartmentWithChildren> = {
      title: '部门名称',
      dataIndex: 'name',
      width: 240,
      render: (text: string, record: DepartmentWithChildren) => {
        const keyword = record._searchText || '';
        if (!keyword) return text;

        const index = text.toLowerCase().indexOf(keyword.toLowerCase());
        if (index === -1) return text;

        const beforeStr = text.substring(0, index);
        const matchStr = text.substring(index, index + keyword.length);
        const afterStr = text.substring(index + keyword.length);

        return (
          <span>
            {beforeStr}
            <span style={{ color: '#f50', backgroundColor: '#ffd591' }}>{matchStr}</span>
            {afterStr}
          </span>
        );
      },
    };

    return [
      nameColumn,
      ...actionColumns.filter((col) => col.dataIndex !== 'name'),
    ] as ProColumns<DepartmentWithChildren>[];
  }, [actionColumns]);

  return (
    <>
      {contextHolder}
      <PageContainer pageHeaderRender={() => <></>}>
        <ProTable<DepartmentWithChildren>
          defaultSize="small"
          actionRef={actionRef}
          rowKey="department_id"
          scroll={{ x: 'max-content' }}
          onRow={(record) => ({
            id: `department-row-${record.department_id}`,
            style: {
              backgroundColor:
                highlightedRowId === record.department_id && isHighlighted
                  ? '#fffbe6'
                  : undefined,
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
          columns={proTableColumns}
          toolBarRender={() => [
            <Button
              type="primary"
              key="create"
              icon={<PlusOutlined />}
              onClick={() => navigate('/member_org/organization/create')}
            >
              新建
            </Button>,
          ]}
          request={loadDepartments}
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
      </PageContainer>
    </>
  );
};

export default Page;
