const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

function parseBearerToken(ctx) {
  const authHeader = ctx.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  return token || null;
}

function verifyStorageToken(token) {
  const payload = jwt.verify(token, config.api.security.jwtSecret);
  if (payload.type === 'application' && payload.application_id) {
    return {
      kind: 'application',
      applicationId: payload.application_id,
      payload,
    };
  }
  if (payload.user_id) {
    return {
      kind: 'user',
      userId: payload.user_id,
      username: payload.username,
      payload,
    };
  }
  return null;
}

async function authRequired(ctx, next) {
  const token = parseBearerToken(ctx);
  if (!token) {
    ctx.status = 401;
    ctx.body = { code: 401, message: '未提供认证令牌', data: null };
    return;
  }
  try {
    const authContext = verifyStorageToken(token);
    if (!authContext) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '无效的令牌', data: null };
      return;
    }
    ctx.state.authContext = authContext;
    await next();
  } catch (error) {
    logger.warn('存储认证失败', { message: error.message });
    ctx.status = 401;
    ctx.body = { code: 401, message: '无效的令牌', data: null };
  }
}

async function authOptional(ctx, next) {
  const token = parseBearerToken(ctx);
  if (token) {
    try {
      const authContext = verifyStorageToken(token);
      if (authContext) ctx.state.authContext = authContext;
    } catch {
      // 公开访问场景忽略无效 token
    }
  }
  await next();
}

module.exports = {
  authRequired,
  authOptional,
  parseBearerToken,
  verifyStorageToken,
};
