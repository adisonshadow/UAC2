/**
 * SSO 签名密钥解析：优先使用应用统一密钥 client_secret / app_secret，兼容旧版 salt。
 */
function resolveSsoSigningSecret(application) {
  if (!application) return null;

  const ssoConfig = application.sso_config || {};
  const apiConfig = application.api_connect_config || {};

  return ssoConfig.client_secret || apiConfig.app_secret || ssoConfig.salt || null;
}

function hasSsoSigningSecret(application) {
  return Boolean(resolveSsoSigningSecret(application));
}

module.exports = {
  resolveSsoSigningSecret,
  hasSsoSigningSecret
};
