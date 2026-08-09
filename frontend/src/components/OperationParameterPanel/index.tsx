import { Input, InputNumber, Select, Switch, Space } from 'antd';
import { message as staticMessage } from '@/utils/antdAppApis';
import React, { useCallback, useMemo } from 'react';
import {
  isQueryOnlyMethod,
  schemaToParameterRows,
  type ParameterRow,
} from './schemaToParameterRows';
import './index.css';

// 重新导出工具，供消费方（文档页 / 测试页 / 表单）直接从组件入口引入
export { isQueryOnlyMethod } from './schemaToParameterRows';
export type { ParameterRow, ParamIn } from './schemaToParameterRows';

const { TextArea } = Input;

export interface OperationParameterPanelProps {
  httpMethod?: string;
  /** 直接传入参数行列表；若未提供则用 schema 工具转换 */
  parameters?: ParameterRow[];
  /** 备选：由 schema + method + routePattern 自动转换（parameters 优先） */
  parametersSchema?: Record<string, unknown> | null;
  routePattern?: string;
  requiredNames?: string[] | null;
  /** editable 模式下每个参数的当前值（key 为参数名） */
  values?: Record<string, unknown>;
  onChange?: (values: Record<string, unknown>) => void;
  /** 只读模式（文档页），仅展示参数定义与描述，无输入控件 */
  readOnly?: boolean;
  /** 空状态文案 */
  emptyText?: string;
}

