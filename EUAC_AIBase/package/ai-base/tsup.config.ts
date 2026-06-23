import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    'antd',
    '@ant-design/icons',
    '@ant-design/x',
    '@ant-design/x-sdk',
    '@ant-design/x-markdown',
  ],
});
