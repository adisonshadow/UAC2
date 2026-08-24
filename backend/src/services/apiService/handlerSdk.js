const { quotePgIdentifier, withPgClient } = require('../businessData/materialization/connectionRunner');
const { resolveEntityTableName } = require('../businessData/entityTableName');
const { BizdataEntity, BizdataEntityField } = require('../../models');
const { buildPaginationMeta } = require('./paginationMeta');
const { serializeWriteRow } = require('./pgWriteSerialize');

const COLUMN_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ALIAS_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ORDER_DIR_RE = /^(ASC|DESC)$/i;
const COLUMN_REF_RE = /^(?:([A-Za-z_][A-Za-z0-9_]*)\.)?([A-Za-z_][A-Za-z0-9_]*)$/;

const OPS = new Set([
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte',
  '$in', '$nin', '$like', '$ilike', '$isNull',
]);

function assertColumnName(name, label = '列名') {
  const col = String(name || '').trim();
  if (!COLUMN_NAME_RE.test(col)) {
    throw Object.assign(new Error(`非法${label}「${name}」`), { status: 400 });
  }
  return col;
}

function assertAlias(alias) {
  const a = String(alias || '').trim();
  if (!ALIAS_RE.test(a)) {
    throw Object.assign(new Error(`非法表别名「${alias}」`), { status: 400 });
  }
  return a;
}

/**
 * @returns {{ alias: string | null, column: string }}
 */
function parseColumnRef(ref, defaultAlias) {
  const raw = String(ref || '').trim();
  const m = COLUMN_REF_RE.exec(raw);
  if (!m) {
    throw Object.assign(new Error(`非法列引用「${ref}」，须为 col 或 alias.col`), { status: 400 });
  }
  return {
    alias: m[1] || defaultAlias || null,
    column: m[2],
  };
}

function quoteColumnRef(ref, defaultAlias) {
  const { alias, column } = parseColumnRef(ref, defaultAlias);
  const col = quotePgIdentifier(column);
  return alias ? `${quotePgIdentifier(alias)}.${col}` : col;
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 解析 where 值为条件列表（支持操作符对象）。
 * @returns {Array<{ columnRef: string, op: string, value?: unknown }>}
 */
function expandFilterValue(columnRef, value) {
  if (value === undefined) return [];
  if (!isPlainObject(value) || value === null) {
    return [{ columnRef, op: '$eq', value }];
  }
  const keys = Object.keys(value);
  const hasOp = keys.some((k) => OPS.has(k));
  if (!hasOp) {
    throw Object.assign(
      new Error(`where「${columnRef}」不支持嵌套普通对象；请用标量或 $gte/$in 等操作符`),
      { status: 400 },
    );
  }
  const conditions = [];
  keys.forEach((op) => {
    if (!OPS.has(op)) {
      throw Object.assign(new Error(`where「${columnRef}」不支持操作符「${op}」`), { status: 400 });
    }
    conditions.push({ columnRef, op, value: value[op] });
  });
  return conditions;
}

/**
 * @returns {Array<{ columnRef: string, op: string, value?: unknown }>}
 */
function toSdkFilterConditions(filter) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    throw Object.assign(new Error('where/filter 须为普通对象'), { status: 400 });
  }
  const conditions = [];
  Object.entries(filter).forEach(([key, value]) => {
    parseColumnRef(key, null); // validate
    expandFilterValue(key, value).forEach((c) => conditions.push(c));
  });
  return conditions;
}

/** 字符串运算符 → $op */
function mapSqlOperatorToOp(operator) {
  const raw = String(operator || '').trim();
  const upper = raw.toUpperCase();
  const map = {
    '=': '$eq',
    '==': '$eq',
    '!=': '$ne',
    '<>': '$ne',
    '>': '$gt',
    '>=': '$gte',
    '<': '$lt',
    '<=': '$lte',
    LIKE: '$like',
    ILIKE: '$ilike',
    IN: '$in',
    'NOT IN': '$nin',
  };
  if (map[upper]) return map[upper];
  if (map[raw]) return map[raw];
  throw Object.assign(
    new Error(`where 不支持运算符「${operator}」，请用 = / != / > / >= / < / <= / LIKE / ILIKE / IN`),
    { status: 400 },
  );
}