/** 把任意值序列化为输入框可用字符串（对象/数组用 JSON 字符串） */
function valueToText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** 把输入文本解析回目标类型 */
function textToValue(text: string, row: ParameterRow): unknown {
  if (text === '') return undefined;
  if (row.type === 'integer' || row.type === 'number') {
    const num = Number(text);
    return Number.isNaN(num) ? text : num;
  }
  if (row.type === 'boolean') {
    return text === 'true';
  }
  if (row.isArray || row.type === 'object') {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function ContextTag({ in: paramIn }: { in: ParameterRow['in'] }) {
  const label = paramIn === 'query' ? 'query' : paramIn === 'path' ? 'path' : 'body';
  return <span className={`operation-parameter-panel__ctx operation-parameter-panel__ctx--${label}`}>({label})</span>;
}

function TypeLabel({ row }: { row: ParameterRow }) {
  if (row.typeLabel) {
    return <span className="operation-parameter-panel__type">{row.typeLabel}</span>;
  }
  const base = row.type || 'string';
  const text = row.isArray ? `${base}[]` : row.enum?.length ? `enum[${base}]` : base;
  return <span className="operation-parameter-panel__type">{text}</span>;
}

/** readOnly 模式下的右侧描述/默认值/ schema 示例展示 */
function DescriptionCell({ row }: { row: ParameterRow }) {
  return (
    <div className="operation-parameter-panel__desc">
      {row.description ? <span>{row.description}</span> : null}
      {row.defaultValue != null ? (
        <span className="operation-parameter-panel__default">默认 {JSON.stringify(row.defaultValue)}</span>
      ) : null}
      {row.example != null && row.defaultValue == null ? (
        <span className="operation-parameter-panel__default">示例 {JSON.stringify(row.example)}</span>
      ) : null}
      {row.enum?.length ? (
        <span className="operation-parameter-panel__default">
          可选 {row.enum.map((item) => row.enumLabels?.[String(item)] || String(item)).join(' · ')}
        </span>
      ) : null}
    </div>
  );
}

/** readOnly 模式：优先展示请求参数 Example 值，否则展示描述/默认/ schema 示例 */
function ReadOnlyValueCell({ row, value }: { row: ParameterRow; value: unknown }) {
  const hasValue = value !== undefined && value !== null && value !== '';
  if (hasValue) {
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return (
      <div className="operation-parameter-panel__desc">
        <code className="operation-parameter-panel__example-value">{text}</code>
        {row.description ? <span>{row.description}</span> : null}
      </div>
    );
  }
  return <DescriptionCell row={row} />;
}

/** editable 模式下根据参数类型渲染输入控件 */
function ValueInput({
  row,
  value,
  onValueChange,
}: {
  row: ParameterRow;
  value: unknown;
  onValueChange: (next: unknown) => void;
}) {
  if (row.enum?.length && row.type !== 'object') {
    const enumOptions = row.enum.map((item) => ({
      value: item,
      label: row.enumLabels?.[String(item)] || String(item),
    }));
    if (row.isArray) {
      const multiValue = Array.isArray(value)
        ? (value as Array<string | number>)
        : value == null || value === ''
          ? []
          : [value as string | number];
      return (
        <Select
          mode="multiple"
          size="small"
          allowClear
          style={{ width: '100%' }}
          placeholder={row.required ? '请选择（可多选）' : '请选择（可多选，可不选）'}
          options={enumOptions}
          value={multiValue}
          onChange={(val) => onValueChange(Array.isArray(val) && val.length ? val : undefined)}
        />
      );
    }
    // 可选枚举：空选项 + allowClear；清空后值为 undefined（不写入 Example）
    const emptyOptionValue = '';
    const options = row.required
      ? enumOptions
      : [{ value: emptyOptionValue, label: '（不选）' }, ...enumOptions];
    const selectValue =
      value == null || value === ''
        ? row.required
          ? undefined
          : emptyOptionValue
        : (value as string | number);
    return (
      <Select
        size="small"
        allowClear={!row.required}
        style={{ width: '100%' }}
        placeholder="请选择"
        options={options}
        value={selectValue}
        onChange={(val) => {
          if (val == null || val === emptyOptionValue) {
            onValueChange(undefined);
            return;
          }
          onValueChange(val);
        }}
      />
    );
  }
  if (String(row.type || '').toLowerCase() === 'boolean') {
    return (
      <Switch
        size="small"
        checked={value === true || value === 'true' || value === 1 || value === '1'}
        onChange={(checked) => onValueChange(checked)}
      />
    );
  }
  if (row.type === 'integer' || row.type === 'number') {
    return (
      <InputNumber
        size="small"
        style={{ width: '100%' }}
        value={typeof value === 'number' ? value : undefined}
        onChange={(val) => onValueChange(val ?? undefined)}
      />
    );
  }
  if (row.isArray || row.type === 'object') {
    return (
      <TextArea
        size="small"
        autoSize={{ minRows: 1, maxRows: 4 }}
        style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}
        placeholder={row.isArray ? '[ ... ]' : '{ ... }'}
        value={valueToText(value)}
        onChange={(e) => {
          const text = e.target.value;
          try {
            onValueChange(text === '' ? undefined : JSON.parse(text));
          } catch {
            // 解析失败时保留原始文本，避免输入中途丢值
            onValueChange(text);
          }
        }}
        onBlur={() => {
          // 失焦时校验 JSON 合法性，给提示
          const text = valueToText(value);
          if (text && value != null && typeof value === 'string' && value.trim().startsWith('{')) {
            try {
              JSON.parse(value);
            } catch {
              staticMessage.warning(`参数「${row.name}」JSON 格式不正确`);
            }
          }
        }}
      />
    );
  }
  return (
    <Input
      size="small"
      style={{ width: '100%' }}
      value={typeof value === 'string' ? value : valueToText(value)}
      onChange={(e) => onValueChange(e.target.value)}
    />
  );
}

const OperationParameterPanel: React.FC<OperationParameterPanelProps> = ({
  httpMethod,
  parameters,
  parametersSchema,
  routePattern,
  requiredNames,
  values,
  onChange,
  readOnly = false,
  emptyText = '无参数',
}) => {
  const rows = useMemo<ParameterRow[]>(() => {
    if (parameters && parameters.length) return parameters;
    return schemaToParameterRows(httpMethod, routePattern, parametersSchema, requiredNames);
  }, [parameters, parametersSchema, httpMethod, routePattern, requiredNames]);

  const isQuery = isQueryOnlyMethod(httpMethod);

  const handleValueChange = useCallback(
    (name: string, next: unknown) => {
      if (!onChange) return;
      const updated = { ...(values || {}) };
      if (next === undefined || next === '' || next === null) {
        delete updated[name];
      } else {
        updated[name] = next;
      }
      onChange(updated);
    },
    [onChange, values],
  );

  if (!rows.length) {
    return <div className="operation-parameter-panel operation-parameter-panel--empty">{emptyText}</div>;
  }

  return (
    <div className="operation-parameter-panel">
      {rows.map((row) => (
        <div className="operation-parameter-panel__row" key={`${row.in}-${row.name}`}>
          <div className="operation-parameter-panel__define">
            <span className="operation-parameter-panel__name">
              {row.name}
              {row.required ? <span className="operation-parameter-panel__required">*</span> : null}
            </span>
            <Space >
              <ContextTag in={row.in} />
              <TypeLabel row={row} />
            </Space>
          </div>
          <div className="operation-parameter-panel__value">
            {readOnly ? (
              <ReadOnlyValueCell row={row} value={values?.[row.name]} />
            ) : (
              <ValueInput
                row={row}
                value={values?.[row.name]}
                onValueChange={(next) => handleValueChange(row.name, next)}
              />
            )}
          </div>
        </div>
      ))}
      {!readOnly && isQuery ? (
        <div className="operation-parameter-panel__hint">参数通过 URL query string 传递，无需 request body</div>
      ) : null}
    </div>
  );
};

export default OperationParameterPanel;
