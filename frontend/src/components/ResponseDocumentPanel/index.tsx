import Editor from '@monaco-editor/react';
import { Alert, Col, Row } from 'antd';
import React, { useMemo } from 'react';
import './index.css';

export type ResponseDocumentEditorProps = {
  responsesSchemaText: string;
  responseExampleText: string;
  onResponsesSchemaChange: (value: string) => void;
  onResponseExampleChange: (value: string) => void;
  schemaError?: string | null;
  exampleError?: string | null;
  /** 左侧 Schema 标题，默认「响应 Schema (200)」 */
  schemaTitle?: string;
  /** 右侧 Example 标题，默认「响应 Example (200)」 */
  exampleTitle?: string;
};

export function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'JSON 解析失败' };
  }
}

const ResponseDocumentEditor: React.FC<ResponseDocumentEditorProps> = ({
  responsesSchemaText,
  responseExampleText,
  onResponsesSchemaChange,
  onResponseExampleChange,
  schemaError,
  exampleError,
  schemaTitle = '响应 Schema (200)',
  exampleTitle = '响应 Example (200)',
}) => {
  const localSchemaError = useMemo(() => {
    if (schemaError) return schemaError;
    const parsed = tryParseJson(responsesSchemaText);
    return parsed.ok ? null : parsed.error;
  }, [responsesSchemaText, schemaError]);

  const localExampleError = useMemo(() => {
    if (exampleError) return exampleError;
    const parsed = tryParseJson(responseExampleText);
    return parsed.ok ? null : parsed.error;
  }, [responseExampleText, exampleError]);

  return (
    <div className="response-document-panel">
      <Row gutter={16}>
        <Col span={12} className="response-document-panel__split-col-left">
          <div className="response-document-panel__section-title">{schemaTitle}</div>
          {localSchemaError ? (
            <Alert type="error" showIcon message={localSchemaError} style={{ marginBottom: 8 }} />
          ) : null}
          <Editor
            height="280px"
            language="json"
            value={responsesSchemaText}
            onChange={(val) => onResponsesSchemaChange(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
            }}
          />
        </Col>
        <Col span={12}>
          <div className="response-document-panel__section-title">{exampleTitle}</div>
          {localExampleError ? (
            <Alert type="error" showIcon message={localExampleError} style={{ marginBottom: 8 }} />
          ) : null}
          <Editor
            height="280px"
            language="json"
            value={responseExampleText}
            onChange={(val) => onResponseExampleChange(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
            }}
          />
        </Col>
      </Row>
    </div>
  );
};

export default ResponseDocumentEditor;
