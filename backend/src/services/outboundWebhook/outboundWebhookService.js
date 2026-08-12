const { Op } = require('sequelize');
const { OutboundWebhook, OutboundWebhookRun } = require('../../models');
const { executeTransformScript, buildWebhookScriptContext } = require('./outboundScriptRuntime');
const { requestJson, ALLOWED_METHODS } = require('./outboundHttpClient');
const { evaluateResponse } = require('./outboundResponseRules');
const { encryptApiKey, decryptApiKey } = require('../../utils/encryption');
const logger = require('../../utils/logger');

const AUTH_TYPES = new Set(['none', 'bearer', 'api_key']);
const AUTH_SEND_MODES = new Set(['header', 'query']);

function normalizeHttpMethod(method) {
  const m = String(method || 'POST').toUpperCase();
  return ALLOWED_METHODS.has(m) ? m : 'POST';
}

function normalizeAuthType(type) {
  const t = String(type || 'none').toLowerCase();
  return AUTH_TYPES.has(t) ? t : 'none';
}

function normalizeAuthSendMode(mode) {
  if (mode == null || mode === '') return null;
  const m = String(mode).toLowerCase();
  return AUTH_SEND_MODES.has(m) ? m : 'header';
}

function normalizeResponseConfig(cfg) {
  if (cfg == null) return null;
  if (typeof cfg === 'string') {
    try {
      return JSON.parse(cfg);
    } catch {
      return null;
    }
  }
  if (typeof cfg !== 'object') return null;
  return cfg;
}

function maskSecret(enc) {
  if (!enc) return null;
  try {
    const plain = decryptApiKey(enc);
    if (!plain) return '****';
    if (plain.length <= 4) return '****';
    return `${'*'.repeat(Math.min(8, plain.length - 4))}${plain.slice(-4)}`;
  } catch {
    return '****';
  }
}

/* ========== 格式化 ========== */

