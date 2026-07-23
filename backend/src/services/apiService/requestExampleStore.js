/**
 * 请求参数 Example 统一存储：
 * - 主存储：security_config.requestOverrides[operation].requestExample
 * - 兼容：security_config.testMockParameters[operation]（历史字段，读写时同步）
 */

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function readSavedRequestExample(securityConfig, operation) {
  if (!operation) return null;
  const fromOverride = securityConfig?.requestOverrides?.[operation]?.requestExample;
  if (isPlainObject(fromOverride)) {
    return fromOverride;
  }
  const legacy = securityConfig?.testMockParameters?.[operation];
  if (isPlainObject(legacy)) {
    return legacy;
  }
  return null;
}

function writeRequestExampleToSecurityConfig(securityConfig, operation, requestExample) {
  if (!operation || !isPlainObject(requestExample)) {
    throw Object.assign(new Error('requestExample 必须为对象'), { status: 400 });
  }
  const next = { ...(securityConfig || {}) };
  const requestOverrides = { ...(next.requestOverrides || {}) };
  requestOverrides[operation] = {
    ...(requestOverrides[operation] || {}),
    requestExample,
  };
  const testMockParameters = { ...(next.testMockParameters || {}) };
  testMockParameters[operation] = requestExample;
  return {
    ...next,
    requestOverrides,
    testMockParameters,
  };
}

function syncTestMockParametersFromRequestOverrides(securityConfig) {
  const next = { ...(securityConfig || {}) };
  const requestOverrides = next.requestOverrides;
  if (!isPlainObject(requestOverrides)) return next;
  const testMockParameters = { ...(next.testMockParameters || {}) };
  Object.entries(requestOverrides).forEach(([operation, entry]) => {
    if (isPlainObject(entry?.requestExample)) {
      testMockParameters[operation] = entry.requestExample;
    }
  });
  return { ...next, testMockParameters };
}

module.exports = {
  readSavedRequestExample,
  writeRequestExampleToSecurityConfig,
  syncTestMockParametersFromRequestOverrides,
};
