const Router = require('koa-router');
const DepartmentController = require('../controllers/departmentController');
const auth = require('../middlewares/auth');
const router = new Router({
  prefix: '/api/v1/departments'
});

/**
 * @swagger
 * /api/v1/departments:
 *   post:
 *     tags:
 *       - Departments
 *     summary: 创建部门 [需要认证]
 *     description: 创建新的部门
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
 *             properties:
 *               name:
 *                 type: string
 *                 description: 部门名称
 *                 example: "技术部"
 *               description:
 *                 type: string
 *                 description: 部门描述
 *                 example: "负责公司技术研发"
 *               parent_id:
 *                 type: string
 *                 format: uuid
 *                 description: 父部门ID
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               status:
 *                 type: string
 *                 description: 部门状态
 *                 enum: [ACTIVE, DISABLED]
 *                 default: ACTIVE
 *                 example: "ACTIVE"
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
 *                   example: 部门创建成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     department_id:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     name:
 *                       type: string
 *                       example: "技术部"
 *                     description:
 *                       type: string
 *                       example: "负责公司技术研发"
 *                     parent_id:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-03-21T10:00:00.000Z"
 *       400:
 *         description: 参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授权
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
router.post('/', auth, DepartmentController.create);

/**
 * @swagger
 * /api/v1/departments:
 *   get:
 *     tags:
 *       - Departments
 *     summary: 获取部门列表 [需要认证]
 *     description: 获取部门列表，支持分页和筛选。当 size 参数为 -1 时，返回所有记录不分页。
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
 *         description: 部门名称（支持模糊匹配）
 *       - name: code
 *         in: query
 *         schema:
 *           type: string
 *         description: 部门编码（支持模糊匹配）
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [ACTIVE, DISABLED]
 *         description: 部门状态
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
 *                         $ref: '#/components/schemas/Department'
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/', auth, DepartmentController.list);

/**
 * @swagger
 * /api/v1/departments/tree:
 *   get:
 *     tags:
 *       - Departments
 *     summary: 获取部门树
 *     description: 获取部门树形结构，返回所有未删除的部门，按层级组织
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
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DepartmentTreeItem'
 *       401:
 *         description: 未授权
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
router.get('/tree', auth, DepartmentController.getTree);

/**
 * @swagger
 * /api/v1/departments/{department_id}:
 *   get:
 *     tags:
 *       - Departments
 *     summary: 获取部门详情 [需要认证]
 *     description: 获取指定部门的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 部门ID
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
 *                     department_id:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     name:
 *                       type: string
 *                       example: "技术部"
 *                     description:
 *                       type: string
 *                       example: "负责公司技术研发"
 *                     parent_id:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-03-21T10:00:00.000Z"
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-03-21T10:00:00.000Z"
 *                     parent:
 *                       type: object
 *                       properties:
 *                         department_id:
 *                           type: string
 *                           format: uuid
 *                           example: "550e8400-e29b-41d4-a716-446655440000"
 *                         name:
 *                           type: string
 *                           example: "研发中心"
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 部门不存在
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
router.get('/:department_id', auth, DepartmentController.getById);

/**
 * @swagger
 * /api/v1/departments/{department_id}:
 *   put:
 *     tags:
 *       - Departments
 *     summary: 更新部门 [需要认证]
 *     description: 更新指定部门的信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 部门ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 部门名称
 *                 example: "技术部"
 *               description:
 *                 type: string
 *                 description: 部门描述
 *                 example: "负责公司技术研发"
 *               parent_id:
 *                 type: string
 *                 format: uuid
 *                 description: 父部门ID
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               status:
 *                 type: string
 *                 description: 部门状态
 *                 enum: [ACTIVE, DISABLED]
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
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     department_id:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     name:
 *                       type: string
 *                       example: "技术部"
 *                     description:
 *                       type: string
 *                       example: "负责公司技术研发"
 *                     parent_id:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     status:
 *                       type: string
 *                       example: "ACTIVE"
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-03-21T10:00:00.000Z"
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 部门不存在
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
router.put('/:department_id', auth, DepartmentController.update);

/**
 * @swagger
 * /api/v1/departments/{department_id}:
 *   delete:
 *     tags:
 *       - Departments
 *     summary: 删除部门 [需要认证]
 *     description: 删除指定部门
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 部门ID
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
 *                   example: success
 *                 data:
 *                   type: null
 *                   example: null
 *       400:
 *         description: 存在子部门，无法删除
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 部门不存在
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
router.delete('/:department_id', auth, DepartmentController.delete);

/**
 * @swagger
 * /api/v1/departments/{department_id}/users:
 *   get:
 *     tags:
 *       - Departments
 *     summary: 获取部门用户 [需要认证]
 *     description: 获取指定部门的所有用户
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: department_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 部门ID
 *       - in: query
 *         name: include_children
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 是否包含子部门的用户
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_id:
 *                         type: string
 *                         format: uuid
 *                         example: "550e8400-e29b-41d4-a716-446655440000"
 *                       username:
 *                         type: string
 *                         example: "zhangsan"
 *                       name:
 *                         type: string
 *                         example: "张三"
 *                       email:
 *                         type: string
 *                         example: "zhangsan@example.com"
 *                       phone:
 *                         type: string
 *                         example: "13800138000"
 *                       status:
 *                         type: string
 *                         example: "ACTIVE"
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: 部门不存在
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
router.get('/:department_id/users', auth, DepartmentController.getMembers);

/**
 * @swagger
 * components:
 *   schemas:
 *     DepartmentTreeItem:
 *       type: object
 *       properties:
 *         department_id:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *           description: 部门ID
 *         name:
 *           type: string
 *           example: "前端组"
 *           description: 部门名称
 *         description:
 *           type: string
 *           nullable: true
 *           example: "负责前端开发"
 *           description: 部门描述
 *         parent_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *           description: 父部门ID
 *         status:
 *           type: string
 *           enum: [ACTIVE, DISABLED]
 *           example: "ACTIVE"
 *           description: 部门状态
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-03-21T10:00:00.000Z"
 *           description: 创建时间
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2024-03-21T10:00:00.000Z"
 *           description: 更新时间
 *         children:
 *           type: array
 *           description: 子部门列表
 *           items:
 *             $ref: '#/components/schemas/DepartmentTreeItem'
 *     Error:
 *       type: object
 *       properties:
 *         code:
 *           type: integer
 *           example: 400
 *         message:
 *           type: string
 *           example: 参数错误
 *         data:
 *           type: null
 *           example: null
 */

module.exports = router; 