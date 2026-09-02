const Router = require('koa-router');
const BusinessDataController = require('../controllers/businessDataController');
const MetricController = require('../controllers/metricController');
const DataStandardController = require('../controllers/dataStandardController');
const MetadataCatalogController = require('../controllers/metadataCatalogController');
const auth = require('../middlewares/auth');
const authWithBuiltinApiGuard = require('../middlewares/withBuiltinApiGuard');
const { operationAudit } = require('../middlewares/operationAudit');

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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataSchema'
 */
router.get('/schema', authWithBuiltinApiGuard, BusinessDataController.getSchema);

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
 *       - in: query
 *         name: summary
 *         schema: { type: boolean }
 *         description: 为 true 时返回精简列表（不含 fields/layout/jsonSchema，含 fieldCount）
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataEntityList'
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
 *               tableName: { type: string, description: "ER 表物理表名；不填则默认将 code 中的冒号替换为下划线；自定义时须全局唯一" }
 *               entityInfo: { type: object }
 *               jsonSchema: { type: object }
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataEntity'
 */
router.get('/entities', authWithBuiltinApiGuard, BusinessDataController.listEntities);
router.post('/entities', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'CREATE',
  resourceType: 'entity',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['code', 'name'],
}), BusinessDataController.createEntity);

/**
 * @swagger
 * /api/v1/business-data/entities/exists:
 *   get:
 *     tags: [BusinessData]
 *     summary: 判断实体 code 是否存在 [需要认证]
 *     description: |
 *       AI 自动新建前的准备：按精确 code 查询实体是否已存在。
 *       始终返回 200；exists=true 时 item 为实体摘要（不含 fields）。
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: 实体 code，如 sales:order:Order
 *     responses:
 *       200:
 *         description: 查询成功，data.exists 为布尔值
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataExistsEntity'
 *       400:
 *         description: 缺少 code
 */
router.get('/entities/exists', authWithBuiltinApiGuard, BusinessDataController.existsEntity);

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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataEntity'
 *   patch:
 *     tags: [BusinessData]
 *     summary: 更新实体（version+1） [需要认证]
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
 *               code: { type: string, description: "Scope:Entity 编码；变更时在同一事务中级联更新元数据、API 服务、采集管道、物化记录、关系配置等引用，并同步重命名已物化的物理表/集合；任一步失败则全部回滚" }
 *               label: { type: string }
 *               entityKind: { type: string, enum: [er_table, json_schema] }
 *               tableName: { type: string, description: "ER 表物理表名；不填且原表名为默认推导值时随 code 同步变更，并同步重命名已物化的物理表/集合" }
 *               status: { type: string, enum: [enabled, disabled, archived] }
 *               isLocked: { type: boolean }
 *               entityInfo: { type: object }
 *               jsonSchema: { type: object }
 *               layout: { type: object }
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataEntity'
 *   delete:
 *     tags: [BusinessData]
 *     summary: 简单删除实体（无下游清理；遇 RESTRICT 引用会失败，请改用 deletion-analysis / deletion-execute） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeNull'
 */
router.get('/entities/:id', authWithBuiltinApiGuard, BusinessDataController.getEntity);
router.patch('/entities/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'UPDATE',
  resourceType: 'entity',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['code', 'name'],
}), BusinessDataController.updateEntity);
router.delete('/entities/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'DELETE',
  resourceType: 'entity',
  resourceId: (ctx) => ctx.params.id,
}), BusinessDataController.deleteEntity);

/**
 * @swagger
 * /api/v1/business-data/entities/{id}/deletion-analysis:
 *   post:
 *     tags: [BusinessData]
 *     summary: 实体删除影响分析（关系连通子图 + 下游资源） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: 根实体 ID
 *     responses:
 *       200:
 *         description: 分析成功，返回连通子图实体、关系、API 服务/采集管道/物化/指标/元数据目录等影响面
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataDeletionAnalysis'
 *       404:
 *         description: 实体不存在
 */
router.post(
  '/entities/:id/deletion-analysis',
  authWithBuiltinApiGuard,
  BusinessDataController.analyzeEntityDeletion,
);

