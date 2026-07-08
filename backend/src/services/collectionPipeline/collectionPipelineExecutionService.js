const { BizdataCollectionPipelineRun } = require('../../models');
const businessDataService = require('../businessData/businessDataService');
const databaseConnectionService = require('../businessData/databaseConnectionService');
const {
  withPgClient,
  withPgTransaction,
  quotePgIdentifier,
} = require('../businessData/materialization/connectionRunner');
const collectionPipelineService = require('./collectionPipelineService');
const {
  executeParseScript,
  executeStoreScript,
  buildScriptContext,
} = require('./collectionScriptRuntime');

function buildQueryPg(client) {
  return async (sql, params = []) => {
    const result = await client.query(sql, params);
    return result.rows;
  };
}

function buildTableQualified(pipeline) {
  const schema = pipeline.targetSchema || 'bizdata_mat';
  if (!pipeline.tableName) return null;
  return `${quotePgIdentifier(schema)}.${quotePgIdentifier(pipeline.tableName)}`;
}

async function loadEntity(pipeline) {
  if (!pipeline?.entityId) return null;
  return businessDataService.getEntityById(pipeline.entityId);
}

async function executePipeline(pipeline, rawInput, {
  runType = 'test',
  rollback = false,
  executedBy = null,
  sourceApplicationId = null,
} = {}) {
  if (!pipeline.parseScript?.trim()) {
    throw Object.assign(new Error('解析脚本为空'), { status: 400 });
  }
  if (!pipeline.storeScript?.trim()) {
    throw Object.assign(new Error('存储脚本为空'), { status: 400 });
  }
  if (!pipeline.entityId) {
    throw Object.assign(new Error('未绑定目标实体'), { status: 400 });
  }

  await collectionPipelineService.assertEntityMaterialized(
    pipeline.entityId,
    pipeline.connectionId,
  );

  const conn = await databaseConnectionService.resolveConnectionRecord(pipeline.connectionId);
  const runtime = databaseConnectionService.buildRuntimeConfig(conn);
  if (runtime.dbType !== 'postgresql') {
    throw Object.assign(
      new Error(`暂不支持 ${runtime.dbType} 连接类型的采集存储`),
      { status: 501 },
    );
  }

  const entity = await loadEntity(pipeline);
  const tableQualified = buildTableQualified(pipeline);
  const start = Date.now();
  let parseOutput;
  let storeOutput;
  let rolledBack = false;

  const runStore = async (client) => {
    const ctx = buildScriptContext({
      pipeline,
      entity,
      queryPg: buildQueryPg(client),
      tableQualified,
    });
    parseOutput = await executeParseScript(pipeline.parseScript, rawInput, ctx);
    storeOutput = await executeStoreScript(pipeline.storeScript, parseOutput, ctx);
    return storeOutput;
  };

  if (rollback) {
    const result = await withPgTransaction(runtime, runStore);
    storeOutput = result;
    rolledBack = result.rolledBack === true;
    if (storeOutput && typeof storeOutput === 'object') delete storeOutput.rolledBack;
  } else {
    storeOutput = await withPgClient(runtime, runStore);
  }

  const durationMs = Date.now() - start;

  const runRecord = await BizdataCollectionPipelineRun.create({
    pipeline_id: pipeline.id,
    run_type: runType,
    input_raw: rawInput,
    parse_output: parseOutput,
    store_output: storeOutput,
    status: 'success',
    duration_ms: durationMs,
    executed_by: executedBy,
    source_application_id: sourceApplicationId,
  });

  return {
    runId: runRecord.id,
    pipelineId: pipeline.id,
    code: pipeline.code,
    runType,
    inputRaw: rawInput,
    parseOutput,
    storeOutput,
    durationMs,
    rolledBack,
    status: 'success',
  };
}

async function testPipeline(pipelineId, {
  rawInput,
  runType = 'test',
  executedBy = null,
} = {}) {
  const pipeline = await collectionPipelineService.getPipelineById(pipelineId, {
    includeApplications: true,
  });
  if (!pipeline) return null;

  const input = rawInput ?? pipeline.sampleData ?? '';
  if (!String(input).trim()) {
    throw Object.assign(new Error('请提供样本数据或 rawInput'), { status: 400 });
  }

  try {
    return await executePipeline(pipeline, String(input), {
      runType,
      rollback: true,
      executedBy,
    });
  } catch (error) {
    await BizdataCollectionPipelineRun.create({
      pipeline_id: pipelineId,
      run_type: runType,
      input_raw: String(input),
      status: 'failed',
      error_message: error.message,
      executed_by: executedBy,
    });
    throw error;
  }
}

module.exports = {
  testPipeline,
  executePipeline,
};
