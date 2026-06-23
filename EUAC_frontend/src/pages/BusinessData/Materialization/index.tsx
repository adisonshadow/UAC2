import Editor from '@monaco-editor/react';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Checkbox,
  Input,
  Space,
  Splitter,
  Table,
  Tabs,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import MaterializedTableList from './components/MaterializedTableList';
import { buildScopeTree, flattenScopeTree } from '../utils/buildScopeTree';
import {
  getBusinessDataSchema,
  getMaterializationRuns,
  getMaterializationStatus,
  postMaterializationExecute,
  postMaterializationPreview,
} from '@/services/UAC/api/businessData';
import { getApiData, getApiErrorMessage, isApiSuccess, parseApiListResponse } from '@/utils/apiResponse';

const MaterializationPage: React.FC = () => {
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<API.BusinessDataEntity[]>([]);
  const [statusItems, setStatusItems] = useState<API.MaterializationStatusItem[]>([]);
  const [runs, setRuns] = useState<API.MaterializationRun[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<API.MaterializationPreview | null>(null);
  const [targetSchema, setTargetSchema] = useState('bizdata_mat');
  const [activeCodeTab, setActiveCodeTab] = useState<string>('sql');

  const erEntities = useMemo(
    () => entities.filter((e) => e.entityKind === 'er_table'),
    [entities],
  );

  const groupedOptions = useMemo(() => {
    const tree = buildScopeTree(erEntities);
    const flat = flattenScopeTree(tree).filter((node) => !node.isScopeNode && node.entity);
    const groups = new Map<string, { label: string; value: string }[]>();

    flat.forEach((node) => {
      const entity = node.entity!;
      const scopePath = (entity.code || '').split(':').slice(0, -1).join(':') || 'root';
      const list = groups.get(scopePath) || [];
      list.push({
        label: `${entity.label} (${entity.code}) v${entity.version}`,
        value: entity.id!,
      });
      groups.set(scopePath, list);
    });

    return Array.from(groups.entries()).map(([scope, options]) => ({ scope, options }));
  }, [erEntities]);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    try {
      const schemaRes = await getBusinessDataSchema();
      const schemaData = getApiData<API.BusinessDataSchema>(schemaRes);
      if (isApiSuccess(schemaRes) && schemaData) {
        setEntities(schemaData.entities || []);
      } else {
        message.error(getApiErrorMessage(schemaRes, '加载实体失败'));
      }

      const statusRes = await getMaterializationStatus();
      const status = getApiData<API.MaterializationStatusItem[]>(statusRes);
      if (isApiSuccess(statusRes)) {
        setStatusItems(Array.isArray(status) ? status : []);
      }

      const runsRes = await getMaterializationRuns({ page: 1, size: 10 });
      const { items } = parseApiListResponse<API.MaterializationRun>(runsRes);
      setRuns(items);
    } catch (error) {
      message.error(getApiErrorMessage(error, '加载物化数据失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const handlePreview = async () => {
    setExecuting(true);
    try {
      const res = await postMaterializationPreview({
        entityIds: selectedIds.length ? selectedIds : undefined,
        targetSchema,
      });
      const data = getApiData<API.MaterializationPreview>(res);
      if (isApiSuccess(res) && data) {
        setPreview(data);
        setActiveCodeTab('sql');
        message.success('预览已生成');
      } else {
        message.error(getApiErrorMessage(res, '预览失败'));
      }
    } finally {
      setExecuting(false);
    }
  };

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const expectedVersions: Record<string, number> = {};
      erEntities
        .filter((e) => !selectedIds.length || selectedIds.includes(e.id!))
        .forEach((e) => {
          if (e.id && e.version != null) expectedVersions[e.id] = e.version;
        });

      const res = await postMaterializationExecute({
        entityIds: selectedIds.length ? selectedIds : undefined,
        targetSchema,
        dryRun: false,
        expectedVersions,
      });
      if (isApiSuccess(res)) {
        message.success('物化执行成功');
        await loadPageData();
        const result = getApiData<API.MaterializationExecuteResult>(res);
        if (result?.preview) setPreview(result.preview);
      } else {
        message.error(getApiErrorMessage(res, '物化失败'));
      }
    } catch (e: unknown) {
      message.error(getApiErrorMessage(e, '物化失败'));
    } finally {
      setExecuting(false);
    }
  };

  const tsCode = useMemo(() => {
    if (!preview?.generatedCode) return '';
    return Object.entries(preview.generatedCode)
      .map(([id, code]) => `// Entity ${id}\n${code}`)
      .join('\n\n');
  }, [preview]);

  const runColumns: ColumnsType<API.MaterializationRun> = [
    { title: 'Schema', dataIndex: 'targetSchema', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100 },
    { title: '时间', dataIndex: 'createdAt', width: 180 },
  ];

  const leftPanel = (
    <div style={{ height: '100%', overflow: 'auto', paddingRight: 8 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Typography.Text strong>物化配置</Typography.Text>
          <Input
            addonBefore="目标 Schema"
            value={targetSchema}
            onChange={(e) => setTargetSchema(e.target.value)}
            style={{ marginTop: 8 }}
          />
          <Space style={{ marginTop: 8 }}>
            <Button loading={executing} onClick={handlePreview}>
              预览 SQL/代码
            </Button>
            <Button type="primary" loading={executing} onClick={handleExecute}>
              执行物化
            </Button>
          </Space>
        </div>

        <div>
          <Typography.Text strong>选择 ER 实体</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Checkbox
              indeterminate={selectedIds.length > 0 && selectedIds.length < erEntities.length}
              checked={selectedIds.length === erEntities.length && erEntities.length > 0}
              onChange={(e) =>
                setSelectedIds(e.target.checked ? erEntities.map((x) => x.id!).filter(Boolean) : [])
              }
            >
              全选
            </Checkbox>
          </div>
          {groupedOptions.map(({ scope, options }) => (
            <div key={scope} style={{ marginTop: 12 }}>
              <Typography.Text type="secondary">{scope}</Typography.Text>
              <Checkbox.Group
                style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}
                value={selectedIds}
                onChange={(vals) => setSelectedIds(vals as string[])}
                options={options}
              />
            </div>
          ))}
        </div>

        <div>
          <Typography.Text strong>物化状态</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <MaterializedTableList items={statusItems} loading={loading} />
          </div>
        </div>
      </Space>
    </div>
  );

  const rightPanel = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 4 }}>
      <Tabs
        activeKey={activeCodeTab}
        onChange={setActiveCodeTab}
        style={{ flex: 1, minHeight: 0 }}
        items={[
          {
            key: 'sql',
            label: 'SQL 预览',
            children: (
              <Editor
                height="calc(100vh - 320px)"
                language="sql"
                value={preview?.sql || '-- 点击「预览 SQL/代码」生成'}
                options={{ readOnly: true, minimap: { enabled: false } }}
              />
            ),
          },
          {
            key: 'typescript',
            label: 'TypeScript 预览',
            children: (
              <Editor
                height="calc(100vh - 320px)"
                language="typescript"
                value={tsCode || '// 点击「预览 SQL/代码」生成'}
                options={{ readOnly: true, minimap: { enabled: false } }}
              />
            ),
          },
        ]}
      />

      <div>
        <Typography.Text strong>物化历史</Typography.Text>
        <Table
          size="small"
          rowKey="id"
          style={{ marginTop: 8 }}
          loading={loading}
          columns={runColumns}
          dataSource={runs}
          pagination={false}
        />
      </div>
    </div>
  );

  return (
    <PageContainer pageHeaderRender={() => <></>}>
      <Splitter style={{ height: 'calc(100vh - 120px)', minHeight: 520 }}>
        <Splitter.Panel defaultSize="36%" min="280px" max="46%">
          {leftPanel}
        </Splitter.Panel>
        <Splitter.Panel>{rightPanel}</Splitter.Panel>
      </Splitter>
    </PageContainer>
  );
};

export default MaterializationPage;
