const Router = require('koa-router');
const PermissionController = require('../controllers/permissionController');
const auth = require('../middlewares/auth');
const router = new Router({
  prefix: '/api/v1/permissions'
});

/**
 * @swagger
 * /api/v1/permissions:
 *   post:
 *     tags:
 *       - Permissions
 *     summary: 创建权限 [需要认证]
 *     description: 创建新的权限
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - resource_type
 *               - actions
 *             properties:
 *               code:
 *                 type: string
 *                 description: 权限编码
 *                 example: "user:manage"
 *               description:
 *                 type: string
 *                 description: 权限描述
 *                 example: "允许对用户进行增删改查操作"
 *               resource_type:
 *                 type: string
 *                 description: 资源类型
 *                 enum: [MENU, BUTTON, API]
 *                 example: "MENU"
 *               actions:
 *                 type: array
 *                 description: 操作类型列表
 *                 items:
 *                   type: string
 *                   enum: [create, read, update, delete]
 *                 example: ["create", "read", "update", "delete"]
 *     responses:
 *       201:
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 201
 *                 message:
 *                   type: string
 *                   example: 权限创建成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     permission_id:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     code:
 *                       type: string
 *                       example: "user:manage"
 *                     description:
 *                       type: string
 *                       example: "允许对用户进行增删改查操作"
 *                     resource_type:
 *                       type: string
 *                       example: "MENU"
 *                     actions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["create", "read", "update", "delete"]
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-03-21T10:00:00.000Z"
 *       400:
 *         description: 参数错误
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
 *                   example: 权限编码、资源类型和操作类型不能为空
 *                 data:
 *                   type: null
 *                   example: null
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 401
 *                 message:
 *                   type: string
 *                   example: 未授权
 *                 data:
 *                   type: null
 *                   example: null
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
router.post('/', auth, PermissionController.create);

/**
 * @swagger
 * /api/v1/permissions:
 *   get:
 *     tags:
 *       - Permissions
 *     summary: 获取权限列表 [需要认证]
 *     description: 获取权限列表，支持分页和筛选。当 size 参数为 -1 时，返回所有记录不分页。
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
 *         description: 权限名称（支持模糊匹配）
 *       - name: code
 *         in: query
 *         schema:
 *           type: string
 *         description: 权限编码（支持模糊匹配）
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *           enum: [MENU, BUTTON, API]
 *         description: 权限类型
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [ACTIVE, DISABLED]
 *         description: 权限状态
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
 *                         $ref: '#/components/schemas/Permission'
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/', auth, PermissionController.list);

/**
 * @swagger
 * /api/v1/permissions/{permission_id}:
 *   get:
 *     tags:
 *       - Permissions
 *     summary: 获取权限详情 [需要认证]
 *     description: 获取指定权限的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: permission_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 权限ID
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
 *                     permission_id:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     code:
 *                       type: string
 *                       example: "user:manage"
 *                     description:
 *                       type: string
 *                       example: "允许对用户进行增删改查操作"
 *                     resource_type:
 *                       type: string
 *                       example: "MENU"
 *                     actions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["create", "read", "update", "delete"]
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-03-21T10:00:00.000Z"
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-03-21T10:00:00.000Z"
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 401
 *                 message:
 *                   type: string
 *                   example: 未授权
 *                 data:
 *                   type: null
 *                   example: null
 *       404:
 *         description: 权限不存在
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: 权限不存在
 *                 data:
 *                   type: null
 *                   example: null
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
router.get('/:permission_id', auth, PermissionController.getById);

/**
 * @swagger
 * /api/v1/permissions/{permission_id}:
 *   put:
 *     tags:
 *       - Permissions
 *     summary: 更新权限 [需要认证]
 *     description: 更新指定权限的信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: permission_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 权限ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: 权限描述
 *                 example: "允许对用户进行增删改查操作"
 *               resource_type:
 *                 type: string
 *                 description: 资源类型
 *                 enum: [MENU, BUTTON, API]
 *                 example: "MENU"
 *               actions:
 *                 type: array
 *                 description: 操作类型列表
 *                 items:
 *                   type: string
 *                   enum: [create, read, update, delete]
 *                 example: ["create", "read", "update", "delete"]
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
 *                   example: 权限更新成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     permission_id:
 *                       type: string
 *                     code:
 *                       type: string
 *                     description:
 *                       type: string
 *                     resource_type:
 *                       type: string
 *                     actions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-03-21T10:00:00.000Z"
 *       404:
 *         description: 权限不存在
 *       500:
 *         description: 服务器错误
 */
router.put('/:permission_id', auth, PermissionController.update);

