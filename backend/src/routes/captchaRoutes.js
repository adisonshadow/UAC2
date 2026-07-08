const Router = require('koa-router');
const CaptchaController = require('../controllers/captchaController');

const router = new Router({
  prefix: '/api/v1/captcha'
});

/**
 * @swagger
 * /api/v1/captcha:
 *   get:
 *     tags:
 *       - Captcha
 *     summary: 获取验证码
 *     description: 获取登录验证码图片
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     captcha_id:
 *                       type: string
 *                       description: 验证码ID
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     bg_url:
 *                       type: string
 *                       description: 背景图片URL
 *                       example: "https://example.com/bg.jpg"
 *                     puzzle_url:
 *                       type: string
 *                       description: 拼图图片URL
 *                       example: "https://example.com/puzzle.jpg"
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: 服务器内部错误
 *                 data:
 *                   type: null
 *                   example: null
 */
router.get('/', CaptchaController.generate);

/**
 * @swagger
 * /api/v1/captcha/verify:
 *   post:
 *     tags:
 *       - Captcha
 *     summary: 验证滑块位置
 *     description: 验证用户滑动轨迹
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - captcha_id
 *               - duration
 *               - trail
 *             properties:
 *               captcha_id:
 *                 type: string
 *                 description: 验证码ID
 *               duration:
 *                 type: number
 *                 description: 滑动持续时间（毫秒）
 *               trail:
 *                 type: array
 *                 description: 滑动轨迹
 *                 items:
 *                   type: object
 *                   properties:
 *                     x:
 *                       type: number
 *                       description: X坐标
 *                     y:
 *                       type: number
 *                       description: Y坐标
 *                     timestamp:
 *                       type: number
 *                       description: 时间戳
 *     responses:
 *       200:
 *         description: 验证成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     verified:
 *                       type: boolean
 *                       example: true
 *                     reason:
 *                       type: string
 *                       example: 验证通过
 *                     details:
 *                       type: object
 *                       properties:
 *                         trajectory:
 *                           type: object
 *                           properties:
 *                             score:
 *                               type: number
 *                             reason:
 *                               type: array
 *                               items:
 *                                 type: string
 *                         velocity:
 *                           type: object
 *                           properties:
 *                             score:
 *                               type: number
 *                             reason:
 *                               type: array
 *                               items:
 *                                 type: string
 *                         repetition:
 *                           type: object
 *                           properties:
 *                             score:
 *                               type: number
 *                             reason:
 *                               type: array
 *                               items:
 *                                 type: string
 *                         totalScore:
 *                           type: number
 *       400:
 *         description: 验证失败
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: 验证失败
 *                 data:
 *                   type: object
 *                   properties:
 *                     verified:
 *                       type: boolean
 *                       example: false
 *                     reason:
 *                       type: string
 *                       example: 轨迹点数不足
 *                     details:
 *                       type: object
 *                       properties:
 *                         trajectory:
 *                           type: object
 *                           properties:
 *                             score:
 *                               type: number
 *                             reason:
 *                               type: array
 *                               items:
 *                                 type: string
 *                         velocity:
 *                           type: object
 *                           properties:
 *                             score:
 *                               type: number
 *                             reason:
 *                               type: array
 *                               items:
 *                                 type: string
 *                         repetition:
 *                           type: object
 *                           properties:
 *                             score:
 *                               type: number
 *                             reason:
 *                               type: array
 *                               items:
 *                                 type: string
 *                         totalScore:
 *                           type: number
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: 验证失败
 *                 data:
 *                   type: null
 */
router.post('/verify', CaptchaController.verify);

module.exports = router; 