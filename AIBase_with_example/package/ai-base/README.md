# @EADAF/ai-base

EADAF AI 聊天基础库。宿主应用通过 `AIChatProvider` 接入侧边栏 / 漂浮按钮式 AI 助手，并可在页面内配置 Skill、Tool、Prompts、Chat 引用等能力。

## 双模式引用

| 消费方 | 引用方式 | 读什么 |
|--------|----------|--------|
| AIBase_with_example | Vite alias | `src/`（保存即 HMR，无需 tsup watch） |
| EADAF_frontend | `file:` 依赖 | `dist/`（改 ai-base 后需 build） |

### AIBase_with_example 联调（读 src）

`AIBase_with_example/vite.config.ts` 已将 `@EADAF/ai-base` alias 到本目录 `src/index.ts`。peer 依赖从 `AIBase_with_example/node_modules` 解析。

```bash
cd AIBase_with_example
pnpm dev
```

修改 `package/ai-base/src/**` 后保存即可 HMR 刷新，**不需要**单独开 `tsup --watch`。

### EADAF_frontend 接入（读 dist）

`EADAF_frontend/package.json` 通过 `file:../AIBase_with_example/package/ai-base` 引用，运行时走 `exports` 指向的 **`dist/`**。

```bash
cd AIBase_with_example/package/ai-base
pnpm build

# 或在 EADAF_frontend 根目录
pnpm refresh:ai-base   # 清除缓存并同步 dist
```

```tsx
import { AIChatProvider } from '@EADAF/ai-base';
import '@EADAF/ai-base/style.css';
```

修改 ai-base **导出** 或 **dist 行为** 后，需重新 build；若新 API 不生效，执行 `pnpm refresh:ai-base` 并重启 frontend dev。

---

## 快速接入

```tsx
import { AIChatProvider } from '@EADAF/ai-base';
import '@EADAF/ai-base/style.css';

<AIChatProvider
  config={{
    apiBase: '/api',
    getToken: () => localStorage.getItem('token'),
    applicationId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // 可选
    systemPromptPrefix: '你是 EADAF 助手…',
    welcome: { title: 'Hi', description: '直接描述需求即可' },
    prompts: [{ key: '1', description: '你可以帮我做什么？' }],
    hiddenPaths: ['/auth/login'],
  }}
>
  {children}
</AIChatProvider>
```

路由 wrapper 内再用 `AIChatPageScope` 覆盖页面级 Skill / 欢迎语 / 静态 prompts：

```tsx
import { AIChatPageScope } from '@EADAF/ai-base';

<AIChatPageScope
  scopeSlug="business-data"
  fallbackSkillSlugs={['bizdata-model-design']}
  headerCaption="模型设计助手"
  systemPromptPrefix="你是业务数据建模助手…"
  welcome={{ title: '业务数据模型设计', description: '…' }}
>
  <Outlet />
</AIChatPageScope>
```

---

## Skill 与 Tool

### `applicationId` 与 Skill 加载

| 是否配置 `applicationId` | 加载的 Skill |
|--------------------------|--------------|
| **已配置** | 远端：**全局 Skill** + **绑定该应用的专用 Skill**；再合并本地 **`fallbackSkillSlugs`** |
| **未配置** | **仅**本地 **`fallbackSkillSlugs`** |

- 远端 Skill 通过 `/v1/ai/capabilities?applicationId=...` 获取。
- **`fallbackSkillSlugs`** 由 `AIChatPageScope` 或根 `AIChatProvider` 配置，例如 `bizdata-model-design`。
- 同 slug 合并时，**本地配置覆盖远端**。
- 页面级 **`applicationId`** 会覆盖根配置；未传则继承根值。

### 可用 Tool 来源

| 来源 | 说明 |
|------|------|
| Skill 关联 Tool | 来自已加载 Skill，含 client / server 类型 |
| 本地 client Tool | `registerFunctionCall` 注册；可为 Skill 关联的 client Tool 提供 handler，也可注册纯本地 Tool |

**合并规则**：`openaiTools` = Skill 关联 Tool + 本地 `registerFunctionCall`；同名时 **Skill 侧 schema 优先**，本地补充 Skill 未覆盖的 Tool。

```tsx
import { registerFunctionCall, unregisterFunctionCall } from '@EADAF/ai-base';

// 应用级：App 入口集中注册（如 EADAF_frontend 的 AIChatClientToolsRegistrar）
registerFunctionCall({
  name: 'bizdata_list_entities',
  description: '列出业务数据实体',
  parameters: { type: 'object', properties: {} },
  handler: async (args) => { /* 调用 API */ },
});

// 页面级：进入注册、离开注销
useEffect(() => {
  registerFunctionCall({ name: 'page_only_tool', /* … */ });
  return () => unregisterFunctionCall('page_only_tool');
}, []);
```

