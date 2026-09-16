/**
 * pm2 配置：pnpm pm2dev / pnpm pm2prod（--only 选择对应进程）
 * - eadaf-web-dev：vite dev server（9527，--host 监听 0.0.0.0，自带 HMR，无需 pm2 watch）
 * - eadaf-web    ：vite preview 托管已构建的 dist（需先 pnpm build），
 *                  沿用 vite.config.ts 的 /api/v1 代理到 http://localhost:9526
 */
const common = {
  cwd: __dirname,
  script: 'node_modules/vite/bin/vite.js',
  autorestart: true,
  max_memory_restart: '800M',
  time: true,
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'eadaf-web-dev',
      args: ['--host'],
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      ...common,
      name: 'eadaf-web',
      args: ['preview', '--host'],
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
