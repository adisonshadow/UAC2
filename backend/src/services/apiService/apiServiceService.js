const { Op } = require('sequelize');
const {
  BizdataApiService,
  BizdataApiServiceOperation,
  BizdataApiServicePermission,
  BizdataEntity,
  BizdataDatabaseConnection,
  BizdataMaterializationEntity,
  BizdataMaterializationRun,
  sequelize,
} = require('../../models');
const businessDataService = require('../businessData/businessDataService');
const databaseConnectionService = require('../businessData/databaseConnectionService');
const { resolveEntityTableName } = require('../businessData/entityTableName');
const {
  validateCode,
  validateScopeCode,
  buildCodeFromScopeAndSlug,
  parseServiceSlugFromCode,
  codeToRoutePath,
  buildDomainTreeFromServices,
  matchesCodePrefix,
  normalizeListStatus,
} = require('./apiServiceDomainUtils');
const {
  OPERATION_CATALOG,
  DEFAULT_ENABLED_OPERATIONS,
  getOperationMeta,
  normalizeEnabledOperations,
} = require('./operationCatalog');
const { getParameterSchema, loadEnumMapForEntity } = require('./operationParameterSchemas');
const { resolveConnection } = require('./apiServiceConnectionResolveService');
const {
  syncPermissions,
  permissionsToAccessRestriction,
  normalizeAccessRestriction,
} = require('./apiServicePermissionService');
const { assertHandlerScriptValid } = require('./handlerTypeCheck');

const {
  normalizeTransportProtocols,
  buildTransportEndpoints,
} = require('./apiServiceTransport');
const { DEFAULT_SECURITY_CONFIG } = require('./apiServiceConstants');

function normalizeScriptMode(value) {
  return value === 'typescript' ? 'typescript' : 'sql';
}

function resolvePayloadCode(payload) {
  if (payload.code) return validateCode(payload.code);
  const scopeCode = payload.scopeCode || payload.scope_code;
  const serviceSlug = payload.serviceSlug || payload.service_slug;
  if (scopeCode && serviceSlug) {
    return buildCodeFromScopeAndSlug(scopeCode, serviceSlug);
  }
  throw Object.assign(new Error('请提供 code 或 scopeCode + serviceSlug'), { status: 400 });
}

function resolveScopeCode(payload, code) {
  if (payload.scopeCode || payload.scope_code) {
    return validateScopeCode(payload.scopeCode || payload.scope_code);
  }
  if (code && code.includes(':')) {
    const parts = code.split(':');
    return parts.slice(0, -1).join(':');
  }
  return null;
}

function mergeSecurityConfigOverrides(securityConfig, payload) {
  let next = { ...securityConfig };
  const responseOverrides = payload.responseOverrides || payload.response_overrides;
  if (responseOverrides && typeof responseOverrides === 'object' && !Array.isArray(responseOverrides)) {
    next = {
      ...next,
      responseOverrides: {
        ...(next.responseOverrides || {}),
        ...responseOverrides,
      },
    };
  }
  const requestOverrides = payload.requestOverrides || payload.request_overrides;
  if (requestOverrides && typeof requestOverrides === 'object' && !Array.isArray(requestOverrides)) {
    next = {
      ...next,
      requestOverrides: {
        ...(next.requestOverrides || {}),
        ...requestOverrides,
      },
    };
    const { syncTestMockParametersFromRequestOverrides } = require('./requestExampleStore');
    next = syncTestMockParametersFromRequestOverrides(next);
  }
  return next;
}

