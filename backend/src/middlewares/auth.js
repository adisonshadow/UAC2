const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const Application = require('../models/application');
const { resolveSsoSigningSecret, hasSsoSigningSecret } = require('../utils/ssoSecret');

/**
 * Bearer Token 认证中间件
 * 支持标准 JWT 认证和第三方应用 SSO 认证
 */
module.exports = async (ctx, next) => {
  const authHeader = ctx.headers.authorization;
  
  if (!authHeader) {
    logger.warn('认证失败：未提供 Authorization 头', {
      method: ctx.method,
      url: ctx.url,
      ip: ctx.ip
    });
    
    ctx.status = 401;
    ctx.body = {
      code: 401,
      message: '未提供认证令牌',
      data: null
    };
    return;
  }

  // 检查 Authorization 头格式
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('认证失败：Authorization 头格式错误', {
      method: ctx.method,
      url: ctx.url,
      ip: ctx.ip,
      authHeader: authHeader.substring(0, 20) + '...'
    });
    
    ctx.status = 401;
    ctx.body = {
      code: 401,
      message: '认证令牌格式错误，请使用 Bearer 格式',
      data: null
    };
    return;
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    logger.warn('认证失败：令牌为空', {
      method: ctx.method,
      url: ctx.url,
      ip: ctx.ip
    });
    
    ctx.status = 401;
    ctx.body = {
      code: 401,
      message: '认证令牌不能为空',
      data: null
    };
    return;
  }
  
  try {
    // 检查是否通过app参数传递了application_id（第三方系统验证）
    const { app } = ctx.query;
    let jwtSecret = config.api.security.jwtSecret;
    let isSsoAuth = false;
    
    if (app) {
      // 验证application_id并获取SSO salt
      const application = await Application.findOne({
        where: {
          application_id: app,
          status: 'ACTIVE',
          sso_enabled: true
        }
      });

      if (application && hasSsoSigningSecret(application)) {
        jwtSecret = resolveSsoSigningSecret(application);
        isSsoAuth = true;
        logger.debug('使用 SSO 认证', { 
          application_id: app, 
          application_name: application.name
        });
      } else {
        logger.warn('SSO 认证失败：应用不存在或未启用 SSO', {
          method: ctx.method,
          url: ctx.url,
          app: app
        });
        
        ctx.status = 401;
        ctx.body = {
          code: 401,
          message: '无效的第三方应用认证',
          data: null
        };
        return;
      }
    }
    
    const payload = jwt.verify(token, jwtSecret);
    
    // 确保 payload 包含必要的用户信息
    if (!payload || !payload.user_id) {
      logger.warn('认证失败：令牌载荷无效', {
        method: ctx.method,
        url: ctx.url,
        ip: ctx.ip,
        payload: payload ? Object.keys(payload) : null
      });
      
      ctx.status = 401;
      ctx.body = {
        code: 401,
        message: '无效的令牌',
        data: null
      };
      return;
    }

    // 检查令牌是否过期
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      logger.warn('认证失败：令牌已过期', {
        method: ctx.method,
        url: ctx.url,
        ip: ctx.ip,
        user_id: payload.user_id,
        exp: payload.exp
      });
      
      ctx.status = 401;
      ctx.body = {
        code: 401,
        message: '认证令牌已过期',
        data: null
      };
      return;
    }

    // 将用户信息存储到 ctx.state 中
    ctx.state.user = payload;
    ctx.state.isSsoAuth = isSsoAuth;
    
    logger.debug('认证成功', {
      method: ctx.method,
      url: ctx.url,
      user_id: payload.user_id,
      username: payload.username,
      isSsoAuth: isSsoAuth
    });
    
    await next();
  } catch (error) {
    logger.error('令牌验证失败', {
      method: ctx.method,
      url: ctx.url,
      ip: ctx.ip,
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    let errorMessage = '无效的令牌';
    
    if (error.name === 'TokenExpiredError') {
      errorMessage = '认证令牌已过期';
    } else if (error.name === 'JsonWebTokenError') {
      error.message = '认证令牌格式错误';
    } else if (error.name === 'NotBeforeError') {
      errorMessage = '认证令牌尚未生效';
    }
    
    ctx.status = 401;
    ctx.body = {
      code: 401,
      message: errorMessage,
      data: null
    };
  }
};
