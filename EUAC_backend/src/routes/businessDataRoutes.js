const Router = require('koa-router');
const BusinessDataController = require('../controllers/businessDataController');
const auth = require('../middlewares/auth');

const router = new Router({ prefix: '/api/v1/business-data' });

/**
 * @swagger
 * /api/v1/business-data/schema:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取业务数据模型全量快照 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/schema', auth, BusinessDataController.getSchema);

/**
 * @swagger
 * /api/v1/business-data/entities:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取实体列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: codePrefix
 *         schema: { type: string }
 *       - in: query
 *         name: entityKind
 *         schema: { type: string, enum: [er_table, json_schema] }
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
 *     tags: [BusinessData]
 *     summary: 创建实体 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, label]
 *             properties:
 *               code: { type: string, description: "Scope:Entity 编码，如 sales:order:Order" }
 *               label: { type: string }
 *               entityKind: { type: string, enum: [er_table, json_schema] }
 *               tableName: { type: string }
 *               entityInfo: { type: object }
 *               jsonSchema: { type: object }
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/entities', auth, BusinessDataController.listEntities);
router.post('/entities', auth, BusinessDataController.createEntity);

/**
 * @swagger
 * /api/v1/business-data/entities/{id}:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取实体详情 [需要认证]
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
 *     tags: [BusinessData]
 *     summary: 更新实体（version+1） [需要认证]
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
 *     tags: [BusinessData]
 *     summary: 删除实体 [需要认证]
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
router.get('/entities/:id', auth, BusinessDataController.getEntity);
router.patch('/entities/:id', auth, BusinessDataController.updateEntity);
router.delete('/entities/:id', auth, BusinessDataController.deleteEntity);

/**
 * @swagger
 * /api/v1/business-data/entities/{id}/fields:
 *   put:
 *     tags: [BusinessData]
 *     summary: 批量保存实体字段（version+1） [需要认证]
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
 *             properties:
 *               fields:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [fieldKey]
 *                   properties:
 *                     fieldKey:
 *                       type: string
 *                       description: 字段名（也支持 name/key 别名）
 *                     columnInfo:
 *                       type: object
 *                       description: 列元信息，如 label
 *                     typeormConfig:
 *                       type: object
 *                       description: 类型配置，如 type/length/nullable/primary
 *                     sortOrder:
 *                       type: integer
 *                     name:
 *                       type: string
 *                       description: fieldKey 别名（AI 常用）
 *                     label:
 *                       type: string
 *                       description: 写入 columnInfo.label
 *                     type:
 *                       type: string
 *                       description: 写入 typeormConfig.type
 *     responses:
 *       200:
 *         description: 保存成功
 */
router.put('/entities/:id/fields', auth, BusinessDataController.upsertFields);

/**
 * @swagger
 * /api/v1/business-data/enums:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取枚举列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建枚举 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/enums', auth, BusinessDataController.listEnums);
router.post('/enums', auth, BusinessDataController.createEnum);

/**
 * @swagger
 * /api/v1/business-data/enums/{id}:
 *   patch:
 *     tags: [BusinessData]
 *     summary: 更新枚举 [需要认证]
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
 *     tags: [BusinessData]
 *     summary: 删除枚举 [需要认证]
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
router.patch('/enums/:id', auth, BusinessDataController.updateEnum);
router.delete('/enums/:id', auth, BusinessDataController.deleteEnum);

/**
 * @swagger
 * /api/v1/business-data/relations:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取关系列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建关系（关联实体 version+1） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/relations', auth, BusinessDataController.listRelations);
router.post('/relations', auth, BusinessDataController.createRelation);

/**
 * @swagger
 * /api/v1/business-data/relations/{id}:
 *   patch:
 *     tags: [BusinessData]
 *     summary: 更新关系 [需要认证]
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
 *     tags: [BusinessData]
 *     summary: 删除关系 [需要认证]
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
router.patch('/relations/:id', auth, BusinessDataController.updateRelation);
router.delete('/relations/:id', auth, BusinessDataController.deleteRelation);

/**
 * @swagger
 * /api/v1/business-data/materialization/preview:
 *   post:
 *     tags: [BusinessData]
 *     summary: 物化预览（SQL + TS 代码） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entityIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               targetSchema: { type: string }
 *     responses:
 *       200:
 *         description: 预览成功
 */
router.post('/materialization/preview', auth, BusinessDataController.previewMaterialization);

/**
 * @swagger
 * /api/v1/business-data/materialization/execute:
 *   post:
 *     tags: [BusinessData]
 *     summary: 执行物化（记录 entity_version） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entityIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *               targetSchema: { type: string }
 *               dryRun: { type: boolean }
 *               expectedVersions:
 *                 type: object
 *                 additionalProperties: { type: integer }
 *     responses:
 *       200:
 *         description: 执行成功
 */
router.post('/materialization/execute', auth, BusinessDataController.executeMaterialization);

/**
 * @swagger
 * /api/v1/business-data/materialization/status:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取各实体物化版本与 stale 状态 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/materialization/status', auth, BusinessDataController.getMaterializationStatus);

/**
 * @swagger
 * /api/v1/business-data/materialization/runs:
 *   get:
 *     tags: [BusinessData]
 *     summary: 物化历史列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
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
router.get('/materialization/runs', auth, BusinessDataController.listMaterializationRuns);

/**
 * @swagger
 * /api/v1/business-data/materialization/runs/{id}:
 *   get:
 *     tags: [BusinessData]
 *     summary: 物化记录详情 [需要认证]
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
router.get('/materialization/runs/:id', auth, BusinessDataController.getMaterializationRun);

module.exports = router;
