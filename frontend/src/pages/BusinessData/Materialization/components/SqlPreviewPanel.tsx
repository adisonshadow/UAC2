import Editor from '@monaco-editor/react';
import { Tabs } from 'antd';
import React, { useMemo } from 'react';
import MaterializationRunTable from './MaterializationRunTable';

interface SqlPreviewPanelProps {
  preview: API.MaterializationPreview | null;
  activeTab: string;
  onTabChange: (key: string) => void;
  dbType?: string;
  connectionId?: string;
  /** 外部刷新物化历史时递增 */
  runsRefreshKey?: number;
}

const SqlPreviewPanel: React.FC<SqlPreviewPanelProps> = ({
  preview,
  activeTab,
  onTabChange,
  dbType,
  connectionId,
  runsRefreshKey = 0,
}) => {
  const tsCode = useMemo(() => {
    if (!preview?.generatedCode) return '';
    return Object.entries(preview.generatedCode)
      .map(([id, code]) => `// Entity ${id}\n${code}`)
      .join('\n\n');
  }, [preview]);

  const scriptLabel = dbType === 'mongodb' ? 'MongoDB 脚本' : dbType === 'redis' ? 'Redis 结构' : 'SQL 预览';
  const scriptLanguage = dbType === 'mongodb' ? 'javascript' : dbType === 'redis' ? 'shell' : 'sql';
  const emptyScript =
    dbType === 'redis'
      ? '# 点击「预览」生成 Redis 结构定义'
      : dbType === 'mongodb'
        ? '// 点击「预览」生成 MongoDB 脚本'
        : '-- 点击「预览 SQL/代码」生成';

  const editorHeight = 'calc(100vh - 120px)';

  return (
    <Tabs
      activeKey={activeTab}
      onChange={onTabChange}
      style={{ flex: 1, minHeight: 0, height: '100%' }}
      items={[
        {
          key: 'sql',
          label: scriptLabel,
          children: (
            <Editor
              height={editorHeight}
              language={scriptLanguage}
              value={preview?.sql || emptyScript}
              options={{ readOnly: true, minimap: { enabled: false } }}
            />
          ),
        },
        {
          key: 'typescript',
          label: 'TypeScript 预览',
          children: (
            <Editor
              height={editorHeight}
              language="typescript"
              value={tsCode || '// 点击「预览 SQL/代码」生成'}
              options={{ readOnly: true, minimap: { enabled: false } }}
            />
          ),
        },
        {
          key: 'history',
          label: '物化历史',
          children: (
            <MaterializationRunTable
              connectionId={connectionId}
              refreshKey={runsRefreshKey}
            />
          ),
        },
      ]}
    />
  );
};

export default SqlPreviewPanel;
