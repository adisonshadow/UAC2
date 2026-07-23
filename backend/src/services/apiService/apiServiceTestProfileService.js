const apiServiceService = require('./apiServiceService');
const businessDataService = require('../businessData/businessDataService');
const systemService = require('../system/systemService');
const { resolveEntityTableName } = require('../businessData/entityTableName');
const { getOperationMeta } = require('./operationCatalog');
const {
  buildMockParameters,
  buildRequestPreview,
  getParameterSchema,
  getResponseDefinition,
  isOperationExecutable,
  loadEnumMapForEntity,
} = require('./operationParameterSchemas');
const {
  readSavedRequestExample,
  writeRequestExampleToSecurityConfig,
} = require('./requestExampleStore');

async function loadEntityForService(service) {
  if (!service?.entityId) return null;
  return businessDataService.getEntityById(service.entityId);
}

async function enrichServiceTableName(service) {
  if (service?.tableName || !service?.entityId) return service;
  const entity = await loadEntityForService(service);
  if (!entity) return service;
  const tableName = resolveEntityTableName(entity.code, entity.table_name || entity.tableName);
  if (!tableName) return service;
  return { ...service, tableName };
}

function resolveMockParameters(service, operation, entity, securityConfig, enumMap = null) {
  const saved = readSavedRequestExample(securityConfig, operation);
  if (saved) {
    return { mockParameters: saved, mockParametersSource: 'saved' };
  }
  return {
    mockParameters: buildMockParameters(service, operation, entity, enumMap),
    mockParametersSource: 'generated',
  };
}

async function saveTestMockParameters(serviceId, operation, mockParameters) {
  if (!operation) {
    throw Object.assign(new Error('operation 必填'), { status: 400 });
  }
  if (!mockParameters || typeof mockParameters !== 'object' || Array.isArray(mockParameters)) {
    throw Object.assign(new Error('mockParameters 必须为对象'), { status: 400 });
  }

  const service = await apiServiceService.getServiceById(serviceId);
  if (!service) return null;

  const securityConfig = { ...(service.securityConfig || {}) };
  const nextSecurityConfig = writeRequestExampleToSecurityConfig(
    securityConfig,
    operation,
    mockParameters,
  );

  // 测试 mock / requestExample 不是契约变更：不得把 published 降回 draft
  // （否则并行 run_test + publish 会出现「Tool 报 published、库里仍是 draft」）
  await apiServiceService.updateService(
    serviceId,
    { securityConfig: nextSecurityConfig },
    { retainPublishedStatus: true },
  );

  return {
    serviceId,
    operation,
    mockParameters,
    saved: true,
  };
}

async function getTestProfile(serviceId) {
  const service = await apiServiceService.getServiceById(serviceId, { includeOperations: true });
  if (!service) return null;

  const features = await systemService.getSystemFeatures();
  const executionOptions = {
    allowWriteOperations: Boolean(features.apiServiceAllowWriteOperations),
    testAutoRollback: features.apiServiceTestAutoRollback !== false,
  };
  const serviceForTest = await enrichServiceTableName(service);
  const entity = await loadEntityForService(serviceForTest);
  const enumMap = await loadEnumMapForEntity(entity, serviceForTest);
  const securityConfig = { ...(serviceForTest.securityConfig || {}) };
  const enabledOps = serviceForTest.enabledOperations || [];

  const enabledOperations = enabledOps.map((operation) => {
    const meta = getOperationMeta(operation) || {};
    const { mockParameters, mockParametersSource } = resolveMockParameters(
      serviceForTest,
      operation,
      entity,
      securityConfig,
      enumMap,
    );
    const { jsonSchema } = getParameterSchema(serviceForTest, operation, entity, enumMap);
    const {
      responseInterface,
      responsesSchema,
      responseSchema,
      responseExample,
    } = getResponseDefinition(serviceForTest, operation, entity, mockParameters);
    const requestPreview = buildRequestPreview(serviceForTest, operation, mockParameters, entity);
    const exec = isOperationExecutable(serviceForTest, operation, executionOptions);
    const basePath = serviceForTest.basePath || `/api/v1/data/${serviceForTest.routePath}`;
    const routePattern = meta.routePattern || '';

    return {
      operation,
      httpMethod: meta.httpMethod || 'GET',
      routePattern,
      label: meta.label || operation,
      category: meta.category,
      url: `${basePath}${routePattern}`,
      parameterSchema: jsonSchema,
      mockParameters,
      mockParametersSource,
      requestPreview,
      responseInterface,
      responsesSchema,
      responseSchema,
      responseExample,
      executable: exec.executable,
      executableReason: exec.reason,
    };
  });

  return {
    serviceId: serviceForTest.id,
    code: serviceForTest.code,
    name: serviceForTest.name,
    basePath: serviceForTest.basePath || `/api/v1/data/${serviceForTest.routePath}`,
    routePath: serviceForTest.routePath,
    entityCode: serviceForTest.entityCode,
    entityId: serviceForTest.entityId,
    status: serviceForTest.status,
    scriptMode: serviceForTest.scriptMode,
    requestParameterInterface: serviceForTest.requestParameterInterface,
    testAutoRollback: executionOptions.testAutoRollback,
    enabledOperations,
    securityConfig,
    transportProtocols: serviceForTest.transportProtocols,
    transportEndpoints: serviceForTest.transportEndpoints,
  };
}

async function suggestTestParams(serviceId, { operation } = {}) {
  const service = await apiServiceService.getServiceById(serviceId, { includeOperations: true });
  if (!service) return null;

  const serviceForTest = await enrichServiceTableName(service);
  const entity = await loadEntityForService(serviceForTest);
  const enumMap = await loadEnumMapForEntity(entity, serviceForTest);
  const enabledOps = serviceForTest.enabledOperations || [];
  const op = operation || enabledOps[0];
  if (!op) {
    throw Object.assign(new Error('该服务未启用任何 operation'), { status: 400 });
  }
  if (!enabledOps.includes(op)) {
    throw Object.assign(new Error(`operation "${op}" 未在该服务中启用`), { status: 400 });
  }

  const mockParameters = buildMockParameters(serviceForTest, op, entity, enumMap);
  const { jsonSchema } = getParameterSchema(serviceForTest, op, entity, enumMap);
  const requestPreview = buildRequestPreview(serviceForTest, op, mockParameters, entity);

  return {
    serviceId: serviceForTest.id,
    code: serviceForTest.code,
    operation: op,
    mockParameters,
    parameterSchema: jsonSchema,
    requestPreview,
  };
}

module.exports = {
  getTestProfile,
  suggestTestParams,
  saveTestMockParameters,
};
