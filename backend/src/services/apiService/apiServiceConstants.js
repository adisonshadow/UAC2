const DEFAULT_SECURITY_CONFIG = {
  requireAuth: true,
  allowedTokenTypes: ['user', 'application'],
  maxLimit: 100,
  defaultLimit: 20,
  rateLimitPerMinute: 120,
  readOnly: false,
  fieldDenylist: ['password', 'secret', 'app_secret'],
  fieldAllowlist: null,
  auditLog: true,
  blockRawSql: true,
  maxPipelineStages: 20,
  maxInsertBatch: 500,
  bypassAccessControlInTest: true,
};

module.exports = {
  DEFAULT_SECURITY_CONFIG,
};