/**
 * @swagger
 * /api/v1/business-data/entities/deletion-execute:
 *   post:
 *     tags: [BusinessData]
 *     summary: 事务化级联删除实体（含 API 服务/采集管道/指标/元数据目录；可选 DROP 物理表） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deleteEntityIds]
 *             properties:
 *               deleteEntityIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 description: 待删除实体 ID 列表（仅含用户选择「删除实体」的节点）
 *               dropPhysicalTables:
 *                 type: boolean
 *                 default: false
 *                 description: 是否在各物化连接上 CASCADE DROP 物理表/集合（事务提交后 best-effort）
 *     responses:
 *       200:
 *         description: 删除成功，data.summary 含删除计数与物理表 DROP 结果
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataDeletionExecute'
 */
router.post(
  '/entities/deletion-execute',
  authWithBuiltinApiGuard,
  operationAudit({
    domain: 'bizdata',
    operationType: 'DELETE',
    resourceType: 'entity',
    resourceId: (ctx) => (ctx.request.body?.deleteEntityIds || []).join(',') || '',
    summaryKeys: ['deleteEntityIds', 'dropPhysicalTables'],
  }),
  BusinessDataController.executeEntityDeletion,
);

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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataEntity'
 */
router.put('/entities/:id/fields', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'UPDATE',
  resourceType: 'entity_field',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['fields'],
}), BusinessDataController.upsertFields);

/**
 * @swagger
 * /api/v1/business-data/enums:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取枚举列表 [需要认证]
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataEnumList'
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建枚举 [需要认证]
 *     description: |
 *       body 含 code、enumInfo、values、items。
 *       values 与 items 会互相同步：仅传 values 时自动补齐 items（label/sort），仅传 items 时自动补齐 values。
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, description: 枚举编码，如 sales:OrderStatus }
 *               enumInfo: { type: object }
 *               values: { type: object, description: 值映射，key 为枚举值 }
 *               items: { type: object, description: 项列表（含 label/sort） }
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataEnum'
 */
router.get('/enums', authWithBuiltinApiGuard, BusinessDataController.listEnums);
router.post('/enums', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'CREATE',
  resourceType: 'enum',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['code', 'name'],
}), BusinessDataController.createEnum);

/**
 * @swagger
 * /api/v1/business-data/enums/exists:
 *   get:
 *     tags: [BusinessData]
 *     summary: 判断枚举 code 是否存在 [需要认证]
 *     description: |
 *       AI 自动新建前的准备：按精确 code 查询枚举是否已存在。
 *       始终返回 200；exists=true 时 item 为枚举详情。
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: 枚举 code，如 production:WorkOrderStatus
 *     responses:
 *       200:
 *         description: 查询成功，data.exists 为布尔值
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataExistsEnum'
 *       400:
 *         description: 缺少 code
 */
router.get('/enums/exists', authWithBuiltinApiGuard, BusinessDataController.existsEnum);

/**
 * @swagger
 * /api/v1/business-data/enums/{id}:
 *   patch:
 *     tags: [BusinessData]
 *     summary: 更新枚举 [需要认证]
 *     description: |
 *       可更新 enumInfo、values、items。
 *       更新 values/items 时两侧会互相同步（一侧为空则从另一侧补齐）。
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
 *               enumInfo: { type: object }
 *               values: { type: object }
 *               items: { type: object }
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataEnum'
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeNull'
 */
router.patch('/enums/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'UPDATE',
  resourceType: 'enum',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['code', 'name'],
}), BusinessDataController.updateEnum);
router.delete('/enums/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'DELETE',
  resourceType: 'enum',
  resourceId: (ctx) => ctx.params.id,
}), BusinessDataController.deleteEnum);

