/**
 * 将 Service / Sequelize 异常格式化为统一 API 错误响应
 */
function formatApiError(error, options = {}) {
  const { fallbackStatus = 400, resourceLabel = '资源' } = options;

  if (error?.name === 'SequelizeUniqueConstraintError') {
    const details = (error.errors || []).map((item) => ({
      field: item.path,
      message: item.message,
      value: item.value,
    }));
    const field = details[0]?.field || 'code';
    const value = details[0]?.value;
    const message =
      field === 'code'
        ? `${resourceLabel} code「${value}」已存在`
        : `${resourceLabel} 字段「${field}」的值「${value}」已存在`;

    return {
      status: 409,
      code: 409,
      message,
      data: {
        errorType: error.name,
        field,
        value,
        constraint: error.parent?.constraint,
        details,
      },
    };
  }

  if (error?.name === 'SequelizeValidationError') {
    const details = (error.errors || []).map((item) => ({
      field: item.path,
      message: item.message,
      value: item.value,
    }));
    return {
      status: 400,
      code: 400,
      message: details[0]?.message || error.message || '数据校验失败',
      data: {
        errorType: error.name,
        details,
      },
    };
  }

  if (error?.name === 'MaterializationTargetNotFoundError') {
    return {
      status: 409,
      code: 409,
      message: error.message,
      data: {
        errorCode: 'TARGET_NOT_FOUND',
        targetSchema: error.targetSchema,
        dbType: error.dbType,
        connectionId: error.connectionId,
      },
    };
  }

  if (error?.name === 'SequelizeForeignKeyConstraintError') {
    return {
      status: 400,
      code: 400,
      message: '关联数据不存在或已被引用，无法完成操作',
      data: {
        errorType: error.name,
        detail: error.parent?.detail,
        table: error.parent?.table,
      },
    };
  }

  const status = error?.status || fallbackStatus;
  const extra = {};
  if (error?.validationErrors) extra.validationErrors = error.validationErrors;
  if (error?.diagnostics) extra.diagnostics = error.diagnostics;
  if (process.env.NODE_ENV === 'development' && error?.name) {
    extra.errorType = error.name;
  }

  return {
    status,
    code: status,
    message: error?.message || '请求失败',
    data: Object.keys(extra).length ? extra : null,
  };
}

module.exports = { formatApiError };
