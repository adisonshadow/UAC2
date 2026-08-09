# @eadaf/ai-base

EADAF AI 聊天基础库。宿主应用通过 `AIChatProvider` 接入侧边栏 / 漂浮按钮式 AI 助手，并可在页面内配置 Skill、Tool、Prompts、Chat 引用等能力。

> 仓库内 `AIBase_with_example` 仅作演示与联调沙箱，正式接入请以本 README 与 `dist/` 为准。

## 宿主接入（读 dist）

运行时通过包 `exports` 加载 **`dist/`**。改动本包源码后需重新 build；宿主侧可用 `pnpm refresh:ai-base`（若已配置）清除缓存并同步。

```bash
pnpm build
```

```tsx
import { AIChatProvider } from '@eadaf/ai-base';
import '@eadaf/ai-base/style.css';
```

修改 **导出** 或 **dist 行为** 后若新 API 不生效，重新 build、刷新宿主依赖链接，并重启 frontend dev。

---

## 快速接入

```tsx
import { AIChatProvider } from '@eadaf/ai-base';
import '@eadaf/ai-base/style.css';

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
import { AIChatPageScope } from '@eadaf/ai-base';

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

### 语音输入

Sender 使用 `@ant-design/x` 内置语音录入（麦克风 → 转写进输入框，交互类似 Cursor）。  
仅当当前选中模型的 `capabilities` 包含 **`audio_input`** 时显示语音按钮；与附件模态 `inputTags: audio`（上传音频文件）相互独立。浏览器需支持 SpeechRecognition，并授予麦克风权限。

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
| Harness Tool | `ask_user` 始终注入；`update_plan` / `task_complete` 在 `enableStructuredTermination` 时注入（见下方「Agent 内置 Tool」） |

**合并规则**：`openaiTools` = Skill 关联 Tool + Harness Tool + 本地 `registerFunctionCall`；同名时 **Skill 侧 schema 优先**，本地补充 Skill 未覆盖的 Tool。

```tsx
import { registerFunctionCall, unregisterFunctionCall } from '@eadaf/ai-base';

// 应用级：App 入口集中注册（如宿主的 AIChatClientToolsRegistrar）
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

### 同一轮 Tool 并行执行

当模型在一轮回复中返回多个 `tool_calls` 时，SDK 会**并发执行**（上限 6 个）而非串行，
显著降低多工具场景下的端到端延迟。每个工具的 ThoughtChain 步骤仍按输出顺序渲染。
工具间存在数据依赖时，模型会拆成多轮（下一轮依赖上一轮结果），多轮之间仍为串行。

### Tool 分派规则（executionType）

| `executionType` | 本地有同名 handler | 行为 |
|-----------------|-------------------|------|
| `client` | ✅ | 本地执行（`functionRegistry`） |
| `client` | ❌ | 抛错（Client Tool 未注册 handler） |
| `server_http` / `server_builtin` | 任意 | **走后端**（按声明执行） |
| `server_*` 且 `allowClientOverride: true` | ✅ | 本地执行（显式覆盖） |
| 无 meta（仅 `exposeAllClientTools`） | ✅ | 本地执行 |

> ⚠️ **行为变更**：历史上「只要本地有同名 handler 就拦截 server 工具」的隐式行为已移除。
> 如需让本地 handler 接管 server 类型工具，必须在 Tool 元数据上显式声明 `allowClientOverride: true`。

### Tool 结果体积管控

Tool 结果在回灌对话历史前会按**字符预算**裁剪，避免大结果撑爆上下文。预算优先级：

**本地 def `resultBudget` > 远端 Tool `resultBudget` > `AIChatConfig.maxToolResultChars`（默认 8000）**

```tsx
// 全局默认
<AIChatProvider config={{ maxToolResultChars: 6000 }}>

// 单个 Tool 级覆盖（本地 handler）
registerFunctionCall({
  name: 'search_orders',
  resultBudget: { maxChars: 2000 }, // 这个工具结果很大，进一步收紧
  // …
});
```

超预算时保留头部并追加 `[truncated: original N chars, budget M]` 标注，模型可据此换更聚焦的查询。

### 命名空间与生命周期

`registerFunctionCall` 支持按 `namespace` 隔离（默认 `'default'`，向后兼容）。
微前端 / 多面板场景可按应用或路由 scope 注册，避免同名 Tool 互相覆盖：

```tsx
registerFunctionCall(def, { namespace: 'sales-app' });
getFunctionCallDef('search_orders', 'sales-app'); // 先查 sales-app，回退 default
unregisterFunctionCall('search_orders', 'sales-app');
clearFunctionCalls('sales-app'); // 清空某命名空间
```

组件级注册推荐用 `useFunctionCall` Hook，**卸载即自动注销**：

```tsx
import { useFunctionCall } from '@eadaf/ai-base';

function PageWithTools({ entityId }) {
  useFunctionCall(
    {
      name: 'page_only_tool',
      description: '…',
      parameters: { type: 'object', properties: {} },
      handler: async (args) => { /* … */ },
    },
    { enabled: Boolean(entityId) },
  );
  // …
}
```

