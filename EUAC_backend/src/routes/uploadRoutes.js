const Router = require('koa-router');
const koaBody = require('koa-body').default;
const _path = require('path');
const fs = require('fs');
const _config = require('../config');
const UploadController = require('../controllers/uploadController');
const auth = require('../middlewares/auth');

const router = new Router({
  prefix: '/api/v1/uploads'
});

// 配置文件上传中间件
const uploadMiddleware = koaBody({
  multipart: true,
  formidable: {
    uploadDir: _path.join(process.cwd(), 'uploads'),
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    onFileBegin: (name, file) => {
      // 确保上传目录存在
      const uploadDir = _path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      // 生成唯一文件名
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = _path.extname(file.originalFilename);
      file.newFilename = uniqueSuffix + ext;
      file.filepath = _path.join(uploadDir, file.newFilename);
    },
    filter: ({ mimetype }) => {
      // 只允许图片文件
      return mimetype && mimetype.startsWith('image/');
    }
  }
});

// 添加错误处理中间件
const handleUploadError = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('handleUploadError - Error caught:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });

    ctx.status = err.status || 500;
    ctx.body = {
      code: ctx.status,
      message: err.message || '上传失败',
      data: null
    };
  }
};

/**
 * @swagger
 * /api/v1/uploads:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: 上传文件 [需要认证]
 *     description: 上传单个文件，支持图片自动转换为webp格式
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [image, document, video, audio]
 *         description: 文件类型，默认为配置中的默认类型
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: 要上传的文件
 *     responses:
 *       200:
 *         description: 上传成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     type:
 *                       type: string
 *                       example: "image"
 *                     url:
 *                       type: string
 *                       example: "http://localhost:3000/api/v1/uploads/images/550e8400-e29b-41d4-a716-446655440000"
 *                     original_name:
 *                       type: string
 *                       example: "example.jpg"
 *                     size:
 *                       type: integer
 *                       example: 1024
 *                     mime_type:
 *                       type: string
 *                       example: "image/jpeg"
 *                     extension:
 *                       type: string
 *                       example: ".webp"
 *       400:
 *         description: 参数错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                   example: 不支持的文件类型
 *                 data:
 *                   type: null
 *                   example: null
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.post('/', auth, handleUploadError, uploadMiddleware, UploadController.uploadSingle);

/**
 * @swagger
 * /api/v1/uploads/multiple:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: 上传多个文件 [需要认证]
 *     description: 同时上传多个文件
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: 上传成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: 文件上传成功
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       filename:
 *                         type: string
 *                       originalname:
 *                         type: string
 *                       mimetype:
 *                         type: string
 *                       size:
 *                         type: integer
 *                       path:
 *                         type: string
 *       400:
 *         description: 参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/multiple', auth, handleUploadError, uploadMiddleware, UploadController.uploadMultiple);

/**
 * @swagger
 * /api/v1/uploads/image:
 *   post:
 *     tags:
 *       - Uploads
 *     summary: 上传图片 [需要认证]
 *     description: 上传单个图片，支持压缩和格式转换
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: 要上传的图片文件
 *               compress:
 *                 type: boolean
 *                 description: 是否压缩图片
 *                 default: true
 *               format:
 *                 type: string
 *                 enum: [jpeg, jpg, png, webp, gif]
 *                 description: 输出格式
 *                 default: webp
 *               width:
 *                 type: integer
 *                 description: 压缩后的最大宽度
 *                 default: 1920
 *               height:
 *                 type: integer
 *                 description: 压缩后的最大高度
 *                 default: 1920
 *               quality:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 description: 图片质量（1-100）
 *                 default: 80
 *     responses:
 *       200:
 *         description: 上传成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: 图片上传成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     filename:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000.webp"
 *                     originalname:
 *                       type: string
 *                       example: "example.jpg"
 *                     mimetype:
 *                       type: string
 *                       example: "image/webp"
 *                     size:
 *                       type: integer
 *                       example: 102400
 *       400:
 *         description: 参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/image', auth, 
  async (ctx, next) => {
    console.log('Route middleware - Before upload:', {
      headers: ctx.request.headers,
      body: ctx.request.body,
      files: ctx.request.files
    });
    await next();
    console.log('Route middleware - After upload:', {
      file: ctx.request.files?.image,
      body: ctx.request.body
    });
  },
  handleUploadError,
  uploadMiddleware,
  UploadController.uploadImage
);

/**
 * @swagger
 * /api/v1/uploads/images/{file_id}:
 *   get:
 *     tags:
 *       - Uploads
 *     summary: 获取图片
 *     description: 获取指定图片，支持实时裁剪、格式转换和缓存（公开访问，无需认证）
 *     parameters:
 *       - in: path
 *         name: file_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 文件ID
 *       - in: query
 *         name: width
 *         schema:
 *           type: integer
 *         description: 图片宽度
 *       - in: query
 *         name: height
 *         schema:
 *           type: integer
 *         description: 图片高度
 *       - in: query
 *         name: quality
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: 图片质量（1-100）
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [jpeg, jpg, png, webp, gif]
 *         description: 输出格式
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: 文件不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/images/:file_id', UploadController.getImage);

/**
 * @swagger
 * /api/v1/uploads/{file_id}:
 *   get:
 *     tags:
 *       - Uploads
 *     summary: 获取文件信息 [需要认证]
 *     description: 获取指定文件的详细信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: file_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 文件ID
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     file_id:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     filename:
 *                       type: string
 *                       example: "example.jpg"
 *                     originalname:
 *                       type: string
 *                       example: "original.jpg"
 *                     mimetype:
 *                       type: string
 *                       example: "image/jpeg"
 *                     size:
 *                       type: integer
 *                       example: 1024
 *                     url:
 *                       type: string
 *                       example: "https://example.com/uploads/example.jpg"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-03-21T10:00:00.000Z"
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 401
 *                 message:
 *                   type: string
 *                   example: 未授权
 *                 data:
 *                   type: null
 *                   example: null
 *       404:
 *         description: 文件不存在
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: 文件不存在
 *                 data:
 *                   type: null
 *                   example: null
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: 服务器内部错误
 *                 data:
 *                   type: null
 *                   example: null
 */
router.get('/:file_id', auth, UploadController.getFile);

/**
 * @swagger
 * /api/v1/uploads/{file_id}:
 *   delete:
 *     tags:
 *       - Uploads
 *     summary: 删除文件 [需要认证]
 *     description: 删除指定文件
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: file_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 文件ID
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: 文件删除成功
 *                 data:
 *                   type: null
 *                   example: null
 *       401:
 *         description: 未授权
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 401
 *                 message:
 *                   type: string
 *                   example: 未授权
 *                 data:
 *                   type: null
 *                   example: null
 *       404:
 *         description: 文件不存在
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: 文件不存在
 *                 data:
 *                   type: null
 *                   example: null
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 500
 *                 message:
 *                   type: string
 *                   example: 服务器内部错误
 *                 data:
 *                   type: null
 *                   example: null
 */
router.delete('/:file_id', auth, UploadController.deleteFile);

module.exports = router; 