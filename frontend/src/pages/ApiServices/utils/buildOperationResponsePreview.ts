/**
 * 根据操作类型推导 200 成功响应的结构（设计期预览，与后端 buildDefaultResponsesSchema 一致）。
 */

import { parseInterfaceFields } from './parseInterfaceFields';

export interface OperationResponsePreview {
  responsesSchema: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
  responseInterface: string;
  responseExample: unknown;
}

const SAMPLE_UUID = '00000000-0000-4000-8000-000000000001';
const RECORD = 'Record<string, unknown>';

function formatRefEntity(entityCode?: string) {
  const code = String(entityCode || '').trim();
  if (!code) return null;
  return code.startsWith('@') ? code : `@${code}`;
}

function buildRefEntitySchema(entityCode?: string) {
  const ref = formatRefEntity(entityCode);
  return ref ? { $refEntity: ref } : { type: 'object', additionalProperties: true };
}

function wrapEnvelopeSchema(dataSchema: Record<string, unknown>) {
  return {
    type: 'object',
    properties: {
      code: { type: 'integer', example: 200 },
      message: { type: 'string', example: 'success' },
      data: dataSchema,
    },
    required: ['code', 'message', 'data'],
  };
}

function buildResponsesSchemaEntry(dataSchema: Record<string, unknown>, description = '获取成功') {
  return {
    description,
    content: {
      'application/json': {
        schema: wrapEnvelopeSchema(dataSchema),
      },
    },
  };
}

function extractInnerSchema(responsesSchema: Record<string, unknown>) {
  const entry = (responsesSchema['200'] || responsesSchema[200]) as Record<string, unknown> | undefined;
  const content = entry?.content as Record<string, { schema?: Record<string, unknown> }> | undefined;
  return content?.['application/json']?.schema || { type: 'object' };
}

function envelopeExample(data: Record<string, unknown>) {
  return { code: 200, message: 'success', data };
}

function buildSampleFromInterface(interfaceText?: string) {
  const fields = parseInterfaceFields(interfaceText);
  if (!fields.length) return null;
  const result: Record<string, unknown> = {};
  fields.forEach((field) => {
    const type = String(field.type || '').toLowerCase();
    if (type.includes('number')) {
      result[field.name] = field.name === 'limit' ? 10 : 0;
    } else if (type.includes('boolean')) {
      result[field.name] = false;
    } else if (type.includes('[]')) {
      result[field.name] = [];
    } else if (type.includes('object') || type.includes('record')) {
      result[field.name] = {};
    } else {
      result[field.name] = '';
    }
  });
  return result;
}

/** 从 updateOne 等请求的 `body: { ... }` 内联块提取字段，用于生成响应 item 示例 */
function extractNestedBodyInterface(interfaceText?: string): string | null {
  const text = String(interfaceText || '');
  const bodyKeyMatch = text.match(/\bbody\s*\??\s*:\s*\{/);
  if (!bodyKeyMatch || bodyKeyMatch.index == null) return null;
  const braceStart = bodyKeyMatch.index + bodyKeyMatch[0].length - 1;
  let depth = 0;
  for (let i = braceStart; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return `interface Body {${text.slice(braceStart + 1, i)}}`;
      }
    }
  }
  return null;
}

