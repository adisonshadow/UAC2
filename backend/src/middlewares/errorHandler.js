const logger = require('../utils/logger');

// 错误类型映射
const _ERROR_TYPES = {
  ValidationError: 400,
  UnauthorizedError: 401,
  ForbiddenError: 403,
  NotFoundError: 404,
  ConflictError: 409,
  InternalServerError: 500,
  CustomValidationError: 400,
  SequelizeValidationError: 400,
  SequelizeUniqueConstraintError: 409
};

// 安全错误消息
const _SAFE_ERROR_MESSAGES = {
  400: '请求参数错误',
  401: '未授权访问',
  403: '禁止访问',
  404: '资源不存在',
  409: '资源冲突',
  500: '服务器内部错误'
};

const errorHandler = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    logger.error('Error occurred', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });

    // 创建一个新的错误对象而不是修改原始错误
    const errorResponse = {
      code: err.status || 500,
      message: err.message || '服务器内部错误',
      data: null
    };

    // 如果是开发环境，添加更多错误信息
    if (process.env.NODE_ENV === 'development') {
      errorResponse.error = {
        name: err.name,
        stack: err.stack
      };
    }

    ctx.status = errorResponse.code;
    ctx.body = errorResponse;
  }
};

module.exports = errorHandler;