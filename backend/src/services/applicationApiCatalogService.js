const { Application, BizdataApiService, BizdataApiServiceOperation, BizdataEntity } = require('../models');
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
  getResponseDescriptor,
} = require('./apiService/operationParameterSchemas');
const {
  buildDomainTreeFromServices,
  attachApiServicesToDomainTree,
} = require('./apiService/apiServiceDomainUtils');

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

/** 按 code 的 `:` 分层构建内置 API tree（domain→resource→action） */
function buildBuiltinApiTree(apis) {
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
        node.label = item.label || seg;
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

function resolveMockParameters(service, operation, entity, securityConfig) {
  const saved = securityConfig?.testMockParameters?.[operation];
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    return saved;
  }
  return buildMockParameters(service, operation, entity);
}

function buildOperationForCatalog(service, operationRow, entity) {
  const meta = getOperationMeta(operationRow.operation);
  const { jsonSchema } = getParameterSchema(service, operationRow.operation, entity);
  const { responseInterface, responseSchema } = getResponseDescriptor(service, operationRow.operation, entity);
  const mockParameters = resolveMockParameters(
    service,
    operationRow.operation,
    entity,
    service.securityConfig || {},
  );
  return {
    operation: operationRow.operation,
    httpMethod: operationRow.httpMethod || meta?.httpMethod,
    routePattern: operationRow.routePattern || meta?.routePattern,
    parametersSchema: jsonSchema,
    mockParameters,
    responseInterface,
    responseSchema,
    label: meta?.label || operationRow.operation,
    category: meta?.category,
  };
}

async function buildServiceForCatalog(serviceRow, entityCache) {
  const service = apiServiceService.formatService(serviceRow, { includeOperations: true });
  if (!service) return null;

  const serviceForSchema = await enrichServiceTableName(service);
  let entity = null;
  if (serviceForSchema.entityId) {
    if (!entityCache.has(serviceForSchema.entityId)) {
      entityCache.set(
        serviceForSchema.entityId,
        await businessDataService.getEntityById(serviceForSchema.entityId),
      );
    }
    entity = entityCache.get(serviceForSchema.entityId);
  }

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
    operations: enabledOps.map((op) => buildOperationForCatalog(serviceForSchema, op, entity)),
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
  const scopedRows = rows.filter((row) => {
    const service = apiServiceService.formatService(row, { includeOperations: true });
    return service && matchesApiDataScope(service.code, scope);
  });
  const services = (
    await Promise.all(scopedRows.map((row) => buildServiceForCatalog(row, entityCache)))
  ).filter(Boolean);

  const tree = buildCatalogDomainTree(domainCodes, services);

  // 系统内置应用（本系统）拥有全部内置 API；其他应用按 builtin_api_scope 授权
  const isSystemApplication = application.code === SYSTEM_APPLICATION_CODE;
  const builtinPermissionCodes = isSystemApplication
    ? listBuiltinApis().map((item) => item.code)
    : parseBuiltinApiScope(application.builtin_api_scope);
  const builtinApis = buildBuiltinApiCatalog(builtinPermissionCodes);
  const builtinApiTree = buildBuiltinApiTree(builtinApis);

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
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getPublicApiCatalog,
  matchesApiDataScope,
  parseApiDataScope,
};
