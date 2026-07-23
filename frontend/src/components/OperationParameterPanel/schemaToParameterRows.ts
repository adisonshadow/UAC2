/**
 * 把运行时参数 JSON Schema 转换为 Swagger 风格参数行（query/path/body）。
 *
 * 与后端 applicationApiOpenApiService.buildParametersAndBody 同语义：
 * - GET / HEAD / DELETE：顶级 properties（非 path）→ query；path 参数 → path；无 body
 * - POST / PUT / PATCH：对象 schema → body（保留整体 body 结构）
 * - routePattern 中的 :id / :field → path 参数
 */

export type ParamIn = 'query' | 'path' | 'body';

export interface ParameterRow {
  name: string;
  in: ParamIn;
  type?: string;
  /** 展示用类型名（如 StatusType / StatusType[]）；优先于 type */
  typeLabel?: string;
  format?: string;
  required?: boolean;
  description?: string;
  defaultValue?: unknown;
  /** 示例值（object/array 类型常用） */
  example?: unknown;
  /** 是否为数组 */
  isArray?: boolean;
  /** JSON Schema enum 可选值 */
  enum?: Array<string | number>;
  /** enum 值 → 展示标签（来自 x-enum-labels） */
  enumLabels?: Record<string, string>;
}

const QUERY_ONLY_METHODS = new Set(['get', 'head', 'delete']);

/** 从 routePattern 提取 path 参数名（如 '/:id' → ['id']，'/distinct/:field' → ['field']） */
function extractPathParamNames(routePattern?: string): Set<string> {
  if (!routePattern) return new Set();
  const matches = String(routePattern).match(/:[A-Za-z_][A-Za-z0-9_]*/g);
  return new Set(matches ? matches.map((token) => token.slice(1)) : []);
}

function isArraySchema(schema?: Record<string, unknown>): boolean {
  return String(schema?.type || '').toLowerCase() === 'array' || Boolean(schema?.items);
}

/**
 * 把对象 properties 中的单项映射为 ParameterRow 的 schema 描述。
 * 返回不含 in/required（由调用方根据位置决定）。
 */
function describeProperty(name: string, propSchema: unknown): Partial<ParameterRow> {
  const schema = (propSchema && typeof propSchema === 'object' ? propSchema : {}) as Record<string, unknown>;
  const array = isArraySchema(schema);
  const items = (schema.items && typeof schema.items === 'object'
    ? schema.items
    : {}) as Record<string, unknown>;
  const type = array
    ? String(items.type || 'string')
    : String(schema.type || 'string');
  const enumSource = array && Array.isArray(items.enum) ? items : schema;
  const labelsSource = array && items['x-enum-labels'] ? items : schema;
  return {
    name,
    type,
    typeLabel: schema['x-type-label'] ? String(schema['x-type-label']) : undefined,
    isArray: array,
    format: schema.format ? String(schema.format) : undefined,
    description: schema.description ? String(schema.description) : undefined,
    defaultValue: schema.default,
    example: schema.example,
    enum: Array.isArray(enumSource.enum)
      ? enumSource.enum.map((item) => (typeof item === 'number' ? item : String(item)))
      : undefined,
    enumLabels: (() => {
      const labels = labelsSource['x-enum-labels'];
      if (!labels || typeof labels !== 'object' || Array.isArray(labels)) return undefined;
      const next: Record<string, string> = {};
      Object.entries(labels as Record<string, unknown>).forEach(([key, label]) => {
        next[key] = String(label);
      });
      return Object.keys(next).length ? next : undefined;
    })(),
  };
}

/**
 * 将 parametersSchema（对象 JSON Schema）映射为参数行列表。
 *
 * @param httpMethod HTTP method（不区分大小写）
 * @param routePattern 路由模式，用于识别 path 参数
 * @param parametersSchema 运行时参数 JSON Schema（{ type:'object', properties:{...} }）
 * @param requiredNames 顶层 required 字段名列表（可选，schema.required 的便捷透传）
 */
export function schemaToParameterRows(
  httpMethod?: string,
  routePattern?: string,
  parametersSchema?: Record<string, unknown> | null,
  requiredNames?: string[] | null,
): ParameterRow[] {
  if (!parametersSchema || typeof parametersSchema !== 'object') return [];

  const properties = parametersSchema.properties as Record<string, unknown> | undefined;
  if (!properties || typeof properties !== 'object') {
    // 非 object 的降级 schema（极罕见）—— 仅记录描述
    if (parametersSchema.name || parametersSchema.description) {
      return [{
        name: String(parametersSchema.name || 'value'),
        in: 'query',
        type: String(parametersSchema.type || 'string'),
        description: parametersSchema.description ? String(parametersSchema.description) : undefined,
      }];
    }
    return [];
  }

  const method = String(httpMethod || 'get').toLowerCase();
  const isQueryMethod = QUERY_ONLY_METHODS.has(method);
  const pathParams = extractPathParamNames(routePattern);
  const requiredSet = new Set<string>([
    ...(Array.isArray(parametersSchema.required) ? parametersSchema.required.map(String) : []),
    ...(Array.isArray(requiredNames) ? requiredNames.map(String) : []),
  ]);

  const rows: ParameterRow[] = [];
  const entries = Object.entries(properties);

  if (isQueryMethod) {
    // GET / HEAD / DELETE：每个顶级属性 → query（path 参数除外）
    entries.forEach(([name, propSchema]) => {
      const inPath = pathParams.has(name) ? 'path' : 'query';
      rows.push({
        ...describeProperty(name, propSchema),
        in: inPath,
        required: inPath === 'path' || requiredSet.has(name),
      } as ParameterRow);
    });
    return rows;
  }

  // POST / PUT / PATCH：对象 schema 作为整体 body
  // 在 body 模式下，若存在 body/set 这种包装属性，则展开其内部字段为 body 行；
  // 否则把顶层属性整体当作一个 body 行展示。
  const bodyWrapper = (properties.body || properties.set) as Record<string, unknown> | undefined;
  const bodyProperties = bodyWrapper?.properties as Record<string, unknown> | undefined;
  if (bodyProperties && typeof bodyProperties === 'object') {
    // path 参数仍单独列出（id 等）
    entries.forEach(([name, propSchema]) => {
      if (name === 'body' || name === 'set') return;
      const inPath = pathParams.has(name) ? 'path' : 'body';
      rows.push({
        ...describeProperty(name, propSchema),
        in: inPath,
        required: inPath === 'path' || requiredSet.has(name),
      } as ParameterRow);
    });
    const bodyRequired = Array.isArray(bodyWrapper?.required) ? bodyWrapper.required.map(String) : [];
    Object.entries(bodyProperties).forEach(([name, propSchema]) => {
      rows.push({
        ...describeProperty(name, propSchema),
        in: 'body',
        required: bodyRequired.includes(name),
      } as ParameterRow);
    });
    return rows;
  }

  // 没有明确 body 包装：整体对象作为一个 body 行
  rows.push({
    name: 'body',
    in: 'body',
    type: 'object',
    description: '请求体（application/json）',
    required: true,
  });
  return rows;
}

/** 判断 httpMethod 是否为「参数在 query string、无 body」的方法 */
export function isQueryOnlyMethod(httpMethod?: string): boolean {
  return QUERY_ONLY_METHODS.has(String(httpMethod || 'get').toLowerCase());
}
