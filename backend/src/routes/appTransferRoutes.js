const Router = require('koa-router');
const koaBody = require('koa-body').default;
const os = require('os');
const path = require('path');
const fs = require('fs');
const AppTransferController = require('../controllers/appTransferController');
const authWithBuiltinApiGuard = require('../middlewares/withBuiltinApiGuard');
const { operationAudit } = require('../middlewares/operationAudit');

const router = new Router({ prefix: '/api/v1/system/app-transfer' });

// 导入文件上传中间件:.json 格式、单文件、上限 1GB,落在系统临时目录(与备份恢复同规格)
const uploadDir = path.join(os.tmpdir(), 'eadaf-app-transfer');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const uploadMiddleware = koaBody({
  multipart: true,
  formidable: {
    uploadDir,
    keepExtensions: true,
    maxFileSize: 1024 * 1024 * 1024,
    filter: ({ originalFilename }) => {
      const name = String(originalFilename || '').toLowerCase();
      return name.endsWith('.json');
    },
  },
});

/**
 * @swagger
 * /api/v1/system/app-transfer/export:
 *   post:
 *     tags: [System]
 *     summary: 按应用导出 JSON 迁移文件(附件流式下载,含明文密钥,高危) [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [applicationId]
 *             properties:
 *               applicationId: { type: string, format: uuid, description: '应用 ID(内置应用 EADAF 拒绝导出)' }
 *               dataMode: { type: string, enum: [structure_and_data, data_only], default: structure_and_data, description: 'data_only 时导入端不落结构,仅对目标已有同版本实体写数' }
 *               includeUac: { type: boolean, default: false, description: '是否携带用户/部门/授权等 UAC 数据(不勾选仅携带被引用的角色与权限)' }
 *     responses:
 *       200:
 *         description: 返回 eadaf-app-export JSON 文件附件(Content-Disposition;body 为 octet-stream)
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *               description: eadaf-app-export 格式的完整导出文件(JSON 内容)
 *       400:
 *         description: 参数错误 / EADAF 拒绝导出
 */
router.post('/export', authWithBuiltinApiGuard, operationAudit({
  domain: 'system',
  operationType: 'EXPORT',
  resourceType: 'system_app_transfer',
  resourceId: () => 'export',
}), AppTransferController.exportApp);

/**
 * @swagger
 * /api/v1/system/app-transfer/preview:
 *   post:
 *     tags: [System]
 *     summary: 预览应用导出文件(节条数/冲突/连接匹配与将创建/物化库表摘要/缺失引用,不写数据) [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary, description: 'eadaf-app-export .json 文件' }
 *     responses:
 *       200:
 *         description: 预览摘要
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeAppTransferPreview'
 *       400:
 *         description: 文件格式不正确 / EADAF 拒绝导入 / 误传平台导出文件
 */
router.post('/preview', authWithBuiltinApiGuard, operationAudit({
  domain: 'system',
  operationType: 'READ',
  resourceType: 'system_app_transfer',
  resourceId: () => 'preview',
}), uploadMiddleware, AppTransferController.previewImport);

/**
 * @swagger
 * /api/v1/system/app-transfer/import:
 *   post:
 *     tags: [System]
 *     summary: 按策略导入应用导出文件(写操作,不可自动撤销;连接未匹配时用目标凭证创建本地连接;物化 run.created_by 记操作者 UUID) [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary, description: 'eadaf-app-export .json 文件' }
 *               strategy: { type: string, enum: [overwrite, skip, abort], default: overwrite, description: '冲突策略:覆盖更新 / 跳过已存在 / 有冲突即中止(不写任何数据)' }
 *     responses:
 *       200:
 *         description: 导入结果(分节计数/errors/notes)。物化与行数据失败不终止后续 API 等元数据节;未勾选 includeUac 写入 notes 而非 errors。不含平台 AI 目录/全局 Skill
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvelopeAppTransferImport'
 *       400:
 *         description: 文件或策略不合法
 */
router.post('/import', authWithBuiltinApiGuard, operationAudit({
  domain: 'system',
  operationType: 'IMPORT',
  resourceType: 'system_app_transfer',
  resourceId: () => 'import',
}), uploadMiddleware, AppTransferController.importApp);

module.exports = router;
