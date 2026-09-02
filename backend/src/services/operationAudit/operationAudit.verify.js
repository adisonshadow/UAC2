/**
 * 操作审计纯函数校验（不连库）
 * node src/services/operationAudit/operationAudit.verify.js
 */
const assert = require('assert');
const { resolveAuditSuccess } = require('./resolveAuditSuccess');
const { resolveOperator } = require('./resolveOperator');
const { buildAuditRecord } = require('./buildAuditRecord');
const { skipLoginAudit } = require('./skipLoginAudit');
const { redactFields, REDACTED } = require('../../utils/redactFields');

// 信封 code 优先
{
  const ctx = { status: 200, body: { code: 400, message: 'bad' } };
  assert.strictEqual(resolveAuditSuccess(ctx), false);
}
{
  const ctx = { status: 200, body: { code: 200, message: 'ok' } };
  assert.strictEqual(resolveAuditSuccess(ctx), true);
}
{
  const ctx = { status: 404, body: { code: 404, message: 'nf' } };
  assert.strictEqual(resolveAuditSuccess(ctx), false);
}

// 操作者
{
  const op = resolveOperator({ state: { user: { user_id: 'u1', username: 'admin' } } });
  assert.strictEqual(op.operator_type, 'USER');
  assert.strictEqual(op.operator_id, 'u1');
}
{
  const op = resolveOperator({
    state: { application: { application_id: 'a1', name: 'App' } },
  });
  assert.strictEqual(op.operator_type, 'APPLICATION');
  assert.strictEqual(op.application_id, 'a1');
}
{
  const op = resolveOperator({ state: {} });
  assert.strictEqual(op.operator_type, 'ANONYMOUS');
}

// buildAuditRecord：FAILED + auditContext
{
  const ctx = {
    status: 200,
    method: 'POST',
    path: '/api/v1/users',
    body: { code: 400, message: '用户名不能为空' },
    request: { body: { username: '' } },
    state: { user: { user_id: 'op1', username: 'admin' }, traceId: 'tr-1' },
    get: (h) => (h === 'user-agent' ? 'TestAgent' : ''),
    ip: '127.0.0.1',
  };
  const record = buildAuditRecord(
    ctx,
    {
      domain: 'user',
      operationType: 'CREATE',
      resourceType: 'user',
      summaryKeys: ['username'],
    },
    Date.now() - 10,
  );
  assert.strictEqual(record.status, 'FAILED');
  assert.strictEqual(record.error_message, '用户名不能为空');
  assert.strictEqual(record.trace_id, 'tr-1');
  assert.deepStrictEqual(record.request_summary.bodyKeys, ['username']);
}

// skip（登录失败不记）
{
  const ctx = {
    status: 401,
    body: { code: 401, message: 'bad creds' },
    method: 'POST',
    path: '/login',
    request: { body: {} },
    state: {},
    get: () => '',
    ip: '127.0.0.1',
  };
  const record = buildAuditRecord(
    ctx,
    {
      domain: 'auth',
      operationType: 'LOGIN',
      resourceType: 'user',
      skip: skipLoginAudit,
    },
    Date.now(),
  );
  assert.strictEqual(record, null);
}

// skip（验证码挑战 HTTP 202 不是一次登录成功）
{
  const ctx = {
    status: 202,
    body: { code: 202, message: '需要验证码', data: { need_captcha: true } },
    method: 'POST',
    path: '/api/v1/auth/login',
    request: { body: { username: 'admin', password: 'x' } },
    state: {},
    get: () => '',
    ip: '127.0.0.1',
  };
  const record = buildAuditRecord(
    ctx,
    {
      domain: 'auth',
      operationType: 'LOGIN',
      resourceType: 'user',
      skip: skipLoginAudit,
    },
    Date.now(),
  );
  assert.strictEqual(record, null);
}

// LOGIN 真正成功（控制器补了 operator）要记
{
  const ctx = {
    status: 200,
    body: { code: 200, message: 'success' },
    method: 'POST',
    path: '/api/v1/auth/login',
    request: { body: { username: 'admin', password: 'x' } },
    state: {
      auditContext: {
        operator: {
          operator_type: 'USER',
          operator_id: 'u1',
          operator_name: 'admin',
        },
      },
    },
    get: () => '',
    ip: '127.0.0.1',
  };
  const record = buildAuditRecord(
    ctx,
    {
      domain: 'auth',
      operationType: 'LOGIN',
      resourceType: 'user',
      skip: skipLoginAudit,
    },
    Date.now(),
  );
  assert.ok(record);
  assert.strictEqual(record.operator_name, 'admin');
  assert.strictEqual(record.operator_type, 'USER');
}

// 脱敏点路径
{
  const out = redactFields(
    { sso_config: { client_secret: 'sec', name: 'x' }, password_hash: 'h' },
    ['sso_config.client_secret'],
  );
  assert.strictEqual(out.sso_config.client_secret, REDACTED);
  assert.strictEqual(out.password_hash, REDACTED);
  assert.strictEqual(out.sso_config.name, 'x');
}

// 超长截断
{
  const long = 'a'.repeat(3000);
  const out = redactFields({ note: long });
  assert.ok(out.note.length < 3000);
  assert.ok(out.note.includes('[truncated]'));
}

console.log('operationAudit.verify.js: all passed');