/**
 * @swagger
 * /api/v1/business-data/relations:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取关系列表（可选按实体过滤） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: entityCode
 *         schema: { type: string }
 *         description: 按实体 code 过滤（from 或 to 命中）
 *       - in: query
 *         name: entityId
 *         schema: { type: string, format: uuid }
 *         description: 按实体 UUID 过滤（from 或 to 命中）
 *     responses:
 *       200:
 *         description: 获取成功；每条含 fromEntityCode、toEntityCode、directionSummary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataRelationList'
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建关系（关联实体 version+1；同一 from 内 name 唯一） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, name, fromEntityId, toEntityId]
 *             properties:
 *               type: { type: string, enum: [oneToMany, manyToOne, oneToOne, manyToMany] }
 *               name: { type: string, description: 同一 from 实体内唯一 }
 *               inverseName: { type: string }
 *               fromEntityId: { type: string, format: uuid }
 *               toEntityId: { type: string, format: uuid }
 *               joinTable: { type: string }
 *               config: { type: object }
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataRelation'
 *       400:
 *         description: 重名或同边已存在（错误信息含 from/to entityCode）
 */
router.get('/relations', authWithBuiltinApiGuard, BusinessDataController.listRelations);
router.post('/relations', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'CREATE',
  resourceType: 'relation',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['code', 'name'],
}), BusinessDataController.createRelation);

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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type: { type: string, enum: [oneToMany, manyToOne, oneToOne, manyToMany] }
 *               name: { type: string }
 *               inverseName: { type: string }
 *               config: { type: object }
 *               joinTable: { type: string }
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataRelation'
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeNull'
 */
router.patch('/relations/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'UPDATE',
  resourceType: 'relation',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['code', 'name'],
}), BusinessDataController.updateRelation);
router.delete('/relations/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'DELETE',
  resourceType: 'relation',
  resourceId: (ctx) => ctx.params.id,
}), BusinessDataController.deleteRelation);

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
 *               connectionId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 预览成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMaterializationPreview'
 */
router.post('/materialization/preview', authWithBuiltinApiGuard, BusinessDataController.previewMaterialization);

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
 *               connectionId: { type: string, format: uuid }
 *               dryRun: { type: boolean }
 *               createTargetIfMissing:
 *                 type: boolean
 *                 description: 目标 Schema/数据库不存在时是否自动创建（默认 false；须用户确认后传 true）。MySQL 下 Schema 即库
 *               expectedVersions:
 *                 type: object
 *                 additionalProperties: { type: integer }
 *     responses:
 *       200:
 *         description: 执行成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMaterializationExecute'
 *       409:
 *         description: 目标 Schema/数据库不存在（errorCode=TARGET_NOT_FOUND，data.hint 含下一步）。须 ask_user 确认后带 createTargetIfMissing=true 重试；禁止同参空转或探 HTTP
 */
router.post('/materialization/execute', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'EXECUTE',
  resourceType: 'materialization',
  resourceId: (ctx) => ctx.body?.data?.id || ctx.request.body?.connectionId || '',
  summaryKeys: ['entityIds', 'connectionId', 'targetSchema', 'dryRun'],
}), BusinessDataController.executeMaterialization);

/**
 * @swagger
 * /api/v1/business-data/materialization/status:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取各实体物化版本与 stale 状态 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: connectionId
 *         schema: { type: string, format: uuid }
 *         description: 限定连接；不传则返回全部连接上的笛卡尔积
 *       - in: query
 *         name: entityCodes
 *         schema: { type: string }
 *         description: 按实体 code 过滤，逗号分隔或重复键；也可用 entityCode
 *       - in: query
 *         name: entityIds
 *         schema: { type: string }
 *         description: 按实体 UUID 过滤，逗号分隔或重复键；也可用 entityId
 *     responses:
 *       200:
 *         description: 获取成功（每项含 code 与 entityCode，值相同）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMaterializationStatus'
 */
router.get('/materialization/status', authWithBuiltinApiGuard, BusinessDataController.getMaterializationStatus);

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
 *       - in: query
 *         name: connectionId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMaterializationRunList'
 */
router.get('/materialization/runs', authWithBuiltinApiGuard, BusinessDataController.listMaterializationRuns);

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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMaterializationRun'
 */
router.get('/materialization/runs/:id', authWithBuiltinApiGuard, BusinessDataController.getMaterializationRun);

