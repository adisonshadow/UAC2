const Router = require('koa-router');
const BuiltinApiController = require('../controllers/builtinApiController');
const auth = require('../middlewares/auth');

const router = new Router({ prefix: '/api/v1/admin/builtin-apis' });

/**
 * @swagger
 * /api/v1/admin/builtin-apis:
 *   get:
 *     tags: [Admin-BuiltinApi]
 *     summary: 获取内置 API 清单（含限制配置） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code: { type: integer }
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code: { type: string, description: "业务域:资源[:动作]" }
 *                           domain: { type: string }
 *                           label: { type: string }
 *                           routePath: { type: string }
 *                           httpMethods: { type: array, items: { type: string } }
 *                           actions: { type: array, items: { type: string } }
 *                           description: { type: string }
 *                           accessRestriction:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               mode: { type: string, enum: [role, department] }
 *                               roleIds: { type: array, items: { type: string } }
 *                               departmentIds: { type: array, items: { type: string } }
 *                           configured: { type: boolean }
 *                     tree:
 *                       type: array
 *                       description: 按 code 分层的树
 * /api/v1/admin/builtin-apis/{code}/access-restriction:
 *   put:
 *     tags: [Admin-BuiltinApi]
 *     summary: 配置内置 API 访问限制（角色或组织，无"无限制"） [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accessRestriction]
 *             properties:
 *               accessRestriction:
 *                 type: object
 *                 required: [mode]
 *                 properties:
 *                   mode: { type: string, enum: [role, department] }
 *                   roleIds: { type: array, items: { type: string, format: uuid } }
 *                   departmentIds: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       200: { description: 配置成功 }
 *       400: { description: 参数无效（必须配置角色或组织限制） }
 *       404: { description: 内置 API 不存在 }
 *   delete:
 *     tags: [Admin-BuiltinApi]
 *     summary: 清除内置 API 访问限制 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: 清除成功 }
 */
router.get('/', auth, BuiltinApiController.list);
router.put('/batch/access-restriction', auth, BuiltinApiController.batchUpdateAccessRestriction);
router.put('/:code/access-restriction', auth, BuiltinApiController.updateAccessRestriction);
router.delete('/:code/access-restriction', auth, BuiltinApiController.deleteAccessRestriction);

module.exports = router;
