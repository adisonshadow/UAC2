const Router = require('koa-router');
const HealthController = require('../controllers/healthController');

const router = new Router({
  prefix: '/api/v1/health'
});

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: 健康检查
 *     description: 检查系统运行状态，包括服务器状态和数据库连接状态
 *     responses:
 *       200:
 *         description: 服务正常
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
 *                     status:
 *                       type: string
 *                       description: 系统整体状态，ok 表示完全正常，warning 表示部分异常
 *                       enum: [ok, warning]
 *                       example: ok
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       description: 检查时间
 *                       example: 2024-03-21T10:00:00.000Z
 *                     version:
 *                       type: string
 *                       description: 系统版本号
 *                       example: 1.0.0
 *                     uptime:
 *                       type: number
 *                       description: 系统运行时间（秒）
 *                       example: 3600
 *                     memory:
 *                       type: object
 *                       description: 内存使用情况
 *                       properties:
 *                         total:
 *                           type: number
 *                           description: 总内存（字节）
 *                           example: 8589934592
 *                         free:
 *                           type: number
 *                           description: 可用内存（字节）
 *                           example: 4294967296
 *                         used:
 *                           type: number
 *                           description: 已用内存（字节）
 *                           example: 2147483648
 *                     cpu:
 *                       type: object
 *                       description: CPU 使用情况
 *                       properties:
 *                         cores:
 *                           type: number
 *                           description: CPU 核心数
 *                           example: 4
 *                         loadAvg:
 *                           type: array
 *                           description: CPU 负载平均值（1分钟、5分钟、15分钟）
 *                           items:
 *                             type: number
 *                           example: [1.5, 1.2, 1.0]
 *                     database:
 *                       type: object
 *                       description: 数据库连接状态
 *                       properties:
 *                         status:
 *                           type: string
 *                           description: 数据库连接状态
 *                           enum: [ok, error]
 *                           example: ok
 *                         message:
 *                           type: string
 *                           description: 数据库状态描述
 *                           example: 数据库连接正常
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
 *                   example: 健康检查失败
 *                 error:
 *                   type: string
 *                   description: 错误详情
 */
router.get('/', HealthController.check);

module.exports = router; 