/**
 * @swagger
 * /api/v1/business-data/materialization/tables/{entityId}/schema:
 *   get:
 *     tags: [BusinessData]
 *     summary: 浏览物化物理表结构 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: connectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataTableSchema'
 */
router.get(
  '/materialization/tables/:entityId/schema',
  auth,
  BusinessDataController.getMaterializedTableSchema,
);

/**
 * @swagger
 * /api/v1/business-data/materialization/tables/{entityId}/rows:
 *   get:
 *     tags: [BusinessData]
 *     summary: 分页浏览物化物理表数据 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: connectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataTableRows'
 */
router.get(
  '/materialization/tables/:entityId/rows',
  auth,
  BusinessDataController.getMaterializedTableRows,
);

/**
 * @swagger
 * /api/v1/business-data/materialization/tables/{entityId}/mock-data:
 *   post:
 *     tags: [BusinessData]
 *     summary: 向物化物理表插入 MOCK 测试数据 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: connectionId
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               connectionId: { type: string, format: uuid }
 *               rows:
 *                 type: array
 *                 items: { type: object }
 *               rowCount: { type: integer }
 *     responses:
 *       200:
 *         description: 插入成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataTableRows'
 */
router.post(
  '/materialization/tables/:entityId/mock-data',
  auth,
  operationAudit({
    domain: 'bizdata',
    operationType: 'CREATE',
    resourceType: 'materialized_mock',
    resourceId: (ctx) => ctx.params.entityId,
    summaryKeys: ['connectionId', 'rowCount', 'rows'],
  }),
  BusinessDataController.insertMaterializedMockData,
);

/**
 * @swagger
 * /api/v1/business-data/database-connections:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取数据库连接列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataDatabaseConnectionList'
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建数据库连接 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, dbType, host, databaseName]
 *             properties:
 *               name: { type: string }
 *               dbType: { type: string, enum: [postgresql, mysql, mongodb, redis] }
 *               host: { type: string }
 *               port: { type: integer }
 *               username:
 *                 type: string
 *                 description: PostgreSQL/MySQL/MongoDB 必填；Redis ACL 可选
 *               password: { type: string }
 *               databaseName:
 *                 type: string
 *                 description: PostgreSQL/MySQL/MongoDB 库名；Redis 为 0-15 的 DB 索引
 *               targetSchema:
 *                 type: string
 *                 description: PostgreSQL schema；MySQL Schema（即库，须 ≥8.0.13）；MongoDB 与 databaseName 相同；Redis Key 前缀。Mongo 未传时后端用 databaseName
 *               isDefault: { type: boolean }
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataDatabaseConnection'
 */
router.get('/database-connections', authWithBuiltinApiGuard, BusinessDataController.listDatabaseConnections);
router.post('/database-connections', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'CREATE',
  resourceType: 'database_connection',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['name', 'dbType', 'host', 'port', 'database'],
}), BusinessDataController.createDatabaseConnection);

/**
 * @swagger
 * /api/v1/business-data/database-connections/{id}:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取数据库连接详情（含密码，供编辑回填） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataDatabaseConnection'
 *       404:
 *         description: 连接不存在
 *   put:
 *     tags: [BusinessData]
 *     summary: 更新数据库连接 [需要认证]
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
 *               dbType: { type: string, enum: [postgresql, mysql, mongodb, redis] }
 *               host: { type: string }
 *               port: { type: integer }
 *               username:
 *                 type: string
 *                 description: PostgreSQL/MySQL/MongoDB 必填；Redis ACL 可选
 *               password: { type: string }
 *               databaseName:
 *                 type: string
 *                 description: PostgreSQL/MySQL/MongoDB 登录库；Redis 为 0-15 的 DB 索引；MySQL 默认可用 mysql
 *               targetSchema:
 *                 type: string
 *                 description: PostgreSQL schema；MySQL 物化目标库；MongoDB 与 databaseName 相同；Redis Key 前缀
 *               isDefault: { type: boolean }
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataDatabaseConnection'
 *   delete:
 *     tags: [BusinessData]
 *     summary: 删除数据库连接 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeNull'
 */
