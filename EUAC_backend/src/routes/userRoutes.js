const Router = require('koa-router');
const UserController = require('../controllers/userController');
const auth = require('../middlewares/auth');
const router = new Router({
  prefix: '/api/v1/users'
});

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         user_id:
 *           type: string
 *           format: uuid
 *           description: 用户ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         username:
 *           type: string
 *           description: 用户名
 *           example: "admin"
 *         password:
 *           type: string
 *           description: 密码（仅在创建时使用）
 *           example: "password123"
 *         name:
 *           type: string
 *           description: 姓名
 *           example: "管理员"
 *         email:
 *           type: string
 *           format: email
 *           description: 邮箱
 *           example: "admin@example.com"
 *         phone:
 *           type: string
 *           description: 电话
 *           example: "13800138000"
 *         gender:
 *           type: string
 *           enum: [MALE, FEMALE, OTHER]
 *           description: 性别
 *           example: "MALE"
 *         avatar:
 *           type: string
 *           description: 头像URL
 *           example: "https://example.com/avatar.jpg"
 *         department_id:
 *           type: string
 *           format: uuid
 *           description: 部门ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         status:
 *           type: string
 *           enum: [ACTIVE, DISABLED, ARCHIVED]
 *           description: 用户状态
 *           example: "ACTIVE"
 *         last_login_at:
 *           type: string
 *           format: date-time
 *           description: 最后登录时间
 *           example: "2024-03-21T10:00:00.000Z"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2024-03-21T10:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2024-03-21T10:00:00.000Z"
 *         deleted_at:
 *           type: string
 *           format: date-time
 *           description: 删除时间（软删除）
 *           example: "2024-03-21T10:00:00.000Z"
 *         roles:
 *           type: array
 *           description: 用户角色列表
 *           items:
 *             $ref: '#/components/schemas/Role'
 *     Role:
 *       type: object
 *       properties:
 *         role_id:
 *           type: string
 *           format: uuid
 *           description: 角色ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         role_name:
 *           type: string
 *           description: 角色名称
 *           example: "管理员"
 *         code:
 *           type: string
 *           description: 角色编码
 *           example: "ADMIN"
 *         description:
 *           type: string
 *           description: 角色描述
 *           example: "系统管理员角色"
 *         status:
 *           type: string
 *           enum: [ACTIVE, DISABLED, ARCHIVED]
 *           description: 角色状态
 *           example: "ACTIVE"
 *         permissions:
 *           type: array
 *           description: 角色权限列表
 *           items:
 *             $ref: '#/components/schemas/Permission'
 *     Permission:
 *       type: object
 *       properties:
 *         permission_id:
 *           type: string
 *           format: uuid
 *           description: 权限ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         name:
 *           type: string
 *           description: 权限名称
 *           example: "用户管理"
 *         code:
 *           type: string
 *           description: 权限编码
 *           example: "user:manage"
 *         description:
 *           type: string
 *           description: 权限描述
 *           example: "允许对用户进行增删改查操作"
 *         resource_type:
 *           type: string
 *           enum: [MENU, BUTTON, API]
 *           description: 资源类型
 *           example: "MENU"
 *         actions:
 *           type: array
 *           description: 操作类型列表
 *           items:
 *             type: string
 *             enum: [create, read, update, delete]
 *           example: ["create", "read", "update", "delete"]
 *         status:
 *           type: string
 *           enum: [ACTIVE, DISABLED, ARCHIVED]
 *           description: 权限状态
 *           example: "ACTIVE"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2024-03-21T10:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2024-03-21T10:00:00.000Z"
 *         deleted_at:
 *           type: string
 *           format: date-time
 *           description: 删除时间（软删除）
 *           example: "2024-03-21T10:00:00.000Z"
 *     Department:
 *       type: object
 *       properties:
 *         department_id:
 *           type: string
 *           format: uuid
 *           description: 部门ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         name:
 *           type: string
 *           description: 部门名称
 *           example: "技术部"
 *         code:
 *           type: string
 *           description: 部门编码
 *           example: "TECH"
 *         description:
 *           type: string
 *           description: 部门描述
 *           example: "负责公司技术研发"
 *         parent_id:
 *           type: string
 *           format: uuid
 *           description: 父部门ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         manager_id:
 *           type: string
 *           format: uuid
 *           description: 部门主管ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         status:
 *           type: string
 *           enum: [ACTIVE, DISABLED]
 *           description: 部门状态
 *           example: "ACTIVE"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2024-03-21T10:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2024-03-21T10:00:00.000Z"
 *         deleted_at:
 *           type: string
 *           format: date-time
 *           description: 删除时间（软删除）
 *           example: "2024-03-21T10:00:00.000Z"
 *         manager:
 *           $ref: '#/components/schemas/User'
 *         parent:
 *           $ref: '#/components/schemas/Department'
 *         children:
 *           type: array
 *           description: 子部门列表
 *           items:
 *             $ref: '#/components/schemas/Department'
 */

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     tags:
 *       - Users
 *     summary: 创建用户 [需要认证]
 *     description: 创建新用户
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - name
 *             properties:
 *               username:
 *                 type: string
 *                 description: 用户名
 *                 example: "newuser"
 *               password:
 *                 type: string
 *                 description: 密码
 *                 minLength: 6
 *                 example: "123456"
 *               name:
 *                 type: string
 *                 description: 姓名
 *                 example: "新用户"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 邮箱
 *                 example: "newuser@example.com"
 *               phone:
 *                 type: string
 *                 pattern: '^1[3-9]\d{9}$'
 *                 description: 电话
 *                 example: "13800138000"
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, OTHER]
 *                 description: 性别
 *                 example: "MALE"
 *               avatar:
 *                 type: string
 *                 description: 头像URL
 *                 example: "https://example.com/avatar.jpg"
 *               department_id:
 *                 type: string
 *                 format: uuid
 *                 description: 部门ID
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               role_ids:
 *                 type: array
 *                 description: 角色ID列表
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["550e8400-e29b-41d4-a716-446655440000"]
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
 *                   example: 用户创建成功
 *                 data:
 *                   $ref: '#/components/schemas/User'
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
 *                   example: 用户名已存在
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
router.post('/', auth, UserController.create);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     tags:
 *       - Users
 *     summary: 获取用户列表 [需要认证]
 *     description: 获取用户列表，支持分页和多种筛选条件
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: 页码
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: 每页数量
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         description: 用户名（支持模糊匹配）
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: 姓名（支持模糊匹配）
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         description: 邮箱（支持模糊匹配）
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *           pattern: '^1[3-9]\d{9}$'
 *         description: 电话（支持模糊匹配）
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, DISABLED, ARCHIVED]
 *         description: 用户状态
 *       - in: query
 *         name: gender
 *         schema:
 *           type: string
 *           enum: [MALE, FEMALE, OTHER]
 *         description: 性别
 *       - in: query
 *         name: department_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 部门ID
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 用户ID（精确匹配）
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
 *                       example: 100
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     size:
 *                       type: integer
 *                       example: 10
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
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
router.get('/', auth, UserController.list);

