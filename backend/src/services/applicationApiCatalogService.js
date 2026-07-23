const {
  Application,
  BizdataApiService,
  BizdataApiServiceOperation,
  BizdataEntity,
  BizdataCollectionPipeline,
  BizdataCollectionPipelineApplication,
} = require('../models');
const { Op } = require('sequelize');
const { validate: isUuid } = require('uuid');
const apiServiceService = require('./apiService/apiServiceService');
const businessDataService = require('./businessData/businessDataService');
const { getBuiltinApiByCode, listBuiltinApis } = require('./builtinApi/catalog');

/** 系统内置应用 code：本系统拥有全部内置 API 访问权 */
const SYSTEM_APPLICATION_CODE = 'EADAF';
const { resolveEntityTableName } = require('./businessData/entityTableName');
const { getOperationMeta } = require('./apiService/operationCatalog');
const {
  buildMockParameters,
  getParameterSchema,
  getResponseDefinition,
  loadEnumMapForEntity,
} = require('./apiService/operationParameterSchemas');
const { readSavedRequestExample } = require('./apiService/requestExampleStore');
const {
  buildDomainTreeFromServices,
  attachApiServicesToDomainTree,
} = require('./apiService/apiServiceDomainUtils');
const { listEnabledForDocs: listEnabledExceptionResponses } = require('./apiService/exceptionResponseService');

const INGEST_AUTH_HINT = '使用业务系统 application_id + app_secret 换取 JWT，请求头 Authorization: Bearer {token}';
const INGEST_BODY_HINT = 'Content-Type: text/plain 或 application/octet-stream；二进制 body 在解析脚本中收到 hex 字符串';
const INGEST_BASE = '/api/v1/ingest';

const COLLECTION_INGEST_RESPONSE_INTERFACE = `/** 采集 API 成功响应外壳 */
interface CollectionIngestApiResponse {
  code: number;
  message: string;
  data: CollectionIngestResult;
}

/** data 字段：管道执行结果 */
interface CollectionIngestResult {
  runId: string;
  pipelineId: string;
  /** 管道 code */
  code: string;
  runType: 'ingest';
  /** 原始输入（text 或 hex） */
  inputRaw: string;
  /** 解析脚本输出，结构与「目标数据结构」一致 */
  parseOutput: Record<string, unknown>;
  /** 存储脚本返回值 */
  storeOutput: Record<string, unknown>;
  durationMs: number;
  rolledBack: boolean;
  status: 'success';
}`;

function buildCollectionIngestResponseExample(pipeline) {
  const sample = String(pipeline.sampleData || '').trim();
  const inputPreview = sample.length > 200 ? `${sample.slice(0, 200)}…` : sample;
  return {
    code: 200,
    message: '数据采集成功',
    data: {
      runId: '00000000-0000-4000-8000-000000000001',
      pipelineId: pipeline.id || '00000000-0000-4000-8000-000000000002',
      code: pipeline.code,
      runType: 'ingest',
      inputRaw: inputPreview || '<raw payload>',
      parseOutput: {},
      storeOutput: { ok: 1 },
      durationMs: 12,
      rolledBack: false,
      status: 'success',
    },
  };
}

function parseApiDataScope(scope) {
  if (!scope || typeof scope !== 'object') {
    return { domainCodes: [], serviceCodes: [] };
  }
  if (Array.isArray(scope.domainCodes) || Array.isArray(scope.serviceCodes)) {
    return {
      domainCodes: Array.isArray(scope.domainCodes) ? scope.domainCodes.map(String).filter(Boolean) : [],
      serviceCodes: Array.isArray(scope.serviceCodes) ? scope.serviceCodes.map(String).filter(Boolean) : [],
    };
  }
  const legacyCodes = Object.keys(scope).filter((key) => scope[key] != null && scope[key] !== false);
  return { domainCodes: legacyCodes.map(String), serviceCodes: [] };
}

