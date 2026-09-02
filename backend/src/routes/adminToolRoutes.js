const Router = require('koa-router');
const ToolController = require('../controllers/toolController');
const auth = require('../middlewares/auth');
const authWithBuiltinApiGuard = require('../middlewares/withBuiltinApiGuard');

const { operationAudit } = require('../middlewares/operationAudit');
const router = new Router({ prefix: '/api/v1/admin/tools' });

/**
 * @swagger
 * /api/v1/admin/tools:
 *   get:
 *     tags: [Admin-Tools]
 *     summary: 获取 Tool 列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: size
 *         schema: { type: integer }
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: 按名称模糊匹配
 *       - in: query
 *         name: functionName
 *         schema: { type: string }
 *         description: 按 functionName 模糊匹配
 *       - in: query
 *         name: scopeId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: executionType
 *         schema: { type: string, enum: [client, server_http, server_builtin] }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: 获取成功，data 为分页 { items, total, page, size }
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeAdminToolList'
 *   post:
 *     tags: [Admin-Tools]
 *     summary: 创建 Tool [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scopeId, name, functionName, executionType]
 *             properties:
 *               scopeId: { type: string, format: uuid }
 *               name: { type: string }
 *               slug: { type: string }
 *               functionName: { type: string }
 *               description: { type: string }
 *               executionType: { type: string, enum: [client, server_http, server_builtin] }
 *               parametersSchema: { type: object }
 *               reviewMarkdown: { type: string }
 *               serverConfig: { type: object }
 *     responses:
 *       201:
 *         description: 创建成功，data 为 AdminTool
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeAdminTool'
 */
router.get('/', authWithBuiltinApiGuard, ToolController.list);
router.post('/', authWithBuiltinApiGuard, operationAudit({
  domain: 'ai',
  operationType: 'CREATE',
  resourceType: 'ai_tool',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['name', 'functionName', 'function_name'],
}), ToolController.create);

/**
 * @swagger
 * /api/v1/admin/tools/{id}:
 *   get:
 *     tags: [Admin-Tools]
 *     summary: 获取 Tool 详情 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功，data 为 AdminTool
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeAdminTool'
 *   patch:
 *     tags: [Admin-Tools]
 *     summary: 更新 Tool [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scopeId: { type: string, format: uuid }
 *               name: { type: string }
 *               slug: { type: string }
 *               functionName: { type: string }
 *               description: { type: string }
 *               executionType: { type: string, enum: [client, server_http, server_builtin] }
 *               parametersSchema: { type: object }
 *               reviewMarkdown: { type: string }
 *               serverConfig: { type: object }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: 更新成功，data 为 AdminTool
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeAdminTool'
 *   delete:
 *     tags: [Admin-Tools]
 *     summary: 删除 Tool [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 删除成功，data 为 null
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeNull'
 */
router.get('/:id', authWithBuiltinApiGuard, ToolController.getById);
router.patch('/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'ai',
  operationType: 'UPDATE',
  resourceType: 'ai_tool',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['name', 'functionName', 'function_name'],
}), ToolController.update);
router.delete('/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'ai',
  operationType: 'DELETE',
  resourceType: 'ai_tool',
  resourceId: (ctx) => ctx.params.id,
}), ToolController.remove);

module.exports = router;