/**
 * @swagger
 * /api/v1/users/{user_id}:
 *   get:
 *     tags:
 *       - Users
 *     summary: 获取用户详情 [需要认证]
 *     description: 获取指定用户的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/User'
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
 *         description: 用户不存在
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
 *                   example: 用户不存在
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
router.get('/:user_id', auth, UserController.getById);

/**
 * @swagger
 * /api/v1/users/{user_id}:
 *   put:
 *     tags:
 *       - Users
 *     summary: 更新用户信息 [需要认证]
 *     description: 更新指定用户的信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 用户ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 姓名
 *                 example: "新名字"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 邮箱
 *                 example: "newemail@example.com"
 *               phone:
 *                 type: string
 *                 pattern: '^1[3-9]\d{9}$'
 *                 description: 电话
 *                 example: "13800138001"
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, OTHER]
 *                 description: 性别
 *                 example: "MALE"
 *               avatar:
 *                 type: string
 *                 description: 头像URL
 *                 example: "https://example.com/avatar.jpg"
 *               department_id:
 *                 type: string
 *                 format: uuid
 *                 description: 部门ID
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, DISABLED, ARCHIVED]
 *                 description: 用户状态
 *                 example: "ACTIVE"
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
 *                   example: 用户信息更新成功
 *                 data:
 *                   $ref: '#/components/schemas/User'
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
 *         description: 用户不存在
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
 *                   example: 用户不存在
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
router.put('/:user_id', auth, UserController.update);

/**
 * @swagger
 * /api/v1/users/{user_id}:
 *   delete:
 *     tags:
 *       - Users
 *     summary: 删除用户 [需要认证]
 *     description: 删除指定用户
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用户ID
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
 *                   example: 用户删除成功
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
 *       404:
 *         description: 用户不存在
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
 *                   example: 用户不存在
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
router.delete('/:user_id', auth, UserController.delete);

/**
 * @swagger
 * /api/v1/users/{user_id}/roles:
 *   put:
 *     tags:
 *       - Users
 *     summary: 更新用户角色 [需要认证]
 *     description: 更新指定用户的角色
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 用户ID
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
 *                 description: 角色ID列表
 *                 items:
 *                   type: string
 *                 example: ["550e8400-e29b-41d4-a716-446655440000"]
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
 *                   example: 用户角色更新成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           role_id:
 *                             type: string
 *                             example: "550e8400-e29b-41d4-a716-446655440000"
 *                           name:
 *                             type: string
 *                             example: "管理员"
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
 *         description: 用户不存在
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
 *                   example: 用户不存在
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
router.put('/:user_id/roles', auth, UserController.assignRoles);

/**
 * @swagger
 * /api/v1/users/{user_id}/status:
 *   put:
 *     tags:
 *       - Users
 *     summary: 更新用户状态 [需要认证]
 *     description: 更新指定用户的状态
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: user_id
 *         in: path
 *         required: true
 *         type: string
 *         description: 用户ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, DISABLED, ARCHIVED]
 *                 description: 用户状态
 *     responses:
 *       200:
 *         description: 更新成功
 *       404:
 *         description: 用户不存在
 *       500:
 *         description: 服务器错误
 */
