const Router = require('koa-router');
const path = require('path');
const fs = require('fs');
const koaBody = require('koa-body').default;
const StorageController = require('../controllers/storageController');
const auth = require('../middlewares/auth');
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
router.get('/buckets', auth, StorageController.listBuckets);
router.post('/buckets', auth, StorageController.createBucket);

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
router.get('/buckets/:id', auth, StorageController.getBucket);
router.put('/buckets/:id', auth, StorageController.updateBucket);
router.delete('/buckets/:id', auth, StorageController.deleteBucket);

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
router.get('/objects', auth, StorageController.listObjects);

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
