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
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: routePath
 *         required: true
 *         schema: { type: string }
 *         description: 服务 routePath，如 equipment/EquipmentFind
 *       - in: query
 *         name: operation
 *         schema: { type: string }
 *         description: 主 operation，如 find、create
 *     responses:
 *       200:
 *         description: 调用成功
 *   post:
 *     tags: [ApiServiceData]
 *     summary: 调用已发布 API 服务（HTTP POST）[需要认证]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:routePath(.*)', auth, ApiServiceDataController.invokeHttp);
router.post('/:routePath(.*)', auth, ApiServiceDataController.invokeHttp);

module.exports = router;