router.get('/database-connections/:id', authWithBuiltinApiGuard, BusinessDataController.getDatabaseConnection);
router.put('/database-connections/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'UPDATE',
  resourceType: 'database_connection',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['name', 'dbType', 'host', 'port', 'database'],
}), BusinessDataController.updateDatabaseConnection);
router.delete('/database-connections/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'DELETE',
  resourceType: 'database_connection',
  resourceId: (ctx) => ctx.params.id,
}), BusinessDataController.deleteDatabaseConnection);

/**
 * @swagger
 * /api/v1/business-data/database-connections/{id}/test:
 *   post:
 *     tags: [BusinessData]
 *     summary: 测试数据库连接 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 测试成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataConnectionTest'
 */
router.post('/database-connections/:id/test', authWithBuiltinApiGuard, BusinessDataController.testDatabaseConnection);

/**
 * @swagger
 * /api/v1/business-data/scopes:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取业务数据 Scope 树（模型 code 路径前缀） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功，data.tree 为树形结构，data.items 为扁平列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataScopeList'
 */
router.get('/scopes', authWithBuiltinApiGuard, BusinessDataController.listScopes);

/**
 * @swagger
 * /api/v1/business-data/scopes/exists:
 *   get:
 *     tags: [BusinessData]
 *     summary: 判断 Scope 是否存在 [需要认证]
 *     description: |
 *       AI 自动新建前的准备：判断实体 code 前缀（Scope）下是否已有实体。
 *       Scope 由实体 code 冒号路径推导，无独立 create_scope。
 *       始终返回 200；exists=true 时附带 item（code/name）与 entityCount。
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: Scope code，如 sales 或 sales:order
 *     responses:
 *       200:
 *         description: 查询成功，data.exists 为布尔值
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataExistsScope'
 *       400:
 *         description: 缺少 code
 */
router.get('/scopes/exists', authWithBuiltinApiGuard, BusinessDataController.existsScope);

/**
 * @swagger
 * /api/v1/business-data/scope-docs:
 *   get:
 *     tags: [BusinessData]
 *     summary: 列出有内容的 Scope 业务说明（供树节点 icon） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: codes
 *         schema: { type: string }
 *         description: 可选，逗号分隔的 Scope code 过滤
 *     responses:
 *       200:
 *         description: 获取成功，data 为含 code、updatedAt、hasContent 的对象数组
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataScopeDocList'
 *   put:
 *     tags: [BusinessData]
 *     summary: 保存 Scope 业务说明（Markdown）；空内容则删除 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 description: Scope code，如 IPS 或 IPS:bom
 *               contentMarkdown:
 *                 type: string
 *                 description: Markdown 正文；trim 后为空则删除记录
 *     responses:
 *       200:
 *         description: 保存成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataScopeDoc'
 */
router.get('/scope-docs', authWithBuiltinApiGuard, BusinessDataController.listScopeDocs);
router.put('/scope-docs', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'UPDATE',
  resourceType: 'scope_doc',
  resourceId: (ctx) => ctx.request.body?.scopeCode || ctx.body?.data?.scopeCode || '',
  summaryKeys: ['scopeCode', 'title'],
}), BusinessDataController.upsertScopeDoc);

/**
 * @swagger
 * /api/v1/business-data/scope-docs/content:
 *   get:
 *     tags: [BusinessData]
 *     summary: 获取单个 Scope 业务说明（query code，避免路径含冒号） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: Scope code，如 IPS 或 IPS:bom
 *       - in: query
 *         name: includeAncestors
 *         schema: { type: string, enum: ['0', '1', 'true', 'false'] }
 *         description: 为 1/true 时同时返回祖先链有内容的说明
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataScopeDoc'
 */
router.get('/scope-docs/content', authWithBuiltinApiGuard, BusinessDataController.getScopeDoc);

