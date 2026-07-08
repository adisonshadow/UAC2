const fs = require('fs');
const path = require('path');
const storageService = require('../services/storage/storageService');
const { assertObjectAccess } = require('../services/storage/storageAccessService');
const StorageBucket = require('../models/storage_bucket');
const StorageObject = require('../models/storage_object');
const logger = require('../utils/logger');

class StorageController {
  static async listBuckets(ctx) {
    try {
      const data = await storageService.listBuckets({
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 20,
        keyword: ctx.query.keyword,
      });
      ctx.body = { code: 200, message: '获取 Bucket 列表成功', data };
    } catch (error) {
      StorageController.sendError(ctx, error);
    }
  }

  static async getBucket(ctx) {
    try {
      const data = await storageService.getBucketById(ctx.params.id);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Bucket 不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '获取 Bucket 成功', data };
    } catch (error) {
      StorageController.sendError(ctx, error);
    }
  }

  static async createBucket(ctx) {
    try {
      const data = await storageService.createBucket(ctx.request.body);
      ctx.status = 201;
      ctx.body = { code: 201, message: '创建 Bucket 成功', data };
    } catch (error) {
      StorageController.sendError(ctx, error, 400);
    }
  }

  static async updateBucket(ctx) {
    try {
      const data = await storageService.updateBucket(ctx.params.id, ctx.request.body);
      if (!data) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Bucket 不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '更新 Bucket 成功', data };
    } catch (error) {
      StorageController.sendError(ctx, error, 400);
    }
  }

  static async deleteBucket(ctx) {
    try {
      const ok = await storageService.deleteBucket(ctx.params.id);
      if (!ok) {
        ctx.status = 404;
        ctx.body = { code: 404, message: 'Bucket 不存在', data: null };
        return;
      }
      ctx.body = { code: 200, message: '删除 Bucket 成功', data: null };
    } catch (error) {
      StorageController.sendError(ctx, error);
    }
  }

  static async listObjects(ctx) {
    try {
      const data = await storageService.listObjects({
        page: parseInt(ctx.query.page, 10) || 1,
        size: parseInt(ctx.query.size, 10) || 20,
        keyword: ctx.query.keyword,
        bucketId: ctx.query.bucketId,
        applicationId: ctx.query.applicationId,
        mimeType: ctx.query.mimeType,
      });
      ctx.body = { code: 200, message: '获取文件列表成功', data };
    } catch (error) {
      StorageController.sendError(ctx, error);
    }
  }

  static async uploadObject(ctx) {
    try {
      const file = ctx.request.files?.file;
      const bucketCode = ctx.request.body?.bucketCode || ctx.query.bucketCode;
      if (!file) {
        ctx.status = 400;
        ctx.body = { code: 400, message: '没有上传文件', data: null };
        return;
      }
      if (!bucketCode) {
        ctx.status = 400;
        ctx.body = { code: 400, message: 'bucketCode 为必填项', data: null };
        return;
      }
      const data = await storageService.uploadObject({
        bucketCode,
        file,
        authContext: ctx.state.authContext,
        applicationId: ctx.request.body?.applicationId,
      });
      ctx.status = 201;
      ctx.body = { code: 201, message: '上传成功', data };
    } catch (error) {
      StorageController.sendError(ctx, error, 400);
    }
  }

  static async downloadObject(ctx) {
    await StorageController.streamObject(ctx, 'attachment');
  }

  static async previewObject(ctx) {
    await StorageController.streamObject(ctx, 'inline');
  }

  static async streamObject(ctx, disposition) {
    try {
      const objectRow = await StorageObject.findByPk(ctx.params.id, {
        include: [{ model: StorageBucket, as: 'StorageBucket', required: true }],
      });
      if (!objectRow) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '文件不存在', data: null };
        return;
      }

      const bucket = objectRow.StorageBucket;
      await assertObjectAccess({
        bucket,
        object: objectRow,
        authContext: ctx.state.authContext,
      });

      const filePath = await storageService.getObjectFilePath(objectRow);
      if (!fs.existsSync(filePath)) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '物理文件不存在', data: null };
        return;
      }

      ctx.set('Content-Type', objectRow.mime_type || 'application/octet-stream');
      ctx.set('Content-Disposition', `${disposition}; filename="${encodeURIComponent(objectRow.name)}"`);
      ctx.body = fs.createReadStream(filePath);
    } catch (error) {
      StorageController.sendError(ctx, error, error.status || 403);
    }
  }

  static sendError(ctx, error, fallbackStatus = 500) {
    logger.error('Storage API error', { message: error.message, stack: error.stack });
    ctx.status = error.status || fallbackStatus;
    ctx.body = {
      code: ctx.status,
      message: error.message || '服务器错误',
      data: null,
    };
  }
}

module.exports = StorageController;
