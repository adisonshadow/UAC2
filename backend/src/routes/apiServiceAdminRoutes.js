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
 *         description: |
 *           code 前缀：精确匹配，或 startsWith（含域段 boundary 与末段软前缀）。
 *           例 IPS:production、IPS:production:BomInstance（可匹配 BomInstanceCreate）
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, published, disabled, ALL] }
 *         description: draft/published/disabled；ALL 或省略表示不过滤
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
 *               definitionScript: { type: string, description: "SQL 脚本（scriptMode=sql）；命名参数 :param" }
 *               handlerScript: { type: string, description: "TypeScript Handler（scriptMode=typescript）；推荐只写函数体，用 params + db(entityCode)，禁止 queryPg/SQL；保存前须语法检查通过" }
 *               scriptMode: { type: string, enum: [sql, typescript], default: sql }
 *               requestParameterInterface: { type: string, description: "请求参数 TS interface（唯一真相源；Handler 中 params.xxx 须与此一致）" }
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
 *               responseOverrides:
 *                 type: object
 *                 description: 按 operation 覆盖响应 Schema 与 Example
 *                 additionalProperties:
 *                   type: object
 *                   properties:
 *                     responsesSchema: { type: object }
 *                     responseExample: {}
 *               responseOverrides:
 *                 type: object
 *                 description: "按 operation 覆盖响应 Schema/Example，如 { find: { responsesSchema, responseExample } }"
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
 * /api/v1/admin/api-services/check-handler:
 *   post:
 *     tags: [Admin-ApiServices]
 *     summary: 检查 TypeScript Handler 语法/类型（行级诊断） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               handlerScript: { type: string, description: "Handler 脚本（函数体或 export async function handler）" }
 *               requestParameterInterface: { type: string, description: "请求参数 TS interface，用于 params 类型" }
 *     responses:
 *       200:
 *         description: 返回 { ok, diagnostics: [{ line, column, message }] }
 */
router.post('/check-handler', auth, ApiServiceController.checkHandler);

/**
 * @swagger
 * /api/v1/admin/api-services/handler-sdk-dts:
 *   get:
 *     tags: [Admin-ApiServices]
 *     summary: 获取 TypeScript Handler SDK 环境声明（Monaco / 语法检查共用） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 返回 { dts }
 */
router.get('/handler-sdk-dts', auth, ApiServiceController.handlerSdkDts);

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
 *               definitionScript: { type: string, description: "SQL 脚本（scriptMode=sql）" }
 *               handlerScript: { type: string, description: "TypeScript Handler；推荐只写函数体 + params/db SDK，禁止 queryPg；保存前须语法检查通过" }
 *               scriptMode: { type: string, enum: [sql, typescript] }
 *               requestParameterInterface: { type: string, description: "请求参数 TS interface（唯一真相源）" }
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
 *               responseOverrides:
 *                 type: object
 *                 description: 按 operation 覆盖响应 Schema 与 Example
 *                 additionalProperties:
 *                   type: object
 *                   properties:
 *                     responsesSchema: { type: object }
 *                     responseExample: {}
 *               responseOverrides:
 *                 type: object
 *                 description: "按 operation 覆盖响应 Schema/Example"
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
 *     summary: 发布 API 服务（draft/disabled→published，原子更新 version） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 发布成功（回读 status 必须为 published）
 *       409:
 *         description: 发布未持久化（并发更新冲突，可重试）
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
 *     summary: 保存 API 服务请求参数 Example（与 requestOverrides 同源，按 operation 持久化；不改变 published 状态） [需要认证]
 *     description: |
 *       写入 security_config.requestOverrides[operation].requestExample。
 *       与编辑页契约变更不同：本接口不会把已 published 的服务降回 draft，
 *       避免与 publish 并行时出现「发布成功但最终仍是 draft」。
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
 *               mockParameters: { type: object, description: '请求参数 Example JSON（写入 security_config.requestOverrides[operation].requestExample）' }
 *               parameters: { type: object, description: '同 mockParameters，二选一' }
 *     responses:
 *       200:
 *         description: 保存成功（published 服务保持 published）
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