function formatWebhook(row) {
  if (!row) return null;
  const data = row.toJSON ? row.toJSON() : row;
  const authType = normalizeAuthType(data.auth_type);
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
    httpMethod: normalizeHttpMethod(data.http_method),
    authType,
    authSendMode: data.auth_send_mode || null,
    authKeyName: data.auth_key_name || null,
    authSecretSet: Boolean(data.auth_secret_enc),
    authSecretMasked: maskSecret(data.auth_secret_enc),
    requestStructure: data.request_structure,
    requestExample: data.request_example,
    transformScript: data.transform_script,
    mockData: data.mock_data,
    responseConfig: data.response_config || null,
    version: data.version,
    publishedAt: data.published_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * 根据 webhook 行构建外呼鉴权 headers / query
 */
function buildAuthOptions(row) {
  const authType = normalizeAuthType(row.auth_type);
  const headers = {};
  const query = {};
  if (authType === 'none' || !row.auth_secret_enc) {
    return { headers, query };
  }

  let secret;
  try {
    secret = decryptApiKey(row.auth_secret_enc);
  } catch (err) {
    throw Object.assign(new Error(`鉴权密钥解密失败: ${err.message}`), { status: 500 });
  }
  if (!secret) return { headers, query };

  if (authType === 'bearer') {
    const keyName = row.auth_key_name || 'Authorization';
    const value = secret.startsWith('Bearer ') ? secret : `Bearer ${secret}`;
    headers[keyName] = value;
    return { headers, query };
  }

  if (authType === 'api_key') {
    const sendMode = normalizeAuthSendMode(row.auth_send_mode) || 'header';
    const keyName = row.auth_key_name || (sendMode === 'query' ? 'api_key' : 'X-API-Key');
    if (sendMode === 'query') {
      query[keyName] = secret;
    } else {
      headers[keyName] = secret;
    }
  }

  return { headers, query };
}

async function dispatchOutbound(row, transformedBody) {
  const { headers, query } = buildAuthOptions(row);
  const resp = await requestJson(row.target_url, transformedBody, {
    method: normalizeHttpMethod(row.http_method),
    headers,
    query,
  });

  const evaluation = evaluateResponse({
    httpStatus: resp.status,
    responseBody: resp.body,
    responseConfig: row.response_config,
  });

  // 网络层错误优先
  if (resp.error && !resp.status) {
    return {
      resp,
      status: 'failed',
      errorMessage: resp.error,
      evaluation: {
        ok: false,
        matchedRules: [],
        httpFailed: true,
        errorMessage: resp.error,
      },
    };
  }

  return {
    resp,
    status: evaluation.ok ? 'success' : 'failed',
    errorMessage: evaluation.ok ? null : (evaluation.errorMessage || resp.error || null),
    evaluation,
  };
}

function applyAuthSecretUpdate(updates, body) {
  // authSecret 未传或空字符串：保留原密钥；有非空值才覆盖加密
  // 清除密钥：将 authType 设为 none（见下方）
  if (body.authSecret === undefined && body.auth_secret === undefined) return;
  const secret = body.authSecret !== undefined ? body.authSecret : body.auth_secret;
  if (typeof secret === 'string' && secret.length > 0) {
    updates.auth_secret_enc = encryptApiKey(secret);
  }
}

function pickWritableFields(body) {
  const updates = {};
  const fieldMap = {
    name: 'name',
    description: 'description',
    targetUrl: 'target_url',
    httpMethod: 'http_method',
    authType: 'auth_type',
    authSendMode: 'auth_send_mode',
    authKeyName: 'auth_key_name',
    requestStructure: 'request_structure',
    requestExample: 'request_example',
    transformScript: 'transform_script',
    mockData: 'mock_data',
    triggerApiServiceId: 'trigger_api_service_id',
    triggerApiServiceCode: 'trigger_api_service_code',
  };

  Object.keys(fieldMap).forEach((f) => {
    if (body[f] !== undefined) {
      let val = body[f];
      if (f === 'httpMethod') val = normalizeHttpMethod(val);
      if (f === 'authType') val = normalizeAuthType(val);
      if (f === 'authSendMode') val = normalizeAuthSendMode(val);
      updates[fieldMap[f]] = val;
    }
  });

  if (body.responseConfig !== undefined) {
    updates.response_config = normalizeResponseConfig(body.responseConfig);
  }

  applyAuthSecretUpdate(updates, body);

  // 鉴权关闭时清除密钥与发送配置
  if (updates.auth_type === 'none') {
    updates.auth_secret_enc = null;
    updates.auth_send_mode = null;
    updates.auth_key_name = null;
  }

  return updates;
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
  return OutboundWebhook.findByPk(id, { include });
}

async function createWebhook(body) {
  const { code, name, targetUrl } = body;

  if (!code || !name || !targetUrl) {
    throw Object.assign(new Error('code、name、targetUrl 为必填项'), { status: 400 });
  }

  const existing = await OutboundWebhook.findOne({ where: { code } });
  if (existing) {
    throw Object.assign(new Error('code 已存在'), { status: 409 });
  }

  const writable = pickWritableFields(body);
  const row = await OutboundWebhook.create({
    code,
    name,
    description: body.description || null,
    status: 'draft',
    trigger_type: 'api_hook',
    trigger_api_service_id: body.triggerApiServiceId || null,
    trigger_api_service_code: body.triggerApiServiceCode || null,
    target_url: targetUrl,
    http_method: normalizeHttpMethod(body.httpMethod),
    auth_type: normalizeAuthType(body.authType),
    auth_send_mode: normalizeAuthSendMode(body.authSendMode),
    auth_key_name: body.authKeyName || null,
    request_structure: body.requestStructure || null,
    request_example: body.requestExample || null,
    transform_script: body.transformScript || null,
    mock_data: body.mockData || null,
    response_config: normalizeResponseConfig(body.responseConfig),
    ...writable,
  });
  return formatWebhook(row);
}

async function updateWebhook(id, body) {
  const row = await OutboundWebhook.findByPk(id);
  if (!row) {
    throw Object.assign(new Error('Webhook 不存在'), { status: 404 });
  }

  const updates = pickWritableFields(body);
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
    hint: '测试将用 Mock Data 运行处置脚本，然后真实调用目标 URL。请确保目标可达。',
  };
}

async function testWebhook(id, { mockData } = {}) {
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
  let evaluation = null;

  try {
    const rawMock = mockData || row.mock_data || '{}';
    let inputData;
    try {
      inputData = typeof rawMock === 'string' ? JSON.parse(rawMock) : rawMock;
    } catch {
      inputData = rawMock;
    }

    if (row.transform_script) {
      const ctx = buildWebhookScriptContext({ webhook: row });
      transformedBody = await executeTransformScript(row.transform_script, inputData, ctx);
    } else {
      transformedBody = inputData;
    }

    const dispatched = await dispatchOutbound(row, transformedBody);
    respStatus = dispatched.resp.status;
    respBody = dispatched.resp.body;
    status = dispatched.status;
    errorMessage = dispatched.errorMessage;
    evaluation = dispatched.evaluation;
  } catch (err) {
    status = 'failed';
    errorMessage = err.message;
  }

  const durationMs = Date.now() - start;

  const run = await OutboundWebhookRun.create({
    webhook_id: id,
    run_type: 'test',
    trigger_data: typeof mockData === 'string'
      ? (() => { try { return JSON.parse(mockData); } catch { return mockData; } })()
      : mockData,
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
    evaluation,
  };
}

/* ========== 触发（被业务 API Hook 调用） ========== */

/**
 * 业务 API 成功后触发：查找绑定的 webhook，运行处置脚本，调用外部 API。
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

      const dispatched = await dispatchOutbound(webhook, transformedBody);
      respStatus = dispatched.resp.status;
      respBody = dispatched.resp.body;
      status = dispatched.status;
      errorMessage = dispatched.errorMessage;
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
  evaluateResponse,
  buildAuthOptions,
};
