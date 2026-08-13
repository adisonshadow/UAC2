const salesDemoDb = require('../demo/salesDemoDb');
const materializationService = require('../businessData/materializationService');
const materializedTableBrowseService = require('../businessData/materializedTableBrowseService');
const { executeToolWithEnvelope } = require('./executeToolWithEnvelope');
const { executeHttpRequest } = require('./httpRequestToolService');

const BUILTIN_HANDLERS = {
  /** 公共 HTTP 请求（类 curl）；context.userToken 用于受信主机鉴权 */
  http_request: async (args, context = {}) => executeHttpRequest(args, context),
  demo_echo: async (args) => ({
    echoed: args,
    message: 'Server builtin echo succeeded'
  }),
  demo_order_lookup: async (args) => {
    const orderId = String(args.orderId || args.order_id || 'unknown');
    return {
      orderId,
      status: 'shipped',
      items: [{ sku: 'DEMO-001', name: '示例商品', qty: 1 }],
      total: 99.9
    };
  },
  sales_get_order: async (args) => {
    const orderNo = args.orderNo || args.order_no || args.orderId || args.order_id;
    const order = salesDemoDb.getOrderByOrderNo(orderNo);
    if (!order) {
      return { found: false, orderNo, message: '未找到订单' };
    }
    return { found: true, order };
  },
  sales_search_orders: async (args) => salesDemoDb.searchOrders(args),
  sales_order_stats_by_status: async () => salesDemoDb.orderStatsByStatus(),
  sales_order_stats_by_period: async (args) => salesDemoDb.orderStatsByPeriod(args),
  sales_list_complaints: async (args) => salesDemoDb.listComplaints(args),
  sales_get_complaint: async (args) => {
    const id = args.id || args.complaintId || args.complaint_id;
    const complaint = salesDemoDb.getComplaintById(id);
    if (!complaint) {
      return { found: false, id, message: '未找到投诉记录' };
    }
    return { found: true, complaint };
  },
  sales_complaint_stats_by_type: async () => salesDemoDb.complaintStatsByType(),
  sales_complaint_stats_by_status: async () => salesDemoDb.complaintStatsByStatus(),
  bizdata_preview_materialization: async (args) => materializationService.buildPreview({
    entityIds: args.entityIds || args.entity_ids,
    targetSchema: args.targetSchema || args.target_schema,
    connectionId: args.connectionId || args.connection_id
  }),
  bizdata_execute_materialization: async (args) => materializationService.executeMaterialization({
    entityIds: args.entityIds || args.entity_ids,
    targetSchema: args.targetSchema || args.target_schema,
    connectionId: args.connectionId || args.connection_id,
    dryRun: args.dryRun ?? args.dry_run ?? false,
    expectedVersions: args.expectedVersions || args.expected_versions || {},
    createTargetIfMissing: args.createTargetIfMissing ?? args.create_target_if_missing ?? false
  }),
  bizdata_list_materialization_runs: async (args) => materializationService.listRuns({
    page: args.page || 1,
    size: args.pageSize || args.page_size || 10,
    connectionId: args.connectionId || args.connection_id
  }),
  bizdata_get_materialization_status: async (args) => materializationService.getMaterializationStatus({
    connectionId: args.connectionId || args.connection_id
  }),
  bizdata_browse_materialized_schema: async (args) => materializedTableBrowseService.getTableSchema({
    entityId: args.entityId || args.entity_id,
    entityCode: args.entityCode || args.entity_code,
    connectionId: args.connectionId || args.connection_id
  }),
  bizdata_browse_materialized_rows: async (args) => materializedTableBrowseService.queryTableRows({
    entityId: args.entityId || args.entity_id,
    entityCode: args.entityCode || args.entity_code,
    connectionId: args.connectionId || args.connection_id,
    page: args.page || 1,
    size: args.pageSize || args.page_size || args.size || 20
  }),
  bizdata_insert_mock_data: async (args) => materializedTableBrowseService.insertMockData({
    entityId: args.entityId || args.entity_id,
    entityCode: args.entityCode || args.entity_code,
    connectionId: args.connectionId || args.connection_id,
    rows: args.rows || [],
    rowCount: args.rowCount || args.row_count
  })
};

const EXECUTION_TYPES = ['client', 'server_http', 'server_builtin'];

async function invokeServerHttp(config, args, context = {}) {
  const url = config?.url;
  if (!url) {
    throw new Error('server_http 工具缺少 url 配置');
  }

  const method = (config.method || 'POST').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };
  // 可选：server_config.forwardUserToken=true 时注入当前用户 JWT
  if (config.forwardUserToken && context.userToken) {
    headers.Authorization = `Bearer ${context.userToken}`;
  }
  const response = await fetch(url, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(args)
  });

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(text);
  }
  return { result: text };
}

async function invokeServerBuiltin(config, args, context = {}) {
  const handlerName = config?.handler;
  if (!handlerName || !BUILTIN_HANDLERS[handlerName]) {
    throw new Error(`未注册的 builtin handler: ${handlerName || '(empty)'}`);
  }
  return BUILTIN_HANDLERS[handlerName](args, context);
}

async function invokeTool(tool, args = {}, logContext = {}) {
  const functionName = tool.function_name || tool.functionName || '(unknown)';
  const executionType = tool.execution_type || tool.executionType;
  const requiresVerification = tool.requires_verification === true || tool.requiresVerification === true;
  const invokeContext = {
    userToken: logContext.userToken || null,
    userId: logContext.userId || null,
    traceId: logContext.traceId || null,
  };

  if (tool.execution_type === 'client') {
    return executeToolWithEnvelope({
      name: functionName,
      args,
      executionType: 'client',
      requiresVerification,
      logContext,
      fn: async () => ({
        executionType: 'client',
        message: 'Client tool must be executed in the browser via functionRegistry',
      }),
    });
  }

  if (tool.execution_type === 'server_http') {
    return executeToolWithEnvelope({
      name: functionName,
      args,
      executionType: 'server_http',
      requiresVerification,
      logContext,
      fn: async () => {
        const result = await invokeServerHttp(tool.server_config || {}, args, invokeContext);
        return { executionType: 'server_http', result };
      },
    });
  }

  if (tool.execution_type === 'server_builtin') {
    return executeToolWithEnvelope({
      name: functionName,
      args,
      executionType: 'server_builtin',
      requiresVerification,
      logContext,
      fn: async () => {
        const result = await invokeServerBuiltin(tool.server_config || {}, args, invokeContext);
        return { executionType: 'server_builtin', result };
      },
    });
  }

  return executeToolWithEnvelope({
    name: functionName,
    args,
    executionType: executionType || 'unknown',
    requiresVerification,
    logContext,
    fn: async () => {
      throw new Error(`不支持的 execution_type: ${tool.execution_type}`);
    },
  });
}

function formatOpenAITool(tool) {
  const functionName = tool.function_name || tool.functionName;
  const description = tool.description || tool.name;
  const parameters = tool.parameters_schema || tool.parametersSchema || { type: 'object', properties: {} };
  return {
    type: 'function',
    function: {
      name: functionName,
      description,
      parameters
    }
  };
}

module.exports = {
  EXECUTION_TYPES,
  invokeTool,
  formatOpenAITool
};
