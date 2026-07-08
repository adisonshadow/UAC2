const collectionPipelineService = require('./collectionPipelineService');
const businessDataService = require('../businessData/businessDataService');

async function loadEntityForPipeline(pipeline) {
  if (!pipeline?.entityId) return null;
  return businessDataService.getEntityById(pipeline.entityId);
}

async function getTestProfile(pipelineId) {
  const pipeline = await collectionPipelineService.getPipelineById(pipelineId, {
    includeApplications: true,
  });
  if (!pipeline) return null;

  const entity = await loadEntityForPipeline(pipeline);
  const basePath = pipeline.basePath;

  return {
    pipelineId: pipeline.id,
    code: pipeline.code,
    name: pipeline.name,
    routePath: pipeline.routePath,
    basePath,
    ingestUrl: basePath,
    ingestMethod: 'POST',
    protocolType: pipeline.protocolType,
    status: pipeline.status,
    sampleData: pipeline.sampleData,
    targetStructure: pipeline.targetStructure,
    parseScript: pipeline.parseScript,
    storeScript: pipeline.storeScript,
    entityCode: pipeline.entityCode,
    entityId: pipeline.entityId,
    tableName: pipeline.tableName,
    targetSchema: pipeline.targetSchema,
    restrictSources: pipeline.restrictSources,
    applicationIds: pipeline.applicationIds || [],
    entity: entity
      ? { id: entity.id, code: entity.code, label: entity.label }
      : undefined,
    authHint: '使用业务系统 application_id + app_secret 换取 JWT，请求头 Authorization: Bearer {token}',
    bodyHint: 'Content-Type: text/plain 或 application/octet-stream；二进制 body 在解析脚本中收到 hex 字符串',
  };
}

module.exports = {
  getTestProfile,
};
