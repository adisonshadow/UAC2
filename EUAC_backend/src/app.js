const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');
const traceId = require('./middlewares/traceId');
const routes = require('./routes');
const { koaSwagger } = require('koa2-swagger-ui');
const swaggerJSDoc = require('swagger-jsdoc');
const healthRoutes = require('./routes/healthRoutes');

// Swagger 配置
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'UAC API Documentation',
    version: '1.0.0',
    description: '用户认证和授权系统 API 文档',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: '开发服务器',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./src/routes/*.js'], // API 路由文件的路径
};

// 生成 Swagger 文档
let swaggerSpec;
try {
  swaggerSpec = swaggerJSDoc(options);
  logger.info('✅ Successfully generated Swagger document');
} catch (error) {
  logger.error('❌ Failed to generate Swagger document', { error: error.message });
  process.exit(1);
}

// 创建应用实例
const app = new Koa();

// 错误处理中间件（放在最前面）
app.use(errorHandler);
app.use(traceId);

// 中间件配置
app.use(cors());
app.use(bodyParser());

// Swagger UI 配置
try {
  app.use(
    koaSwagger({
      routePrefix: '/swagger',
      swaggerOptions: {
        spec: swaggerSpec,
      },
    }),
  );
  logger.info('✅ Successfully configured Swagger UI');
} catch (error) {
  logger.error('❌ Failed to configure Swagger UI', { error: error.message });
  process.exit(1);
}

// 添加 OpenAPI JSON 路由
app.use(async (ctx, next) => {
  if (ctx.path === '/swagger.json') {
    ctx.type = 'application/json';
    ctx.body = swaggerSpec;
    return;
  }
  await next();
});

// 添加请求日志
app.use(async (ctx, next) => {
  const start = Date.now();
  try {
    await next();
    const ms = Date.now() - start;
    logger.info('Request completed', {
      method: ctx.method,
      url: ctx.url,
      status: ctx.status,
      duration: `${ms}ms`
    });
  } catch (error) {
    const ms = Date.now() - start;
    logger.error('Request error', {
      method: ctx.method,
      url: ctx.url,
      status: ctx.status,
      duration: `${ms}ms`,
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
});

// 路由配置
app.use(routes.routes());
app.use(routes.allowedMethods());

// 注册路由
app.use(healthRoutes.routes());

// 检查服务器是否已启动
let server = null;

// 如果不是测试环境，则启动服务器
if (process.env.NODE_ENV !== 'test') {
  const PORT = config.api.port || 3000;
  try {
    server = app.listen(PORT, () => {
      logger.info(`🚀 ✅✅✅✅ API Server started on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/api/v1/health`);
      logger.info(`📚 Swagger UI: http://localhost:${PORT}/swagger`);
      logger.info(`📄 Swagger JSON: http://localhost:${PORT}/swagger.json`);
    });
  } catch (error) {
    logger.error('服务器启动失败', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
} else {
  // 在测试环境中，创建一个服务器实例并导出
  const PORT = config.api.port || 3000;
  try {
    server = app.listen(PORT);
    if (!server) {
      logger.error('❌ Failed to start server');
      process.exit(1);
    }
  } catch (error) {
    logger.error('❌ Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// 添加错误处理
server.on('error', (error) => {
  logger.error('❌ Server error', {
    name: error.name,
    message: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// 添加未捕获的异常处理
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught exception', {
    name: error.name,
    message: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// 添加未处理的 Promise 拒绝处理
process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled promise rejection', {
    reason: reason,
    promise: promise
  });
  process.exit(1);
});

module.exports = app;