const collectionPipelineService = require('./collectionPipelineService');
const collectionPipelineExecutionService = require('./collectionPipelineExecutionService');
const { normalizeRawBody } = require('./collectionScriptRuntime');

async function ingestByRoutePath(routePath, {
  rawBuffer,
  contentType,
  applicationId,
} = {}) {
  const pipeline = await collectionPipelineService.getPipelineByRoutePath(routePath, {
    includeApplications: true,
  });

  if (!pipeline) {
    throw Object.assign(new Error('采集管道不存在'), { status: 404 });
  }
  if (pipeline.status !== 'published') {
    throw Object.assign(new Error('采集管道未发布'), { status: 403 });
  }

  await collectionPipelineService.assertApplicationAllowed(pipeline, applicationId);

  const rawInput = normalizeRawBody(rawBuffer, contentType);

  return collectionPipelineExecutionService.executePipeline(pipeline, rawInput, {
    runType: 'ingest',
    rollback: false,
    sourceApplicationId: applicationId,
  });
}

module.exports = {
  ingestByRoutePath,
};
