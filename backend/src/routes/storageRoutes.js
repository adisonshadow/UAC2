const Router = require('koa-router');
const path = require('path');
const fs = require('fs');
const koaBody = require('koa-body').default;
const StorageController = require('../controllers/storageController');
const auth = require('../middlewares/auth');
const authWithBuiltinApiGuard = require('../middlewares/withBuiltinApiGuard');
const { authRequired, authOptional } = require('../middlewares/storageAuth');
const config = require('../config');

const router = new Router({ prefix: '/api/v1/storage' });

const storageRoot = path.join(process.cwd(), config.storage.root);
if (!fs.existsSync(storageRoot)) {
  fs.mkdirSync(storageRoot, { recursive: true });
}

const uploadMiddleware = koaBody({
  multipart: true,
  formidable: {
    uploadDir: storageRoot,
    keepExtensions: true,
    maxFileSize: 100 * 1024 * 1024,
  },
});

/**
 * @swagger
 * /api/v1/storage/buckets:
 *   get:
 *     tags: [Storage]
 *     summary: 获取 Bucket 列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: size
 *         schema: { type: integer }
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 获取成功
 *   post:
 *     tags: [Storage]
 *     summary: 创建 Bucket [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name]
 *             properties:
 *               code: { type: string }
 *               name: { type: string }
 *               description: { type: string }
 *               applicationId: { type: string, format: uuid }
 *               accessMode: { type: string, enum: [public, authenticated] }
 *               accessRestrictions: { type: object }
 *     responses:
 *       201:
 *         description: 创建成功
 */
router.get('/buckets', authWithBuiltinApiGuard, StorageController.listBuckets);
router.post('/buckets', authWithBuiltinApiGuard, StorageController.createBucket);

/**
 * @swagger
 * /api/v1/storage/buckets/{id}:
 *   get:
 *     tags: [Storage]
 *     summary: 获取 Bucket 详情 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 获取成功
 *   put:
 *     tags: [Storage]
 *     summary: 更新 Bucket [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 更新成功
 *   delete:
 *     tags: [Storage]
 *     summary: 删除 Bucket [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 删除成功
 */
router.get('/buckets/:id', authWithBuiltinApiGuard, StorageController.getBucket);
router.put('/buckets/:id', authWithBuiltinApiGuard, StorageController.updateBucket);
router.delete('/buckets/:id', authWithBuiltinApiGuard, StorageController.deleteBucket);

/**
 * @swagger
 * /api/v1/storage/objects:
 *   get:
 *     tags: [Storage]
 *     summary: 文件浏览器列表 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: size
 *         schema: { type: integer }
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *       - in: query
 *         name: bucketId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: applicationId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: mimeType
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 获取成功
 */
router.get('/objects', authWithBuiltinApiGuard, StorageController.listObjects);

/**
 * @swagger
 * /api/v1/storage/objects/upload:
 *   post:
 *     tags: [Storage]
 *     summary: 上传文件到 Bucket [需要认证，支持用户或应用 JWT]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, bucketCode]
 *             properties:
 *               file: { type: string, format: binary }
 *               bucketCode: { type: string }
 *               applicationId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: 上传成功
 */
router.post('/objects/upload', authRequired, uploadMiddleware, StorageController.uploadObject);

/**
 * @swagger
 * /api/v1/storage/objects/dedup-check:
 *   post:
 *     tags: [Storage]
 *     summary: 按 Bucket + MD5 预检重复文件 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bucketCode, md5]
 *             properties:
 *               bucketCode: { type: string }
 *               md5: { type: string, description: 32 位 hex }
 *     responses:
 *       200:
 *         description: 查询成功，duplicate=true 时返回已有 object
 */
router.post('/objects/dedup-check', authRequired, StorageController.dedupCheck);

/**
 * @swagger
 * /api/v1/storage/tus:
 *   options:
 *     tags: [Storage]
 *     summary: tus 能力发现（Tus-Resumable / Tus-Max-Size）
 *     responses:
 *       204:
 *         description: 返回 tus 扩展头
 *   post:
 *     tags: [Storage]
 *     summary: 创建 tus 上传会话（超大文件断点续传）[需要认证]
 *     description: |
 *       tus 1.0 协议。Upload-Metadata 必填 bucketCode、filename；可选 contentType、md5、applicationId。
 *       PATCH 流式写入磁盘，完成后 GET /tus/{id}/result 取 StorageObject。
 *       轻量接口 POST /objects/upload 上限 100MB；本通道可传小文件，上限见 Tus-Max-Size（默认 5GB）。
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: header
 *         name: Tus-Resumable
 *         required: true
 *         schema: { type: string, example: '1.0.0' }
 *       - in: header
 *         name: Upload-Length
 *         required: true
 *         schema: { type: integer }
 *       - in: header
 *         name: Upload-Metadata
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: 已创建，Location 为会话 URL
 *
 * /api/v1/storage/tus/{id}:
 *   head:
 *     tags: [Storage]
 *     summary: 查询 tus 已上传 offset（续传）[需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Upload-Offset 为已写入字节
 *   patch:
 *     tags: [Storage]
 *     summary: 向 tus 会话追加数据（流式写盘）[需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: Upload-Offset
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/offset+octet-stream:
 *           schema: { type: string, format: binary }
 *     responses:
 *       204:
 *         description: 追加成功
 *   delete:
 *     tags: [Storage]
 *     summary: 终止未完成的 tus 上传 [需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: 已终止
 *
 * /api/v1/storage/tus/{id}/result:
 *   get:
 *     tags: [Storage]
 *     summary: 查询 tus 完成后的 StorageObject（可轮询）[需要认证]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: completed / duplicate，data.object 为文件记录
 *       202:
 *         description: uploading / pending_finalize / finalizing
 */
router.get('/tus/:id/result', authRequired, StorageController.getTusResult);

/**
 * @swagger
 * /api/v1/storage/objects/{id}/download:
 *   get:
 *     tags: [Storage]
 *     summary: 下载文件（按 Bucket 访问策略鉴权，公开桶可匿名）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 文件流
 */
router.get('/objects/:id/download', authOptional, StorageController.downloadObject);

/**
 * @swagger
 * /api/v1/storage/objects/{id}/preview:
 *   get:
 *     tags: [Storage]
 *     summary: 预览文件（图片 inline，按 Bucket 访问策略鉴权）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 文件流
 */
router.get('/objects/:id/preview', authOptional, StorageController.previewObject);

module.exports = router;
