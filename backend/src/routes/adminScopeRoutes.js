const Router = require('koa-router');
const ScopeController = require('../controllers/scopeController');
const auth = require('../middlewares/auth');

const router = new Router({ prefix: '/api/v1/admin/scopes' });

/**
 * @swagger
 * /api/v1/admin/scopes:
 *   get:
 *     tags: [Admin-Scopes]
 *     summary: 获取 Scope 列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: size
 *         schema: { type: integer }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: 获取成功
 *   post:
 *     tags: [Admin-Scopes]
 *     summary: 创建 Scope [需要认证]
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
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/', auth, ScopeController.list);
router.post('/', auth, ScopeController.create);

/**
 * @swagger
 * /api/v1/admin/scopes/{id}:
 *   get:
 *     tags: [Admin-Scopes]
 *     summary: 获取 Scope 详情 [需要认证]
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
 *     tags: [Admin-Scopes]
 *     summary: 更新 Scope [需要认证]
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
 *               slug: { type: string }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: 更新成功
 *   delete:
 *     tags: [Admin-Scopes]
 *     summary: 软删除 Scope [需要认证]
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
router.get('/:id', auth, ScopeController.getById);
router.patch('/:id', auth, ScopeController.update);
router.delete('/:id', auth, ScopeController.remove);

module.exports = router;