function formatService(row, { includeOperations = false, includePermissions = false } = {}) {
  if (!row) return null;
  const data = row.toJSON ? row.toJSON() : row;
  const result = {
    id: data.id,
    code: data.code,
    routePath: data.route_path,
    name: data.name,
    description: data.description,
    tags: data.tags || [],
    status: data.status,
    entityId: data.entity_id,
    entityCode: data.entity_code,
    connectionId: data.connection_id,
    tableName: data.table_name,
    scopeCode: data.scope_code,
    scriptMode: data.script_mode || 'sql',
    handlerScript: data.handler_script,
    requestParameterInterface: data.request_parameter_interface,
    definitionScript: data.definition_script,
    targetSchema: data.target_schema,
    basePath: data.base_path || `/api/v1/data/${data.route_path}`,
    transportProtocols: normalizeTransportProtocols(data.transport_protocols),
    enabledOperations: data.enabled_operations || [],
    securityConfig: data.security_config || {},
    scriptOverrides: data.script_overrides || {},
    version: data.version,
    publishedAt: data.published_at,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    entity: data.entity
      ? {
          id: data.entity.id,
          code: data.entity.code,
          label: data.entity.label,
        }
      : undefined,
    connection: data.connection
      ? {
          id: data.connection.id,
          name: data.connection.name,
          dbType: data.connection.db_type,
        }
      : undefined,
  };

  if (includeOperations && data.operations) {
    result.operations = data.operations.map((op) => ({
      id: op.id,
      operation: op.operation,
      httpMethod: op.http_method,
      routePattern: op.route_pattern,
      parametersSchema: op.parameters_schema || {},
      isEnabled: op.is_enabled,
      sortOrder: op.sort_order,
    }));
  }

  if (includePermissions && data.permissions) {
    result.permissions = data.permissions.map((p) => ({
      id: p.id,
      grantType: p.grant_type,
      grantId: p.grant_id,
      actions: p.actions || [],
    }));
    result.accessRestriction = permissionsToAccessRestriction(result.permissions);
  }

  if (result.scopeCode && result.code) {
    result.serviceSlug = parseServiceSlugFromCode(result.code, result.scopeCode);
  }

  if (!result.accessRestriction && data.security_config?.accessRestriction) {
    result.accessRestriction = data.security_config.accessRestriction;
  }

  result.transportEndpoints = buildTransportEndpoints(result);

  return result;
}

function resolveServiceCode(payload) {
  return resolvePayloadCode(payload);
}

async function assertEntityMaterialized(entityId, connectionId) {
  const mat = await BizdataMaterializationEntity.findOne({
    where: { entity_id: entityId, ddl_applied: true },
    include: [{
      model: BizdataMaterializationRun,
      as: 'run',
      required: true,
      where: { connection_id: connectionId, status: 'success' },
    }],
    order: [['created_at', 'DESC']],
  });

  if (!mat) {
    throw Object.assign(
      new Error('所选实体在该数据库连接下尚未成功物化，请先在「数据执行」中完成物化'),
      { status: 409 },
    );
  }
  return mat;
}

async function syncOperations(apiServiceId, enabledOperations, transaction, serviceSnapshot = null) {
  await BizdataApiServiceOperation.destroy({
    where: { api_service_id: apiServiceId },
    transaction,
  });

  let serviceRow = serviceSnapshot;
  if (!serviceRow) {
    serviceRow = await BizdataApiService.findByPk(apiServiceId, { transaction });
  }
  const serviceForSchema = serviceRow ? formatService(serviceRow) : null;
  let entity = null;
  let enumMap = null;
  if (serviceRow?.entity_id) {
    entity = await businessDataService.getEntityById(serviceRow.entity_id);
  }
  enumMap = await loadEnumMapForEntity(entity, serviceForSchema);

  const rows = enabledOperations.map((operation, index) => {
    const meta = getOperationMeta(operation);
    if (!meta) return null;
    let parametersSchema = {};
    if (serviceForSchema) {
      ({ jsonSchema: parametersSchema } = getParameterSchema(serviceForSchema, operation, entity, enumMap));
    }
    return {
      api_service_id: apiServiceId,
      operation,
      http_method: meta.httpMethod,
      route_pattern: meta.routePattern,
      parameters_schema: parametersSchema,
      is_enabled: true,
      sort_order: index,
    };
  }).filter(Boolean);

  if (rows.length) {
    await BizdataApiServiceOperation.bulkCreate(rows, { transaction });
  }
}

