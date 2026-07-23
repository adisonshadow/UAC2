/**
 * TypeScript Handler SDK 环境声明（编辑器 / 语法检查共用）。
 *
 * params：网关已按 requestParameterInterface 校验并只读注入；经 db().where/insert 等使用时值会参数化绑定。
 * 勿把 params 拼进字符串。SDK 不会自动把 params 转成 where。
 */

declare interface HandlerParams {
  [key: string]: unknown;
}

declare type OrderDirection = 'ASC' | 'DESC' | 'asc' | 'desc';

/** where 操作符（禁 SQL 后的比较 / 模糊 / IN） */
declare type HandlerWhereOps = {
  $eq?: unknown;
  $ne?: unknown;
  $gt?: unknown;
  $gte?: unknown;
  $lt?: unknown;
  $lte?: unknown;
  $in?: unknown[];
  $nin?: unknown[];
  $like?: string;
  $ilike?: string;
  $isNull?: boolean;
};

declare type HandlerWhereValue = unknown | HandlerWhereOps | null;

declare type HandlerWhereFilter = Record<string, HandlerWhereValue>;

declare type HandlerPaginateResult = {
  items: Record<string, unknown>[];
  total: number;
};

declare interface HandlerQueryBuilder {
  /** 等值 / 操作符过滤；列可用 col 或 alias.col */
  where(filter: HandlerWhereFilter): HandlerQueryBuilder;
  /** TypeORM/Knex：where('status', value) */
  where(column: string, value: unknown): HandlerQueryBuilder;
  /** TypeORM/Knex：where('name', 'ILIKE', '%x%') */
  where(column: string, operator: string, value: unknown): HandlerQueryBuilder;
  andWhere(filter: HandlerWhereFilter): HandlerQueryBuilder;
  andWhere(column: string, value: unknown): HandlerQueryBuilder;
  andWhere(column: string, operator: string, value: unknown): HandlerQueryBuilder;
  whereIn(column: string, values: unknown[]): HandlerQueryBuilder;
  andWhereIn(column: string, values: unknown[]): HandlerQueryBuilder;
  /** INNER JOIN，ON 仅等值：leftCol = rightCol（如 'o.id', 'oi.order_id'） */
  innerJoin(entityCode: string, alias: string, leftCol: string, rightCol: string): HandlerQueryBuilder;
  /** LEFT JOIN，ON 仅等值 */
  leftJoin(entityCode: string, alias: string, leftCol: string, rightCol: string): HandlerQueryBuilder;
  /** JOIN 计数时 DISTINCT 主键列，默认 id */
  primaryKey(column: string): HandlerQueryBuilder;
  orderBy(column: string, direction?: OrderDirection): HandlerQueryBuilder;
  take(n: number): HandlerQueryBuilder;
  skip(n: number): HandlerQueryBuilder;
  select(columns: string[]): HandlerQueryBuilder;
  getMany(): Promise<Record<string, unknown>[]>;
  getOne(): Promise<Record<string, unknown> | null>;
  getCount(): Promise<number>;
  /** 同一套 where/join：先 count 再分页查询，避免过滤写两遍 */
  getManyAndCount(): Promise<HandlerPaginateResult>;
  /** 钳制 limit/skip 后 getManyAndCount；limit 默认 20、上限 maxLimit（默认 100） */
  paginate(options?: { limit?: unknown; skip?: unknown; maxLimit?: number }): Promise<HandlerPaginateResult>;
  /** 别名 = getMany */
  find(): Promise<Record<string, unknown>[]>;
  /** 别名 = getOne */
  findOne(): Promise<Record<string, unknown> | null>;
  /** 别名 = getCount */
  count(): Promise<number>;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): Promise<Record<string, unknown>[]>;
  update(where: HandlerWhereFilter, set: Record<string, unknown>): Promise<{ matched: number; items: Record<string, unknown>[] }>;
  delete(where: HandlerWhereFilter): Promise<{ deleted: number; items: Record<string, unknown>[] }>;
}

/**
 * 实体仓储：传入实体 code（如 `fmms:production:WorkCard`），可选表别名（默认 t0）。
 * 勿写物化表名 / 原始 SQL。
 */
declare function db(entityCode?: string, alias?: string): HandlerQueryBuilder;

/** 已校验、只读的请求参数（结构来自 requestParameterInterface） */
declare const params: HandlerParams;

declare interface HandlerServiceInfo {
  id?: string;
  code?: string;
  name?: string;
  scopeCode?: string;
  operation?: string;
}

declare interface HandlerContext {
  service: HandlerServiceInfo;
  operation?: string;
  params: HandlerParams;
  parameters: HandlerParams;
  user?: { bypassAccessControl?: boolean };
}

/** 兼容旧写法；新 Handler 请直接用 params / db */
declare const ctx: HandlerContext;
