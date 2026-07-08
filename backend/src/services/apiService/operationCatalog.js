/** API 服务 operation 目录（Mongo 语义 → REST 映射元数据） */
const OPERATION_CATALOG = [
  { operation: 'find', httpMethod: 'GET', routePattern: '', category: 'read', label: 'find 列表查询' },
  { operation: 'findOne', httpMethod: 'GET', routePattern: '/one', category: 'read', label: 'findOne 单条' },
  { operation: 'findById', httpMethod: 'GET', routePattern: '/:id', category: 'read', label: 'findById 按 ID' },
  { operation: 'count', httpMethod: 'GET', routePattern: '/count', category: 'read', label: 'count 计数' },
  { operation: 'countDocuments', httpMethod: 'GET', routePattern: '/count', category: 'read', label: 'countDocuments 计数' },
  { operation: 'distinct', httpMethod: 'GET', routePattern: '/distinct/:field', category: 'read', label: 'distinct 去重' },
  { operation: 'exists', httpMethod: 'GET', routePattern: '/exists', category: 'read', label: 'exists 存在判断' },
  { operation: 'aggregate', httpMethod: 'POST', routePattern: '/aggregate', category: 'aggregate', label: 'aggregate 聚合' },
  { operation: 'insertOne', httpMethod: 'POST', routePattern: '', category: 'create', label: 'insertOne 插入' },
  { operation: 'create', httpMethod: 'POST', routePattern: '', category: 'create', label: 'create 创建' },
  { operation: 'insertMany', httpMethod: 'POST', routePattern: '/many', category: 'create', label: 'insertMany 批量插入' },
  { operation: 'save', httpMethod: 'PUT', routePattern: '/:id', category: 'update', label: 'save 全量保存' },
  { operation: 'updateOne', httpMethod: 'PATCH', routePattern: '/:id', category: 'update', label: 'updateOne 更新' },
  { operation: 'updateMany', httpMethod: 'PATCH', routePattern: '', category: 'update', label: 'updateMany 批量更新' },
  { operation: 'findOneAndUpdate', httpMethod: 'PATCH', routePattern: '/one', category: 'update', label: 'findOneAndUpdate' },
  { operation: 'replaceOne', httpMethod: 'PUT', routePattern: '/:id/replace', category: 'update', label: 'replaceOne 替换' },
  { operation: 'deleteOne', httpMethod: 'DELETE', routePattern: '/:id', category: 'delete', label: 'deleteOne 删除' },
  { operation: 'deleteMany', httpMethod: 'DELETE', routePattern: '', category: 'delete', label: 'deleteMany 批量删除' },
  { operation: 'findOneAndDelete', httpMethod: 'DELETE', routePattern: '/one', category: 'delete', label: 'findOneAndDelete' },
  { operation: 'clone', httpMethod: 'POST', routePattern: '/:id/clone', category: 'create', label: 'clone 克隆' },
];

const DEFAULT_ENABLED_OPERATIONS = [
  'find',
  'count',
  'aggregate',
];

const CATALOG_BY_OPERATION = new Map(OPERATION_CATALOG.map((item) => [item.operation, item]));

function getOperationMeta(operation) {
  return CATALOG_BY_OPERATION.get(operation) || null;
}

function normalizeEnabledOperations(operations) {
  const list = Array.isArray(operations) ? operations.map(String) : DEFAULT_ENABLED_OPERATIONS;
  const unique = [...new Set(list.filter((op) => CATALOG_BY_OPERATION.has(op)))];
  return unique.length ? unique : [...DEFAULT_ENABLED_OPERATIONS];
}

module.exports = {
  OPERATION_CATALOG,
  DEFAULT_ENABLED_OPERATIONS,
  CATALOG_BY_OPERATION,
  getOperationMeta,
  normalizeEnabledOperations,
};
