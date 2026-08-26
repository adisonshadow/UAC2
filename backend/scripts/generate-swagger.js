const fs = require('fs');
const path = require('path');
const swaggerSpec = require('../src/config/swagger');

function generateSwagger() {
  try {
    const swaggerJson = JSON.stringify(swaggerSpec, null, 2);
    const outputPath = path.join(__dirname, '../swagger.json');
    fs.writeFileSync(outputPath, swaggerJson);
    console.log('Swagger 文档已生成到:', outputPath);
  } catch (error) {
    console.error('生成 Swagger 文档失败:', error);
    process.exit(1);
  }
}

generateSwagger();