async function listServices({
  codePrefix,
  status,
  tag,
  entityId,
  connectionId,
  page = 1,
  size = 100,
} = {}) {
  const where = {};
  const normalizedStatus = normalizeListStatus(status);
  if (normalizedStatus) where.status = normalizedStatus;
  if (entityId) where.entity_id = entityId;
  if (connectionId) where.connection_id = connectionId;
  if (codePrefix) {
    const prefix = String(codePrefix).trim();
    if (prefix) {
      // 精确 | 域段边界 prefix: | 末段软前缀 prefix%（BomInstance → BomInstanceCreate）
      // Op.startsWith 由 Sequelize 转义 LIKE 通配符
      where[Op.or] = [
        { code: prefix },
        { code: { [Op.startsWith]: `${prefix}:` } },
        { code: { [Op.startsWith]: prefix } },
      ];
    }
  }
  if (tag) {
    where.tags = { [Op.contains]: [tag] };
  }

  const limit = size === -1 ? undefined : Math.min(Math.max(size, 1), 500);
  const offset = limit ? (Math.max(page, 1) - 1) * limit : undefined;

  const { count, rows } = await BizdataApiService.findAndCountAll({
    where,
    include: [
      { model: BizdataEntity, as: 'entity', attributes: ['id', 'code', 'label'], required: false },
      { model: BizdataDatabaseConnection, as: 'connection', attributes: ['id', 'name', 'db_type'], required: false },
    ],
    order: [['code', 'ASC']],
    limit,
    offset,
  });

  return {
    total: count,
    items: rows.map((row) => formatService(row)),
  };
}

async function getServiceTree({ codePrefix } = {}) {
  const { items } = await listServices({ codePrefix, size: -1 });
  const filtered = codePrefix
    ? items.filter((item) => matchesCodePrefix(item.code, codePrefix))
    : items;
  return buildDomainTreeFromServices(filtered);
}

async function getServiceById(id, options = {}) {
  const row = await BizdataApiService.findByPk(id, {
    include: [
      { model: BizdataEntity, as: 'entity', attributes: ['id', 'code', 'label'], required: false },
      { model: BizdataDatabaseConnection, as: 'connection', attributes: ['id', 'name', 'db_type'], required: false },
      ...(options.includeOperations
        ? [{ model: BizdataApiServiceOperation, as: 'operations', required: false }]
        : []),
      ...(options.includePermissions
        ? [{ model: BizdataApiServicePermission, as: 'permissions', required: false }]
        : []),
    ],
    order: options.includeOperations ? [[{ model: BizdataApiServiceOperation, as: 'operations' }, 'sort_order', 'ASC']] : undefined,
  });
  return formatService(row, options);
}

async function getServiceByCode(code, options = {}) {
  const row = await BizdataApiService.findOne({
    where: { code },
    include: [
      { model: BizdataEntity, as: 'entity', attributes: ['id', 'code', 'label'], required: false },
      { model: BizdataDatabaseConnection, as: 'connection', attributes: ['id', 'name', 'db_type'], required: false },
      ...(options.includeOperations
        ? [{ model: BizdataApiServiceOperation, as: 'operations', required: false }]
        : []),
    ],
  });
  return formatService(row, options);
}

async function getServiceByRoutePath(routePath, options = {}) {
  const row = await BizdataApiService.findOne({
    where: { route_path: routePath },
    include: [
      { model: BizdataEntity, as: 'entity', attributes: ['id', 'code', 'label'], required: false },
      { model: BizdataDatabaseConnection, as: 'connection', attributes: ['id', 'name', 'db_type'], required: false },
      ...(options.includeOperations
        ? [{ model: BizdataApiServiceOperation, as: 'operations', required: false }]
        : []),
      ...(options.includePermissions
        ? [{ model: BizdataApiServicePermission, as: 'permissions', required: false }]
        : []),
    ],
    order: options.includeOperations
      ? [[{ model: BizdataApiServiceOperation, as: 'operations' }, 'sort_order', 'ASC']]
      : undefined,
  });
  return formatService(row, options);
}

