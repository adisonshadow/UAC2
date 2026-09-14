const PlatformTransferExportService = require('../services/platformTransfer/platformExportService');
const PlatformTransferPreviewService = require('../services/platformTransfer/platformPreviewService');
const PlatformTransferImportService = require('../services/platformTransfer/platformImportService');
const { cleanupUpload } = require('../services/appTransfer/transferZip');
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
      const body = ctx.request.body || {};
      const { archive, fileName, options } = await PlatformTransferExportService.buildPlatformExportArchive(body);
      streamStarted = true;
      ctx.status = 200;
      ctx.set('Content-Type', 'application/octet-stream');
      ctx.set('Content-Disposition', `attachment; filename="${fileName}"`);
      archive.on('error', (err) => {
        logger.error(`[platformTransfer] zip 导出失败: ${err.message}`, { stack: err.stack });
        ctx.res.destroy();
      });
      ctx.body = archive;
      logger.info('[platformTransfer] EADAF 平台导出开始', { fileName, options });
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
      ctx.body = { code: 400, message: '请上传 EADAF 平台导出的 .zip 或旧版 .json 文件', data: null };
      return;
    }
    try {
      const data = await PlatformTransferPreviewService.previewImportFile(file.filepath);
      ctx.body = { code: 200, message: '预览解析完成', data };
    } catch (error) {
      sendError(ctx, error, 400);
    } finally {
      await cleanupUpload(file.filepath);
    }
  }

  static async importPlatform(ctx) {
    const file = getRequestFile(ctx);
    if (!file || !file.filepath) {
      ctx.status = 400;
      ctx.body = { code: 400, message: '请上传 EADAF 平台导出的 .zip 或旧版 .json 文件', data: null };
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
      await cleanupUpload(file.filepath);
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
      await cleanupUpload(file.filepath);
    }
  }
}

module.exports = PlatformTransferController;
