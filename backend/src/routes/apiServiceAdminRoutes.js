const Router = require('koa-router');
const ApiServiceController = require('../controllers/apiServiceController');
const auth = require('../middlewares/auth');

const router = new Router({ prefix: '/api/v1/admin/api-services' });

/**
 * @swagger
 * /api/v1/admin/api-services:
 *   get:
 *     tags: [Admin-ApiServices]
 *     summary: 获取 API 服务列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: codePrefix
 *         schema: { type: string }
 *         description: 域前缀过滤，如 sales:order
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, published, disabled] }
 *       - in: query
 *         name: tag
 *         schema: { type: string }
 *       - in: query
 *         name: entityId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: connectionId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: size
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 获取成功
 *   post:
 *     tags: [Admin-ApiServices]
 *     summary: 创建 API 服务（draft） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               code: { type: string, description: "完整域编码，与 scopeCode+serviceSlug 二选一" }
 *               scopeCode: { type: string, description: "数据模型 Scope（单选）" }
 *               serviceSlug: { type: string, description: "服务短名，与 scopeCode 组合生成 code" }
 *               name: { type: string }
 *               description: { type: string }
 *               tags: { type: array, items: { type: string } }
 *               connectionId: { type: string, format: uuid, description: "可选，省略时按 Scope 物化记录自动推断" }
 *               entityId: { type: string, format: uuid, description: "可选，单实体模板时使用" }
 *               definitionScript: { type: string, description: "SQL 脚本（scriptMode=sql）" }
 *               handlerScript: { type: string, description: "TypeScript Handler（scriptMode=typescript）" }
 *               scriptMode: { type: string, enum: [sql, typescript], default: sql }
 *               requestParameterInterface: { type: string, description: "设计期请求参数 TypeScript interface" }
 *               accessRestriction:
 *                 type: object
 *                 properties:
 *                   mode: { type: string, enum: [none, role, department] }
 *                   roleIds: { type: array, items: { type: string, format: uuid } }
 *                   departmentIds: { type: array, items: { type: string, format: uuid } }
 *               enabledOperations: { type: array, items: { type: string } }
 *               transportProtocols:
 *                 type: array
 *                 items: { type: string, enum: [http, sse, websocket] }
 *                 description: 访问协议，至少一项，默认 http
 *               securityConfig: { type: object }
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/', auth, ApiServiceController.list);
router.post('/', auth, ApiServiceController.create);

/**
 * @swagger
 * /api/v1/admin/api-services/tree:
 *   get:
 *     tags: [Admin-ApiServices]
 *     summary: 获取 API 服务域树 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: codePrefix
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/tree', auth, ApiServiceController.tree);

/**
 * @swagger
 * /api/v1/admin/api-services/operations/catalog:
 *   get:
 *     tags: [Admin-ApiServices]
 *     summary: 获取 operation 目录 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/operations/catalog', auth, ApiServiceController.operationCatalog);

/**
 * @swagger
 * /api/v1/admin/api-services/resolve-connection:
 *   post:
 *     tags: [Admin-ApiServices]
 *     summary: 按 Scope/物化记录推断数据库连接 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               connectionId: { type: string, format: uuid, description: "可选，显式指定连接" }
 *               scopeCode: { type: string, description: "Scope 编码" }
 *               entityId: { type: string, format: uuid }
 *               entityCodes: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: 推断成功
 */
router.post('/resolve-connection', auth, ApiServiceController.resolveConnection);