async function createService(payload, createdBy) {
  const code = resolvePayloadCode(payload);
  const routePath = codeToRoutePath(code);
  const scopeCode = resolveScopeCode(payload, code);
  const entityId = payload.entityId || payload.entity_id || null;
  let connectionId = payload.connectionId || payload.connection_id || null;

  if (!connectionId) {
    const resolved = await resolveConnection({
      scopeCode,
      entityId,
      entityCodes: payload.entityCodes || payload.entity_codes,
    });
    connectionId = resolved.connectionId;
  }

  const connRow = await databaseConnectionService.resolveConnectionRecord(connectionId);
  const targetSchema = payload.targetSchema
    || payload.target_schema
    || connRow.target_schema
    || await businessDataService.getDefaultMaterializationSchema();

  let entityCode = null;
  let tableName = null;

  const definitionScript = payload.definitionScript
    || payload.definition_script
    || null;
  const handlerScript = payload.handlerScript || payload.handler_script || null;
  const scriptMode = normalizeScriptMode(payload.scriptMode || payload.script_mode);
  const requestParameterInterface = payload.requestParameterInterface
    || payload.request_parameter_interface
    || null;

  if (scriptMode === 'typescript' && !handlerScript?.trim()) {
    throw Object.assign(new Error('TypeScript Handler 模式下 handlerScript 不能为空'), { status: 400 });
  }
  if (scriptMode === 'typescript' && handlerScript?.trim()) {
    assertHandlerScriptValid(handlerScript, { requestParameterInterface });
  }
  if (scriptMode === 'sql' && !definitionScript?.trim() && !entityId) {
    throw Object.assign(new Error('SQL 模式下需提供 definitionScript 或绑定实体'), { status: 400 });
  }

  if (entityId) {
    const entity = await BizdataEntity.findByPk(entityId);
    if (!entity || entity.entity_kind !== 'er_table') {
      throw Object.assign(new Error('绑定实体须为 ER 表类型'), { status: 400 });
    }
    // 已提供自定义 SQL 时不再强制校验物化记录
    if (!definitionScript) {
      await assertEntityMaterialized(entityId, connectionId);
    }
    entityCode = entity.code;
    tableName = resolveEntityTableName(entity.code, entity.table_name);
  }

  const enabledOperations = normalizeEnabledOperations(
    payload.enabledOperations || payload.enabled_operations,
  );
  const name = String(payload.name || '').trim() || code.split(':').pop();
  const tags = Array.isArray(payload.tags) ? payload.tags.map(String) : [];

  const existing = await BizdataApiService.findOne({ where: { code } });
  if (existing) {
    throw Object.assign(new Error(`code "${code}" 已存在`), { status: 409 });
  }

  const scriptOverrides = { ...(payload.scriptOverrides || payload.script_overrides || {}) };
  if (definitionScript) {
    scriptOverrides.__definition__ = definitionScript;
  }
  if (handlerScript) {
    scriptOverrides.__handler__ = handlerScript;
  }

  const accessRestriction = normalizeAccessRestriction(
    payload.accessRestriction || payload.access_restriction,
  );
  const transportProtocols = normalizeTransportProtocols(
    payload.transportProtocols || payload.transport_protocols,
  );

  const serviceId = await sequelize.transaction(async (transaction) => {
    const service = await BizdataApiService.create({
      code,
      route_path: routePath,
      name,
      description: payload.description || null,
      tags,
      status: 'draft',
      entity_id: entityId,
      entity_code: entityCode,
      connection_id: connectionId,
      table_name: tableName,
      scope_code: scopeCode,
      script_mode: scriptMode,
      handler_script: handlerScript,
      request_parameter_interface: requestParameterInterface,
      target_schema: targetSchema,
      definition_script: definitionScript,
      base_path: `/api/v1/data/${routePath}`,
      enabled_operations: enabledOperations,
      transport_protocols: transportProtocols,
      security_config: mergeSecurityConfigOverrides({
        ...DEFAULT_SECURITY_CONFIG,
        ...(payload.securityConfig || payload.security_config || {}),
        accessRestriction,
      }, payload),
      script_overrides: scriptOverrides,
      version: 0,
      created_by: createdBy || null,
    }, { transaction });

    await syncOperations(service.id, enabledOperations, transaction, service);
    await syncPermissions(service.id, accessRestriction, transaction);
    return service.id;
  });

  const created = await getServiceById(serviceId, {
    includeOperations: true,
    includePermissions: true,
  });
  if (!created) {
    throw Object.assign(new Error(`API 服务 "${code}" 创建后读取失败`), { status: 500 });
  }
  return created;
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} payload
 * @param {{ retainPublishedStatus?: boolean }} [options]
 *   retainPublishedStatus: 仅写测试 mock / requestExample 等非契约字段时为 true，
 *   避免把已 published 的服务静默降回 draft（并行 test+publish 的根因）。
 */
