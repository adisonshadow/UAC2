/**
 * 新实体尚未物化时，按同域已物化兄弟推断 targetSchema
 * node --import tsx src/pages/ApiServices/ai/apiServiceConnectionResolve.verify.ts
 */
import assert from 'node:assert/strict';
import {
  deriveScopePrefixes,
  matchTargetSchema,
  pickTargetSchema,
  scoreConnections,
} from './apiServiceConnectionResolveLogic';

const conn = {
  id: 'c1',
  name: 'pg',
  dbType: 'postgresql',
  targetSchema: 'bizdata_mat',
  isDefault: true,
};

const webUser = {
  connectionId: 'c1',
  entityId: 'u1',
  code: 'web:User',
  targetSchema: 'web_app',
  staleStatus: 'ok',
};

const webTagUnmaterialized = {
  connectionId: 'c1',
  entityId: 't1',
  code: 'web:Tag',
  targetSchema: undefined,
  staleStatus: 'not_materialized',
};

{
  assert.deepEqual(deriveScopePrefixes({ entityCodes: ['web:Tag', 'web:UserProfileTag'] }), ['web']);
  assert.deepEqual(deriveScopePrefixes({ scopeCode: 'web', entityCodes: ['web:Tag'] }), ['web']);
}

{
  // 新实体尚未物化：回落到同域 web:User 的 schema，禁止 bizdata_mat
  const schema = pickTargetSchema(conn, [webUser, webTagUnmaterialized], {
    entityCodes: ['web:Tag', 'web:UserProfileTag'],
    entityIds: ['t1', 'p1'],
  });
  assert.equal(schema, 'web_app');
  assert.equal(
    matchTargetSchema(conn, [webUser, webTagUnmaterialized], {
      entityCodes: ['web:Tag'],
      entityIds: ['t1'],
    }).match,
    'scope',
  );
}

{
  // 精确命中优先于同域兄弟
  const tagMaterialized = {
    connectionId: 'c1',
    entityId: 't1',
    code: 'web:Tag',
    targetSchema: 'tag_schema',
    staleStatus: 'ok',
  };
  assert.equal(
    pickTargetSchema(conn, [tagMaterialized, webUser], { entityCodes: ['web:Tag'] }),
    'tag_schema',
  );
  assert.equal(
    matchTargetSchema(conn, [tagMaterialized, webUser], { entityCodes: ['web:Tag'] }).match,
    'exact',
  );
}

{
  // 同域也无物化：仍禁止回落到连接默认 bizdata_mat
  assert.equal(
    pickTargetSchema(conn, [webTagUnmaterialized], { entityCodes: ['web:Tag'] }),
    undefined,
  );
  assert.equal(
    matchTargetSchema(conn, [webTagUnmaterialized], { entityCodes: ['web:Tag'] }).match,
    'none',
  );
}

{
  // 无实体/Scope 提示时才允许连接默认 schema
  assert.equal(pickTargetSchema(conn, [], {}), 'bizdata_mat');
}

{
  const scores = scoreConnections(
    [webUser, webTagUnmaterialized],
    { entityCodes: ['web:Tag'], entityIds: ['t1'] },
  );
  assert.equal(scores.get('c1'), 1);
}

console.log('apiServiceConnectionResolve.verify.ts ok');
