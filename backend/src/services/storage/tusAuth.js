const { parseBearerToken, verifyStorageToken } = require('../../middlewares/storageAuth');

function getHeader(req, name) {
  if (!req?.headers) return '';
  const lower = name.toLowerCase();
  if (typeof req.headers.get === 'function') {
    return req.headers.get(name) || req.headers.get(lower) || '';
  }
  const raw = req.headers[lower] || req.headers[name];
  if (Array.isArray(raw)) return raw[0] || '';
  return raw || '';
}

function tusError(statusCode, body) {
  const err = new Error(body);
  err.status_code = statusCode;
  err.body = body;
  return err;
}

function authFromTusRequest(req) {
  const header = getHeader(req, 'authorization');
  if (!header || !String(header).startsWith('Bearer ')) {
    throw tusError(401, '未提供认证令牌');
  }
  const token = String(header).replace(/^Bearer\s+/i, '').trim();
  if (!token) throw tusError(401, '未提供认证令牌');
  try {
    const authContext = verifyStorageToken(token);
    if (!authContext) throw tusError(401, '无效的令牌');
    return authContext;
  } catch (error) {
    if (error.status_code) throw error;
    throw tusError(401, '无效的令牌');
  }
}

function ownerFromAuth(authContext, explicitApplicationId) {
  if (authContext.kind === 'application') {
    return {
      ownerKind: 'application',
      applicationId: authContext.applicationId,
      createdBy: null,
    };
  }
  return {
    ownerKind: 'user',
    applicationId: explicitApplicationId || null,
    createdBy: authContext.userId || null,
  };
}

module.exports = {
  getHeader,
  tusError,
  authFromTusRequest,
  ownerFromAuth,
  parseBearerToken,
};
