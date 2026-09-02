/**
 * 钩子管理路由（prefix /api/v1/automation）
 * 全部挂 authWithBuiltinApiGuard（auth + builtin catalog 鉴权，已登记 builtinApi/catalog.js）
 */
const Router = require('koa-router');
const authWithBuiltinApiGuard = require('../middlewares/withBuiltinApiGuard');

const { operationAudit } = require('../middlewares/operationAudit');const controller = require('../controllers/automationHookController');

const router = new Router({ prefix: '/api/v1/automation' });

/**
 * @swagger
 * /api/v1/automation/hooks:
 *   get:
 *     tags: [Automation]
 *     summary: 钩子列表（排除已删除；含最近运行与近7天成功率）
 *     parameters:
 *       - { name: status, in: query, schema: { type: string }, description: draft|enabled|disabled|auto_disabled }
 *       - { name: eventType, in: query, schema: { type: string } }
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: size, in: query, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: 列表 }
 */
router.get('/hooks', authWithBuiltinApiGuard, controller.list);

/**
 * @swagger
 * /api/v1/automation/hooks:
 *   post:
 *     tags: [Automation]
 *     summary: 创建钩子（script 动作先过类型检查）
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               eventType: { type: string }
 *               eventFilter: { type: object }
 *               conditionExpr: { type: string }
 *               actionType: { type: string, enum: [http_request, internal_api, script] }
 *               actionConfig: { type: object }
 *               failurePolicy: { type: object }
 *               status: { type: string, enum: [draft, enabled, disabled] }
 *     responses:
 *       201: { description: 创建成功 }
 */
router.post('/hooks', authWithBuiltinApiGuard, operationAudit({
  domain: 'automation',
  operationType: 'CREATE',
  resourceType: 'automation_hook',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['name', 'eventType', 'actionType'],
}), controller.create);

/**
 * @swagger
 * /api/v1/automation/hooks/event-types:
 *   get:
 *     tags: [Automation]
 *     summary: 事件目录（类型 + 过滤项 + 负载 Schema + 示例；前端表单与 AI 共用）
 *     responses:
 *       200: { description: 事件目录 }
 */
router.get('/hooks/event-types', authWithBuiltinApiGuard, controller.eventTypes);

/**
 * @swagger
 * /api/v1/automation/hooks/validate-script:
 *   post:
 *     tags: [Automation]
 *     summary: 钩子脚本 TS 类型检查（诊断行号映射回原文）
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               source: { type: string }
 *     responses:
 *       200: { description: 检查结果 }
 */
router.post('/hooks/validate-script', authWithBuiltinApiGuard, controller.validateScript);

/**
 * @swagger
 * /api/v1/automation/hooks/runs/{runId}/retry:
 *   post:
 *     tags: [Automation]
 *     summary: 重放一次运行（新 event_id，trigger_source=replay）
 *     parameters:
 *       - { name: runId, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: 重放已执行 }
 */
router.post('/hooks/runs/:runId/retry', authWithBuiltinApiGuard, operationAudit({
  domain: 'automation',
  operationType: 'EXECUTE',
  resourceType: 'automation_hook_run',
  resourceId: (ctx) => ctx.params.runId,
}), controller.retryRun);

/**
 * @swagger
 * /api/v1/automation/hooks/{id}:
 *   get:
 *     tags: [Automation]
 *     summary: 钩子详情（含最近运行）
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: 详情 }
 */
router.get('/hooks/:id', authWithBuiltinApiGuard, controller.getById);

/**
 * @swagger
 * /api/v1/automation/hooks/{id}:
 *   put:
 *     tags: [Automation]
 *     summary: 更新钩子（version+1；密钥空提交保留）
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: 更新成功 }
 */
router.put('/hooks/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'automation',
  operationType: 'UPDATE',
  resourceType: 'automation_hook',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['name', 'eventType', 'actionType'],
}), controller.update);

/**
 * @swagger
 * /api/v1/automation/hooks/{id}:
 *   delete:
 *     tags: [Automation]
 *     summary: 软删钩子（status=deleted，运行历史保留）
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: 删除成功 }
 */
router.delete('/hooks/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'automation',
  operationType: 'DELETE',
  resourceType: 'automation_hook',
  resourceId: (ctx) => ctx.params.id,
}), controller.remove);

/**
 * @swagger
 * /api/v1/automation/hooks/{id}/enable:
 *   post:
 *     tags: [Automation]
 *     summary: 启用钩子（清零连续失败计数）
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: 已启用 }
 */
router.post('/hooks/:id/enable', authWithBuiltinApiGuard, operationAudit({
  domain: 'automation',
  operationType: 'STATUS_CHANGE',
  resourceType: 'automation_hook',
  resourceId: (ctx) => ctx.params.id,
}), controller.enable);

/**
 * @swagger
 * /api/v1/automation/hooks/{id}/disable:
 *   post:
 *     tags: [Automation]
 *     summary: 禁用钩子
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: 已禁用 }
 */
router.post('/hooks/:id/disable', authWithBuiltinApiGuard, operationAudit({
  domain: 'automation',
  operationType: 'STATUS_CHANGE',
  resourceType: 'automation_hook',
  resourceId: (ctx) => ctx.params.id,
}), controller.disable);

/**
 * @swagger
 * /api/v1/automation/hooks/{id}/test:
 *   post:
 *     tags: [Automation]
 *     summary: 试跑钩子（mock payload 或引用历史 Run；写 Run，trigger_source=test）
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mockPayload: { type: object }
 *               sourceRunId: { type: string }
 *     responses:
 *       200: { description: 测试完成 }
 */
router.post('/hooks/:id/test', authWithBuiltinApiGuard, operationAudit({
  domain: 'automation',
  operationType: 'EXECUTE',
  resourceType: 'automation_hook',
  resourceId: (ctx) => ctx.params.id,
}), controller.test);

/**
 * @swagger
 * /api/v1/automation/hooks/{id}/runs:
 *   get:
 *     tags: [Automation]
 *     summary: 钩子运行历史
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string } }
 *       - { name: status, in: query, schema: { type: string } }
 *       - { name: triggerSource, in: query, schema: { type: string } }
 *       - { name: page, in: query, schema: { type: integer } }
 *       - { name: size, in: query, schema: { type: integer } }
 *     responses:
 *       200: { description: 运行历史 }
 */
router.get('/hooks/:id/runs', authWithBuiltinApiGuard, controller.listRuns);

module.exports = router;