/**
 * @swagger
 * /api/v1/business-data/metrics/dashboard:
 *   get:
 *     tags: [BusinessData]
 *     summary: 指标看板（按 domain 返回已配置卡片及水合数据） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: domainCode
 *         schema: { type: string }
 *         description: 按域过滤
 *       - in: query
 *         name: codePrefix
 *         schema: { type: string }
 *       - in: query
 *         name: refresh
 *         schema: { type: string, enum: ['0', '1', 'true', 'false'] }
 *         description: 对 on_demand/both 指标即时重算
 *     responses:
 *       200:
 *         description: 获取成功，data.domains[].cards 含水合 value/trend/series
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetricDashboard'
 */
router.get('/metrics/dashboard', authWithBuiltinApiGuard, MetricController.getDashboard);

/**
 * @swagger
 * /api/v1/business-data/metrics/cards:
 *   get:
 *     tags: [BusinessData]
 *     summary: 指标卡片列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: domainCode
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [enabled, disabled] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: size
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetricCardList'
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建指标卡片 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, title, domainCode, vizType]
 *             properties:
 *               code: { type: string }
 *               title: { type: string }
 *               description: { type: string }
 *               domainCode: { type: string }
 *               metricId: { type: string, format: uuid }
 *               metricCode: { type: string }
 *               vizType: { type: string, enum: [statistic_trend, line, bar, ring] }
 *               config: { type: object }
 *               sortOrder: { type: integer }
 *               status: { type: string, enum: [enabled, disabled] }
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetricCard'
 */
router.get('/metrics/cards', authWithBuiltinApiGuard, MetricController.listCards);
router.post('/metrics/cards', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'CREATE',
  resourceType: 'metric_card',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['code', 'name', 'title'],
}), MetricController.createCard);

/**
 * @swagger
 * /api/v1/business-data/metrics/cards/suggest:
 *   get:
 *     tags: [BusinessData]
 *     summary: 根据指标历史建议卡片配置 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: metricId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: metricCode
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 建议成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetricCard'
 */
router.get('/metrics/cards/suggest', authWithBuiltinApiGuard, MetricController.suggestCard);

/**
 * @swagger
 * /api/v1/business-data/metrics/cards/{id}:
 *   get:
 *     tags: [BusinessData]
 *     summary: 指标卡片详情 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetricCard'
 *   patch:
 *     tags: [BusinessData]
 *     summary: 更新指标卡片 [需要认证]
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
 *               code: { type: string }
 *               title: { type: string }
 *               description: { type: string }
 *               domainCode: { type: string }
 *               metricId: { type: string, format: uuid }
 *               metricCode: { type: string }
 *               vizType: { type: string, enum: [statistic_trend, line, bar, ring] }
 *               config: { type: object }
 *               sortOrder: { type: integer }
 *               status: { type: string, enum: [enabled, disabled] }
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetricCard'
 *   delete:
 *     tags: [BusinessData]
 *     summary: 删除指标卡片 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeNull'
 */
router.get('/metrics/cards/:id', authWithBuiltinApiGuard, MetricController.getCard);
router.patch('/metrics/cards/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'UPDATE',
  resourceType: 'metric_card',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['code', 'name', 'title'],
}), MetricController.updateCard);
router.delete('/metrics/cards/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'DELETE',
  resourceType: 'metric_card',
  resourceId: (ctx) => ctx.params.id,
}), MetricController.deleteCard);

/**
 * @swagger
 * /api/v1/business-data/metrics/execute-batch:
 *   post:
 *     tags: [BusinessData]
 *     summary: 批量执行指标 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scopeCode: { type: string }
 *     responses:
 *       200:
 *         description: 执行完成
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetricRunList'
 */
router.post('/metrics/execute-batch', authWithBuiltinApiGuard, MetricController.executeBatch);

/**
 * @swagger
 * /api/v1/business-data/metrics:
 *   get:
 *     tags: [BusinessData]
 *     summary: 指标列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: scopeCode
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: size
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetricList'
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建指标 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, label, metricType]
 *             properties:
 *               code: { type: string }
 *               label: { type: string }
 *               description: { type: string }
 *               metricType: { type: string, enum: [sql, formula] }
 *               connectionId: { type: string, format: uuid }
 *               queryScript: { type: string, description: SQL 型必填 }
 *               formulaConfig: { type: object, description: 公式型配置 }
 *               computeMode: { type: string }
 *               scheduleType: { type: string }
 *               scheduleConfig: { type: object }
 *               unit: { type: string }
 *               category: { type: string }
 *               scopeCode: { type: string }
 *               status: { type: string, enum: [enabled, disabled] }
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetric'
 */