/** 解析应用可访问内置 API 授权，返回清单 code 数组 */
function parseBuiltinApiScope(scope) {
  if (!scope || typeof scope !== 'object') return [];
  const codes = Array.isArray(scope.permissionCodes) ? scope.permissionCodes : [];
  return codes.map(String).filter(Boolean);
}

/** 把授权的内置 API code 映射为清单明细，供公开目录展示 */
function buildBuiltinApiCatalog(permissionCodes) {
  const apis = [];
  permissionCodes.forEach((code) => {
    const item = getBuiltinApiByCode(code);
    if (item) {
      apis.push({
        code: item.code,
        domain: item.domain,
        label: item.label,
        routePath: item.routePath,
        httpMethods: item.httpMethods || [],
        actions: item.actions || [],
        description: item.description || '',
      });
    }
  });
  return apis;
}

/** 按 code 的 `:` 分层构建 tree（内置 API / 采集 API 共用） */
function buildCodeTree(apis) {
  const root = { code: '', label: '', children: {} };
  apis.forEach((item) => {
    const segments = item.code.split(':');
    let node = root;
    segments.forEach((seg, idx) => {
      const isLeaf = idx === segments.length - 1;
      if (!node.children[seg]) {
        node.children[seg] = { code: seg, label: seg, children: {} };
      }
      node = node.children[seg];
      if (isLeaf) {
        node.label = item.label || item.name || seg;
        node.isLeaf = true;
        node.isApiNode = true;
        node.fullCode = item.code;
      } else if (!node.isLeaf) {
        node.isDomainNode = true;
      }
    });
  });

  function toNodes(mapNode, parentPath = '') {
    return Object.values(mapNode.children)
      .map((child) => {
        const code = parentPath ? `${parentPath}:${child.code}` : child.code;
        const treeNode = {
          code,
          name: child.label,
          isDomainNode: !child.isLeaf,
        };
        if (child.isLeaf) {
          treeNode.isApiNode = true;
        }
        if (!child.isLeaf && Object.keys(child.children).length) {
          treeNode.children = toNodes(child, code);
        }
        return treeNode;
      })
      .sort((a, b) => {
        if (Boolean(a.isApiNode) !== Boolean(b.isApiNode)) return a.isApiNode ? 1 : -1;
        return String(a.code).localeCompare(String(b.code));
      });
  }
  return toNodes(root);
}

/** @deprecated 使用 buildCodeTree */
function buildBuiltinApiTree(apis) {
  return buildCodeTree(apis);
}

function isCollectionPipelineAllowedForApp(pipeline, applicationId) {
  if (!pipeline.restrictSources) return true;
  const allowed = pipeline.applicationIds || [];
  if (!allowed.length) return true;
  return allowed.includes(applicationId);
}

function formatCollectionPipelineForCatalog(row) {
  const data = row.toJSON ? row.toJSON() : row;
  const routePath = data.route_path;
  const basePath = data.base_path || `${INGEST_BASE}/${routePath}`;
  const applicationIds = Array.isArray(data.applications)
    ? data.applications.map((a) => a.application_id)
    : [];
  const item = {
    id: data.id,
    code: data.code,
    label: data.name || data.code,
    name: data.name,
    description: data.description || '',
    protocolType: data.protocol_type,
    status: data.status,
    routePath,
    basePath,
    httpMethods: ['POST'],
    entityCode: data.entity_code || data.entity?.code || null,
    entityLabel: data.entity?.label || null,
    sampleData: data.sample_data || '',
    targetStructure: data.target_structure || '',
    restrictSources: Boolean(data.restrict_sources),
    applicationIds,
    authHint: INGEST_AUTH_HINT,
    bodyHint: INGEST_BODY_HINT,
    responseInterface: COLLECTION_INGEST_RESPONSE_INTERFACE,
    responseExample: null,
  };
  item.responseExample = buildCollectionIngestResponseExample(item);
  return item;
}

