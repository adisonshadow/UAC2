const Router = require('koa-router');
const auth = require('../middlewares/auth');
const DemoSalesController = require('../controllers/demoSalesController');

const router = new Router({ prefix: '/api/v1/demo/sales' });

/**
 * @swagger
 * tags:
 *   - name: Demo-Sales
 *     description: 销售管理系统 Demo（SQLite 数据，供 AIBase 页面与 AI Tool 共用）
 */

/**
 * @swagger
 * /api/v1/demo/sales/orders:
 *   get:
 *     tags: [Demo-Sales]
 *     summary: 订单列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, paid, shipped, completed, cancelled] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/orders', auth, DemoSalesController.listOrders);

/**
 * @swagger
 * /api/v1/demo/sales/orders/{orderNo}:
 *   get:
 *     tags: [Demo-Sales]
 *     summary: 订单详情 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: orderNo
 *         required: true
 *         schema: { type: string, example: SO202501001 }
 *     responses:
 *       200:
 *         description: 获取成功
 *       404:
 *         description: 订单不存在
 */
router.get('/orders/:orderNo', auth, DemoSalesController.getOrder);

/**
 * @swagger
 * /api/v1/demo/sales/users:
 *   get:
 *     tags: [Demo-Sales]
 *     summary: 用户列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/users', auth, DemoSalesController.listUsers);

/**
 * @swagger
 * /api/v1/demo/sales/products:
 *   get:
 *     tags: [Demo-Sales]
 *     summary: 产品列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/products', auth, DemoSalesController.listProducts);

/**
 * @swagger
 * /api/v1/demo/sales/complaints:
 *   get:
 *     tags: [Demo-Sales]
 *     summary: 投诉列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [quality, logistics, service, refund] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [open, processing, resolved, closed] }
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/complaints', auth, DemoSalesController.listComplaints);

/**
 * @swagger
 * /api/v1/demo/sales/stats/orders:
 *   get:
 *     tags: [Demo-Sales]
 *     summary: 订单统计 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/stats/orders', auth, DemoSalesController.orderStats);

/**
 * @swagger
 * /api/v1/demo/sales/stats/complaints:
 *   get:
 *     tags: [Demo-Sales]
 *     summary: 投诉统计 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/stats/complaints', auth, DemoSalesController.complaintStats);

module.exports = router;
