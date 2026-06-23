import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@euac/ai-base/style.css',
        replacement: path.resolve(__dirname, 'package/ai-base/src/ui/AIChatPanel.css'),
      },
      {
        find: '@euac/ai-base',
        replacement: path.resolve(__dirname, 'package/ai-base/src/index.ts'),
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, 'src'),
      },
    ],
  },
  // 不预构建 @euac/ai-base（直接读 src，改源码后 HMR）；
  // react-is 为 CJS，须单独预构建，否则 antd/rc 组件会报 ForwardRef 导出错误
  optimizeDeps: {
    exclude: ['@euac/ai-base'],
    include: ['react-is'],
  },
  server: {
    port: 9529,
    watch: {
      ignored: ['!**/package/ai-base/src/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:9526',
        changeOrigin: true,
      },
    },
  },
});