async function buildCollectionPipelineCatalog(applicationId, { isSystemApplication = false } = {}) {
  const rows = await BizdataCollectionPipeline.findAll({
    where: { status: { [Op.in]: ['published', 'draft'] } },
    include: [
      {
        model: BizdataCollectionPipelineApplication,
        as: 'applications',
        required: false,
        attributes: ['application_id'],
      },
      {
        model: BizdataEntity,
        as: 'entity',
        attributes: ['id', 'code', 'label'],
        required: false,
      },
    ],
    order: [['code', 'ASC']],
  });

  return rows
    .map(formatCollectionPipelineForCatalog)
    .filter((item) => (
      isSystemApplication || isCollectionPipelineAllowedForApp(item, applicationId)
    ));
}

function matchesApiDataScope(serviceCode, scope) {
  const code = String(serviceCode || '');
  if (!code) return false;
  const { domainCodes, serviceCodes } = parseApiDataScope(scope);
  if (!domainCodes.length && !serviceCodes.length) return false;
  if (serviceCodes.includes(code)) return true;
  return domainCodes.some((domain) => code === domain || code.startsWith(`${domain}:`));
}

async function enrichServiceTableName(service) {
  if (service?.tableName || !service?.entityId) return service;
  const entity = await businessDataService.getEntityById(service.entityId);
  if (!entity) return service;
  const tableName = resolveEntityTableName(entity.code, entity.table_name || entity.tableName);
  if (!tableName) return service;
  return { ...service, tableName };
}

function resolveMockParameters(service, operation, entity, securityConfig, enumMap = null) {
  const saved = readSavedRequestExample(securityConfig, operation);
  if (saved) {
    return saved;
  }
  return buildMockParameters(service, operation, entity, enumMap);
}

function buildOperationForCatalog(service, operationRow, entity, enumMap = null) {
  const meta = getOperationMeta(operationRow.operation);
  const { jsonSchema } = getParameterSchema(service, operationRow.operation, entity, enumMap);
  const mockParameters = resolveMockParameters(
    service,
    operationRow.operation,
    entity,
    service.securityConfig || {},
    enumMap,
  );
  const {
    responseInterface,
    responsesSchema,
    responseSchema,
    responseExample,
  } = getResponseDefinition(service, operationRow.operation, entity, mockParameters);
  return {
    operation: operationRow.operation,
    httpMethod: operationRow.httpMethod || meta?.httpMethod,
    routePattern: operationRow.routePattern || meta?.routePattern,
    parametersSchema: jsonSchema,
    mockParameters,
    requestExample: mockParameters,
    responseInterface,
    responsesSchema,
    responseSchema,
    responseExample,
    label: meta?.label || operationRow.operation,
    category: meta?.category,
  };
}

async function buildServiceForCatalog(serviceRow, entityCache, enumMapCache) {
  const service = apiServiceService.formatService(serviceRow, { includeOperations: true });
  if (!service) return null;

  const serviceForSchema = await enrichServiceTableName(service);
  let entity = null;
  let enumMap = null;
  if (serviceForSchema.entityId) {
    if (!entityCache.has(serviceForSchema.entityId)) {
      entityCache.set(
        serviceForSchema.entityId,
        await businessDataService.getEntityById(serviceForSchema.entityId),
      );
    }
    entity = entityCache.get(serviceForSchema.entityId);
  }
  const enumCacheKey = serviceForSchema.id || serviceForSchema.entityId || 'none';
  if (!enumMapCache.has(enumCacheKey)) {
    enumMapCache.set(
      enumCacheKey,
      await loadEnumMapForEntity(entity, serviceForSchema),
    );
  }
  enumMap = enumMapCache.get(enumCacheKey);

  const enabledOps = (serviceForSchema.operations || []).filter((op) => op.isEnabled !== false);
  return {
    id: serviceForSchema.id,
    code: serviceForSchema.code,
    name: serviceForSchema.name,
    description: serviceForSchema.description,
    tags: serviceForSchema.tags || [],
    status: serviceForSchema.status,
    routePath: serviceForSchema.routePath,
    basePath: serviceForSchema.basePath,
    transportProtocols: serviceForSchema.transportProtocols || ['http'],
    entityCode: serviceForSchema.entityCode,
    entityLabel: serviceForSchema.entity?.label,
    version: serviceForSchema.version,
    requestParameterInterface: serviceForSchema.requestParameterInterface || '',
    operations: enabledOps.map((op) => buildOperationForCatalog(serviceForSchema, op, entity, enumMap)),
  };
}

