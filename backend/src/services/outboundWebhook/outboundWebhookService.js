const { Op } = require('sequelize');
const { OutboundWebhook, OutboundWebhookRun, sequelize } = require('../../models');
const { executeTransformScript, buildWebhookScriptContext } = require('./outboundScriptRuntime');
const { postJson } = require('./outboundHttpClient');
const logger = require('../../utils/logger');

/* ========== 格式化 ========== */

function formatWebhook(row, { includeRuns = false } = {}) {
  if (!row) return null;
  const data = row.toJSON ? row.toJSON() : row;
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    description: data.description,
    status: data.status,
    triggerType: data.trigger_type,
    triggerApiServiceId: data.trigger_api_service_id,
    triggerApiServiceCode: data.trigger_api_service_code,
    targetUrl: data.target_url,
    requestStructure: data.request_structure,
    transformScript: data.transform_script,
    mockData: data.mock_data,
    version: data.version,
    publishedAt: data.published_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/* ========== CRUD ========== */

async function listWebhooks({ codePrefix, status, page = 1, size = 100 } = {}) {
  const where = { status: { [Op.ne]: 'deleted' } };
  if (codePrefix) where.code = { [Op.iLike]: `${codePrefix}%` };
  if (status && status !== 'ALL') where.status = status;

  const { count, rows } = await OutboundWebhook.findAndCountAll({
    where,
    offset: (page - 1) * size,
    limit: size === -1 ? undefined : size,
    order: [['created_at', 'DESC']],
  });
  return { total: count, items: rows.map(formatWebhook), page, size };
}

async function getWebhookById(id, { includeRuns = false } = {}) {
  const include = [];
  if (includeRuns) {
    include.push({
      model: OutboundWebhookRun,
      as: 'runs',
      separate: true,
      limit: 10,
      order: [['created_at', 'DESC']],
    });
  }
  const row = await OutboundWebhook.findByPk(id, { include });
  return row;
}

async function createWebhook(body) {
  const { code, name, description, triggerApiServiceId, triggerApiServiceCode, targetUrl,
    requestStructure, transformScript, mockData } = body;

  if (!code || !name || !targetUrl) {
    throw Object.assign(new Error('code、name、targetUrl 为必填项'), { status: 400 });
  }

  const existing = await OutboundWebhook.findOne({ where: { code } });
  if (existing) {
    throw Object.assign(new Error('code 已存在'), { status: 409 });
  }

  const row = await OutboundWebhook.create({
    code,
    name,
    description,
    status: 'draft',
    trigger_type: 'api_hook',
    trigger_api_service_id: triggerApiServiceId || null,
    trigger_api_service_code: triggerApiServiceCode || null,
    target_url: targetUrl,
    request_structure: requestStructure || null,
    transform_script: transformScript || null,
    mock_data: mockData || null,
  });
  return formatWebhook(row);
}

async function updateWebhook(id, body) {
  const row = await OutboundWebhook.findByPk(id);
  if (!row) {
    throw Object.assign(new Error('Webhook 不存在'), { status: 404 });
  }

  const updates = {};
  const fields = ['name', 'description', 'targetUrl', 'requestStructure', 'transformScript', 'mockData',
    'triggerApiServiceId', 'triggerApiServiceCode'];
  const fieldMap = {
    name: 'name', description: 'description', targetUrl: 'target_url',
    requestStructure: 'request_structure', transformScript: 'transform_script',
    mockData: 'mock_data', triggerApiServiceId: 'trigger_api_service_id',
    triggerApiServiceCode: 'trigger_api_service_code',
  };
  fields.forEach((f) => {
    if (body[f] !== undefined) updates[fieldMap[f]] = body[f];
  });

  if (Object.keys(updates).length) {
    await row.update(updates);
  }
  return formatWebhook(row);
}

async function setWebhookStatus(id, status) {
  const row = await OutboundWebhook.findByPk(id);
  if (!row) {
    throw Object.assign(new Error('Webhook 不存在'), { status: 404 });
  }
  if (status === 'published') {
    if (!row.target_url) {
      throw Object.assign(new Error('发布前须填写目标 URL'), { status: 400 });
    }
    if (!row.trigger_api_service_id) {
      throw Object.assign(new Error('发布前须绑定触发业务 API'), { status: 400 });
    }
    if (!row.transform_script) {
      throw Object.assign(new Error('发布前须编写处置脚本'), { status: 400 });
    }
    row.version = (row.version || 0) + 1;
    row.published_at = new Date();
  }
  row.status = status;
  await row.save();
  return formatWebhook(row);
}

async function deleteWebhook(id) {
  return setWebhookStatus(id, 'deleted');
}

/* ========== 测试 ========== */

async function getTestProfile(id) {
  const row = await getWebhookById(id);
  if (!row) {
    throw Object.assign(new Error('Webhook 不存在'), { status: 404 });
  }
  const w = formatWebhook(row);
  return {
    ...w,
    hint: '测试将用 Mock Data 运行处置脚本，然后真实 POST 到目标 URL。请确保目标 URL 可达。',
  };
}

async function testWebhook(id, { mockData, executedBy } = {}) {
  const row = await getWebhookById(id);
  if (!row) {
    throw Object.assign(new Error('Webhook 不存在'), { status: 404 });
  }

  const start = Date.now();
  let status = 'success';
  let errorMessage = null;
  let transformedBody = null;
  let respStatus = null;
  let respBody = null;

  try {
    // 解析输入数据
    const rawMock = mockData || row.mock_data || '{}';
    let inputData;
    try {
      inputData = typeof rawMock === 'string' ? JSON.parse(rawMock) : rawMock;
    } catch {
      inputData = rawMock;
    }

    // 运行处置脚本
    if (row.transform_script) {
      const ctx = buildWebhookScriptContext({ webhook: row });
      transformedBody = await executeTransformScript(row.transform_script, inputData, ctx);
    } else {
      transformedBody = inputData;
    }

    // 真实 POST 到外部 API
    const resp = await postJson(row.target_url, transformedBody);
    respStatus = resp.status;
    respBody = resp.body;
    if (!resp.ok) {
      status = 'failed';
      errorMessage = resp.error || `外部 API 返回非 2xx: ${resp.status}`;
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err.message;
  }

  const durationMs = Date.now() - start;

  // 记录 run
  const run = await OutboundWebhookRun.create({
    webhook_id: id,
    run_type: 'test',
    trigger_data: typeof mockData === 'string' ? (() => { try { return JSON.parse(mockData); } catch { return mockData; } })() : mockData,
    transformed_body: transformedBody,
    response_status: respStatus,
    response_body: respBody,
    status,
    error_message: errorMessage,
    duration_ms: durationMs,
  });

  return {
    runId: run.id,
    webhookId: id,
    runType: 'test',
    transformedBody,
    responseStatus: respStatus,
    responseBody: respBody,
    status,
    errorMessage,
    durationMs,
  };
}

/* ========== 触发（被业务 API Hook 调用） ========== */

/**
 * 业务 API 成功后触发：查找绑定的 webhook，运行处置脚本，POST 外部 API。
 * 同步触发但用 catch 吞错，不影响业务 API 主流程。
 */
async function triggerByApiService(apiServiceId, apiServiceResult) {
  const webhooks = await OutboundWebhook.findAll({
    where: {
      trigger_api_service_id: apiServiceId,
      status: 'published',
    },
  });

  if (!webhooks.length) return;

  for (const webhook of webhooks) {
    const start = Date.now();
    let status = 'success';
    let errorMessage = null;
    let transformedBody = null;
    let respStatus = null;
    let respBody = null;

    try {
      if (webhook.transform_script) {
        const ctx = buildWebhookScriptContext({ webhook });
        transformedBody = await executeTransformScript(
          webhook.transform_script,
          apiServiceResult,
          ctx,
        );
      } else {
        transformedBody = apiServiceResult;
      }

      const resp = await postJson(webhook.target_url, transformedBody);
      respStatus = resp.status;
      respBody = resp.body;
      if (!resp.ok) {
        status = 'failed';
        errorMessage = resp.error || `外部 API 返回非 2xx: ${resp.status}`;
      }
    } catch (err) {
      status = 'failed';
      errorMessage = err.message;
    }

    const durationMs = Date.now() - start;
    await OutboundWebhookRun.create({
      webhook_id: webhook.id,
      run_type: 'trigger',
      trigger_data: apiServiceResult,
      transformed_body: transformedBody,
      response_status: respStatus,
      response_body: respBody,
      status,
      error_message: errorMessage,
      duration_ms: durationMs,
    });

    if (status === 'failed') {
      logger.warn('外部 API 提交失败（不影响业务 API）', {
        webhookCode: webhook.code,
        error: errorMessage,
      });
    }
  }
}

/* ========== Run 历史 ========== */

async function listRuns(id, { page = 1, size = 20 } = {}) {
  const { count, rows } = await OutboundWebhookRun.findAndCountAll({
    where: { webhook_id: id },
    offset: (page - 1) * size,
    limit: size,
    order: [['created_at', 'DESC']],
  });
  return {
    total: count,
    items: rows.map((r) => ({
      id: r.id,
      webhookId: r.webhook_id,
      runType: r.run_type,
      triggerData: r.trigger_data,
      transformedBody: r.transformed_body,
      responseStatus: r.response_status,
      responseBody: r.response_body,
      status: r.status,
      errorMessage: r.error_message,
      durationMs: r.duration_ms,
      createdAt: r.created_at,
    })),
    page,
    size,
  };
}

module.exports = {
  formatWebhook,
  listWebhooks,
  getWebhookById,
  createWebhook,
  updateWebhook,
  setWebhookStatus,
  deleteWebhook,
  getTestProfile,
  testWebhook,
  triggerByApiService,
  listRuns,
};
