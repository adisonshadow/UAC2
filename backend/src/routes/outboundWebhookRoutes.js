const Router = require('koa-router');
const OutboundWebhookController = require('../controllers/outboundWebhookController');
const authWithBuiltinApiGuard = require('../middlewares/withBuiltinApiGuard');

const { operationAudit } = require('../middlewares/operationAudit');
const router = new Router({ prefix: '/api/v1/admin/outbound-webhooks' });

/**
 * @swagger
 * components:
 *   schemas:
 *     OutboundWebhook:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         code:
 *           type: string
 *           example: fmms:notifyOrder
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: string
 *           enum: [draft, published, disabled, deleted]
 *         triggerType:
 *           type: string
 *           example: api_hook
 *         triggerApiServiceId:
 *           type: string
 *           format: uuid
 *         triggerApiServiceCode:
 *           type: string
 *         targetUrl:
 *           type: string
 *           example: https://example.com/api/notify
 *         httpMethod:
 *           type: string
 *           enum: [POST, PUT, PATCH]
 *           example: POST
 *         authType:
 *           type: string
 *           enum: [none, bearer, api_key]
 *           example: none
 *         authSendMode:
 *           type: string
 *           enum: [header, query]
 *           nullable: true
 *         authKeyName:
 *           type: string
 *           nullable: true
 *           example: X-API-Key
 *         authSecretSet:
 *           type: boolean
 *           description: 是否已缓存密钥（不回传明文）
 *         authSecretMasked:
 *           type: string
 *           nullable: true
 *         requestStructure:
 *           type: string
 *           description: TypeScript interface 文本
 *         requestExample:
 *           type: string
 *           description: 请求 Demo JSON 文本
 *         transformScript:
 *           type: string
 *         mockData:
 *           type: string
 *         responseConfig:
 *           type: object
 *           description: 成功/异常契约与判定规则
 *           properties:
 *             success:
 *               type: object
 *               properties:
 *                 schema:
 *                   type: object
 *                 example:
 *                   type: object
 *             exception:
 *               type: object
 *               properties:
 *                 schema:
 *                   type: object
 *                 example:
 *                   type: object
 *                 rules:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["code != 200", "isOK != 'SUCCESS'"]
 *             httpStatusAsException:
 *               type: boolean
 *               description: 默认 true，HTTP 非 2xx 视为失败
 *         version:
 *           type: integer
 *         publishedAt:
 *           type: string
 *           format: date-time
 *     OutboundWebhookWrite:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         targetUrl:
 *           type: string
 *         httpMethod:
 *           type: string
 *           enum: [POST, PUT, PATCH]
 *         authType:
 *           type: string
 *           enum: [none, bearer, api_key]
 *         authSendMode:
 *           type: string
 *           enum: [header, query]
 *         authKeyName:
 *           type: string
 *         authSecret:
 *           type: string
 *           description: 写入密钥；省略或空字符串保留原密钥；authType=none 时清除
 *         triggerApiServiceId:
 *           type: string
 *           format: uuid
 *         triggerApiServiceCode:
 *           type: string
 *         requestStructure:
 *           type: string
 *         requestExample:
 *           type: string
 *         transformScript:
 *           type: string
 *         mockData:
 *           type: string
 *         responseConfig:
 *           type: object
 */

/**
 * @swagger
 * /api/v1/admin/outbound-webhooks:
 *   get:
 *     tags:
 *       - Admin-OutboundWebhooks
 *     summary: 列出提交外部API配置 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: codePrefix
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 获取成功
 *   post:
 *     tags:
 *       - Admin-OutboundWebhooks
 *     summary: 创建提交外部API配置 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OutboundWebhookWrite'
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/', authWithBuiltinApiGuard, OutboundWebhookController.list);
router.post('/', authWithBuiltinApiGuard, operationAudit({
  domain: 'apiservice',
  operationType: 'CREATE',
  resourceType: 'outbound_webhook',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['code', 'name'],
}), OutboundWebhookController.create);

/**
 * @swagger
 * /api/v1/admin/outbound-webhooks/{id}:
 *   get:
 *     tags:
 *       - Admin-OutboundWebhooks
 *     summary: 获取提交外部API详情 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 获取成功
 *   patch:
 *     tags:
 *       - Admin-OutboundWebhooks
 *     summary: 更新提交外部API配置 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OutboundWebhookWrite'
 *     responses:
 *       200:
 *         description: 更新成功
 *   delete:
 *     tags:
 *       - Admin-OutboundWebhooks
 *     summary: 删除提交外部API配置（软删） [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 已删除
 */
router.get('/:id', authWithBuiltinApiGuard, OutboundWebhookController.getById);
router.patch('/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'apiservice',
  operationType: 'UPDATE',
  resourceType: 'outbound_webhook',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['code', 'name'],
}), OutboundWebhookController.update);
router.delete('/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'apiservice',
  operationType: 'DELETE',
  resourceType: 'outbound_webhook',
  resourceId: (ctx) => ctx.params.id,
}), OutboundWebhookController.remove);

/**
 * @swagger
 * /api/v1/admin/outbound-webhooks/{id}/publish:
 *   post:
 *     tags:
 *       - Admin-OutboundWebhooks
 *     summary: 发布提交外部API [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 发布成功
 */
router.post('/:id/publish', authWithBuiltinApiGuard, operationAudit({
  domain: 'apiservice',
  operationType: 'PUBLISH',
  resourceType: 'outbound_webhook',
  resourceId: (ctx) => ctx.params.id,
}), OutboundWebhookController.publish);

/**
 * @swagger
 * /api/v1/admin/outbound-webhooks/{id}/disable:
 *   post:
 *     tags:
 *       - Admin-OutboundWebhooks
 *     summary: 禁用提交外部API [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 已禁用
 */
router.post('/:id/disable', authWithBuiltinApiGuard, operationAudit({
  domain: 'apiservice',
  operationType: 'UNPUBLISH',
  resourceType: 'outbound_webhook',
  resourceId: (ctx) => ctx.params.id,
}), OutboundWebhookController.disable);

/**
 * @swagger
 * /api/v1/admin/outbound-webhooks/{id}/test-profile:
 *   get:
 *     tags:
 *       - Admin-OutboundWebhooks
 *     summary: 获取测试配置 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/:id/test-profile', authWithBuiltinApiGuard, OutboundWebhookController.getTestProfile);

/**
 * @swagger
 * /api/v1/admin/outbound-webhooks/{id}/test:
 *   post:
 *     tags:
 *       - Admin-OutboundWebhooks
 *     summary: 运行真实外呼测试 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mockData:
 *                 type: string
 *                 description: 模拟业务 API 返回的 JSON 文本
 *     responses:
 *       200:
 *         description: 测试完成（含 evaluation 规则判定）
 */
router.post('/:id/test', authWithBuiltinApiGuard, OutboundWebhookController.test);

/**
 * @swagger
 * /api/v1/admin/outbound-webhooks/{id}/runs:
 *   get:
 *     tags:
 *       - Admin-OutboundWebhooks
 *     summary: 列出执行历史 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/:id/runs', authWithBuiltinApiGuard, OutboundWebhookController.listRuns);

module.exports = router;
