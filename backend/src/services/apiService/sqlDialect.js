/**
 * API 服务 SQL 方言层：统一 PostgreSQL / MySQL 的客户端形态与写回读。
 * 命名参数绑定仍产出 $n；MySQL 仅在 query 边界转为 ?。
 */

const { randomUUID } = require('crypto');
const {
  withPgClient,
  withMysqlClient,
  quotePgIdentifier,
  quoteMysqlIdentifier,
} = require('../businessData/materialization/connectionRunner');

const SUPPORTED_SQL_DB_TYPES = new Set(['postgresql', 'mysql']);

/** $1 / $12 —— 不匹配 $$ 或 $name */
const DOLLAR_PLACEHOLDER_RE = /\$(\d+)\b/g;

function assertSqlDbType(runtime) {
  const dbType = runtime?.dbType;
  if (!SUPPORTED_SQL_DB_TYPES.has(dbType)) {
    throw Object.assign(
      new Error(`暂不支持 ${dbType || '未知'} 连接类型的测试请求`),
      { status: 501 },
    );
  }
  return dbType;
}

function isMysql(dbTypeOrRuntime) {
  const t = typeof dbTypeOrRuntime === 'string'
    ? dbTypeOrRuntime
    : dbTypeOrRuntime?.dbType;
  return t === 'mysql';
}

function quoteIdent(name, dbType) {
  return isMysql(dbType) ? quoteMysqlIdentifier(name) : quotePgIdentifier(name);
}

function qualifiedTable(schema, tableName, dbType) {
  return `${quoteIdent(schema, dbType)}.${quoteIdent(tableName, dbType)}`;
}

/**
 * 将 SQL 中的 $1,$2,... 转为 MySQL ?，并按出现顺序展开 bindings。
 * 同名 $1 出现两次则绑定值重复两次。
 * @returns {{ sql: string, bindings: unknown[] }}
 */
function expandDollarPlaceholders(sql, bindings = []) {
  const text = String(sql || '');
  const expanded = [];
  const nextSql = text.replace(DOLLAR_PLACEHOLDER_RE, (_, numStr) => {
    const index = Number(numStr) - 1;
    if (index < 0 || index >= bindings.length) {
      throw Object.assign(
        new Error(`SQL 占位符 $${numStr} 超出绑定参数范围（共 ${bindings.length} 个）`),
        { status: 400 },
      );
    }
    expanded.push(bindings[index]);
    return '?';
  });
  return { sql: nextSql, bindings: expanded };
}

/** 返回可放入 SELECT 的计数表达式（调用方自行加 AS count） */
function countExpr(dbType, distinctColSql = null) {
  if (distinctColSql) {
    const inner = `COUNT(DISTINCT ${distinctColSql})`;
    return isMysql(dbType) ? `CAST(${inner} AS UNSIGNED)` : `${inner}::int`;
  }
  return isMysql(dbType) ? 'CAST(COUNT(*) AS UNSIGNED)' : 'COUNT(*)::int';
}

/** 将 SQL 中 $n 按出现顺序重编为从 startFrom 起的连续编号（用于 WHERE 单独执行） */
function renumberPlaceholders(sql, startFrom = 1) {
  let idx = startFrom;
  return String(sql || '').replace(DOLLAR_PLACEHOLDER_RE, () => `$${idx++}`);
}

/** 将 PostgreSQL 双引号标识符转为 MySQL 反引号（字符串字面量本系统用单引号，可安全替换） */
function adaptSqlIdentifiers(sql, dbType) {
  if (!isMysql(dbType)) return String(sql || '');
  return String(sql || '').replace(/"([^"]+)"/g, (_, name) => quoteMysqlIdentifier(name));
}

function ilikePred(col, placeholder, dbType) {
  if (isMysql(dbType)) {
    return `LOWER(${col}) LIKE LOWER(${placeholder})`;
  }
  return `${col} ILIKE ${placeholder}`;
}

/**
 * 包装 mysql2 连接为与 node-pg 相近的 { query → { rows, rowCount } }。
 */
function wrapMysqlClient(conn) {
  return {
    dbType: 'mysql',
    raw: conn,
    async query(sql, bindings = []) {
      const { sql: nextSql, bindings: nextBindings } = expandDollarPlaceholders(sql, bindings);
      const [result] = await conn.query(nextSql, nextBindings);
      if (Array.isArray(result)) {
        return { rows: result, rowCount: result.length };
      }
      // ResultSetHeader（INSERT/UPDATE/DELETE）
      const rowCount = typeof result?.affectedRows === 'number'
        ? result.affectedRows
        : 0;
      return { rows: [], rowCount, header: result };
    },
  };
}