/**
 * @swagger
 * /api/v1/permissions/{permission_id}:
 *   delete:
 *     tags:
 *       - Permissions
 *     summary: 删除权限 [需要认证]
 *     description: 删除指定权限
 *     parameters:
 *       - name: permission_id
 *         in: path
 *         required: true
 *         type: string
 *         format: uuid
 *         description: 权限ID
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
 *                   example: 权限删除成功
 *       404:
 *         description: 权限不存在
 *       500:
 *         description: 服务器错误
 */
router.delete('/:permission_id', auth, PermissionController.delete);

/**
 * @swagger
 * /api/v1/permissions/{permission_id}/roles:
 *   post:
 *     tags:
 *       - Permissions
 *     summary: 分配角色权限 [需要认证]
 *     description: 为指定角色分配权限
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: permission_id
 *         in: path
 *         required: true
 *         type: string
 *         format: uuid
 *         description: 权限ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role_ids
 *             properties:
 *               role_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: 角色ID列表
 *     responses:
 *       200:
 *         description: 分配成功
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
 *                   example: 权限分配成功
 *       400:
 *         description: 参数错误
 *       404:
 *         description: 权限不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/:permission_id/roles', auth, PermissionController.assignRole);

/**
 * @swagger
 * /api/v1/permissions/users/{user_id}:
 *   get:
 *     tags:
 *       - Permissions
 *     summary: 获取用户权限 [需要认证]
 *     description: 获取指定用户的所有权限
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: user_id
 *         in: path
 *         required: true
 *         type: string
 *         format: uuid
 *         description: 用户ID
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
 *                   example: 获取用户权限成功
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       permission_id:
 *                         type: string
 *                       permission_name:
 *                         type: string
 *                       code:
 *                         type: string
 *                       description:
 *                         type: string
 *       404:
 *         description: 用户不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/users/:user_id', auth, PermissionController.getUserPermissions);

/**
 * @swagger
 * /api/v1/permissions/check:
 *   get:
 *     tags:
 *       - Permissions
 *     summary: 检查权限 [需要认证]
 *     description: 检查用户是否拥有指定资源类型的多个操作权限
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: user_id
 *         in: query
 *         required: true
 *         type: string
 *         format: uuid
 *         description: 用户ID
 *       - name: resource_type
 *         in: query
 *         required: true
 *         type: string
 *         enum: [MENU, BUTTON, API]
 *         description: 资源类型
 *       - name: action
 *         in: query
 *         required: true
 *         type: string
 *         description: 操作类型，多个操作类型用逗号分隔，例如：create,read,update
 *         example: "create,read,update"
 *     responses:
 *       200:
 *         description: 检查成功
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
 *                   example: 权限检查成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     has_permission:
 *                       type: boolean
 *                       description: 是否拥有所有请求的操作权限
 *                       example: true
 *                     permissions:
 *                       type: array
 *                       description: 用户拥有的相关权限列表
 *                       items:
 *                         type: object
 *                         properties:
 *                           permission_id:
 *                             type: string
 *                             format: uuid
 *                           name:
 *                             type: string
 *                           code:
 *                             type: string
 *                           actions:
 *                             type: array
 *                             items:
 *                               type: string
 *       400:
 *         description: 参数错误
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
 *                   example: 缺少必要参数或无效的操作类型
 *       404:
 *         description: 用户不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/check', auth, PermissionController.checkPermission);

/**
 * @swagger
 * /api/v1/permissions/rules:
 *   post:
 *     tags:
 *       - Permissions
 *     summary: 创建数据权限规则 [需要认证]
 *     description: 创建新的数据权限规则
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role_id
 *               - resource_type
 *               - conditions
 *             properties:
 *               role_id:
 *                 type: string
 *                 format: uuid
 *                 description: 角色ID
 *               resource_type:
 *                 type: string
 *                 description: 资源类型
 *               conditions:
 *                 type: object
 *                 description: 权限条件
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
 *                   example: 数据权限规则创建成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     rule_id:
 *                       type: string
 *                     role_id:
 *                       type: string
 *                     resource_type:
 *                       type: string
 *                     conditions:
 *                       type: object
 *                     status:
 *                       type: string
 *       400:
 *         description: 参数错误
 *       404:
 *         description: 角色不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/rules', auth, PermissionController.createRule);

/**
 * @swagger
 * /api/v1/permissions/rules:
 *   get:
 *     tags:
 *       - Permissions
 *     summary: 获取数据权限规则列表 [需要认证]
 *     description: 获取所有数据权限规则
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
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: 获取数据权限规则列表成功
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rule_id:
 *                         type: string
 *                       role_id:
 *                         type: string
 *                       resource_type:
 *                         type: string
 *                       conditions:
 *                         type: object
 *                       status:
 *                         type: string
 *       500:
 *         description: 服务器错误
 */
router.get('/rules', auth, PermissionController.getRules);

module.exports = router; 