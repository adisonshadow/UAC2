const Router = require('koa-router');
const AiServiceController = require('../controllers/aiServiceController');
const AiCapabilityController = require('../controllers/aiCapabilityController');
const SkillController = require('../controllers/skillController');
const auth = require('../middlewares/auth');

const router = new Router({
  prefix: '/api/v1/ai'
});

/**
 * @swagger
 * components:
 *   schemas:
 *     ModelInfo:
 *       type: object
 *       properties:
 *         slug:
 *           type: string
 *           example: deepseek-chat
 *         displayName:
 *           type: string
 *           example: DeepSeek Chat
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
 *         defaultParams:
 *           type: object
 *     AIBaseErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: object
 *           properties:
 *             code:
 *               type: string
 *               example: MODEL_NOT_FOUND
 *             message:
 *               type: string
 *             traceId:
 *               type: string
 *               format: uuid
 */

/**
 * @swagger
 * /api/v1/ai/models:
 *   get:
 *     tags:
 *       - AI-Service
 *     summary: 获取可用 AI 模型列表 [需要认证]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ModelInfo'
 */
router.get('/models', auth, AiServiceController.listModels);

/**
 * @swagger
 * /api/v1/ai/chat/completions:
 *   post:
 *     tags:
 *       - AI-Service
 *     summary: OpenAI 兼容对话接口 [需要认证]
 *     description: 通过 slug 或 modelId 路由到已注册模型，支持流式 SSE
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messages]
 *             properties:
 *               slug:
 *                 type: string
 *                 example: deepseek-chat
 *               modelId:
 *                 type: string
 *                 format: uuid
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *               stream:
 *                 type: boolean
 *                 default: false
 *               temperature:
 *                 type: number
 *               max_tokens:
 *                 type: integer
 *               tools:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: 对话成功（非流式返回 OpenAI JSON，流式返回 text/event-stream）
 *       400:
 *         description: 请求无效或能力不匹配
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIBaseErrorResponse'
 *       404:
 *         description: 模型不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIBaseErrorResponse'
 */
router.post('/chat/completions', auth, AiServiceController.chatCompletions);

/**
 * @swagger
 * /api/v1/ai/capabilities:
 *   get:
 *     tags: [AI-Service]
 *     summary: 获取 AIBase 能力清单 [需要认证]
 *     description: 返回 scopes、skills（含 scopeSlug）、tools 等能力元数据
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/capabilities', auth, AiCapabilityController.getCapabilities);

/**
 * @swagger
 * /api/v1/ai/scopes/{slug}/tools:
 *   get:
 *     tags: [AI-Service]
 *     summary: 获取 Scope 下 Tool 列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/scopes/:slug/tools', auth, AiCapabilityController.getScopeTools);

/**
 * @swagger
 * /api/v1/ai/skills/{slug}:
 *   get:
 *     tags: [AI-Service]
 *     summary: 获取 Skill 详情（含 Tool 列表） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/skills/:slug', auth, SkillController.getPublicBySlug);

/**
 * @swagger
 * /api/v1/ai/tools/invoke:
 *   post:
 *     tags: [AI-Service]
 *     summary: 执行 Server Tool [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [functionName]
 *             properties:
 *               functionName: { type: string }
 *               arguments: { type: object }
 *     responses:
 *       200:
 *         description: 执行成功
 */
router.post('/tools/invoke', auth, AiCapabilityController.invokeTool);

module.exports = router;
