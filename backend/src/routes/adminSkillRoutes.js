const Router = require('koa-router');
const SkillController = require('../controllers/skillController');
const auth = require('../middlewares/auth');
const authWithBuiltinApiGuard = require('../middlewares/withBuiltinApiGuard');

const { operationAudit } = require('../middlewares/operationAudit');
const router = new Router({ prefix: '/api/v1/admin/skills' });

/**
 * @swagger
 * /api/v1/admin/skills:
 *   get:
 *     tags: [Admin-Skills]
 *     summary: 获取 Skill 列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: size
 *         schema: { type: integer }
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: 名称模糊匹配
 *       - in: query
 *         name: slug
 *         schema: { type: string }
 *         description: Skill ID 模糊匹配
 *       - in: query
 *         name: description
 *         schema: { type: string }
 *         description: 描述模糊匹配
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: isGlobal
 *         schema: { type: boolean }
 *       - in: query
 *         name: isDedicated
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: 获取成功，data 为分页 { items, total, page, size }
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeAdminSkillList'
 *   post:
 *     tags: [Admin-Skills]
 *     summary: 创建 Skill [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug]
 *             properties:
 *               name: { type: string }
 *               slug:
 *                 type: string
 *                 description: Skill ID，唯一标识
 *               description: { type: string }
 *               contentMarkdown: { type: string }
 *               isGlobal:
 *                 type: boolean
 *                 description: 是否全局 Skill
 *               isDedicated:
 *                 type: boolean
 *                 description: 是否专用 Skill
 *               applicationIds:
 *                 type: array
 *                 description: 专用 Skill 支持的应用系统 ID 列表
 *                 items: { type: string, format: uuid }
 *               scopeId:
 *                 type: string
 *                 format: uuid
 *                 description: 绑定 Scope ID，为空表示全局 Skill
 *               toolIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: 创建成功，data 为 AdminSkill（含 tools）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeAdminSkill'
 */
router.get('/', authWithBuiltinApiGuard, SkillController.list);
router.post('/', authWithBuiltinApiGuard, operationAudit({
  domain: 'ai',
  operationType: 'CREATE',
  resourceType: 'ai_skill',
  resourceId: (ctx) => ctx.body?.data?.id,
  summaryKeys: ['name', 'slug'],
}), SkillController.create);

/**
 * @swagger
 * /api/v1/admin/skills/{id}:
 *   get:
 *     tags: [Admin-Skills]
 *     summary: 获取 Skill 详情 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功，data 为 AdminSkill（含 tools）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeAdminSkill'
 *   patch:
 *     tags: [Admin-Skills]
 *     summary: 更新 Skill [需要认证]
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
 *               slug: { type: string, description: Skill ID，唯一标识 }
 *               description: { type: string }
 *               contentMarkdown: { type: string }
 *               isActive: { type: boolean }
 *               isGlobal: { type: boolean }
 *               isDedicated: { type: boolean }
 *               applicationIds: { type: array, items: { type: string, format: uuid } }
 *               scopeId: { type: string, format: uuid, nullable: true }
 *               toolIds: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: 更新成功，data 为 AdminSkill
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeAdminSkill'
 *   delete:
 *     tags: [Admin-Skills]
 *     summary: 删除 Skill [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 删除成功，data 为 null
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeNull'
 */
router.get('/:id', authWithBuiltinApiGuard, SkillController.getById);
router.patch('/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'ai',
  operationType: 'UPDATE',
  resourceType: 'ai_skill',
  resourceId: (ctx) => ctx.params.id,
  summaryKeys: ['name', 'slug'],
}), SkillController.update);
router.delete('/:id', authWithBuiltinApiGuard, operationAudit({
  domain: 'ai',
  operationType: 'DELETE',
  resourceType: 'ai_skill',
  resourceId: (ctx) => ctx.params.id,
}), SkillController.remove);

module.exports = router;