/**
 * @swagger
 * /api/v1/admin/api-services/by-code/{code}:
 *   get:
 *     tags: [Admin-ApiServices]
 *     summary: 按 code 获取 API 服务 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/by-code/:code', auth, ApiServiceController.getByCode);

/**
 * @swagger
 * /api/v1/admin/api-services/{id}:
 *   get:
 *     tags: [Admin-ApiServices]
 *     summary: 获取 API 服务详情 [需要认证]
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
 *     tags: [Admin-ApiServices]
 *     summary: 更新 API 服务 [需要认证]
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
 *               name: { type: string }
 *               scopeCode: { type: string }
 *               serviceSlug: { type: string }
 *               definitionScript: { type: string }
 *               handlerScript: { type: string }
 *               scriptMode: { type: string, enum: [sql, typescript] }
 *               requestParameterInterface: { type: string }
 *               accessRestriction:
 *                 type: object
 *                 properties:
 *                   mode: { type: string, enum: [none, role, department] }
 *                   roleIds: { type: array, items: { type: string, format: uuid } }
 *                   departmentIds: { type: array, items: { type: string, format: uuid } }
 *               enabledOperations: { type: array, items: { type: string } }
 *               transportProtocols:
 *                 type: array
 *                 items: { type: string, enum: [http, sse, websocket] }
 *               connectionId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 更新成功
 *   delete:
 *     tags: [Admin-ApiServices]
 *     summary: 删除 API 服务 [需要认证]
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
router.get('/:id', auth, ApiServiceController.getById);
router.patch('/:id', auth, ApiServiceController.update);
router.delete('/:id', auth, ApiServiceController.remove);

/**
 * @swagger
 * /api/v1/admin/api-services/{id}/publish:
 *   post:
 *     tags: [Admin-ApiServices]
 *     summary: 发布 API 服务 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 发布成功
 */
router.post('/:id/publish', auth, ApiServiceController.publish);

/**
 * @swagger
 * /api/v1/admin/api-services/{id}/disable:
 *   post:
 *     tags: [Admin-ApiServices]
 *     summary: 禁用 API 服务 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 禁用成功
 */
router.post('/:id/disable', auth, ApiServiceController.disable);

/**
 * @swagger
 * /api/v1/admin/api-services/{id}/enable:
 *   post:
 *     tags: [Admin-ApiServices]
 *     summary: 启用 API 服务 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 启用成功
 */
router.post('/:id/enable', auth, ApiServiceController.enable);

/**
 * @swagger
 * /api/v1/admin/api-services/{id}/test-profile:
 *   get:
 *     tags: [Admin-ApiServices]
 *     summary: 获取 API 服务测试上下文（参数结构 + 模拟参数） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/:id/test-profile', auth, ApiServiceController.testProfile);

/**
 * @swagger
 * /api/v1/admin/api-services/{id}/suggest-test-params:
 *   post:
 *     tags: [Admin-ApiServices]
 *     summary: 生成 API 服务测试模拟参数 [需要认证]
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
 *               operation: { type: string, description: "可选，默认取首个已启用 operation" }
 *     responses:
 *       200:
 *         description: 生成成功
 */
router.post('/:id/suggest-test-params', auth, ApiServiceController.suggestTestParams);

/**
 * @swagger
 * /api/v1/admin/api-services/{id}/test-mock-parameters:
 *   put:
 *     tags: [Admin-ApiServices]
 *     summary: 保存 API 服务测试模拟参数（按 operation 持久化） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [operation, mockParameters]
 *             properties:
 *               operation: { type: string }
 *               mockParameters: { type: object, description: '完整 mock 参数 JSON' }
 *               parameters: { type: object, description: '同 mockParameters，二选一' }
 *     responses:
 *       200:
 *         description: 保存成功
 */
router.put('/:id/test-mock-parameters', auth, ApiServiceController.saveTestMockParams);

/**
 * @swagger
 * /api/v1/admin/api-services/{id}/test:
 *   post:
 *     tags: [Admin-ApiServices]
 *     summary: 测试 API 服务（zod 校验参数后执行，写操作事务回滚） [需要认证]
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
 *               operation: { type: string, description: "必填或默认首个已启用 operation" }
 *               parameters: { type: object, description: "请求参数（path/query/body）" }
 *     responses:
 *       200:
 *         description: 测试成功，返回请求元信息与 preview
 */
router.post('/:id/test', auth, ApiServiceController.test);

module.exports = router;
