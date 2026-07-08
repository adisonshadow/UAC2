# 安装与运行

## 环境要求

- **Node.js 20 LTS**（推荐，见项目根目录 `.nvmrc`）
- Node.js 18 / 22 也可使用
- Node.js 24+ 需 `@umijs/max >= 4.6`（当前项目已满足）
- Yarn 4（或 npm / pnpm）

切换 Node 版本（如已安装 nvm）：

```bash
nvm install
nvm use
```

## 安装

```bash
yarn install
```

## 配置

环境相关配置集中在 **`config/env.ts`**（Umi 4 不支持 `.env.development` / `.env.production`）：

```ts
export const APP_ENV = {
  port: 9527,                              // 开发服务器端口
  devApiBaseUrl: 'http://localhost:9526',  // 开发 proxy 目标
  prodApiBaseUrl: '',                      // 生产 API（同源代理 /api 时留空）
};
```

## 开发

```bash
yarn dev
```

浏览器访问：http://localhost:9527

## 构建

```bash
yarn build
```

产物在 `dist/` 目录。

## 常见问题

### `yarn install` 失败：`No such module: http_parser`

**原因**：Node.js 24+ 移除了内部模块 `http_parser`，旧版 Umi（`@umijs/max < 4.6`）的 `postinstall`（`max setup`）会报错。

**解决方式（二选一）**：

1. **推荐**：切换到 Node 20 LTS

```bash
nvm install 20
nvm use 20
rm -rf node_modules .mfsu src/.umi
yarn install
```

2. 保持 Node 24，确保 `@umijs/max` 已升级到 4.6+

```bash
yarn add @umijs/max@^4.6.65
yarn install
```

### `yarn dev` 提示需要 sudo

通常是因为项目目录或 `node_modules` 曾被 `sudo` 安装过，当前用户没有写权限。

在项目根目录执行（**只需执行一次**）：

```bash
sudo chown -R $(whoami) .
```

若仍有问题，清理缓存后重装：

```bash
rm -rf node_modules .mfsu src/.umi
yarn install
yarn dev
```
