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
    alias: [
      {
        find: '@euac/ai-base/style.css',
        replacement: path.resolve(__dirname, '../EUAC_AIBase/package/ai-base/src/ui/AIChatPanel.css'),
      },
      {
        find: '@euac/ai-base',
        replacement: path.resolve(__dirname, '../EUAC_AIBase/package/ai-base/src/index.ts'),
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, 'src'),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['@euac/ai-base'],
    include: ['react-is'],
  },
  server: {
    port: APP_ENV.port,
    watch: {
      ignored: ['!**/EUAC_AIBase/package/ai-base/src/**'],
    },
    proxy: {
      '/api': {
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
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
});
