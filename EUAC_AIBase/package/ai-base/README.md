# @euac/ai-base

EUAC AI 聊天基础库，供业务前端通过 `AIChatProvider` 接入侧边栏 / 漂浮按钮式 AI 助手。

## 双模式引用

| 消费方 | 引用方式 | 读什么 |
|--------|----------|--------|
| EUAC_AIBase | Vite alias | `src/`（保存即 HMR，无需 tsup watch） |
| EUAC_frontend | `file:` 依赖 | `dist/`（改 ai-base 后需 `yarn build`） |

### EUAC_AIBase 联调（读 src）

`EUAC_AIBase/vite.config.ts` 已将 `@euac/ai-base` alias 到本目录 `src/index.ts`。ai-base 位于 `EUAC_AIBase/package/ai-base`，peer 依赖从 `EUAC_AIBase/node_modules` 解析。

```bash
cd EUAC_AIBase
yarn dev
```

修改 `package/ai-base/src/**` 后保存即可，Vite HMR 会自动刷新。**不需要**开第二个终端跑 `tsup --watch`。

### EUAC_frontend 接入（读 dist）

`EUAC_frontend/package.json` 通过 `file:../EUAC_AIBase/package/ai-base` 引用本包，运行时走 `exports` 指向的 **`dist/`**。

首次接入或修改 ai-base 导出后，需先构建 dist：

```bash
cd EUAC_AIBase/package/ai-base
yarn build
```

然后在 EUAC_frontend 中：

```tsx
import { AIChatProvider } from '@euac/ai-base';
import '@euac/ai-base/style.css';
```

## 构建 dist（发布 / EUAC_frontend 联调）

```bash
cd EUAC_AIBase/package/ai-base
yarn build    # 产出 dist/index.js、dist/index.d.ts、dist/style.css
yarn dev      # tsup --watch，仅 EUAC_frontend 联调时需要
```

## 常见报错

**找不到某个 export（如 `AIChatDisplay`）**

EUAC_AIBase 开发时清 Vite 预构建缓存后重启：

```bash
cd EUAC_AIBase
rm -rf node_modules/.vite
yarn dev
```

EUAC_frontend 使用时确认 dist 已 build 且包含该导出。

**`Failed to resolve import "@ant-design/x" from .../ai-base/src/...`**

说明 ai-base 不在 `EUAC_AIBase/package/` 下，或 Vite alias 指向了错误的目录。本包必须位于 `EUAC_AIBase/package/ai-base`，以便 peer 依赖向上解析到 `EUAC_AIBase/node_modules`。

**`react-is` does not provide an export named 'ForwardRef'`**

`react-is` 是 CJS 包，EUAC_AIBase 的 `vite.config.ts` 已将其加入 `optimizeDeps.include`。清缓存后重启：

```bash
cd EUAC_AIBase
rm -rf node_modules/.vite
yarn dev
```

## API：页面级展示模式

在 `AIChatProvider` 包裹的路由树内，每个页面可控制 AI 助手如何展示：

| 模式 | 说明 |
|------|------|
| `sidebar` | 默认。右侧固定侧边栏，展开时挤压主内容 |
| `float` | 仅漂浮按钮，面板以浮层打开 |
| `hidden` | **完全不挂载**聊天 UI，DOM 中无相关节点 |

### 路由层（推荐）

```tsx
import { AIChatDisplay } from '@euac/ai-base';

<Route
  path="/auth/login"
  element={
    <AIChatDisplay mode="hidden">
      <LoginPage />
    </AIChatDisplay>
  }
/>
```

### 页面内 Hook

```tsx
import { useAIChatDisplayMode } from '@euac/ai-base';

export default function SomePage() {
  useAIChatDisplayMode('float');
  // ...
}
```

组件卸载后自动恢复为 `sidebar`。

## 目录结构

```text
src/
  provider/     AIChatProvider、AIChatDisplay、context
  ui/           AIChatPanel 及样式
  chat/         流式对话与 Tool 调用
  registry/     客户端 Function Call 注册
  sdk/          AIBaseClient HTTP 封装
dist/           构建产物（EUAC_frontend 实际加载此目录）
```