async function updateService(id, payload, options = {}) {
  const service = await BizdataApiService.findByPk(id);
  if (!service) {
    return null;
  }

  const updates = {};
  if (payload.name != null) updates.name = String(payload.name).trim() || service.name;
  if (payload.description != null) updates.description = payload.description;
  if (payload.tags != null) updates.tags = Array.isArray(payload.tags) ? payload.tags.map(String) : [];

  if (payload.transportProtocols != null || payload.transport_protocols != null) {
    updates.transport_protocols = normalizeTransportProtocols(
      payload.transportProtocols || payload.transport_protocols,
    );
  }

  const nextScopeCode = payload.scopeCode != null || payload.scope_code != null
    ? validateScopeCode(payload.scopeCode || payload.scope_code)
    : service.scope_code;
  if (payload.scopeCode != null || payload.scope_code != null) {
    updates.scope_code = nextScopeCode;
  }

  if (payload.scriptMode != null || payload.script_mode != null) {
    updates.script_mode = normalizeScriptMode(payload.scriptMode || payload.script_mode);
  }
  if (payload.handlerScript != null || payload.handler_script != null) {
    updates.handler_script = payload.handlerScript || payload.handler_script;
  }
  if (payload.requestParameterInterface != null || payload.request_parameter_interface != null) {
    updates.request_parameter_interface = payload.requestParameterInterface
      || payload.request_parameter_interface;
  }

  if (payload.securityConfig != null || payload.security_config != null) {
    updates.security_config = {
      ...service.security_config,
      ...(payload.securityConfig || payload.security_config),
    };
  }
  if (
    payload.responseOverrides != null
    || payload.response_overrides != null
    || payload.requestOverrides != null
    || payload.request_overrides != null
  ) {
    updates.security_config = mergeSecurityConfigOverrides(
      updates.security_config || service.security_config || {},
      payload,
    );
  }
  if (payload.scriptOverrides != null || payload.script_overrides != null) {
    updates.script_overrides = payload.scriptOverrides || payload.script_overrides;
  }
  if (payload.definitionScript != null || payload.definition_script != null) {
    const definitionScript = payload.definitionScript || payload.definition_script;
    updates.definition_script = definitionScript;
    updates.script_overrides = {
      ...(updates.script_overrides || service.script_overrides || {}),
      __definition__: definitionScript,
    };
  }
  if (payload.handlerScript != null || payload.handler_script != null) {
    const handlerScript = payload.handlerScript || payload.handler_script;
    updates.handler_script = handlerScript;
    updates.script_overrides = {
      ...(updates.script_overrides || service.script_overrides || {}),
      __handler__: handlerScript,
    };
  }

  if (payload.code != null) {
    updates.code = validateCode(payload.code);
    updates.route_path = codeToRoutePath(updates.code);
    updates.base_path = `/api/v1/data/${updates.route_path}`;
  } else if (payload.serviceSlug != null || payload.service_slug != null) {
    const scopeForCode = nextScopeCode || service.scope_code;
    if (!scopeForCode) {
      throw Object.assign(new Error('更新 serviceSlug 前须配置 scopeCode'), { status: 400 });
    }
    updates.code = buildCodeFromScopeAndSlug(scopeForCode, payload.serviceSlug || payload.service_slug);
    updates.route_path = codeToRoutePath(updates.code);
    updates.base_path = `/api/v1/data/${updates.route_path}`;
  }

  const scopeChanged = updates.scope_code && updates.scope_code !== service.scope_code;
  const explicitConnectionId = payload.connectionId || payload.connection_id;
  if (explicitConnectionId) {
    updates.connection_id = explicitConnectionId;
  } else if (scopeChanged) {
    const resolved = await resolveConnection({
      scopeCode: updates.scope_code,
      entityId: service.entity_id,
    });
    updates.connection_id = resolved.connectionId;
  }

  const enabledOperations = payload.enabledOperations || payload.enabled_operations;
  if (enabledOperations != null) {
    updates.enabled_operations = normalizeEnabledOperations(enabledOperations);
  }

  const accessRestrictionInput = payload.accessRestriction || payload.access_restriction;

  const nextScriptMode = updates.script_mode || service.script_mode;
  const nextHandlerScript = updates.handler_script !== undefined
    ? updates.handler_script
    : service.handler_script;
  const nextRequestParameterInterface = updates.request_parameter_interface !== undefined
    ? updates.request_parameter_interface
    : service.request_parameter_interface;
  if (nextScriptMode === 'typescript' && nextHandlerScript?.trim()) {
    assertHandlerScriptValid(nextHandlerScript, {
      requestParameterInterface: nextRequestParameterInterface,
    });
  }

  const hasMutation = Object.keys(updates).length > 0
    || accessRestrictionInput != null
    || enabledOperations != null;
  const retainPublishedStatus = options.retainPublishedStatus === true;
  if (service.status === 'published' && hasMutation && !retainPublishedStatus) {
    updates.status = 'draft';
  }

  await sequelize.transaction(async (transaction) => {
    if (Object.keys(updates).length > 0) {
      await service.update(updates, { transaction });
    }
    if (enabledOperations != null) {
      await syncOperations(service.id, updates.enabled_operations, transaction);
    }
    if (accessRestrictionInput != null) {
      const normalized = await syncPermissions(service.id, accessRestrictionInput, transaction);
      await service.update({
        security_config: {
          ...service.security_config,
          ...(updates.security_config || {}),
          accessRestriction: normalized,
        },
      }, { transaction });
    }
  });

  return getServiceById(id, { includeOperations: true, includePermissions: true });
}