async function findApplicationByKey(applicationKey) {
  const key = String(applicationKey || '').trim();
  if (!key) return null;
  const where = isUuid(key) ? { application_id: key } : { code: key };
  return Application.findOne({ where });
}

function buildCatalogDomainTree(domainCodes, services) {
  const serviceItems = services.map((s) => ({ code: s.code, name: s.name || s.code }));
  const placeholderItems = domainCodes
    .filter(Boolean)
    .map((code) => ({ code: `${code}:__catalog_placeholder__`, name: code.split(':').pop() || code }));
  const domainTree = buildDomainTreeFromServices([...serviceItems, ...placeholderItems]);
  return attachApiServicesToDomainTree(domainTree, services);
}

async function getPublicApiCatalog(applicationKey) {
  const application = await findApplicationByKey(applicationKey);
  if (!application) {
    throw Object.assign(new Error('应用不存在'), { status: 404 });
  }
  if (!application.api_enabled) {
    throw Object.assign(new Error('该应用未启用 API'), { status: 400 });
  }

  const rows = await BizdataApiService.findAll({
    where: { status: { [Op.in]: ['published', 'draft'] } },
    include: [
      { model: BizdataApiServiceOperation, as: 'operations', required: false },
      { model: BizdataEntity, as: 'entity', attributes: ['id', 'code', 'label'], required: false },
    ],
    order: [
      ['code', 'ASC'],
      [{ model: BizdataApiServiceOperation, as: 'operations' }, 'sort_order', 'ASC'],
    ],
  });

  const scope = application.api_data_scope;
  const { domainCodes } = parseApiDataScope(scope);
  const entityCache = new Map();
  const enumMapCache = new Map();
  const scopedRows = rows.filter((row) => {
    const service = apiServiceService.formatService(row, { includeOperations: true });
    return service && matchesApiDataScope(service.code, scope);
  });
  const services = (
    await Promise.all(scopedRows.map((row) => buildServiceForCatalog(row, entityCache, enumMapCache)))
  ).filter(Boolean);

  const tree = buildCatalogDomainTree(domainCodes, services);

  // 系统内置应用（本系统）拥有全部内置 API；其他应用按 builtin_api_scope 授权
  const isSystemApplication = application.code === SYSTEM_APPLICATION_CODE;
  const builtinPermissionCodes = isSystemApplication
    ? listBuiltinApis().map((item) => item.code)
    : parseBuiltinApiScope(application.builtin_api_scope);
  const builtinApis = buildBuiltinApiCatalog(builtinPermissionCodes);
  const builtinApiTree = buildCodeTree(builtinApis);

  // 该应用可调用的采集管道（draft/published；系统应用看全部，其他按来源白名单）
  const collectionApis = await buildCollectionPipelineCatalog(application.application_id, {
    isSystemApplication,
  });
  const collectionApiTree = buildCodeTree(collectionApis);

  // 全局共享的异常响应模板（用于 API 文档页与 apis.json 展示）
  const exceptionResponses = await listEnabledExceptionResponses();

  return {
    application: {
      application_id: application.application_id,
      name: application.name,
      code: application.code,
      description: application.description,
      logo_url: application.logo_url,
    },
    tree,
    services,
    builtinApis,
    builtinApiTree,
    collectionApis,
    collectionApiTree,
    exceptionResponses,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getPublicApiCatalog,
  findApplicationByKey,
  matchesApiDataScope,
  parseApiDataScope,
};
