const fs = require('fs');
const path = require('path');
const swaggerJSDoc = require('swagger-jsdoc');

// Swagger 配置选项
const options = {
  definition: {
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
  },
  // 指定要扫描的文件路径
  apis: ['./src/routes/*.js'], // 扫描所有路由文件
};

// 生成 Swagger 文档
function generateSwagger() {
  try {
    const swaggerSpec = swaggerJSDoc(options);
    const swaggerJson = JSON.stringify(swaggerSpec, null, 2);
    const outputPath = path.join(__dirname, '../swagger.json');
    
    fs.writeFileSync(outputPath, swaggerJson);
    console.log('Swagger 文档已生成到:', outputPath);
  } catch (error) {
    console.error('生成 Swagger 文档失败:', error);
    process.exit(1);
  }
}

// 执行生成
generateSwagger(); 