router.get('/metrics', authWithBuiltinApiGuard, MetricController.listMetrics);
router.post('/metrics', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'CREATE',
  resourceType: 'metric',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['code', 'name'],
}), MetricController.createMetric);

/**
 * @swagger
 * /api/v1/business-data/metrics/{id}/execute:
 *   post:
 *     tags: [BusinessData]
 *     summary: 手动执行指标 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 执行成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetric'
 */
router.post('/metrics/:id/execute', authWithBuiltinApiGuard, MetricController.executeMetric);

/**
 * @swagger
 * /api/v1/business-data/metrics/{id}/runs:
 *   get:
 *     tags: [BusinessData]
 *     summary: 指标执行历史 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetricRunList'
 */
router.get('/metrics/:id/runs', authWithBuiltinApiGuard, MetricController.listRuns);

/**
 * @swagger
 * /api/v1/business-data/metrics/{id}/values:
 *   get:
 *     tags: [BusinessData]
 *     summary: 指标历史值 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetricValueList'
 */
router.get('/metrics/:id/values', authWithBuiltinApiGuard, MetricController.listValues);

/**
 * @swagger
 * /api/v1/business-data/metrics/{id}/value:
 *   get:
 *     tags: [BusinessData]
 *     summary: 指标最新值 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: refresh
 *         schema: { type: string, enum: ['0', '1', 'true', 'false'] }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetricValue'
 */
router.get('/metrics/:id/value', authWithBuiltinApiGuard, MetricController.getValue);

/**
 * @swagger
 * /api/v1/business-data/metrics/{id}:
 *   get:
 *     tags: [BusinessData]
 *     summary: 指标详情 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetric'
 *   patch:
 *     tags: [BusinessData]
 *     summary: 更新指标 [需要认证]
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
 *               label: { type: string }
 *               description: { type: string }
 *               metricType: { type: string, enum: [sql, formula] }
 *               connectionId: { type: string, format: uuid }
 *               queryScript: { type: string }
 *               formulaConfig: { type: object }
 *               computeMode: { type: string }
 *               scheduleType: { type: string }
 *               scheduleConfig: { type: object }
 *               unit: { type: string }
 *               category: { type: string }
 *               scopeCode: { type: string }
 *               status: { type: string, enum: [enabled, disabled] }
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetric'
 *   delete:
 *     tags: [BusinessData]
 *     summary: 删除指标 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeNull'
 */
router.get('/metrics/:id', authWithBuiltinApiGuard, MetricController.getMetric);
router.patch('/metrics/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'UPDATE',
  resourceType: 'metric',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['code', 'name'],
}), MetricController.updateMetric);
router.delete('/metrics/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'DELETE',
  resourceType: 'metric',
  resourceId: (ctx) => ctx.params.id,
}), MetricController.deleteMetric);

/**
 * @swagger
 * /api/v1/business-data/data-standards:
 *   get:
 *     tags: [BusinessData]
 *     summary: 数据标准列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [enabled, disabled] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: size
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataDataStandardList'
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建数据标准 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *               version: { type: string }
 *               description: { type: string }
 *               status: { type: string, enum: [enabled, disabled] }
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataDataStandard'
 */
router.get('/data-standards', authWithBuiltinApiGuard, DataStandardController.list);
router.post('/data-standards', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'CREATE',
  resourceType: 'data_standard',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['code', 'name'],
}), DataStandardController.create);

/**
 * @swagger
 * /api/v1/business-data/data-standards/{id}:
 *   get:
 *     tags: [BusinessData]
 *     summary: 数据标准详情 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataDataStandard'
 *   put:
 *     tags: [BusinessData]
 *     summary: 更新数据标准 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataDataStandard'
 *   delete:
 *     tags: [BusinessData]
 *     summary: 删除数据标准 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeNull'
 */
