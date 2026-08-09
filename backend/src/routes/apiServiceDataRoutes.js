const Router = require('koa-router');
const ApiServiceDataController = require('../controllers/apiServiceDataController');
const auth = require('../middlewares/auth');

const router = new Router({ prefix: '/api/v1/data' });

/**
 * @swagger
 * /api/v1/data/{routePath}:
 *   get:
 *     tags: [ApiServiceData]
 *     summary: 调用已发布 API 服务（HTTP）[需要认证]
 *     description: |
 *       `routePath` 可为服务路径，或带 operation 后缀的 REST 路径（如 `IPS/master/WorkstationDelete/{id}`）。
 *       亦支持 query `operation`；单 operation 服务可省略。
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: routePath
 *         required: true
 *         schema: { type: string }
 *         description: 服务 routePath，或含 path 参数的完整路径
 *       - in: query
 *         name: operation
 *         schema: { type: string }
 *         description: 主 operation（可省略；亦可由 HTTP 方法 + 路径后缀推断）
 *     responses:
 *       200:
 *         description: |
 *           调用成功。`data` 为业务载荷（与 Responses Schema 一致）。
 *           find 类分页响应固定为：
 *           `{ items: [], pagination: { total, page, pageSize, totalPages, hasNext } }`。
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code: { type: integer, example: 200 }
 *                 message: { type: string, example: 调用成功 }
 *                 data: { type: object }
 *       405:
 *         description: 方法不允许（JSON 信封）
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code: { type: integer, example: 405 }
 *                 message: { type: string }
 *                 data: { nullable: true }
 *   post:
 *     tags: [ApiServiceData]
 *     summary: 调用已发布 API 服务（HTTP POST，兼容写法）[需要认证]
 *     description: |
 *       写操作可用 POST + JSON body（如 {"id":"..."}）；亦可用 DELETE/PATCH + path id。
 *     security: [{ bearerAuth: [] }]
 *   put:
 *     tags: [ApiServiceData]
 *     summary: 调用已发布 API 服务（HTTP PUT）[需要认证]
 *     security: [{ bearerAuth: [] }]
 *   patch:
 *     tags: [ApiServiceData]
 *     summary: 调用已发布 API 服务（HTTP PATCH，如 updateOne /:id）[需要认证]
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [ApiServiceData]
 *     summary: 调用已发布 API 服务（HTTP DELETE，如 deleteOne /:id）[需要认证]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:routePath(.*)', auth, ApiServiceDataController.invokeHttp);
router.post('/:routePath(.*)', auth, ApiServiceDataController.invokeHttp);
router.put('/:routePath(.*)', auth, ApiServiceDataController.invokeHttp);
router.patch('/:routePath(.*)', auth, ApiServiceDataController.invokeHttp);
router.delete('/:routePath(.*)', auth, ApiServiceDataController.invokeHttp);

module.exports = router;
