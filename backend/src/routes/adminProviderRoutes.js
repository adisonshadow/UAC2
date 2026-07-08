const Router = require('koa-router');
const ProviderController = require('../controllers/providerController');
const auth = require('../middlewares/auth');

const router = new Router({
  prefix: '/api/v1/admin/providers'
});

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminProvider:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *           example: DeepSeek
 *         slug:
 *           type: string
 *           example: deepseek
 *         baseUrl:
 *           type: string
 *           example: https://api.deepseek.com
 *         apiKeySet:
 *           type: boolean
 *           example: true
 *         adapterType:
 *           type: string
 *           example: openai_compatible
 *         isActive:
 *           type: boolean
 *           example: true
 */

/**
 * @swagger
 * /api/v1/admin/providers:
 *   get:
 *     tags:
 *       - Admin-Providers
 *     summary: 获取服务商列表 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: 获取成功
 *   post:
 *     tags:
 *       - Admin-Providers
 *     summary: 创建服务商 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, baseUrl]
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               baseUrl:
 *                 type: string
 *               apiKey:
 *                 type: string
 *               adapterType:
 *                 type: string
 *                 example: openai_compatible
 *     responses:
 *       200:
 *         description: 创建成功
 */
router.get('/', auth, ProviderController.list);
router.post('/', auth, ProviderController.create);

/**
 * @swagger
 * /api/v1/admin/providers/{id}:
 *   get:
 *     tags:
 *       - Admin-Providers
 *     summary: 获取服务商详情 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 获取成功
 *   patch:
 *     tags:
 *       - Admin-Providers
 *     summary: 更新服务商 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               baseUrl:
 *                 type: string
 *               apiKey:
 *                 type: string
 *               adapterType:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 更新成功
 *   delete:
 *     tags:
 *       - Admin-Providers
 *     summary: 删除服务商（软删除） [需要认证]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.get('/:id', auth, ProviderController.getById);
router.patch('/:id', auth, ProviderController.update);
router.delete('/:id', auth, ProviderController.delete);

module.exports = router;