router.get('/data-standards/:id', authWithBuiltinApiGuard, DataStandardController.get);
router.put('/data-standards/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'UPDATE',
  resourceType: 'data_standard',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['code', 'name'],
}), DataStandardController.update);
router.delete('/data-standards/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'DELETE',
  resourceType: 'data_standard',
  resourceId: (ctx) => ctx.params.id,
}), DataStandardController.delete);

/**
 * @swagger
 * /api/v1/business-data/metadata/tables:
 *   get:
 *     tags: [BusinessData]
 *     summary: 元数据逻辑表列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetadataTableList'
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建或按 target 保存元数据表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string }
 *               targetType: { type: string, enum: [entity, metric, enum] }
 *               targetId: { type: string, format: uuid }
 *               metadataCode: { type: string }
 *               standardId: { type: string, format: uuid }
 *               businessMeaning: { type: string }
 *               status: { type: string }
 *               fields: { type: array, items: { type: object } }
 *     responses:
 *       200:
 *         description: 保存成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetadataTable'
 */
router.get('/metadata/tables', authWithBuiltinApiGuard, MetadataCatalogController.listTables);
router.post('/metadata/tables', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'CREATE',
  resourceType: 'metadata_table',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['code', 'name', 'tableName'],
}), MetadataCatalogController.upsertTable);

/**
 * @swagger
 * /api/v1/business-data/metadata/by-target:
 *   get:
 *     tags: [BusinessData]
 *     summary: 按 target 获取元数据 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: targetType
 *         schema: { type: string, enum: [entity, metric, enum] }
 *       - in: query
 *         name: targetId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: fieldKey
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetadataTable'
 */
router.get('/metadata/by-target', authWithBuiltinApiGuard, MetadataCatalogController.getByTarget);

/**
 * @swagger
 * /api/v1/business-data/metadata/sync-from-schema:
 *   post:
 *     tags: [BusinessData]
 *     summary: 从数据模型同步元数据目录骨架 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 同步成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetadataTableList'
 */
router.post('/metadata/sync-from-schema', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'EXECUTE',
  resourceType: 'metadata_sync',
  resourceId: (ctx) => ctx.request.body?.connectionId || '',
  summaryKeys: ['connectionId', 'targetSchema'],
}), MetadataCatalogController.syncFromSchema);

/**
 * @swagger
 * /api/v1/business-data/metadata/tables/{id}:
 *   get:
 *     tags: [BusinessData]
 *     summary: 元数据表详情（含字段） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetadataTable'
 *   put:
 *     tags: [BusinessData]
 *     summary: 更新元数据表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetadataTable'
 *   delete:
 *     tags: [BusinessData]
 *     summary: 删除元数据表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeNull'
 */
router.get('/metadata/tables/:id', authWithBuiltinApiGuard, MetadataCatalogController.getTable);
router.put('/metadata/tables/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'UPDATE',
  resourceType: 'metadata_table',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['code', 'name', 'tableName'],
}), MetadataCatalogController.updateTable);
router.delete('/metadata/tables/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'DELETE',
  resourceType: 'metadata_table',
  resourceId: (ctx) => ctx.params.id,
}), MetadataCatalogController.deleteTable);

/**
 * @swagger
 * /api/v1/business-data/metadata/tables/{id}/fields:
 *   put:
 *     tags: [BusinessData]
 *     summary: 批量更新元数据字段 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetadataTable'
 */
router.put('/metadata/tables/:id/fields', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'UPDATE',
  resourceType: 'metadata_field',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['fields'],
}), MetadataCatalogController.updateFields);

/**
 * @swagger
 * /api/v1/business-data/metadata/tables/{id}/fields:
 *   post:
 *     tags: [BusinessData]
 *     summary: 保存单个元数据字段 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 保存成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeBizdataMetadataTable'
 */
router.post('/metadata/tables/:id/fields', authWithBuiltinApiGuard, operationAudit({
  domain: 'bizdata',
  operationType: 'CREATE',
  resourceType: 'metadata_field',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['fieldKey', 'name'],
}), MetadataCatalogController.upsertField);

module.exports = router;
