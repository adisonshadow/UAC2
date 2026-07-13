const Router = require('koa-router');
const SystemController = require('../controllers/systemController');
const auth = require('../middlewares/auth');
const authWithBuiltinApiGuard = require('../middlewares/withBuiltinApiGuard');

const router = new Router({ prefix: '/api/v1/system' });

/**
 * @swagger
 * /api/v1/system/features:
 *   get:
 *     tags: [System]
 *     summary: 获取系统功能开关 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 *   put:
 *     tags: [System]
 *     summary: 更新系统功能开关 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metadataEnabled: { type: boolean }
 *               apiServiceAllowWriteOperations: { type: boolean, description: 'API 测试中是否允许执行写操作（仅测试页，含自定义 SQL）' }
 *               apiServiceTestAutoRollback: { type: boolean, description: 'API 测试中写操作是否自动回滚（仅测试页；false 时测试数据落库）' }
 *     responses:
 *       200:
 *         description: 更新成功
 */
router.get('/features', authWithBuiltinApiGuard, SystemController.getFeatures);
router.put('/features', authWithBuiltinApiGuard, SystemController.updateFeatures);

/**
 * @swagger
 * /api/v1/system/backups:
 *   get:
 *     tags: [System]
 *     summary: 获取数据库备份文件列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/backups', authWithBuiltinApiGuard, SystemController.listBackups);

/**
 * @swagger
 * /api/v1/system/backups/run:
 *   post:
 *     tags: [System]
 *     summary: 立即执行数据库备份 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 备份已触发
 */
router.post('/backups/run', authWithBuiltinApiGuard, SystemController.runBackup);

module.exports = router;
