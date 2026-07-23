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
 *       返回业务 API、内置 API、采集 API（已发布且对本应用开放的采集管道）各 Operation / 接口明细，
 *       以及服务级请求参数 TypeScript interface（若有）。
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
 *       覆盖业务 API、内置 API、采集 API（POST /api/v1/ingest/...，text/plain 或 octet-stream）。
 *       GET 类 operation 在 parameters[].example 中附带请求参数 Example；POST/PUT/PATCH 在 requestBody 中附带。
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

/**
 * @swagger
 * /api/v1/applications-public/{key}/api-skill.md:
 *   get:
 *     tags:
 *       - Applications Public
 *     summary: 获取 EADAF API 调用 Skill（Markdown，公开）
 *     description: |
 *       供 AI Agent / 集成脚本直接读取 EADAF API 调用约定（鉴权、filter 参数、发现接口等）。
 *       返回纯 Markdown 原文（不套 { code, message, data } 外壳）。
 *       响应头 `X-EADAF-Api-Skill-Version` 为 Skill 版本号。
 *       `key` 可为应用 code 或 application_id（UUID）；应用须已启用 API。
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *         description: 应用 code 或 application_id
 *     responses:
 *       200:
 *         description: SKILL.md 原文（text/markdown）
 *       400:
 *         description: 应用未启用 API
 *       404:
 *         description: 应用不存在
 */
router.get('/:key/api-skill.md', ApplicationController.getPublicApiSkill);

module.exports = router;