注册/注销后通过 `subscribeFunctionCalls` 自动刷新当前会话可用 Tool 列表。

---

## AISurface 与 UI 联动（Mutation）

页面注册 **Surface** 供 AI 读取上下文；Tool 写操作返回 **mutation** 后自动刷新 UI。

```tsx
import { useAISurface } from '@EADAF/ai-base';

useAISurface({
  id: 'bizdata.model-designer',
  domain: 'bizdata',
  label: '业务数据模型设计',
  read: () => ({ selectedEntity, entityCount }),
  refresh: loadSchema,
  applyMutation: (mutation) => { /* 增量 patch 或 fallback refresh */ },
});
```

| API | 说明 |
|-----|------|
| `useAISurface(def)` | 注册/注销页面 Surface |
| `useAIMutationHandler(domain, fn)` | 仅订阅 mutation |
| `subscribeAIMutation` / `emitAIMutation` | 事件总线 |
| `subscribeToolInvoke` | Tool 完成回调（含 result.mutation） |
| `aibase_read_surfaces` | 内置 Tool，读取所有已注册 Surface |

Tool 写操作返回格式：

```typescript
return {
  data: entity,
  mutation: { domain: 'bizdata', type: 'entity.updated', resourceId: entity.id, payload: entity },
};
```

---

## Prompts（建议问题）

欢迎区「你可以试试」的建议问题，支持三层配置：

**优先级**：`useAIChatPrompts` / `setPrompts` **>** `AIChatPageScope.prompts` **>** 根 `AIChatProvider.config.prompts`

### 静态配置

在 `AIChatProvider` 或 `AIChatPageScope` 上传入 `prompts: AIChatPromptItem[]`：

```tsx
prompts={[{ key: '1', description: '列出当前所有实体' }]}
```

### 动态配置（推荐）

页面内按选中项、Tab 等状态切换：

```tsx
import { useMemo } from 'react';
import { useAIChatPrompts } from '@EADAF/ai-base';

function ModelDesigner({ selectedEntity }) {
  const chatPrompts = useMemo(() => {
    if (!selectedEntity) {
      return [
        { key: '1', description: '列出当前所有业务实体' },
        { key: '2', description: '创建一个 sales:order:Order 订单实体' },
      ];
    }
    const label = selectedEntity.label || selectedEntity.code;
    return [
      { key: '1', description: `为「${label}」补充常用字段` },
      { key: '2', description: `为「${label}」自动创建和补齐索引` },
    ];
  }, [selectedEntity?.id, selectedEntity?.label, selectedEntity?.code]);

  useAIChatPrompts(chatPrompts);
}
```

命令式更新（事件回调中）：

```tsx
import { useSetAIChatPrompts } from '@EADAF/ai-base';

const { setPrompts, resetPrompts } = useSetAIChatPrompts();
setPrompts([{ key: '1', description: '为当前实体自动生成关系' }]);
resetPrompts(); // 恢复为 PageScope / 根配置
```

| API | 说明 |
|-----|------|
| `useAIChatPrompts(prompts)` | 声明式；卸载后自动 `resetPrompts` |
| `useSetAIChatPrompts()` | 返回 `{ setPrompts, resetPrompts }` |
| `useAIChatDynamicPrompts()` | 读取当前运行时覆盖值 |

---

## Chat 引用

页面元素可将上下文加入 AI 对话引用区，随下一条消息一并发送。

```tsx
import { useChatReference } from '@EADAF/ai-base';

const { addReference, removeReference, clearReferences, references } = useChatReference();

addReference({
  type: 'entity',
  label: '订单（实体）',
  content: { code: 'sales:order:Order', fields: [/* … */] },
  unique: true, // 同 type 仅保留最新一条
});
```

EADAF_frontend 中配合 `ChatReferenceTarget` 组件（`className: chat-reference-target`）使用。

---

## 程序化发消息

打开 AI 面板并模拟用户发送（与手动点击发送相同流程）：

```tsx
import { sendMockUserMessage } from '@EADAF/ai-base';

sendMockUserMessage('请帮我为当前实体自动创建索引');
```

底层 API：

| API | 说明 |
|-----|------|
| `sendMockUserMessage(text)` | 打开面板 + 发送消息 |
| `sendAIChatMessage(text)` | 仅发送，不强制打开面板 |
| `registerAIChatControls({ openPanel })` | 由 `AIChatProvider` 内部注册 |

---

## 展示模式

| 模式 | 说明 |
|------|------|
| `sidebar` | 默认。右侧固定侧边栏，展开时挤压主内容 |
| `float` | 仅漂浮按钮，面板以浮层打开 |
| `hidden` | 完全不挂载聊天 UI |

