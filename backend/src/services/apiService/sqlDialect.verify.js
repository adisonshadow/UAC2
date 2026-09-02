/**
 * sqlDialect 纯函数校验（不连库）
 * node src/services/apiService/sqlDialect.verify.js
 */
const assert = require('assert');
const {
  expandDollarPlaceholders,
  renumberPlaceholders,
  quoteIdent,
  qualifiedTable,
  countExpr,
  ilikePred,
  assertSqlDbType,
  assertNoReturningForMysql,
} = require('./sqlDialect');

// $n → ?
{
  const { sql, bindings } = expandDollarPlaceholders(
    'SELECT * FROM t WHERE a = $1 AND b = $2 AND a2 = $1',
    ['x', 2],
  );
  assert.strictEqual(sql, 'SELECT * FROM t WHERE a = ? AND b = ? AND a2 = ?');
  assert.deepStrictEqual(bindings, ['x', 2, 'x']);
}

{
  assert.throws(
    () => expandDollarPlaceholders('SELECT $3', [1]),
    /超出绑定参数范围/,
  );
}

// renumber
{
  assert.strictEqual(
    renumberPlaceholders(' WHERE id = $3 AND status = $4', 1),
    ' WHERE id = $1 AND status = $2',
  );
}

// quote / qualified
{
  assert.strictEqual(quoteIdent('bizdata_mat', 'postgresql'), '"bizdata_mat"');
  assert.strictEqual(quoteIdent('bizdata_mat', 'mysql'), '`bizdata_mat`');
  assert.strictEqual(
    qualifiedTable('bizdata_mat', 'WorkCard', 'mysql'),
    '`bizdata_mat`.`WorkCard`',
  );
  assert.strictEqual(
    qualifiedTable('bizdata_mat', 'WorkCard', 'postgresql'),
    '"bizdata_mat"."WorkCard"',
  );
}

// count / ilike
{
  assert.strictEqual(countExpr('postgresql'), 'COUNT(*)::int');
  assert.strictEqual(countExpr('mysql'), 'CAST(COUNT(*) AS UNSIGNED)');
  assert.ok(countExpr('mysql', '`t0`.`id`').includes('CAST(COUNT(DISTINCT'));
  assert.strictEqual(ilikePred('name', '$1', 'postgresql'), 'name ILIKE $1');
  assert.strictEqual(
    ilikePred('name', '$1', 'mysql'),
    'LOWER(name) LIKE LOWER($1)',
  );
}

// assertSqlDbType
{
  assert.strictEqual(assertSqlDbType({ dbType: 'postgresql' }), 'postgresql');
  assert.strictEqual(assertSqlDbType({ dbType: 'mysql' }), 'mysql');
  try {
    assertSqlDbType({ dbType: 'mongodb' });
    assert.fail('should throw');
  } catch (e) {
    assert.strictEqual(e.status, 501);
  }
}

// RETURNING guard
{
  assertNoReturningForMysql('DELETE FROM t WHERE id = 1', 'mysql');
  assert.throws(
    () => assertNoReturningForMysql('DELETE FROM t WHERE id = 1 RETURNING *', 'mysql'),
    /不支持 RETURNING/,
  );
  assertNoReturningForMysql('DELETE FROM t RETURNING *', 'postgresql');
}

  assert.strictEqual(
    require('./sqlDialect').adaptSqlIdentifiers('"bizdata_mat"."T"', 'mysql'),
    '`bizdata_mat`.`T`',
  );
  assert.strictEqual(
    require('./sqlDialect').adaptSqlIdentifiers('"bizdata_mat"."T"', 'postgresql'),
    '"bizdata_mat"."T"',
  );

console.log('sqlDialect.verify.js ok');
