import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { APP_ENV } from './config/env';

const DEV_LOG_PATH = '/__dev/ai-tool-log';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ai-tool-dev-log',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0];
          if (url !== DEV_LOG_PATH || req.method !== 'POST') {
            next();
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body || '{}');
              const text = payload.text || payload.message || JSON.stringify(payload);
              console.log(`\n${text}\n`);
            } catch (error) {
              console.error('🤖❌ [client] ai-tool-log parse failed', error);
            }
            res.statusCode = 204;
            res.end();
          });
        });
      },
    },
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-is'],
    alias: [
      {
        find: 'react',
        replacement: path.resolve(__dirname, 'node_modules/react'),
      },
      {
        find: 'react-dom',
        replacement: path.resolve(__dirname, 'node_modules/react-dom'),
      },
      {
        find: 'react/jsx-runtime',
        replacement: path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
      },
      {
        find: 'react/jsx-dev-runtime',
        replacement: path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
      },
      {
        find: '@eadaf/ai-base/style.css',
        replacement: path.resolve(__dirname, '../AIBase_with_example/package/ai-base/src/ui/AIChatPanel.css'),
      },
      {
        find: '@eadaf/ai-base',
        replacement: path.resolve(__dirname, '../AIBase_with_example/package/ai-base/src/index.ts'),
      },
      // 该包 ESM 导出在 Vite optimizeDeps 下偶发写不出 .vite/deps 文件（浏览器 504），直链 dist
      {
        find: 'constrained-editor-plugin',
        replacement: path.resolve(
          __dirname,
          'node_modules/constrained-editor-plugin/dist/esm/constrainedEditor.js',
        ),
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, 'src'),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['@eadaf/ai-base', 'constrained-editor-plugin'],
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-is'],
  },
  server: {
    port: APP_ENV.port,
    watch: {
      ignored: ['!**/AIBase_with_example/package/ai-base/src/**'],
    },
    proxy: {
      '/api/v1': {
        target: APP_ENV.devApiBaseUrl,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  define: {
    'process.env.APP_API_BASE_URL': JSON.stringify(APP_ENV.prodApiBaseUrl),
    'process.env.APP_SYSTEM_STORAGE_BUCKET_CODE': JSON.stringify(APP_ENV.systemStorageBucketCode),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});