```tsx
// 路由层
import { AIChatDisplay } from '@EADAF/ai-base';
<AIChatDisplay mode="hidden"><LoginPage /></AIChatDisplay>

// 页面内 Hook（卸载后恢复 sidebar）
import { useAIChatDisplayMode } from '@EADAF/ai-base';
useAIChatDisplayMode('float');
```

---

## Tool 调用日志（开发）

开发环境可将 client / server Tool 调用输出到浏览器控制台与 dev 终端：

```tsx
import { setToolInvokeLogger, formatToolInvokeError } from '@EADAF/ai-base';

setToolInvokeLogger((entry) => {
  console.log(entry.success ? '✅' : '❌', entry.name, entry.error ?? entry.result);
});
```

EADAF_frontend 在 `App.tsx` 中通过 `setupAiToolDevLogger()` 接入。失败时 `entry.error` 已包含 API 返回的 `[HTTP status] message | details`。

---

## 配置项摘要

| 字段 | 必填 | 说明 |
|------|------|------|
| `apiBase` | 否 | API 根路径，默认 `/api` |
| `getToken` | 否 | 鉴权 token 获取函数 |
| `applicationId` | 否 | 应用系统 ID；配置后加载全局 + 专用 Skill |
| `fallbackSkillSlugs` | 否 | 本地 Skill slug 列表 |
| `scopeSlug` | 否 | 页面能力域标识 |
| `systemPromptPrefix` | 否 | 合并进系统提示的前缀 |
| `welcome` | 否 | `{ title, description }` 欢迎区文案 |
| `prompts` | 否 | 静态建议问题列表 |
| `headerCaption` | 否 | 面板标题，默认「AI 助手」 |
| `panelWidth` | 否 | 侧栏宽度，默认 `420` |
| `headerOffset` | 否 | 面板 top 偏移，默认 `64` |
| `defaultOpen` | 否 | 初始是否展开，默认 `true` |
| `hiddenPaths` | 否 | 匹配路径下隐藏 AI UI |

---

## 主要导出

| 分类 | 导出 |
|------|------|
| Provider | `AIChatProvider`, `AIChatPageScope`, `AIChatDisplay`, `ChatReferenceProvider` |
| Hooks | `useAIChatLayout`, `useAIChatDisplayMode`, `useEffectiveAIChatConfig`, `useChatReference`, `useAIChatPrompts`, `useSetAIChatPrompts`, `useAISurface`, `useAIMutationHandler` |
| Tool 注册 | `registerFunctionCall`, `unregisterFunctionCall`, `getAllFunctionCalls`, `subscribeFunctionCalls` |
| 消息 / 引用 | `sendMockUserMessage`, `sendAIChatMessage`, `formatMessageWithReferences` |
| 日志 | `setToolInvokeLogger`, `logToolInvoke`, `formatToolInvokeError` |
| SDK | `AIBaseClient` |
| 类型 | `AIChatConfig`, `AIChatPromptItem`, `FunctionCallDef`, `AIBaseSkill`, `AIBaseTool`, … |

---

## 构建

```bash
cd AIBase_with_example/package/ai-base
pnpm build    # dist/index.js、dist/index.d.ts、dist/style.css
pnpm dev        # tsup --watch（仅 frontend 联调时需要）
```

## 常见报错

**找不到某个 export**

EADAF_frontend：确认 dist 已 build 且包含该导出，执行 `pnpm refresh:ai-base`。

AIBase_with_example：清 Vite 预构建缓存后重启：

```bash
cd AIBase_with_example && rm -rf node_modules/.vite && pnpm dev
```

**`Failed to resolve import "@ant-design/x"`**

本包须位于 `AIBase_with_example/package/ai-base`，以便 peer 依赖向上解析。

**`react-is` does not provide an export named 'ForwardRef'`**

清 `node_modules/.vite` 后重启 dev（`vite.config.ts` 已配置 `optimizeDeps.include`）。

**`setToolInvokeLogger 不可用`**

dist 过旧，执行 `pnpm build` + `pnpm refresh:ai-base` 并重启 frontend dev。

---

## 目录结构

```text
src/
  provider/     AIChatProvider、AIChatPageScope、AIChatPromptsContext、ChatReferenceContext
  ui/           AIChatPanel 及样式
  chat/         流式对话、EADAFChatProvider、useAIBaseChat
  registry/     client Function Call 注册、Skill 加载、Tool manifest 合并
  hooks/        useSendAIChatMessage（deprecated，请用 sendMockUserMessage）
  utils/        aiChatBridge、formatChatReferences、toolInvokeLogger
  sdk/          AIBaseClient HTTP 封装
  config/       resolveConfig、默认 prompts / welcome
dist/           构建产物（EADAF_frontend 实际加载此目录）
```
