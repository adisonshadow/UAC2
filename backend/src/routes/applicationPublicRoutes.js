const Router = require('koa-router');
const ApplicationController = require('../controllers/applicationController');

const router = new Router({
  prefix: '/api/v1/applications-public',
});

/**
 * @swagger
 * /api/v1/applications-public/{key}/api-catalog:
 *   get:
 *     tags:
 *       - Applications Public
 *     summary: 获取应用可访问 API 目录（公开）
 *     description: |
 *       供第三方应用开发人员查看该应用已授权可访问的 API 明细，无需登录。
 *       `key` 可为应用 code 或 application_id（UUID）。
 *       返回各 Operation 的运行时 JSON Schema、模拟参数（JSON）、响应结构说明，以及服务级请求参数 TypeScript interface（若有）。
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: 应用 code 或 application_id
 *     responses:
 *       200:
 *         description: 获取成功
 *       400:
 *         description: 应用未启用 API
 *       404:
 *         description: 应用不存在
 */
router.get('/:key/api-catalog', ApplicationController.getPublicApiCatalog);

/**
 * @swagger
 * /api/v1/applications-public/{key}/apis.json:
 *   get:
 *     tags:
 *       - Applications Public
 *     summary: 获取应用可访问 API 的 OpenAPI 3.0 JSON（公开）
 *     description: |
 *       供 AI / 第三方工具直接读取机器可读的接口契约（替代抓取 api-docs HTML）。
 *       返回标准 OpenAPI 3.0 对象（不套 { code, message, data } 外壳）。
 *       `key` 可为应用 code 或 application_id（UUID）。
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *         description: 应用 code 或 application_id
 *     responses:
 *       200:
 *         description: OpenAPI 3.0 JSON
 *       400:
 *         description: 应用未启用 API
 *       404:
 *         description: 应用不存在
 */
router.get('/:key/apis.json', ApplicationController.getPublicApiOpenApi);

module.exports = router;