function wrapPgClient(client) {
  return {
    dbType: 'postgresql',
    raw: client,
    async query(sql, bindings = []) {
      return client.query(sql, bindings);
    },
  };
}

async function withSqlClient(runtime, fn) {
  assertSqlDbType(runtime);
  if (isMysql(runtime)) {
    return withMysqlClient(runtime, async (conn) => fn(wrapMysqlClient(conn)));
  }
  return withPgClient(runtime, async (client) => fn(wrapPgClient(client)));
}

/** 测试专用：事务内写操作；rollback=true 时成功后回滚 */
async function withSqlWriteTest(runtime, fn, { rollback = true } = {}) {
  assertSqlDbType(runtime);
  if (isMysql(runtime)) {
    return withMysqlClient(runtime, async (conn) => {
      const client = wrapMysqlClient(conn);
      await conn.beginTransaction();
      try {
        const result = await fn(client);
        if (rollback) {
          await conn.rollback();
          if (result && typeof result === 'object') {
            return { ...result, rolledBack: true };
          }
          return { preview: result, rolledBack: true };
        }
        await conn.commit();
        return result;
      } catch (err) {
        await conn.rollback();
        throw err;
      }
    });
  }

  return withPgClient(runtime, async (raw) => {
    const client = wrapPgClient(raw);
    await raw.query('BEGIN');
    try {
      const result = await fn(client);
      if (rollback) {
        await raw.query('ROLLBACK');
        if (result && typeof result === 'object') {
          return { ...result, rolledBack: true };
        }
        return { preview: result, rolledBack: true };
      }
      await raw.query('COMMIT');
      return result;
    } catch (err) {
      await raw.query('ROLLBACK');
      throw err;
    }
  });
}

/**
 * INSERT ... 后按主键回读（MySQL 无 RETURNING）。
 * PostgreSQL 仍用 RETURNING *。
 * @param {{ id?: string }} row — 若无 id 则生成 UUID
 */
async function insertThenSelect(client, table, row, { idColumn = 'id' } = {}) {
  const body = { ...(row || {}) };
  if (body[idColumn] == null || body[idColumn] === '') {
    body[idColumn] = randomUUID();
  }
  const keys = Object.keys(body);
  if (!keys.length) {
    throw Object.assign(new Error('insert 行对象不能为空'), { status: 400 });
  }
  const dbType = client.dbType || 'postgresql';
  const cols = keys.map((k) => quoteIdent(k, dbType)).join(', ');
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const values = keys.map((k) => body[k]);

  if (isMysql(dbType)) {
    await client.query(
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
      values,
    );
    const idPlaceholder = '$1';
    const sel = await client.query(
      `SELECT * FROM ${table} WHERE ${quoteIdent(idColumn, dbType)} = ${idPlaceholder} LIMIT 1`,
      [body[idColumn]],
    );
    return { item: sel.rows[0] || null, rows: sel.rows, rowCount: 1 };
  }

  const res = await client.query(
    `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`,
    values,
  );
  return { item: res.rows[0] || null, rows: res.rows, rowCount: res.rowCount };
}

/**
 * 多行 INSERT：PG 用 RETURNING；MySQL 逐行 insertThenSelect。
 */
async function insertManyThenSelect(client, table, rows, { idColumn = 'id' } = {}) {
  const list = Array.isArray(rows) ? rows : [rows];
  if (!list.length) {
    throw Object.assign(new Error('insert 须提供至少一行数据'), { status: 400 });
  }
  const dbType = client.dbType || 'postgresql';

  if (isMysql(dbType)) {
    const items = [];
    for (const row of list) {
      // eslint-disable-next-line no-await-in-loop
      const { item } = await insertThenSelect(client, table, row, { idColumn });
      if (item) items.push(item);
    }
    return { rows: items, rowCount: items.length };
  }

  const normalized = list.map((row) => {
    const body = { ...(row || {}) };
    if (body[idColumn] == null || body[idColumn] === '') {
      body[idColumn] = randomUUID();
    }
    return body;
  });
  const keys = Object.keys(normalized[0] || {});
  if (!keys.length) {
    throw Object.assign(new Error('insert 行对象不能为空'), { status: 400 });
  }
  const cols = keys.map((k) => quoteIdent(k, dbType)).join(', ');
  const allBindings = [];
  const valueGroups = normalized.map((row) => {
    const placeholders = keys.map((k) => {
      allBindings.push(row[k]);
      return `$${allBindings.length}`;
    });
    return `(${placeholders.join(', ')})`;
  });
  const res = await client.query(
    `INSERT INTO ${table} (${cols}) VALUES ${valueGroups.join(', ')} RETURNING *`,
    allBindings,
  );
  return { rows: res.rows, rowCount: res.rowCount };
}

