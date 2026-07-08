const Router = require('koa-router');
const ApiServiceDataController = require('../controllers/apiServiceDataController');
const auth = require('../middlewares/auth');

const router = new Router({ prefix: '/api/v1/stream/data' });

/**
 * @swagger
 * /api/v1/stream/data/{routePath}:
 *   get:
 *     tags: [ApiServiceData]
 *     summary: SSE 流式调用已发布 API 服务（仅读 operation）[需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: routePath
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: operation
 *         required: true
 *         schema: { type: string }
 *         description: 读类 operation，如 find、count
 *     responses:
 *       200:
 *         description: text/event-stream
 */
router.get('/:routePath(.*)', auth, ApiServiceDataController.streamSse);

module.exports = router;
