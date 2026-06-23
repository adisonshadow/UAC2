const Router = require('koa-router');
const ToolController = require('../controllers/toolController');
const auth = require('../middlewares/auth');

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
 *         name: scopeId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: executionType
 *         schema: { type: string, enum: [client, server_http, server_builtin] }
 *     responses:
 *       200:
 *         description: 获取成功
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
 *         description: 创建成功
 */
router.get('/', auth, ToolController.list);
router.post('/', auth, ToolController.create);

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
 *         description: 获取成功
 *   patch:
 *     tags: [Admin-Tools]
 *     summary: 更新 Tool [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 更新成功
 *   delete:
 *     tags: [Admin-Tools]
 *     summary: 软删除 Tool [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.get('/:id', auth, ToolController.getById);
router.patch('/:id', auth, ToolController.update);
router.delete('/:id', auth, ToolController.remove);

module.exports = router;
