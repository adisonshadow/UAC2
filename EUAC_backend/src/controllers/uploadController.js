const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../config');

// 确保上传目录存在
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 生成缩略图
async function generateThumbnail(filePath, width = 300, height = 300, mode = 'cover') {
  const thumbnailPath = filePath.replace(/\.[^/.]+$/, '') + '_thumb.webp';
  
  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();
    
    // 计算缩放比例
    const scale = Math.min(width / metadata.width, height / metadata.height);
    const newWidth = Math.round(metadata.width * scale);
    const newHeight = Math.round(metadata.height * scale);
    
    if (mode === 'cover') {
      // 裁剪模式
      await image
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);
    } else {
      // 包含模式
      await image
        .resize(newWidth, newHeight)
        .webp({ quality: 80 })
        .toFile(thumbnailPath);
    }
    
    return thumbnailPath;
  } catch (error) {
    logger.error('生成缩略图失败', { error: error.message });
    return null;
  }
}

// 上传单个文件
exports.uploadSingle = async (ctx) => {
  try {
    const file = ctx.request.files?.file;
    if (!file) {
      ctx.status = 400;
      ctx.body = { 
        code: 400,
        message: '没有上传文件',
        data: null
      };
      return;
    }

    const fileType = ctx.query.type || config.upload.defaultType;
    logger.debug('文件上传请求', { 
      fileType, 
      originalName: file.originalFilename, 
      mimetype: file.mimetype, 
      size: file.size 
    });

    const typeConfig = config.upload.types[fileType];
    if (!typeConfig) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: '不支持的文件类型',
        data: null
      };
      return;
    }

    // 检查文件类型
    if (!typeConfig.mimeTypes.includes(file.mimetype)) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: `不支持的文件类型，允许的类型：${typeConfig.mimeTypes.join(', ')}`,
        data: null
      };
      return;
    }

    // 检查文件大小
    if (file.size > typeConfig.maxSize) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: `文件大小超过限制，最大允许：${typeConfig.maxSize / 1024 / 1024}MB`,
        data: null
      };
      return;
    }

    const fileId = uuidv4();
    const fileExt = fileType === 'image' ? '.webp' : path.extname(file.originalFilename);
    const fileName = `${fileId}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);

    // 处理文件
    if (fileType === 'image') {
      // 图片转webp
      await sharp(file.filepath)
        .webp({ quality: 80 })
        .toFile(filePath);
      // 删除原始文件
      fs.unlinkSync(file.filepath);
    } else {
      // 非图片文件直接移动
      fs.renameSync(file.filepath, filePath);
    }

    ctx.status = 200;
    ctx.body = {
      code: 200,
      message: 'success',
      data: {
        id: fileId,
        type: fileType,
        url: `${config.api.host}:${config.api.port}/api/v1/uploads/${fileType === 'image' ? 'images' : 'files'}/${fileId}`,
        original_name: file.originalFilename,
        size: file.size,
        mime_type: file.mimetype,
        extension: fileExt
      }
    };
  } catch (error) {
    logger.error('上传文件失败', { 
      error: error.message, 
      stack: error.stack,
      file: ctx.request.files?.file ? {
        originalname: ctx.request.files.file.originalFilename,
        mimetype: ctx.request.files.file.mimetype,
        size: ctx.request.files.file.size
      } : null
    });
    ctx.status = 500;
    ctx.body = { 
      code: 500,
      message: '上传文件失败',
      data: null
    };
  }
};

// 上传多个文件
exports.uploadMultiple = async (ctx) => {
  try {
    const files = ctx.request.files?.files;
    if (!files || (Array.isArray(files) && files.length === 0)) {
      ctx.status = 400;
      ctx.body = { 
        code: 400,
        message: '没有上传文件',
        data: null
      };
      return;
    }

    // 确保 files 是数组
    const fileArray = Array.isArray(files) ? files : [files];

    const results = await Promise.all(fileArray.map(async (file) => {
      const fileId = uuidv4();
      const fileExt = path.extname(file.originalFilename);
      const fileName = `${fileId}${fileExt}`;
      const filePath = path.join(uploadDir, fileName);

      // 移动文件到目标目录
      fs.renameSync(file.filepath, filePath);

      return {
        id: fileId,
        filename: fileName,
        originalname: file.originalFilename,
        mimetype: file.mimetype,
        size: file.size,
        path: filePath
      };
    }));

    ctx.status = 200;
    ctx.body = {
      code: 200,
      message: '文件上传成功',
      data: results
    };
  } catch (error) {
    logger.error('上传多个文件失败', { error: error.message });
    ctx.status = 500;
    ctx.body = { 
      code: 500,
      message: '上传文件失败',
      data: null
    };
  }
};

// 上传图片
exports.uploadImage = async (ctx) => {
  try {
    const file = ctx.request.files?.image;
    if (!file) {
      ctx.status = 400;
      ctx.body = { 
        code: 400,
        message: '没有上传图片',
        data: null
      };
      return;
    }

    // 验证文件类型
    if (!file.mimetype.startsWith('image/')) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: '只能上传图片文件',
        data: null
      };
      return;
    }

    // 从 ctx.request.body 中获取参数
    const compress = ctx.request.body.compress === 'true';
    const format = ctx.request.body.format || 'webp';
    const width = parseInt(ctx.request.body.width) || 1920;
    const height = parseInt(ctx.request.body.height) || 1920;
    const quality = parseInt(ctx.request.body.quality) || 80;
    
    // 验证格式参数
    const allowedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
    if (!allowedFormats.includes(format.toLowerCase())) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: `不支持的图片格式，支持的格式有：${allowedFormats.join(', ')}`,
        data: null
      };
      return;
    }

    const fileId = uuidv4();
    const fileName = `${fileId}.${format}`;
    const filePath = path.join(uploadDir, fileName);

    // 处理图片
    let image = sharp(file.filepath);
    
    if (compress) {
      // 如果需要压缩，进行压缩处理
      image = image.resize(width, height, { 
        fit: 'inside', 
        withoutEnlargement: true 
      });
    }
    
    // 转换格式并保存
    await image
      .toFormat(format, { quality })
      .toFile(filePath);

    // 删除原始文件
    fs.unlinkSync(file.filepath);

    // 获取压缩后的文件大小
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    ctx.status = 200;
    ctx.body = {
      code: 200,
      message: '图片上传成功',
      data: {
        id: fileId,
        filename: fileName,
        originalname: file.originalFilename,
        mimetype: `image/${format}`,
        size: fileSize
      }
    };
  } catch (error) {
    logger.error('上传图片失败', { error: error.message });
    ctx.status = 500;
    ctx.body = { 
      code: 500,
      message: '上传图片失败',
      data: null
    };
  }
};

// 删除文件
exports.deleteFile = async (ctx) => {
  try {
    const { filename } = ctx.params;
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      ctx.status = 404;
      ctx.body = {
        code: 404,
        message: '文件不存在',
        data: null
      };
      return;
    }

    // 删除文件
    fs.unlinkSync(filePath);

    // 如果存在缩略图，也一并删除
    const thumbnailPath = filePath.replace(/\.[^/.]+$/, '') + '_thumb.webp';
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    ctx.status = 200;
    ctx.body = {
      code: 200,
      message: '文件删除成功',
      data: null
    };
  } catch (error) {
    logger.error('删除文件失败', { error: error.message });
    ctx.status = 500;
    ctx.body = { 
      code: 500,
      message: '删除文件失败',
      data: null
    };
  }
};

// 获取文件信息
exports.getFileInfo = async (ctx) => {
  try {
    const { filename } = ctx.params;
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      ctx.status = 404;
      ctx.body = {
        code: 404,
        message: '文件不存在',
        data: null
      };
      return;
    }

    const stats = fs.statSync(filePath);
    const fileInfo = {
      filename: filename,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      mimetype: path.extname(filename).slice(1),
      path: filePath
    };

    // 如果是图片，获取图片信息
    if (fileInfo.mimetype.match(/^(jpe?g|png|gif|webp)$/i)) {
      const metadata = await sharp(filePath).metadata();
      fileInfo.width = metadata.width;
      fileInfo.height = metadata.height;
      fileInfo.format = metadata.format;
    }

    ctx.status = 200;
    ctx.body = {
      code: 200,
      message: '获取文件信息成功',
      data: fileInfo
    };
  } catch (error) {
    logger.error('获取文件信息失败', { error: error.message });
    ctx.status = 500;
    ctx.body = { 
      code: 500,
      message: '获取文件信息失败',
      data: null
    };
  }
};

// 获取图片
exports.getImage = async (ctx) => {
  try {
    const { file_id } = ctx.params;
    const { width, height, quality, format } = ctx.query;
    
    logger.debug('开始获取图片', { file_id, width, height, quality, format });
    
    // 查找文件
    const files = fs.readdirSync(uploadDir);
    logger.debug('上传目录文件列表', { files });
    
    const file = files.find(f => f.startsWith(file_id));
    logger.debug('找到的文件', { file });
    
    if (!file) {
      logger.warn('文件不存在', { file_id });
      ctx.status = 404;
      ctx.body = { error: '文件不存在' };
      return;
    }

    const filePath = path.join(uploadDir, file);
    logger.debug('文件完整路径', { filePath });
    
    if (!fs.existsSync(filePath)) {
      logger.warn('文件路径不存在', { filePath });
      ctx.status = 404;
      ctx.body = { error: '文件不存在' };
      return;
    }

    let image = sharp(filePath);
    logger.debug('成功创建 sharp 实例');

    // 处理图片参数
    if (width || height) {
      logger.debug('开始调整图片尺寸', { width, height });
      image = image.resize(parseInt(width) || undefined, parseInt(height) || undefined, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // 设置输出格式和质量
    const outputFormat = format || 'webp';
    const outputQuality = parseInt(quality) || 80;
    logger.debug('设置输出参数', { outputFormat, outputQuality });

    // 设置响应头
    ctx.type = `image/${outputFormat}`;
    ctx.set('Cache-Control', 'public, max-age=31536000'); // 缓存一年

    // 返回处理后的图片
    logger.debug('开始处理图片');
    const processedImageBuffer = await image
      .toFormat(outputFormat, { quality: outputQuality })
      .toBuffer();
    
    logger.debug('图片处理完成', { bufferSize: processedImageBuffer.length });
    ctx.body = processedImageBuffer;
  } catch (error) {
    logger.error('获取图片失败', { 
      error: error.message,
      stack: error.stack,
      file_id: ctx.params.file_id,
      query: ctx.query
    });
    ctx.status = 500;
    ctx.body = { error: '获取图片失败' };
  }
};

// 获取文件
exports.getFile = async (ctx) => {
  try {
    const { file_id } = ctx.params;
    
    // 查找文件
    const files = fs.readdirSync(uploadDir);
    const file = files.find(f => f.startsWith(file_id));
    
    if (!file) {
      ctx.status = 404;
      ctx.body = { error: '文件不存在' };
      return;
    }

    const filePath = path.join(uploadDir, file);
    
    // 返回文件
    ctx.type = path.extname(file).slice(1);
    ctx.body = fs.createReadStream(filePath);
  } catch (error) {
    logger.error('获取文件失败', { error: error.message });
    ctx.status = 500;
    ctx.body = { error: '获取文件失败' };
  }
}; 