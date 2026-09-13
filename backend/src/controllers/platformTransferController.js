const { Readable } = require('stream');
const PlatformTransferExportService = require('../services/platformTransfer/platformExportService');
const PlatformTransferPreviewService = require('../services/platformTransfer/platformPreviewService');
const PlatformTransferImportService = require('../services/platformTransfer/platformImportService');
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

class PlatformTransferController {
  static async exportPlatform(ctx) {
    let streamStarted = false;
    try {
      const fileName = PlatformTransferExportService.buildExportFileName();
      streamStarted = true;
      ctx.status = 200;
      ctx.set('Content-Type', 'application/octet-stream');
      ctx.set('Content-Disposition', `attachment; filename="${fileName}"`);
      ctx.body = Readable.from(PlatformTransferExportService.exportPlatformStream());
      logger.info('[platformTransfer] EADAF 平台导出开始', { fileName });
    } catch (error) {
      if (streamStarted) {
        ctx.res.destroy();
        return;
      }
      sendError(ctx, error, 400);
    }
  }

  static async previewImport(ctx) {
    const file = getRequestFile(ctx);
    if (!file || !file.filepath) {
      ctx.status = 400;
      ctx.body = { code: 400, message: '请上传 EADAF 平台导出的 .json 文件', data: null };
      return;
    }
    try {
      const data = await PlatformTransferPreviewService.previewImportFile(file.filepath);
      ctx.body = { code: 200, message: '预览解析完成', data };
    } catch (error) {
      sendError(ctx, error, 400);
    } finally {
      PlatformTransferPreviewService.cleanupFile(file.filepath);
    }
  }

  static async importPlatform(ctx) {
    const file = getRequestFile(ctx);
    if (!file || !file.filepath) {
      ctx.status = 400;
      ctx.body = { code: 400, message: '请上传 EADAF 平台导出的 .json 文件', data: null };
      return;
    }
    const strategy = String(ctx.request.body?.strategy || 'overwrite');
    if (!PlatformTransferImportService.STRATEGIES.includes(strategy)) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: `strategy 仅支持: ${PlatformTransferImportService.STRATEGIES.join(' / ')}`,
        data: null,
      };
      PlatformTransferPreviewService.cleanupFile(file.filepath);
      return;
    }
    try {
      const data = await PlatformTransferImportService.importPlatformFile(file.filepath, strategy);
      ctx.body = {
        code: 200,
        message: data.aborted ? '存在冲突,已按 abort 策略中止' : '导入执行完成',
        data,
      };
    } catch (error) {
      sendError(ctx, error, 400);
    } finally {
      PlatformTransferPreviewService.cleanupFile(file.filepath);
    }
  }
}

module.exports = PlatformTransferController;