function buildSampleItem(entityCode?: string, requestParameterInterface?: string) {
  const nestedBodyIface = extractNestedBodyInterface(requestParameterInterface);
  const bodySample = nestedBodyIface ? buildSampleFromInterface(nestedBodyIface) : null;
  if (bodySample && Object.keys(bodySample).length > 0) {
    return { id: SAMPLE_UUID, ...bodySample };
  }

  const topLevel = buildSampleFromInterface(requestParameterInterface);
  if (topLevel) {
    const { body, id: _id, ...rest } = topLevel;
    const merged: Record<string, unknown> = { ...rest };
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      Object.assign(merged, body as Record<string, unknown>);
    }
    if (Object.keys(merged).length > 0) {
      return { id: SAMPLE_UUID, ...merged };
    }
  }

  const shortName = String(entityCode || '').split(':').pop() || 'record';
  return {
    id: SAMPLE_UUID,
    name: `sample_${shortName}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

export function buildOperationResponsePreview(
  operation?: string,
  entityCode?: string,
  requestParameterInterface?: string,
): OperationResponsePreview | null {
  const entityRef = buildRefEntitySchema(entityCode);
  const looseItem = { type: 'object', additionalProperties: true, nullable: true };
  const item = entityCode ? formatRefEntity(entityCode)?.replace('@', '') : RECORD;
  const sampleItem = buildSampleItem(entityCode, requestParameterInterface);

  let dataSchema: Record<string, unknown>;
  let responseInterface: string;
  let responseExample: unknown;

  switch (operation) {
    case 'find':
      dataSchema = {
        type: 'object',
        properties: {
          items: { type: 'array', items: entityCode ? entityRef : { type: 'object' } },
          pagination: {
            type: 'object',
            properties: {
              total: { type: 'integer', example: 100 },
              page: { type: 'integer', example: 1 },
              pageSize: { type: 'integer', example: 10 },
              totalPages: { type: 'integer', example: 10 },
              hasNext: { type: 'boolean', example: true },
            },
            required: ['total', 'page', 'pageSize', 'totalPages', 'hasNext'],
          },
        },
        required: ['items', 'pagination'],
      };
      responseInterface = `interface Response {\n  code: number;\n  message: string;\n  data: {\n    items: ${item}[];\n    pagination: {\n      total: number;\n      page: number;\n      pageSize: number;\n      totalPages: number;\n      hasNext: boolean;\n    };\n  };\n}`;
      responseExample = envelopeExample({
        items: [sampleItem],
        pagination: {
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
          hasNext: false,
        },
      });
      break;
    case 'count':
    case 'countDocuments':
      dataSchema = {
        type: 'object',
        properties: { count: { type: 'integer', example: 1 } },
        required: ['count'],
      };
      responseInterface = 'interface Response {\n  code: number;\n  message: string;\n  data: { count: number };\n}';
      responseExample = envelopeExample({ count: 1 });
      break;
    case 'distinct':
      dataSchema = {
        type: 'object',
        properties: { values: { type: 'array', items: { type: 'string' }, example: ['sample'] } },
        required: ['values'],
      };
      responseInterface = 'interface Response {\n  code: number;\n  message: string;\n  data: { values: string[] };\n}';
      responseExample = envelopeExample({ values: ['sample'] });
      break;
    case 'deleteOne':
    case 'findOneAndDelete':
      dataSchema = {
        type: 'object',
        properties: {
          item: entityCode ? { ...entityRef, nullable: true } : looseItem,
          deleted: { type: 'integer', example: 1 },
        },
      };
      responseInterface = `interface Response {\n  code: number;\n  message: string;\n  data: { item: ${item} | null; deleted: number };\n}`;
      responseExample = envelopeExample({ item: sampleItem, deleted: 1 });
      break;
    case 'updateOne':
    case 'findOneAndUpdate':
      dataSchema = {
        type: 'object',
        properties: {
          item: entityCode ? { ...entityRef, nullable: true } : looseItem,
          matched: { type: 'integer', example: 1 },
        },
      };
      responseInterface = `interface Response {\n  code: number;\n  message: string;\n  data: { item: ${item} | null; matched: number };\n}`;
      responseExample = envelopeExample({ item: sampleItem, matched: 1 });
      break;
    case 'create':
    case 'insertOne':
    case 'findById':
    case 'findOne':
    case 'save':
    case 'replaceOne':
      dataSchema = {
        type: 'object',
        properties: {
          item: entityCode ? { ...entityRef, nullable: true } : looseItem,
        },
        required: ['item'],
      };
      responseInterface = `interface Response {\n  code: number;\n  message: string;\n  data: { item: ${item} | null };\n}`;
      responseExample = envelopeExample({ item: sampleItem });
      break;
    case 'aggregate':
      dataSchema = {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
        required: ['items'],
      };
      responseInterface = 'interface Response {\n  code: number;\n  message: string;\n  data: { items: Record<string, unknown>[] };\n}';
      responseExample = envelopeExample({ items: [{ _id: 'group1', count: 1 }] });
      break;
    case 'exists':
      dataSchema = {
        type: 'object',
        properties: { exists: { type: 'boolean', example: false } },
        required: ['exists'],
      };
      responseInterface = 'interface Response {\n  code: number;\n  message: string;\n  data: { exists: boolean };\n}';
      responseExample = envelopeExample({ exists: false });
      break;
    default:
      return null;
  }

  const responsesSchema = { 200: buildResponsesSchemaEntry(dataSchema) };
  return {
    responsesSchema,
    responseSchema: extractInnerSchema(responsesSchema),
    responseInterface,
    responseExample,
  };
}