/**
 * UPDATE ... SET ... WHERE ... 后回读（附更新前快照 before）。
 * @param {{ setSql: string, setBindings: unknown[], whereClause: string, whereBindings: unknown[] }}
 *   whereClause 须含前导空格或 WHERE（与 buildSdkWhere 一致：` WHERE ...`）
 */
async function updateThenSelect(client, table, {
  setSql,
  setBindings,
  whereClause,
  whereBindings,
}) {
  const dbType = client.dbType || 'postgresql';
  const allBindings = [...setBindings, ...whereBindings];
  // whereClause 可能含 $2,$3（接在 SET 占位后）；单独 SELECT 时须重编为 $1…
  const whereForSelect = renumberPlaceholders(whereClause, 1);

  if (isMysql(dbType)) {
    const selBefore = await client.query(
      `SELECT * FROM ${table}${whereForSelect}`,
      whereBindings,
    );
    if (!selBefore.rows.length) {
      return { item: null, items: [], matched: 0, rows: [], rowCount: 0, before: null };
    }
    const res = await client.query(
      `UPDATE ${table} SET ${setSql}${whereClause}`,
      allBindings,
    );
    const selAfter = await client.query(
      `SELECT * FROM ${table}${whereForSelect}`,
      whereBindings,
    );
    return {
      item: selAfter.rows[0] || null,
      items: selAfter.rows,
      matched: res.rowCount,
      rows: selAfter.rows,
      rowCount: res.rowCount,
      before: selBefore.rows[0] || null,
    };
  }

  // PG：RETURNING 只能给更新后行，更新前快照需补一次 SELECT（单行主键查询，开销可忽略）
  const selBefore = await client.query(
    `SELECT * FROM ${table}${whereForSelect}`,
    whereBindings,
  );
  if (!selBefore.rows.length) {
    return { item: null, items: [], matched: 0, rows: [], rowCount: 0, before: null };
  }
  const res = await client.query(
    `UPDATE ${table} SET ${setSql}${whereClause} RETURNING *`,
    allBindings,
  );
  return {
    item: res.rows[0] || null,
    items: res.rows,
    matched: res.rowCount,
    rows: res.rows,
    rowCount: res.rowCount,
    before: selBefore.rows[0] || null,
  };
}

/**
 * 先 SELECT 再 DELETE（MySQL）；PG 用 RETURNING。被删行以 before 返回。
 */
async function selectThenDelete(client, table, { whereClause, whereBindings }) {
  const dbType = client.dbType || 'postgresql';

  if (isMysql(dbType)) {
    const sel = await client.query(
      `SELECT * FROM ${table}${whereClause}`,
      whereBindings,
    );
    if (!sel.rows.length) {
      return { item: null, items: [], deleted: 0, rows: [], rowCount: 0, before: null };
    }
    const res = await client.query(
      `DELETE FROM ${table}${whereClause}`,
      whereBindings,
    );
    return {
      item: sel.rows[0] || null,
      items: sel.rows,
      deleted: res.rowCount,
      rows: sel.rows,
      rowCount: res.rowCount,
      before: sel.rows[0] || null,
    };
  }

  const res = await client.query(
    `DELETE FROM ${table}${whereClause} RETURNING *`,
    whereBindings,
  );
  return {
    item: res.rows[0] || null,
    items: res.rows,
    deleted: res.rowCount,
    rows: res.rows,
    rowCount: res.rowCount,
    before: res.rows[0] || null,
  };
}

/** 自定义写 SQL 含 RETURNING 时在 MySQL 上拒绝 */
function assertNoReturningForMysql(sql, dbType) {
  if (!isMysql(dbType)) return;
  if (/\bRETURNING\b/i.test(String(sql || ''))) {
    throw Object.assign(
      new Error('MySQL 不支持 RETURNING；请改用网关实体写操作，或去掉自定义写 SQL 中的 RETURNING'),
      { status: 400 },
    );
  }
}

module.exports = {
  SUPPORTED_SQL_DB_TYPES,
  assertSqlDbType,
  isMysql,
  quoteIdent,
  qualifiedTable,
  expandDollarPlaceholders,
  renumberPlaceholders,
  adaptSqlIdentifiers,
  countExpr,
  ilikePred,
  wrapMysqlClient,
  wrapPgClient,
  withSqlClient,
  withSqlWriteTest,
  insertThenSelect,
  insertManyThenSelect,
  updateThenSelect,
  selectThenDelete,
  assertNoReturningForMysql,
};
