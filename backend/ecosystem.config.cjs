/**
 * pm2 配置：pnpm pm2dev / pnpm pm2prod（--only 选择对应进程）
 * - uac-api-dev：开发模式，pm2 watch 文件变更自动重启
 * - uac-api   ：生产模式，dotenv 自动加载 .env.production
 */
const common = {
  cwd: __dirname,
  script: 'src/app.js',
  instances: 1,
  autorestart: true,
  max_memory_restart: '600M',
  time: true,
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'uac-api-dev',
      watch: true,
      ignore_watch: ['node_modules', 'logs', '**/*.log'],
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      ...common,
      name: 'uac-api',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
