const Router = require('koa-router');
const AiRequestLogController = require('../controllers/aiRequestLogController');
const auth = require('../middlewares/auth');

const router = new Router({ prefix: '/api/v1/admin/ai-request-logs' });

/**
 * @swagger
 * /api/v1/admin/ai-request-logs:
 *   get:
 *     tags: [Admin-AI-Request-Logs]
 *     summary: 获取 AI 请求日志列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: size
 *         schema: { type: integer }
 *       - in: query
 *         name: slug
 *         schema: { type: string }
 *       - in: query
 *         name: traceId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/', auth, AiRequestLogController.list);

/**
 * @swagger
 * /api/v1/admin/ai-request-logs/{id}:
 *   get:
 *     tags: [Admin-AI-Request-Logs]
 *     summary: 获取 AI 请求日志详情 [需要认证]
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
router.get('/:id', auth, AiRequestLogController.getById);

module.exports = router;