### Skill 完成策略（声明式 auto-continue）

当模型「只输出步骤说明、却没真正调用 Tool」时，SDK 会按各 Skill 声明的**完成策略**
决定是否自动注入续调指令。策略可由后端 Skill 元数据（`completion_strategy` 字段）下发，
也可由前端注册表覆盖：

```tsx
import { registerSkillCompletionPolicy } from '@eadaf/ai-base';

registerSkillCompletionPolicy('bizdata-model-design', {
  requiredTools: ['bizdata_validate_model'], // 完成前必须调用过
  completionKeywords: ['建模完成', '校验通过'], // 文本命中即视为完成
  blockKeywords: ['接下来您可以', '建议您'],    // 文本命中即禁止续调
  continuousExecution: false,                  // 连续执行型（如 test-fix 循环）
});
```

| 字段 | 作用 |
|------|------|
| `requiredTools` | 本轮结束若仍有未调用的关键 Tool → 续调 |
| `completionKeywords` | 文本命中 → 视为任务完成，停止续调 |
| `blockKeywords` | 文本命中（如收尾建议句）→ 停止续调 |
| `continuousExecution` | 连续执行型 Skill，不受「一次一事」限制 |

SDK 自身不包含任何业务工具名集合或中文正则，新业务接入只需声明策略，无需改 SDK 源码。

---

## Agent 内置 Tool（Harness）

对话循环会向 LLM **始终或按配置**注入若干流程控制 Tool（不属于业务 Skill 关联）：

| Tool | 何时注入 | 作用 |
|------|----------|------|
| `ask_user` | **始终** | mid-task HITL：向用户展示结构化选择题并挂起循环 |
| `update_plan` | `enableStructuredTermination: true` | 维护任务清单（Plan） |
| `task_complete` | `enableStructuredTermination: true` | 显式验收并终止循环 |

```tsx
<AIChatProvider
  config={{
    // …
    enableStructuredTermination: true, // 注入 update_plan / task_complete，并启用「默认续命、task_complete 才停」
  }}
>
```

### `ask_user`：向用户询问并确认选择

用于方案取舍、危险写操作前确认、多路径决策等**任务中途**决策门。模型调用后：

1. Tool 返回信封 `kind: 'user_choice_request'`（**不是**业务写成功）
2. 聊天循环 **hard-stop**（`waiting_user_choice`），禁止 auto-continue / nudge
3. 助手消息中渲染 **Choice Card**（`UserChoiceCard`）
4. 用户提交后，SDK 通过 `sendMockUserMessage` 注入格式化消息并续跑 Agent

**参数摘要**：

| 字段 | 说明 |
|------|------|
| `question` | 展示给用户的问题 |
| `mode` | `single`（单选）或 `multi`（多选） |
| `options` | `{ id, label, description? }[]`，通常 2–5 项（推荐 3） |
| `allowCustom` | 是否显示「其他」输入；`single` 默认 `true`，`multi` 默认 `false` |
| `minSelect` / `maxSelect` | 仅 `multi`：最少 / 最多选择数 |

提交后写入对话历史的文案形如：

```text
【用户选择】
题：……
模式：单选
已选：opt_b（方案 B）
自定义：（无）
```

也可在宿主侧复用格式化工具：

```tsx
import { formatUserChoiceMessage, ASK_USER_TOOL } from '@eadaf/ai-base';
```

> **与「下一步建议」的边界**
>
> | 机制 | 时机 | UI |
> |------|------|-----|
> | `ask_user` | 任务**中途**决策门 | Choice Card（单选/多选 + 可选自定义） |
> | `a2ui-commands` / `task_complete.next_steps` | 阶段**完成后**的可选快捷动作 | A2UI 下一步按钮 |
>
> 禁止仅用「请确认后回复」等口头话术代替 `ask_user`（口头等待确认正则仍保留作兜底 hard-stop）。

全局行为约定写在 Framework Skill `aibase-chat-framework`；开启结构化终止时，系统提示还会注入含 `ask_user` 的执行协议。

---

## AISurface 与 UI 联动（Mutation）

页面注册 **Surface** 供 AI 读取上下文；Tool 写操作返回 **mutation** 后自动刷新 UI。

```tsx
import { useAISurface } from '@eadaf/ai-base';

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
import { useAIChatPrompts } from '@eadaf/ai-base';

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
import { useSetAIChatPrompts } from '@eadaf/ai-base';

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
import { useChatReference } from '@eadaf/ai-base';

const { addReference, removeReference, clearReferences, references } = useChatReference();

addReference({
  type: 'entity',
  label: '订单（实体）',
  content: { code: 'sales:order:Order', fields: [/* … */] },
  unique: true, // 同 type 仅保留最新一条
});
```

宿主应用中可配合 `ChatReferenceTarget` 组件（`className: chat-reference-target`）使用。

---

## 程序化发消息

打开 AI 面板并模拟用户发送（与手动点击发送相同流程）：

