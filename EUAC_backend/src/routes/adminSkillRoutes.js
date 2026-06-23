const Router = require('koa-router');
const SkillController = require('../controllers/skillController');
const auth = require('../middlewares/auth');

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
 *     responses:
 *       200:
 *         description: 获取成功
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
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *               contentMarkdown: { type: string }
 *               scopeId:
 *                 type: string
 *                 format: uuid
 *                 description: 绑定 Scope ID，为空表示全局 Skill
 *               toolIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/', auth, SkillController.list);
router.post('/', auth, SkillController.create);

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
 *         description: 获取成功
 *   patch:
 *     tags: [Admin-Skills]
 *     summary: 更新 Skill [需要认证]
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
 *     tags: [Admin-Skills]
 *     summary: 软删除 Skill [需要认证]
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
router.get('/:id', auth, SkillController.getById);
router.patch('/:id', auth, SkillController.update);
router.delete('/:id', auth, SkillController.remove);

module.exports = router;
