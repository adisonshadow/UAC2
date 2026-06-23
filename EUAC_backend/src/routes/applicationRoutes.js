const Router = require('koa-router');
const ApplicationController = require('../controllers/applicationController');
const auth = require('../middlewares/auth');
const router = new Router({
  prefix: '/api/v1/applications'
});

/**
 * @swagger
 * /api/v1/applications:
 *   post:
 *     tags:
 *       - Applications
 *     summary: 创建应用 [需要认证]
 *     description: 创建一个新的应用
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *                 description: 应用名称
 *                 example: "人力资源管理系统"
 *               code:
 *                 type: string
 *                 description: 应用编码
 *                 example: "hrms"
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, DISABLED]
 *                 description: 应用状态
 *                 example: "ACTIVE"
 *               sso_enabled:
 *                 type: boolean
 *                 description: 是否启用SSO
 *                 example: true
 *               sso_config:
 *                 $ref: '#/components/schemas/SSOConfig'
 *               api_enabled:
 *                 type: boolean
 *                 description: 是否启用API服务
 *                 example: true
 *               api_connect_config:
 *                 $ref: '#/components/schemas/APIConnectConfig'
 *               api_data_scope:
 *                 $ref: '#/components/schemas/APIDataScope'
 *               description:
 *                 type: string
 *                 description: 应用描述
 *                 example: "公司人力资源管理系统"
 *     responses:
 *       200:
 *         description: 创建成功
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
 *                   example: "创建成功"
 *                 data:
 *                   $ref: '#/components/schemas/Application'
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', auth, ApplicationController.create);

/**
 * @swagger
 * /api/v1/applications:
 *   get:
 *     tags:
 *       - Applications
 *     summary: 获取应用列表 [需要认证] 
 *     description: 获取应用列表，支持分页和筛选。当 size 参数为 -1 时，返回所有记录不分页。
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: 页码（当 size 不为 -1 时有效）
 *       - name: size
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: -1
 *           maximum: 100
 *         description: 每页数量，设置为 -1 时返回所有记录不分页
 *       - name: name
 *         in: query
 *         schema:
 *           type: string
 *         description: 应用名称（支持模糊匹配）
 *       - name: code
 *         in: query
 *         schema:
 *           type: string
 *         description: 应用编码（支持模糊匹配）
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [ACTIVE, DISABLED]
 *         description: 应用状态
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
 *                     total:
 *                       type: integer
 *                       description: 总记录数（当 size 为 -1 时等于 items 的长度）
 *                       example: 100
 *                     page:
 *                       type: integer
 *                       description: 当前页码（当 size 为 -1 时固定为 1）
 *                       example: 1
 *                     size:
 *                       type: integer
 *                       description: 每页数量（当 size 为 -1 时等于总记录数）
 *                       example: 10
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Application'
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/', auth, ApplicationController.list);

/**
 * @swagger
 * /api/v1/applications/{id}:
 *   get:
 *     tags:
 *       - Applications
 *     summary: 获取应用详情 [需要认证]
 *     description: 根据ID获取应用详情
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 应用ID
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
 *                   example: "获取成功"
 *                 data:
 *                   $ref: '#/components/schemas/Application'
 *       404:
 *         description: 应用不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', auth, ApplicationController.getById);

/**
 * @swagger
 * /api/v1/applications/{id}:
 *   put:
 *     tags:
 *       - Applications
 *     summary: 更新应用 [需要认证]
 *     description: 更新应用信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 应用ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 应用名称
 *                 example: "人力资源管理系统"
 *               code:
 *                 type: string
 *                 description: 应用编码
 *                 example: "hrms"
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, DISABLED]
 *                 description: 应用状态
 *                 example: "ACTIVE"
 *               sso_enabled:
 *                 type: boolean
 *                 description: 是否启用SSO
 *                 example: true
 *               sso_config:
 *                 $ref: '#/components/schemas/SSOConfig'
 *               api_enabled:
 *                 type: boolean
 *                 description: 是否启用API服务
 *                 example: true
 *               api_connect_config:
 *                 $ref: '#/components/schemas/APIConnectConfig'
 *               api_data_scope:
 *                 $ref: '#/components/schemas/APIDataScope'
 *               description:
 *                 type: string
 *                 description: 应用描述
 *                 example: "公司人力资源管理系统"
 *     responses:
 *       200:
 *         description: 更新成功
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
 *                   example: "更新成功"
 *                 data:
 *                   $ref: '#/components/schemas/Application'
 *       404:
 *         description: 应用不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:id', auth, ApplicationController.update);

/**
 * @swagger
 * /api/v1/applications/{id}:
 *   delete:
 *     tags:
 *       - Applications
 *     summary: 删除应用 [需要认证]
 *     description: 删除指定应用 
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 应用ID
 *     responses:
 *       200:
 *         description: 删除成功
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
 *                   example: "删除成功"
 *       404:
 *         description: 应用不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:id', auth, ApplicationController.delete);

/**
 * @swagger
 * /api/v1/applications/{id}/generate-secret:
 *   post:
 *     tags:
 *       - Applications
 *     summary: 生成应用统一密钥 [需要认证]
 *     description: 生成 app_secret 并同步写入 api_connect_config 与 sso_config.client_secret
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 应用ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: 无需传参，服务端随机生成统一密钥
 *     responses:
 *       200:
 *         description: 生成成功
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
 *                   example: "生成成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     app_secret:
 *                       type: string
 *                       description: 应用密钥
 *                       example: "a1b2c3d4e5f6g7h8i9j0..."
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 应用不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/generate-secret', auth, ApplicationController.generateSecret);

/**
 * @swagger
 * /api/v1/applications/token:
 *   post:
 *     tags:
 *       - Applications
 *     summary: 获取应用Token [需要认证]
 *     description: 根据应用ID和app_secret获取JWT Token，用于应用API认证
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - application_id
 *               - app_secret
 *             properties:
 *               application_id:
 *                 type: string
 *                 format: uuid
 *                 description: 应用ID
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               app_secret:
 *                 type: string
 *                 description: 应用密钥
 *                 example: "a1b2c3d4e5f6g7h8i9j0..."
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
 *                   example: "获取成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       description: JWT Token
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 认证失败
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 应用不存在
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/token', auth, ApplicationController.getToken);

module.exports = router; 