router.put('/:user_id/status', auth, UserController.updateStatus);

/**
 * @swagger
 * /api/v1/users/{user_id}/avatar:
 *   post:
 *     tags:
 *       - Users
 *     summary: 上传用户头像 [需要认证]
 *     description: 上传并更新用户头像
 *     parameters:
 *       - name: user_id
 *         in: path
 *         required: true
 *         type: string
 *         description: 用户ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: 头像文件
 *     responses:
 *       200:
 *         description: 上传成功
 *       400:
 *         description: 参数错误
 *       404:
 *         description: 用户不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/:user_id/avatar', auth, UserController.update);

/**
 * @swagger
 * /api/v1/users/{user_id}/restore:
 *   post:
 *     tags:
 *       - Users
 *     summary: 恢复已删除用户 [需要认证]
 *     description: 恢复被软删除的用户
 *     parameters:
 *       - name: user_id
 *         in: path
 *         required: true
 *         type: string
 *         description: 用户ID
 *     responses:
 *       200:
 *         description: 恢复成功
 *       404:
 *         description: 用户不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/:user_id/restore', auth, UserController.restore);

/**
 * @swagger
 * /api/v1/users/{user_id}/change-password:
 *   post:
 *     tags:
 *       - Users
 *     summary: 修改密码 [需要认证]
 *     description: 用户通过旧密码修改为新密码
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 用户ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - old_password
 *               - new_password
 *             properties:
 *               old_password:
 *                 type: string
 *                 description: 旧密码
 *                 example: "oldpass123"
 *               new_password:
 *                 type: string
 *                 description: 新密码
 *                 minLength: 6
 *                 example: "newpass123"
 *     responses:
 *       200:
 *         description: 密码修改成功
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
 *                   example: 密码修改成功
 *                 data:
 *                   type: null
 *                   example: null
 *       400:
 *         description: 参数错误或原密码错误
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
 *                   example: 原密码错误
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
 *       404:
 *         description: 用户不存在
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
 *                   example: 用户不存在
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
router.post('/:user_id/change-password', auth, UserController.changePassword);

/**
 * @swagger
 * /api/v1/users/reset-password:
 *   post:
 *     tags:
 *       - Users
 *     summary: 重置密码 [需要认证]
 *     description: 重置用户密码
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *             properties:
 *               username:
 *                 type: string
 *                 description: 用户名
 *               email:
 *                 type: string
 *                 description: 邮箱
 *     responses:
 *       200:
 *         description: 重置成功
 *       400:
 *         description: 参数错误
 *       404:
 *         description: 用户不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/reset-password', UserController.resetPassword);

/**
 * @swagger
 * /api/v1/users/request-password-reset:
 *   post:
 *     tags:
 *       - Users
 *     summary: 请求重置密码
 *     description: 通过用户名和邮箱请求重置密码。服务端会校验用户名与邮箱是否与账户一致，一致时才发送重置码；未设置邮箱的账户无法自助重置。
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *             properties:
 *               username:
 *                 type: string
 *                 description: 用户名
 *                 example: "admin"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 邮箱
 *                 example: "admin@example.com"
 *     responses:
 *       200:
 *         description: 请求成功，重置令牌已发送到邮箱
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
 *                   example: 重置密码邮件已发送
 *                 data:
 *                   type: null
 *                   example: null
 *       400:
 *         description: 参数错误或用户不存在
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
 *                   example: 未设置邮箱的用户无法重置密码，请联系管理员手工修改
 *                 data:
 *                   type: null
 *                   example: null
 *       500:
 *         description: 服务器错误
 */
router.post('/request-password-reset', UserController.requestPasswordResetToken);

/**
 * @swagger
 * /api/v1/users/reset-password-with-token:
 *   post:
 *     tags:
 *       - Users
 *     summary: 使用令牌重置密码
 *     description: 使用重置令牌重置密码
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - token
 *               - new_password
 *             properties:
 *               username:
 *                 type: string
 *                 description: 用户名
 *                 example: "admin"
 *               token:
 *                 type: string
 *                 description: 重置令牌（8位）
 *                 example: "A1B2C3D4"
 *               new_password:
 *                 type: string
 *                 description: 新密码
 *                 minLength: 6
 *                 example: "newpass123"
 *     responses:
 *       200:
 *         description: 密码重置成功
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
 *                   example: 密码重置成功
 *                 data:
 *                   type: null
 *                   example: null
 *       400:
 *         description: 参数错误或令牌无效
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
 *                   example: 重置令牌无效或已过期
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
router.post('/reset-password-with-token', UserController.resetPasswordWithToken);

module.exports = router; 