async function setServiceStatus(id, status) {
  const existing = await BizdataApiService.findByPk(id, {
    attributes: ['id', 'status', 'version'],
  });
  if (!existing) return null;

  if (status === 'published') {
    // 原子更新：避免读改写竞态；已是 published 则 no-op（仍返回当前行）
    if (existing.status !== 'published') {
      const [affected] = await BizdataApiService.update(
        {
          status: 'published',
          version: sequelize.literal('version + 1'),
          published_at: new Date(),
        },
        {
          where: {
            id,
            status: { [Op.in]: ['draft', 'disabled'] },
          },
        },
      );
      if (!affected) {
        const raced = await getServiceById(id, { includeOperations: true });
        if (raced?.status === 'published') return raced;
        throw Object.assign(
          new Error('发布失败：状态未能更新为 published，请重试'),
          { status: 409 },
        );
      }
    }
    const published = await getServiceById(id, { includeOperations: true });
    if (!published) return null;
    if (published.status !== 'published') {
      throw Object.assign(
        new Error(
          '发布未持久化：服务在发布过程中被其他更新回退，请重试 apiservice_publish_service',
        ),
        { status: 409 },
      );
    }
    return published;
  }

  await BizdataApiService.update({ status }, { where: { id } });
  return getServiceById(id, { includeOperations: true });
}

async function deleteService(id) {
  const service = await BizdataApiService.findByPk(id);
  if (!service) return false;
  await sequelize.transaction(async (transaction) => {
    await BizdataApiServiceOperation.destroy({ where: { api_service_id: id }, transaction });
    await BizdataApiServicePermission.destroy({ where: { api_service_id: id }, transaction });
    await service.destroy({ transaction });
  });
  return true;
}

function getOperationCatalog() {
  return OPERATION_CATALOG;
}

module.exports = {
  DEFAULT_SECURITY_CONFIG,
  DEFAULT_ENABLED_OPERATIONS,
  formatService,
  listServices,
  getServiceTree,
  getServiceById,
  getServiceByCode,
  getServiceByRoutePath,
  createService,
  updateService,
  setServiceStatus,
  deleteService,
  getOperationCatalog,
  resolveServiceCode,
  parseServiceSlugFromCode,
  resolveConnection,
};
