const Router = require('koa-router');
const CollectionIngestController = require('../controllers/collectionIngestController');
const { authRequired } = require('../middlewares/storageAuth');
const { collectionIngestRawBody } = require('../middlewares/collectionIngestRawBody');

const router = new Router({ prefix: '/api/v1/ingest' });

router.use(collectionIngestRawBody());

/**
 * @swagger
 * /api/v1/ingest/{routePath}:
 *   post:
 *     tags: [CollectionIngest]
 *     summary: 向采集管道提交原始数据 [需要业务系统 JWT]
 *     description: |
 *       Body 为纯文本或二进制（application/octet-stream 时在解析脚本中收到 hex 字符串）。
 *       协议类型由管道配置固定（serial / modbus_rtu / modbus_tcp）。
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: routePath
 *         required: true
 *         schema: { type: string }
 *         description: 管道 routePath，如 equipment/sensorIngest
 *     requestBody:
 *       required: true
 *       content:
 *         text/plain:
 *           schema:
 *             type: string
 *         application/octet-stream:
 *           schema:
 *             type: string
 *             format: binary
 *     responses:
 *       200:
 *         description: 采集成功
 *       401:
 *         description: 未认证或令牌无效
 *       403:
 *         description: 管道未发布或来源业务系统无权限
 */
router.post('/:routePath(.*)', authRequired, CollectionIngestController.ingest);

module.exports = router;
