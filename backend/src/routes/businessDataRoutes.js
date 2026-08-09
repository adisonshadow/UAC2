const Router = require('koa-router');
const BusinessDataController = require('../controllers/businessDataController');
const MetricController = require('../controllers/metricController');
const DataStandardController = require('../controllers/dataStandardController');
const MetadataCatalogController = require('../controllers/metadataCatalogController');
const auth = require('../middlewares/auth');
const authWithBuiltinApiGuard = require('../middlewares/withBuiltinApiGuard');

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
 */
router.get('/entities', authWithBuiltinApiGuard, BusinessDataController.listEntities);
router.post('/entities', authWithBuiltinApiGuard, BusinessDataController.createEntity);

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
 */
router.get('/entities/:id', authWithBuiltinApiGuard, BusinessDataController.getEntity);
router.patch('/entities/:id', authWithBuiltinApiGuard, BusinessDataController.updateEntity);
router.delete('/entities/:id', authWithBuiltinApiGuard, BusinessDataController.deleteEntity);

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
 */
router.post(
  '/entities/deletion-execute',
  authWithBuiltinApiGuard,
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
 */
router.put('/entities/:id/fields', authWithBuiltinApiGuard, BusinessDataController.upsertFields);

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
 *     description: |
 *       body 含 code、enumInfo、values、items。
 *       values 与 items 会互相同步：仅传 values 时自动补齐 items（label/sort），仅传 items 时自动补齐 values。
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/enums', authWithBuiltinApiGuard, BusinessDataController.listEnums);
router.post('/enums', authWithBuiltinApiGuard, BusinessDataController.createEnum);

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
router.patch('/enums/:id', authWithBuiltinApiGuard, BusinessDataController.updateEnum);
router.delete('/enums/:id', authWithBuiltinApiGuard, BusinessDataController.deleteEnum);

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
 *       400:
 *         description: 重名或同边已存在（错误信息含 from/to entityCode）
 */
router.get('/relations', authWithBuiltinApiGuard, BusinessDataController.listRelations);
router.post('/relations', authWithBuiltinApiGuard, BusinessDataController.createRelation);

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
router.patch('/relations/:id', authWithBuiltinApiGuard, BusinessDataController.updateRelation);
router.delete('/relations/:id', authWithBuiltinApiGuard, BusinessDataController.deleteRelation);

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
 *                 description: 目标 Schema/数据库不存在时是否自动创建唯一ID（通常由前端确认后传入）
 *               expectedVersions:
 *                 type: object
 *                 additionalProperties: { type: integer }
 *     responses:
 *       200:
 *         description: 执行成功
 *       409:
 *         description: 目标 Schema/数据库不存在，需用户确认后带 createTargetIfMissing 重试
 */
router.post('/materialization/execute', authWithBuiltinApiGuard, BusinessDataController.executeMaterialization);

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
 *     responses:
 *       200:
 *         description: 获取成功
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
 */
router.post(
  '/materialization/tables/:entityId/mock-data',
  auth,
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
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建数据库连接 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, dbType, host, username, databaseName]
 *             properties:
 *               name: { type: string }
 *               dbType: { type: string, enum: [postgresql, mongodb, redis] }
 *               host: { type: string }
 *               port: { type: integer }
 *               username: { type: string }
 *               password: { type: string }
 *               databaseName: { type: string }
 *               targetSchema: { type: string }
 *               isDefault: { type: boolean }
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/database-connections', authWithBuiltinApiGuard, BusinessDataController.listDatabaseConnections);
router.post('/database-connections', authWithBuiltinApiGuard, BusinessDataController.createDatabaseConnection);

/**
 * @swagger
 * /api/v1/business-data/database-connections/{id}:
 *   put:
 *     tags: [BusinessData]
 *     summary: 更新数据库连接 [需要认证]
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
 */
router.put('/database-connections/:id', authWithBuiltinApiGuard, BusinessDataController.updateDatabaseConnection);
router.delete('/database-connections/:id', authWithBuiltinApiGuard, BusinessDataController.deleteDatabaseConnection);

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
 */
router.get('/scopes', authWithBuiltinApiGuard, BusinessDataController.listScopes);

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
 */
router.get('/scope-docs', authWithBuiltinApiGuard, BusinessDataController.listScopeDocs);
router.put('/scope-docs', authWithBuiltinApiGuard, BusinessDataController.upsertScopeDoc);

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
 */
router.get('/metrics/cards', authWithBuiltinApiGuard, MetricController.listCards);
router.post('/metrics/cards', authWithBuiltinApiGuard, MetricController.createCard);

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
 *   patch:
 *     tags: [BusinessData]
 *     summary: 更新指标卡片 [需要认证]
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
 */
router.get('/metrics/cards/:id', authWithBuiltinApiGuard, MetricController.getCard);
router.patch('/metrics/cards/:id', authWithBuiltinApiGuard, MetricController.updateCard);
router.delete('/metrics/cards/:id', authWithBuiltinApiGuard, MetricController.deleteCard);

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
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建指标 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/metrics', authWithBuiltinApiGuard, MetricController.listMetrics);
router.post('/metrics', authWithBuiltinApiGuard, MetricController.createMetric);

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
 *   patch:
 *     tags: [BusinessData]
 *     summary: 更新指标 [需要认证]
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
 */
router.get('/metrics/:id', authWithBuiltinApiGuard, MetricController.getMetric);
router.patch('/metrics/:id', authWithBuiltinApiGuard, MetricController.updateMetric);
router.delete('/metrics/:id', authWithBuiltinApiGuard, MetricController.deleteMetric);

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
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建数据标准 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/data-standards', authWithBuiltinApiGuard, DataStandardController.list);
router.post('/data-standards', authWithBuiltinApiGuard, DataStandardController.create);

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
 */
router.get('/data-standards/:id', authWithBuiltinApiGuard, DataStandardController.get);
router.put('/data-standards/:id', authWithBuiltinApiGuard, DataStandardController.update);
router.delete('/data-standards/:id', authWithBuiltinApiGuard, DataStandardController.delete);

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
 *   post:
 *     tags: [BusinessData]
 *     summary: 创建或按 target 保存元数据表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 保存成功
 */
router.get('/metadata/tables', authWithBuiltinApiGuard, MetadataCatalogController.listTables);
router.post('/metadata/tables', authWithBuiltinApiGuard, MetadataCatalogController.upsertTable);

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
 */
router.post('/metadata/sync-from-schema', authWithBuiltinApiGuard, MetadataCatalogController.syncFromSchema);

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
 *   put:
 *     tags: [BusinessData]
 *     summary: 更新元数据表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 更新成功
 *   delete:
 *     tags: [BusinessData]
 *     summary: 删除元数据表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.get('/metadata/tables/:id', authWithBuiltinApiGuard, MetadataCatalogController.getTable);
router.put('/metadata/tables/:id', authWithBuiltinApiGuard, MetadataCatalogController.updateTable);
router.delete('/metadata/tables/:id', authWithBuiltinApiGuard, MetadataCatalogController.deleteTable);

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
 */
router.put('/metadata/tables/:id/fields', authWithBuiltinApiGuard, MetadataCatalogController.updateFields);

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
 */
router.post('/metadata/tables/:id/fields', authWithBuiltinApiGuard, MetadataCatalogController.upsertField);

module.exports = router;