```tsx
import { sendMockUserMessage } from '@eadaf/ai-base';

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
import { AIChatDisplay } from '@eadaf/ai-base';
<AIChatDisplay mode="hidden"><LoginPage /></AIChatDisplay>

// 页面内 Hook（卸载后恢复 sidebar）
import { useAIChatDisplayMode } from '@eadaf/ai-base';
useAIChatDisplayMode('float');
```

---

## Tool 调用日志（开发）

开发环境可将 client / server Tool 调用输出到浏览器控制台与 dev 终端：

```tsx
import { setToolInvokeLogger, formatToolInvokeError } from '@eadaf/ai-base';

setToolInvokeLogger((entry) => {
  console.log(entry.success ? '✅' : '❌', entry.name, entry.error ?? entry.result);
});
```

宿主可在应用入口通过 `setToolInvokeLogger` / `setupAiToolDevLogger()` 接入。失败时 `entry.error` 已包含 API 返回的 `[HTTP status] message | details`。

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
| `exposeAllClientTools` | 否 | 调试：向 LLM 暴露全部本地 client Tool（忽略 Skill 关联限制） |
| `maxToolResultChars` | 否 | 单次 Tool 结果回灌上下文的字符预算上限，默认 `8000` |
| `enableStructuredTermination` | 否 | 开启后注入 `update_plan` / `task_complete`，并按结构化终止驱动循环（`ask_user` 始终可用，与本开关无关） |

---

## 主要导出

| 分类 | 导出 |
|------|------|
| Provider | `AIChatProvider`, `AIChatPageScope`, `AIChatDisplay`, `ChatReferenceProvider` |
| Hooks | `useAIChatLayout`, `useAIChatDisplayMode`, `useEffectiveAIChatConfig`, `useChatReference`, `useAIChatPrompts`, `useSetAIChatPrompts`, `useAISurface`, `useAIMutationHandler`, `useFunctionCall` |
| Tool 注册 | `registerFunctionCall`, `unregisterFunctionCall`, `getFunctionCallDef`, `getAllFunctionCalls`, `invokeFunctionCall`, `clearFunctionCalls`, `subscribeFunctionCalls` |
| Skill 策略 | `registerSkillCompletionPolicy`, `unregisterSkillCompletionPolicy`, `clearSkillCompletionPolicies`, `getSkillCompletionStrategy` |
| Harness Tool | `ASK_USER_TOOL`, `ASK_USER_OPENAI_TOOL`, `UPDATE_PLAN_TOOL`, `TASK_COMPLETE_TOOL`, `HARNESS_TOOL_NAMES`, `HARNESS_OPENAI_TOOLS` |
| 用户选择 | `formatUserChoiceMessage`, `isUserChoiceRequestData`；类型 `AskUserArgs`, `UserChoiceRequest`, `UserChoiceSubmission`, … |
| 结果预算 | `serializeToolResultForContext`, `resolveToolResultBudget` |
| 模型能力 | `supportsModelAttachments`, `supportsModelVoiceInput`, `MODEL_CAPABILITY_AUDIO_INPUT` |
| 消息 / 引用 | `sendMockUserMessage`, `sendAIChatMessage`, `formatMessageWithReferences` |
| 日志 | `setToolInvokeLogger`, `logToolInvoke`, `formatToolInvokeError` |
| SDK | `AIBaseClient` |
| 类型 | `AIChatConfig`, `AIChatPromptItem`, `FunctionCallDef`, `AIBaseSkill`, `AIBaseTool`, `SkillCompletionStrategy`, `ToolResponse`, … |

---

## 构建

```bash
pnpm build    # dist/index.js、dist/index.d.ts、dist/style.css
pnpm dev      # tsup --watch（宿主读 dist 联调时可用）
```

## 常见报错

**找不到某个 export**

确认 `dist` 已 build 且包含该导出；宿主侧执行 `pnpm refresh:ai-base`（若已配置）并重启 frontend dev。

**`Failed to resolve import "@ant-design/x"`**

peer 依赖（`antd`、`@ant-design/x` 等）须由宿主安装并可被本包解析。

**`react-is` does not provide an export named 'ForwardRef'`**

清宿主 `node_modules/.vite` 后重启 dev（Vite 侧可配置 `optimizeDeps.include`）。

**`setToolInvokeLogger 不可用`**

`dist` 过旧，执行 `pnpm build` 并刷新宿主依赖链接后重启 frontend dev。

---

## 目录结构

```text
src/
  provider/     AIChatProvider、AIChatPageScope、AIChatPromptsContext、ChatReferenceContext
  ui/           AIChatPanel、AssistantSegments、UserChoiceCard 及样式
  a2ui/         下一步建议 A2UI（NextStep）catalog / deck
  chat/         流式对话、useAIBaseChat、autoContinuePolicy、userChoice
  registry/     client Function Call、builtin harness Tools、Skill 加载
  hooks/        useSendAIChatMessage（deprecated，请用 sendMockUserMessage）
  utils/        aiChatBridge、formatChatReferences、toolInvokeLogger
  sdk/          AIBaseClient HTTP 封装
  config/       resolveConfig、默认 prompts / welcome
dist/           构建产物（宿主运行时加载）
```