/**
 * 兼容 TypeORM/Knex 风格重载：
 * - where({ status: 'x' })
 * - where('status', 'x')
 * - where('status', 'ILIKE', '%x%')
 */
function normalizeWhereArgs(args) {
  if (!args.length) {
    throw Object.assign(new Error('where 至少需要一个参数'), { status: 400 });
  }
  if (args.length === 1) {
    if (typeof args[0] === 'function') {
      throw Object.assign(
        new Error('where(回调) 暂不支持；请用 where({...}) / whereIn / 多次 andWhere'),
        { status: 400 },
      );
    }
    return toSdkFilterConditions(args[0]);
  }
  if (args.length === 2) {
    const [column, value] = args;
    if (typeof column !== 'string') {
      throw Object.assign(new Error('where(列, 值) 的列名须为字符串'), { status: 400 });
    }
    return toSdkFilterConditions({ [column]: value });
  }
  if (args.length >= 3) {
    const [column, operator, value] = args;
    if (typeof column !== 'string') {
      throw Object.assign(new Error('where(列, 运算符, 值) 的列名须为字符串'), { status: 400 });
    }
    const op = mapSqlOperatorToOp(operator);
    if (op === '$in' || op === '$nin') {
      return toSdkFilterConditions({ [column]: { [op]: value } });
    }
    return toSdkFilterConditions({ [column]: { [op]: value } });
  }
  return toSdkFilterConditions(args[0]);
}

/**
 * SDK 专用参数化 WHERE（支持操作符与 alias.col）。
 * @returns {{ clause: string, bindings: unknown[], nextIndex: number }}
 */
function buildSdkWhere(conditions, { startIndex = 1, defaultAlias = null } = {}) {
  if (!conditions.length) {
    return { clause: '', bindings: [], nextIndex: startIndex };
  }

  const parts = [];
  const bindings = [];
  let idx = startIndex;

  conditions.forEach(({ columnRef, op, value }) => {
    const col = quoteColumnRef(columnRef, defaultAlias);
    switch (op) {
      case '$eq':
        if (value === null) {
          parts.push(`${col} IS NULL`);
        } else {
          parts.push(`${col} = $${idx}`);
          bindings.push(value);
          idx += 1;
        }
        break;
      case '$ne':
        if (value === null) {
          parts.push(`${col} IS NOT NULL`);
        } else {
          parts.push(`${col} <> $${idx}`);
          bindings.push(value);
          idx += 1;
        }
        break;
      case '$gt':
      case '$gte':
      case '$lt':
      case '$lte': {
        const sqlOp = { $gt: '>', $gte: '>=', $lt: '<', $lte: '<=' }[op];
        parts.push(`${col} ${sqlOp} $${idx}`);
        bindings.push(value);
        idx += 1;
        break;
      }
      case '$like':
      case '$ilike': {
        const sqlOp = op === '$like' ? 'LIKE' : 'ILIKE';
        parts.push(`${col} ${sqlOp} $${idx}`);
        bindings.push(value);
        idx += 1;
        break;
      }
      case '$in':
      case '$nin': {
        if (!Array.isArray(value) || !value.length) {
          throw Object.assign(new Error(`${op} 须为非空数组`), { status: 400 });
        }
        const placeholders = value.map((v) => {
          bindings.push(v);
          const p = `$${idx}`;
          idx += 1;
          return p;
        });
        parts.push(`${col} ${op === '$in' ? 'IN' : 'NOT IN'} (${placeholders.join(', ')})`);
        break;
      }
      case '$isNull':
        parts.push(value ? `${col} IS NULL` : `${col} IS NOT NULL`);
        break;
      default:
        throw Object.assign(new Error(`未知操作符「${op}」`), { status: 400 });
    }
  });

  return {
    clause: ` WHERE ${parts.join(' AND ')}`,
    bindings,
    nextIndex: idx,
  };
}

function clampLimit(raw, maxLimit = 100) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(Math.floor(n), maxLimit);
}

