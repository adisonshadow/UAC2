const Router = require('koa-router');
const AiModelController = require('../controllers/aiModelController');
const auth = require('../middlewares/auth');

const router = new Router({
  prefix: '/api/v1/admin/models'
});

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminAiModel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         providerId:
 *           type: string
 *           format: uuid
 *         slug:
 *           type: string
 *           example: deepseek-chat
 *         modelId:
 *           type: string
 *           example: deepseek-chat
 *         displayName:
 *           type: string
 *           example: DeepSeek Chat
 *         defaultParams:
 *           type: object
 *         capabilities:
 *           type: array
 *           items:
 *             type: string
 *         inputTags:
 *           type: array
 *           items:
 *             type: string
 *         outputTags:
 *           type: array
 *           items:
 *             type: string
 *         isActive:
 *           type: boolean
 */

/**
 * @swagger
 * /api/v1/admin/models:
 *   get:
 *     tags:
 *       - Admin-Models
 *     summary: 获取 AI 模型列表 [需要认证]
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
 *         name: providerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: 获取成功
 *   post:
 *     tags:
 *       - Admin-Models
 *     summary: 创建 AI 模型 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [providerId, modelId, displayName, capabilities]
 *             properties:
 *               providerId:
 *                 type: string
 *                 format: uuid
 *               slug:
 *                 type: string
 *               modelId:
 *                 type: string
 *               displayName:
 *                 type: string
 *               defaultParams:
 *                 type: object
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               inputTags:
 *                 type: array
 *                 items:
 *                   type: string
 *               outputTags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 创建成功
 */
router.get('/', auth, AiModelController.list);
router.post('/', auth, AiModelController.create);

/**
 * @swagger
 * /api/v1/admin/models/{id}:
 *   get:
 *     tags:
 *       - Admin-Models
 *     summary: 获取 AI 模型详情 [需要认证]
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
 *       - Admin-Models
 *     summary: 更新 AI 模型 [需要认证]
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
 *               providerId:
 *                 type: string
 *               slug:
 *                 type: string
 *               modelId:
 *                 type: string
 *               displayName:
 *                 type: string
 *               defaultParams:
 *                 type: object
 *               capabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               inputTags:
 *                 type: array
 *                 items:
 *                   type: string
 *               outputTags:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 更新成功
 *   delete:
 *     tags:
 *       - Admin-Models
 *     summary: 删除 AI 模型（软删除） [需要认证]
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
router.get('/:id', auth, AiModelController.getById);
router.patch('/:id', auth, AiModelController.update);
router.delete('/:id', auth, AiModelController.delete);

module.exports = router;
