const Router = require('koa-router');
const CollectionPipelineController = require('../controllers/collectionPipelineController');
const auth = require('../middlewares/auth');
const authWithBuiltinApiGuard = require('../middlewares/withBuiltinApiGuard');

const router = new Router({ prefix: '/api/v1/business-data/collection-pipelines' });

/**
 * @swagger
 * /api/v1/business-data/collection-pipelines:
 *   get:
 *     tags: [BusinessData-CollectionPipeline]
 *     summary: 获取采集管道列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: codePrefix
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, published, disabled] }
 *       - in: query
 *         name: protocolType
 *         schema: { type: string, enum: [serial, modbus_rtu, modbus_tcp] }
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
 *     tags: [BusinessData-CollectionPipeline]
 *     summary: 创建采集管道 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               code: { type: string }
 *               scopeCode: { type: string }
 *               pipelineSlug: { type: string }
 *               name: { type: string }
 *               description: { type: string }
 *               protocolType: { type: string, enum: [serial, modbus_rtu, modbus_tcp] }
 *               entityId: { type: string, format: uuid }
 *               connectionId: { type: string, format: uuid }
 *               sampleData: { type: string }
 *               targetStructure: { type: string }
 *               parseScript: { type: string }
 *               storeScript: { type: string }
 *               restrictSources: { type: boolean }
 *               applicationIds: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/', authWithBuiltinApiGuard, CollectionPipelineController.list);
router.post('/', authWithBuiltinApiGuard, CollectionPipelineController.create);

/**
 * @swagger
 * /api/v1/business-data/collection-pipelines/{id}:
 *   get:
 *     tags: [BusinessData-CollectionPipeline]
 *     summary: 获取采集管道详情 [需要认证]
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
 *     tags: [BusinessData-CollectionPipeline]
 *     summary: 更新采集管道 [需要认证]
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
 *     responses:
 *       200:
 *         description: 更新成功
 *   delete:
 *     tags: [BusinessData-CollectionPipeline]
 *     summary: 删除采集管道 [需要认证]
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
router.get('/:id', authWithBuiltinApiGuard, CollectionPipelineController.getById);
router.patch('/:id', authWithBuiltinApiGuard, CollectionPipelineController.update);
router.delete('/:id', authWithBuiltinApiGuard, CollectionPipelineController.remove);

/**
 * @swagger
 * /api/v1/business-data/collection-pipelines/{id}/publish:
 *   post:
 *     tags: [BusinessData-CollectionPipeline]
 *     summary: 发布采集管道 [需要认证]
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
router.post('/:id/publish', authWithBuiltinApiGuard, CollectionPipelineController.publish);

/**
 * @swagger
 * /api/v1/business-data/collection-pipelines/{id}/disable:
 *   post:
 *     tags: [BusinessData-CollectionPipeline]
 *     summary: 禁用采集管道 [需要认证]
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
router.post('/:id/disable', authWithBuiltinApiGuard, CollectionPipelineController.disable);

/**
 * @swagger
 * /api/v1/business-data/collection-pipelines/{id}/runs:
 *   get:
 *     tags: [BusinessData-CollectionPipeline]
 *     summary: 获取采集管道运行记录 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
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
 */
router.get('/:id/runs', authWithBuiltinApiGuard, CollectionPipelineController.listRuns);

/**
 * @swagger
 * /api/v1/business-data/collection-pipelines/{id}/test-profile:
 *   get:
 *     tags: [BusinessData-CollectionPipeline]
 *     summary: 获取采集管道测试配置 [需要认证]
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
router.get('/:id/test-profile', authWithBuiltinApiGuard, CollectionPipelineController.getTestProfile);

/**
 * @swagger
 * /api/v1/business-data/collection-pipelines/{id}/test:
 *   post:
 *     tags: [BusinessData-CollectionPipeline]
 *     summary: 测试采集管道（事务内执行并回滚） [需要认证]
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
 *               rawInput: { type: string, description: 原始样本，省略时使用管道 sampleData }
 *               runType: { type: string, enum: [test, ai_test] }
 *     responses:
 *       200:
 *         description: 测试成功
 */
router.post('/:id/test', authWithBuiltinApiGuard, CollectionPipelineController.test);

module.exports = router;