function clampSkip(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * TypeORM 风格实体仓储（底层参数化 SQL，无原始 SQL 暴露）。
 */
function createHandlerSdk({ service, client = null, runtime = null }) {
  const schema = service?.targetSchema || 'bizdata_mat';
  const tableCache = new Map();
  const entityMetaCache = new Map(); // code -> { fields }

  async function loadEntityMeta(code) {
    if (entityMetaCache.has(code)) return entityMetaCache.get(code);
    const entity = await BizdataEntity.findOne({
      where: { code },
      include: [{ model: BizdataEntityField, as: 'fields', required: false }],
    });
    const meta = entity
      ? {
          code: entity.code,
          table_name: entity.table_name,
          fields: (entity.fields || []).map((f) => {
            const d = f.toJSON ? f.toJSON() : f;
            return {
              fieldKey: d.field_key,
              typeormConfig: d.typeorm_config || {},
            };
          }),
        }
      : null;
    entityMetaCache.set(code, meta);
    return meta;
  }

  async function resolveQualifiedTable(entityCode) {
    const code = String(entityCode || service?.entityCode || '').trim();
    if (!code) {
      if (service?.tableName) {
        return `${quotePgIdentifier(schema)}.${quotePgIdentifier(service.tableName)}`;
      }
      throw Object.assign(
        new Error('db() 须传入实体 code，或服务须绑定实体'),
        { status: 400 },
      );
    }
    if (tableCache.has(code)) return tableCache.get(code);

    let tableName = null;
    if (service?.entityCode && code === service.entityCode && service.tableName) {
      tableName = service.tableName;
    } else {
      const entity = await BizdataEntity.findOne({ where: { code } });
      if (!entity) {
        throw Object.assign(new Error(`实体「${code}」不存在`), { status: 400 });
      }
      tableName = resolveEntityTableName(entity.code, entity.table_name);
    }

    const qualified = `${quotePgIdentifier(schema)}.${quotePgIdentifier(tableName)}`;
    tableCache.set(code, qualified);
    return qualified;
  }

  async function runQuery(sql, bindings) {
    if (client) {
      const res = await client.query(sql, bindings);
      return res;
    }
    if (!runtime) {
      throw Object.assign(new Error('Handler SDK 缺少数据库连接'), { status: 500 });
    }
    return withPgClient(runtime, async (pgClient) => pgClient.query(sql, bindings));
  }

  function createBuilder(entityCode, tableAlias = 't0') {
    const primaryAlias = assertAlias(tableAlias || 't0');
    const state = {
      conditions: [],
      orderBy: [],
      limit: null,
      offset: null,
      columns: null,
      joins: [],
      primaryKey: 'id',
    };

    async function buildFromClause() {
      const table = await resolveQualifiedTable(entityCode);
      let from = `${table} AS ${quotePgIdentifier(primaryAlias)}`;
      for (const join of state.joins) {
        const joinTable = await resolveQualifiedTable(join.entityCode);
        const left = quoteColumnRef(join.leftCol, primaryAlias);
        const right = quoteColumnRef(join.rightCol, primaryAlias);
        from += ` ${join.type} JOIN ${joinTable} AS ${quotePgIdentifier(join.alias)} ON ${left} = ${right}`;
      }
      return from;
    }

    function buildSelectList() {
      if (state.columns?.length) {
        return state.columns.map((c) => quoteColumnRef(c, primaryAlias)).join(', ');
      }
      if (state.joins.length) {
        return `${quotePgIdentifier(primaryAlias)}.*`;
      }
      return `${quotePgIdentifier(primaryAlias)}.*`;
    }

    function addJoin(type, joinEntityCode, alias, leftCol, rightCol) {
      const a = assertAlias(alias);
      parseColumnRef(leftCol, primaryAlias);
      parseColumnRef(rightCol, primaryAlias);
      if (!String(joinEntityCode || '').trim()) {
        throw Object.assign(new Error('join 须传入实体 code'), { status: 400 });
      }
      state.joins.push({
        type,
        entityCode: String(joinEntityCode).trim(),
        alias: a,
        leftCol: String(leftCol).trim(),
        rightCol: String(rightCol).trim(),
      });
      return builder;
    }

    const builder = {
      primaryKey(column) {
        state.primaryKey = assertColumnName(column, '主键列');
        return builder;
      },
      where(...args) {
        state.conditions = normalizeWhereArgs(args);
        return builder;
      },
      andWhere(...args) {
        state.conditions = state.conditions.concat(normalizeWhereArgs(args));
        return builder;
      },
      whereIn(column, values) {
        if (!Array.isArray(values)) {
          throw Object.assign(new Error('whereIn 的第二个参数须为数组'), { status: 400 });
        }
        state.conditions = state.conditions.concat(
          toSdkFilterConditions({ [String(column)]: { $in: values } }),
        );
        return builder;
      },
      andWhereIn(column, values) {
        return builder.whereIn(column, values);
      },
      innerJoin(joinEntityCode, alias, leftCol, rightCol) {
        return addJoin('INNER', joinEntityCode, alias, leftCol, rightCol);
      },
      leftJoin(joinEntityCode, alias, leftCol, rightCol) {
        return addJoin('LEFT', joinEntityCode, alias, leftCol, rightCol);
      },
      orderBy(column, direction = 'ASC') {
        parseColumnRef(column, primaryAlias);
        const dir = String(direction || 'ASC');
        if (!ORDER_DIR_RE.test(dir)) {
          throw Object.assign(new Error(`非法排序方向「${direction}」`), { status: 400 });
        }
        state.orderBy.push({ column: String(column).trim(), direction: dir.toUpperCase() });
        return builder;
      },
      take(n) {
        const num = Number(n);
        if (!Number.isFinite(num) || num < 0) {
          throw Object.assign(new Error('take 须为非负数字'), { status: 400 });
        }
        state.limit = Math.floor(num);
        return builder;
      },
      skip(n) {
        const num = Number(n);
        if (!Number.isFinite(num) || num < 0) {
          throw Object.assign(new Error('skip 须为非负数字'), { status: 400 });
        }
        state.offset = Math.floor(num);
        return builder;
      },
      select(columns) {
        if (!Array.isArray(columns) || !columns.length) {
          throw Object.assign(new Error('select 须为非空字符串数组'), { status: 400 });
        }
        state.columns = columns.map((c) => {
          parseColumnRef(c, primaryAlias);
          return String(c).trim();
        });
        return builder;
      },
      async getMany() {
        const from = await buildFromClause();
        const { clause, bindings, nextIndex } = buildSdkWhere(state.conditions, {
          defaultAlias: primaryAlias,
        });
        let sql = `SELECT ${buildSelectList()} FROM ${from}${clause}`;
        const values = [...bindings];
        let idx = nextIndex;
        if (state.orderBy.length) {
          const orderSql = state.orderBy
            .map((o) => `${quoteColumnRef(o.column, primaryAlias)} ${o.direction}`)
            .join(', ');
          sql += ` ORDER BY ${orderSql}`;
        }
        if (state.limit != null) {
          sql += ` LIMIT $${idx}`;
          values.push(state.limit);
          idx += 1;
        }
        if (state.offset != null) {
          sql += ` OFFSET $${idx}`;
          values.push(state.offset);
        }
        const res = await runQuery(sql, values);
        return res.rows;
      },
      async getOne() {
        const prev = state.limit;
        state.limit = 1;
        try {
          const rows = await builder.getMany();
          return rows[0] || null;
        } finally {
          state.limit = prev;
        }
      },
      async getCount() {
        const from = await buildFromClause();
        const { clause, bindings } = buildSdkWhere(state.conditions, {
          defaultAlias: primaryAlias,
        });
        const countExpr = state.joins.length
          ? `COUNT(DISTINCT ${quotePgIdentifier(primaryAlias)}.${quotePgIdentifier(state.primaryKey)})`
          : 'COUNT(*)';
        const sql = `SELECT ${countExpr}::int AS count FROM ${from}${clause}`;
        const res = await runQuery(sql, bindings);
        return res.rows[0]?.count ?? 0;
      },
      async getManyAndCount() {
        const total = await builder.getCount();
        const items = await builder.getMany();
        return {
          items,
          pagination: buildPaginationMeta({
            total,
            limit: state.limit,
            skip: state.offset,
          }),
        };
      },
      async paginate({ limit, skip, page, pageSize, maxLimit = 100 } = {}) {
        let resolvedLimit = limit ?? pageSize;
        let resolvedSkip = skip;
        if (resolvedSkip == null && page != null) {
          const ps = clampLimit(resolvedLimit ?? 20, maxLimit);
          const p = Math.max(1, Number(page) || 1);
          resolvedSkip = (p - 1) * ps;
          resolvedLimit = ps;
        }
        state.limit = clampLimit(resolvedLimit, maxLimit);
        state.offset = clampSkip(resolvedSkip);
        return builder.getManyAndCount();
      },
      // aliases
      find() {
        return builder.getMany();
      },
      findOne() {
        return builder.getOne();
      },
      count() {
        return builder.getCount();
      },
      async insert(values) {
        if (state.joins.length) {
          throw Object.assign(new Error('insert 不支持带 join 的查询构造器，请用 db(实体) 单独插入'), { status: 400 });
        }
        const table = await resolveQualifiedTable(entityCode);
        const rows = Array.isArray(values) ? values : [values];
        if (!rows.length) {
          throw Object.assign(new Error('insert 须提供至少一行数据'), { status: 400 });
        }
        const keys = Object.keys(rows[0] || {});
        if (!keys.length) {
          throw Object.assign(new Error('insert 行对象不能为空'), { status: 400 });
        }
        keys.forEach((k) => assertColumnName(k, '字段名'));
        const cols = keys.map((k) => quotePgIdentifier(k)).join(', ');
        const meta = await loadEntityMeta(entityCode);
        const allBindings = [];
        const valueGroups = rows.map((row) => {
          const serialized = serializeWriteRow(row, meta);
          const placeholders = keys.map((k) => {
            allBindings.push(serialized[k]);
            return `$${allBindings.length}`;
          });
          return `(${placeholders.join(', ')})`;
        });
        const sql = `INSERT INTO ${table} (${cols}) VALUES ${valueGroups.join(', ')} RETURNING *`;
        const res = await runQuery(sql, allBindings);
        return res.rows;
      },
      async update(where, set) {
        if (state.joins.length) {
          throw Object.assign(new Error('update 不支持带 join 的查询构造器'), { status: 400 });
        }
        const table = await resolveQualifiedTable(entityCode);
        if (!set || typeof set !== 'object' || Array.isArray(set) || !Object.keys(set).length) {
          throw Object.assign(new Error('update 的 set 须为非空对象'), { status: 400 });
        }
        const setKeys = Object.keys(set);
        setKeys.forEach((k) => assertColumnName(k, '字段名'));
        const meta = await loadEntityMeta(entityCode);
        const serializedSet = serializeWriteRow(set, meta);
        const setBindings = [];
        const setSql = setKeys.map((k, i) => {
          setBindings.push(serializedSet[k]);
          return `${quotePgIdentifier(k)} = $${i + 1}`;
        }).join(', ');
        const conditions = toSdkFilterConditions(where);
        if (!conditions.length) {
          throw Object.assign(new Error('update 须提供 where 条件，禁止全表更新'), { status: 400 });
        }
        const { clause, bindings } = buildSdkWhere(conditions, {
          startIndex: setBindings.length + 1,
        });
        const sql = `UPDATE ${table} SET ${setSql}${clause} RETURNING *`;
        const res = await runQuery(sql, [...setBindings, ...bindings]);
        return { matched: res.rowCount, items: res.rows };
      },
      async delete(where) {
        if (state.joins.length) {
          throw Object.assign(new Error('delete 不支持带 join 的查询构造器'), { status: 400 });
        }
        const table = await resolveQualifiedTable(entityCode);
        const conditions = toSdkFilterConditions(where);
        if (!conditions.length) {
          throw Object.assign(new Error('delete 须提供 where 条件，禁止全表删除'), { status: 400 });
        }
        const { clause, bindings } = buildSdkWhere(conditions);
        const sql = `DELETE FROM ${table}${clause} RETURNING *`;
        const res = await runQuery(sql, bindings);
        return { deleted: res.rowCount, items: res.rows };
      },
    };

    return builder;
  }

  function db(entityCode, alias) {
    return createBuilder(entityCode, alias || 't0');
  }

  return { db };
}

module.exports = {
  createHandlerSdk,
  buildSdkWhere,
  toSdkFilterConditions,
  clampLimit,
  clampSkip,
};
