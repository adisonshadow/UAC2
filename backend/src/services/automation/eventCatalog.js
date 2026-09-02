/**
 * 钩子事件目录 —— 单一事实源。
 * 前端表单（事件选择器/负载示例）、AI 提示词、分发器校验共用本文件，
 * 经 GET /api/v1/automation/hooks/event-types 下发。
 */

const EVENT_TYPES = [
  {
    type: 'auth.user.login',
    label: '用户登录',
    category: 'auth',
    description: '用户登录成功后触发（含 SSO 分支）。不阻断登录响应。',
    filterFields: [],
    payloadSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: '用户 ID' },
        username: { type: 'string', description: '用户名' },
        ip: { type: 'string', description: '登录来源 IP' },
        user_agent: { type: 'string', description: '浏览器 UA' },
        login_at: { type: 'string', description: '登录时间（ISO）' },
        application_id: { type: 'string', description: 'SSO 应用 ID（非 SSO 登录为 null）' },
      },
    },
    example: {
      user_id: 'b3d1c0e2-0000-4000-8000-000000000001',
      username: 'admin',
      ip: '192.168.1.10',
      user_agent: 'Mozilla/5.0',
      login_at: '2026-08-31T08:00:00.000Z',
      application_id: null,
    },
  },
  {
    type: 'auth.user.logout',
    label: '用户登出',
    category: 'auth',
    description: '用户登出成功后触发。',
    filterFields: [],
    payloadSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        username: { type: 'string' },
        ip: { type: 'string' },
        logout_at: { type: 'string', description: '登出时间（ISO）' },
      },
    },
    example: {
      user_id: 'b3d1c0e2-0000-4000-8000-000000000001',
      username: 'admin',
      ip: '192.168.1.10',
      logout_at: '2026-08-31T09:30:00.000Z',
    },
  },
  {
    type: 'bizdata.record.created',
    label: '记录创建',
    category: 'bizdata',
    description: '已发布 Data API HTTP 调用中网关实体写 create/insertOne 成功且真实落库后触发。自定义写 SQL / TS Handler 不触发。',
    filterFields: ['entityCodes', 'apiServiceIds'],
    payloadSchema: {
      type: 'object',
      properties: {
        entity_code: { type: 'string', description: '实体编码，如 sale:Order' },
        after: { type: 'object', description: '创建后的完整记录' },
        api_service_id: { type: 'string' },
        operation: { type: 'string' },
      },
    },
    example: {
      entity_code: 'sale:Order',
      after: { id: '0d9f...', amount: 1500, status: 'created' },
      api_service_id: '5f1c...',
      operation: 'create',
    },
  },
  {
    type: 'bizdata.record.updated',
    label: '记录更新',
    category: 'bizdata',
    description: '已发布 Data API HTTP 调用中网关实体写 updateOne 成功且真实落库后触发。负载含变更前后数据。',
    filterFields: ['entityCodes', 'apiServiceIds', 'changedFields'],
    payloadSchema: {
      type: 'object',
      properties: {
        entity_code: { type: 'string' },
        before: { type: 'object', description: '更新前记录' },
        after: { type: 'object', description: '更新后记录' },
        changed_fields: { type: 'array', items: { type: 'string' }, description: '变更字段列表' },
        api_service_id: { type: 'string' },
        operation: { type: 'string' },
      },
    },
    example: {
      entity_code: 'sale:Order',
      before: { id: '0d9f...', amount: 1000 },
      after: { id: '0d9f...', amount: 1500 },
      changed_fields: ['amount'],
      api_service_id: '5f1c...',
      operation: 'updateOne',
    },
  },
  {
    type: 'bizdata.record.deleted',
    label: '记录删除',
    category: 'bizdata',
    description: '已发布 Data API HTTP 调用中网关实体写 deleteOne 成功且真实落库后触发。before 为被删记录。',
    filterFields: ['entityCodes', 'apiServiceIds'],
    payloadSchema: {
      type: 'object',
      properties: {
        entity_code: { type: 'string' },
        before: { type: 'object', description: '被删除的记录' },
        api_service_id: { type: 'string' },
        operation: { type: 'string' },
      },
    },
    example: {
      entity_code: 'sale:Order',
      before: { id: '0d9f...', amount: 1500 },
      api_service_id: '5f1c...',
      operation: 'deleteOne',
    },
  },
  {
    type: 'apiservice.invoked',
    label: 'API 服务被调用',
    category: 'apiservice',
    description: '已发布 Data API HTTP 调用完成后触发（成功与失败均触发；可按状态过滤）。SSE/WebSocket 不触发。',
    filterFields: ['apiServiceIds', 'operations', 'invokeStatus'],
    payloadSchema: {
      type: 'object',
      properties: {
        api_service_id: { type: 'string' },
        api_service_code: { type: 'string' },
        operation: { type: 'string' },
        transport: { type: 'string' },
        status: { type: 'string', description: 'success | failed | skipped' },
        duration_ms: { type: 'number' },
        request: { type: 'object', description: '请求参数摘要' },
        response: { type: 'object', description: '响应摘要（可能截断）' },
        error: { type: 'string' },
      },
    },
    example: {
      api_service_id: '5f1c...',
      api_service_code: 'order-query',
      operation: 'find',
      transport: 'http',
      status: 'success',
      duration_ms: 42,
      request: { limit: 20 },
      response: { items: [] },
      error: null,
    },
  },
  {
    type: 'schedule.cron',
    label: '定时触发',
    category: 'schedule',
    description: '按 cron 表达式定时触发（服务器时区）。cron 在钩子触发配置中设置。',
    filterFields: ['cron'],
    payloadSchema: {
      type: 'object',
      properties: {
        cron: { type: 'string', description: '命中的 cron 表达式' },
        fire_at: { type: 'string', description: '本次触发时间（ISO）' },
        hook_id: { type: 'string', description: '注册该 cron 的钩子 ID' },
      },
    },
    example: {
      cron: '0 8 * * *',
      fire_at: '2026-09-01T00:08:00.000Z',
      hook_id: 'a1b2...',
    },
  },
  {
    type: 'manual.test',
    label: '手动测试',
    category: 'manual',
    description: '测试面板 / AI 试跑专用；payload 为用户构造的 mock 或引用的历史负载。不参与正式统计。',
    filterFields: [],
    payloadSchema: { type: 'object', description: '由测试发起方自定义' },
    example: { hello: 'world' },
  },
];

const EVENT_TYPE_MAP = new Map(EVENT_TYPES.map((entry) => [entry.type, entry]));

function listEventTypes() {
  return EVENT_TYPES;
}

function getEventType(type) {
  return EVENT_TYPE_MAP.get(type) || null;
}

function isValidEventType(type) {
  return EVENT_TYPE_MAP.has(type);
}

module.exports = {
  EVENT_TYPES,
  listEventTypes,
  getEventType,
  isValidEventType,
};
