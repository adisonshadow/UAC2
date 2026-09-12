const { Readable } = require('stream');
const AppTransferExportService = require('../services/appTransfer/appExportService');
const AppTransferPreviewService = require('../services/appTransfer/appPreviewService');
const AppTransferImportService = require('../services/appTransfer/appImportService');
const logger = require('../utils/logger');
const { formatApiError } = require('../utils/formatApiError');

function sendError(ctx, error, fallbackStatus = 500) {
  const formatted = formatApiError(error, { fallbackStatus });
  logger.error(formatted.message, { stack: error?.stack });
  ctx.status = formatted.status;
  ctx.body = { code: formatted.code, message: formatted.message, data: formatted.data };
}

function getRequestFile(ctx) {
  const files = ctx.request.files || {};
  const raw = files.file;
  return Array.isArray(raw) ? raw[0] : raw;
}

class AppTransferController {
  /**
   * 导出:响应体就是 JSON 导出文件(附件流式下载),不包业务信封。
   * Content-Type 用 octet-stream 而非 application/json:
   * 前端以「blob 是 JSON」识别错误信封,导出文件本身是 JSON,不能用同一类型。
   * 校验失败时返回标准 JSON 错误信封(application/json)。
   */
  static async exportApp(ctx) {
    let streamStarted = false;
    try {
      const body = ctx.request.body || {};
      const app = await AppTransferExportService.assertExportableApplication(body.applicationId);
      const options = AppTransferExportService.normalizeOptions(body);
      const fileName = AppTransferExportService.buildExportFileName(app.code);
      streamStarted = true;
      ctx.status = 200;
      ctx.set('Content-Type', 'application/octet-stream');
      ctx.set('Content-Disposition', `attachment; filename="${fileName}"`);
      ctx.body = Readable.from(
        AppTransferExportService.exportAppStream(app.application_id, options),
      );
      logger.info(`[appTransfer] 应用「${app.code}」导出开始`, { fileName, options });
    } catch (error) {
      if (streamStarted) {
        // 头已发出,无法改发 JSON 信封,只能中断流
        ctx.res.destroy();
        return;
      }
      sendError(ctx, error, 400);
    }
  }

  /** 预览:解析上传文件并对照目标实例检查,不写任何数据 */
  static async previewImport(ctx) {
    const file = getRequestFile(ctx);
    if (!file || !file.filepath) {
      ctx.status = 400;
      ctx.body = { code: 400, message: '请上传应用导出的 .json 文件', data: null };
      return;
    }
    try {
      const data = await AppTransferPreviewService.previewImportFile(file.filepath);
      ctx.body = { code: 200, message: '预览解析完成', data };
    } catch (error) {
      sendError(ctx, error, 400);
    } finally {
      AppTransferPreviewService.cleanupFile(file.filepath);
    }
  }

  /** 导入:按策略执行,结果分节 */
  static async importApp(ctx) {
    const file = getRequestFile(ctx);
    if (!file || !file.filepath) {
      ctx.status = 400;
      ctx.body = { code: 400, message: '请上传应用导出的 .json 文件', data: null };
      return;
    }
    const strategy = String(ctx.request.body?.strategy || 'overwrite');
    if (!AppTransferImportService.STRATEGIES.includes(strategy)) {
      ctx.status = 400;
      ctx.body = { code: 400, message: `strategy 仅支持: ${AppTransferImportService.STRATEGIES.join(' / ')}`, data: null };
      AppTransferPreviewService.cleanupFile(file.filepath);
      return;
    }
    try {
      const data = await AppTransferImportService.importAppFile(file.filepath, strategy, {
        createdBy: ctx.state.user?.user_id,
      });
      ctx.body = {
        code: 200,
        message: data.chainStoppedAt
          ? `导入在「${data.chainStoppedAt}」节失败,后续节已终止`
          : '导入执行完成',
        data,
      };
    } catch (error) {
      sendError(ctx, error, 400);
    } finally {
      AppTransferPreviewService.cleanupFile(file.filepath);
    }
  }
}

module.exports = AppTransferController;
