# ProTable 状态与 URL 同步 —— 统一解决方案

> **状态**：方案已出，待评审确认
> **日期**：2026-08-12
> **范围**：`frontend` 全部列表页（ProTable / UrlSyncedProTable），后端无改动
> **一句话目标**：把列表页的"分页、筛选、排序"等状态统一落到 URL 上，做到——翻页/过滤后进详情再返回，状态原样恢复；拿到 URL 直接访问，页面直接呈现对应内容（URL 直达）；浏览器前进/后退与列表状态一致。

---

## 一、背景与问题

### 1.1 问题来源

项目从 Umi 迁移到 Vite 后，Umi 内置的三项能力随之丢失：

- **URL State / Query Params 状态同步**（路由级 query 读写）
- **路由状态序列化**（数组、日期、枚举等 → URL 字符串）
- **表格状态与路由双向绑定**（ProTable 分页/筛选 ↔ 路由 query）

Vite 只提供"裸"的 `react-router-dom`（`useSearchParams`），序列化、双向绑定、状态恢复全部要自己搭。

### 1.2 根因

**ProTable 的表格状态（页码、筛选值、排序）只存在组件内存里**。列表页跳详情页（`navigate('/xxx/:id/edit')`）时列表组件卸载，返回时组件重新挂载，内存状态全部清零，重新回到第 1 页、空筛选。

### 1.3 用户可感知的问题场景

1. 列表翻到第 2 页 → 点行进详情 → 返回 → 掉回第 1 页；
2. 过滤条件（关键词 / 状态 / 日期区间 / 域）→ 点行进详情 → 返回 → 过滤丢失；
3. 把当前列表 URL 发给别人 / 存书签 → 打开后是空列表第 1 页，而不是"我要的那一页"；
4. 浏览器前进/后退在列表页内部无法表达"回到上次看的那一页"。

---

## 二、现状盘点（已核实）

### 2.1 技术栈

- React `19.2.0`，antd `6.4.4`，`@ant-design/pro-components` `2.8.10`（内部 `pro-table 3.21.0`）
- `react-router-dom` `7.18.0`，**声明式** `<BrowserRouter>` + `<Routes>`（`src/App.tsx`，非 `createBrowserRouter`）
- Vite `8` + pnpm；无 `nuqs`，无其他 URL 状态库

### 2.2 已有自研方案（此前"硬编码"的产物）

三件套，覆盖了约 20 个列表页（28 个引用 ProTable 的文件中，含工具组件与封装自身）：

| 文件 | 职责 |
|---|---|
| `src/utils/tableUrlHelper.ts`（152 行） | page/pageSize/筛选值 ↔ URLSearchParams 序列化（`page`/`pageSize`/`scope` 保留键） |
| `src/hooks/useUrlQueryState.ts`（164 行） | `useTableUrlState` / `useUrlPagination` / `useScopeFromUrl` / `usePatchSearchParams` |
| `src/components/UrlSyncedProTable/index.tsx`（330 行） | ProTable 封装：分页受控于 URL、筛选回填、request 包装、搜索区收起（走 `useProTableSearchCollapse` + localStorage） |

另有：`scope`（域树选择）已入 URL（键 `scope`）；搜索区收起/展开状态存 localStorage（`useUserHabit`），**不打算搬进 URL**。

**关键事实：项目存在两种数据模式并存**（直接影响 URL 驱动的设计，见 6.4）：

| 模式 | 特征 | 代表页面 |
|---|---|---|
| **request 模式**（后端分页/搜索） | `request` 接收 `current/pageSize/筛选`，后端分页 | AIManagement 六个页面、Metrics、Member、Role、Buckets、Browser、Applications、ExceptionResponses 等（约 19 个文件含 `request=`） |
| **dataSource 模式**（页面自管） | 页面全量拉取（如 `size:-1`）+ 前端过滤/前端分页，ProTable 只做展示 | ApiServices/List（`loadData` + `filteredServices`）、MaterializedTableList、CollectionPipelines 等 |

### 2.3 仍未迁移的 ProTable 页面（问题重灾区）

以下页面还是裸 `ProTable`，翻页/过滤完全不进 URL：

- `src/pages/MemberOrg/Organization/index.tsx`（组织架构：树形表 `pagination={false}`，其"状态"主要是展开行——按 3.1 不进 URL；用户在该页感知到的更多是过滤条件丢失）
- `src/pages/MemberOrg/Role/index.tsx`（角色：request + 分页模式，**"翻页→详情→返回丢失"的典型场景**）
- `src/pages/Permissions/BuiltinApi/index.tsx`（内置 API 权限）
- `src/pages/Permissions/components/PermissionTable/index.tsx`（权限表格子组件）
- `src/pages/BusinessData/Materialization/components/DatabaseConnectionManager.tsx`（数据库连接）
- `src/pages/BusinessData/Materialization/TableBrowse/Schema.tsx`（表结构预览）

### 2.4 现有自研方案的缺陷（代码级，逐条核实）

1. **时序竞态靠 ref + setTimeout 硬扛**：`UrlSyncedProTable` 内部有 `urlPaginationGuardRef` / `skipInitialReloadRef` / `prevUrlPageRef` / `pageRef` / `pageSizeRef` **5 个 ref** + 400ms 定时器来区分"用户翻页"与"URL 回填导致的翻页"，极易出边界 bug（快速连点、前进/后退、reload 撞车）；
2. **日期/对象序列化不可用**：`tableUrlHelper.serializeFilterValue` 对 `dayjs`/对象直接 `JSON.stringify`，RangePicker 会写出 `{"$L":...}` 之类的不可逆字符串，读回后无法还原成 `dayjs`。目前搜索区还没有日期筛选字段（现有 `dateTime` 类型多为**列展示**），所以该 bug 尚未爆发，但 URL 状态方案必须支持日期/区间筛选（后续必用）；
3. **排序（sorter）没有同步**：`onChange` 只透传，排序状态不进 URL；ProTable 的列排序默认非受控，无法从 URL 恢复；
4. **`manualRequest` 未处理 + 首次请求时机不统一**：request 模式页面在"搜索区存在"时，挂载会先用默认值（current=1、空筛选）自动发一次请求，URL 回填后再 reload 第二次——重复请求 + 首屏闪烁（URL 直达场景下最明显）；而 dataSource 模式页面由各自 `useEffect` 触发拉取，时机五花八门；
5. **多实例冲突**：同页放多个表格（或将来拆分组件）时 `page`/`pageSize` 等键全局共享，互相踩；
6. **表单回填时序**：筛选回填靠 `useEffect` + `form.setFieldsValue`，首次挂载表单实例未就绪时会静默失效；
7. **双数据源**：请求参数在 `urlFormValues` 与 `readFormValues()`（实时读表单）之间切换，一致性脆弱。

> 结论：现有自研方案**方向正确**（URL 为唯一数据源、分页受控、保留键），但**实现层缺陷多、扩展性差**（不支持排序/日期/多实例/manualRequest）。在此基础上做局部修补只会继续积累 guard 逻辑，应借这次机会重构为"成熟库 + 薄胶水"。

---

## 三、需求与非目标

### 3.1 需要同步到 URL 的状态

| 状态 | 是否入 URL | 说明 |
|---|---|---|
| 分页 `page` / `pageSize` | ✅ | 键名 `page` / `pageSize`（沿用现状） |
| 搜索表单筛选值 | ✅ | 字符串、数字、枚举、多选数组、日期、日期区间 |
| 排序 `sorter` | ✅ | `sort=字段:asc\|desc`（可多字段，本期先单字段） |
| 域/作用域 `scope` | ✅ | 沿用现有 `scope` 键 |
| 搜索区收起/展开 | ❌ | 用户偏好，继续走 localStorage（`useUserHabit`） |
| 选中行 / 展开行 | ❌ | 页面内瞬态，不进 URL（树形表展开行如需恢复，可后续单独评估，本期不做） |
| 编辑中的表单草稿 | ❌ | 详情/编辑页表单不纳入（本期范围外） |

### 3.2 非目标

- 不改后端分页协议（保持 `offset=(page-1)*size`、1-based）；
- 不做 SSR/loader 预取（纯 SPA）；
- 不把详情/编辑页的表单状态纳入 URL；
- 不迁移到 `@tanstack/react-table` 等整套表格换血（成本过高，ProTable 生态已深入项目）。

---

## 四、方案选型（三选一）

### 4.1 方案 A：nuqs 做 URL 状态基础设施 + 自研薄 ProTable 胶水层（推荐）

**选型依据见第五节 nuqs 评估**。核心思路：

- **nuqs 负责**：query 的解析/序列化（类型安全）、history 策略（replace/push）、URL 更新节流（浏览器 History API 限流）、`clearOnDefault`（默认值不写 URL）、key 隔离（只 watch 本表相关键）；
- **自研胶水层只负责**：把"表格状态 ↔ nuqs 状态"的映射与 ProTable 的请求时机桥接（这是 nuqs 不做、也做不了的部分）。

> 一句话：**nuqs 解决"URL 状态库"这一半，ProTable 绑定这一半仍需自研，但能比现在薄一个量级**（不再需要 5 个 ref + 400ms 定时器）。

### 4.2 方案 B：不引依赖，把现有三件套重构成熟

- 修补 `tableUrlHelper` 序列化（日期/数组/枚举）、给 `UrlSyncedProTable` 加 sorter/manualRequest/多实例支持、重写竞态守卫；
- 优点：零新依赖；缺点：所有基础设施（节流、key 隔离、history 边界、类型推导）都要自己造，工期与风险都高于 A；
- 适合"团队强烈排斥新依赖"的情况。

### 4.3 方案 C：维持现状，继续打补丁

- 只迁移剩余 6 个页面到现有 `UrlSyncedProTable`；
- 缺点：2.4 的七条缺陷原样保留，日期筛选依然是坏的，排序/URL 直达依旧无解。**不推荐**。

### 4.4 结论

**推荐方案 A**。理由：
1. nuqs 是当前 React 生态事实上的 URL 状态标准库（Type-safe search params state manager），React 19 与 react-router v7 均有官方适配，维护活跃；
2. 把"通用、与业务无关"的部分（解析/节流/history/类型）交给久经考验的库，把"与 ProTable 强相关"的部分留在项目内，职责清晰；
3. 现有三件套的知识资产（键名约定、scope 保留、页面接入方式）可以平滑迁移，页面改动量小。

---

## 五、nuqs 评估结论（已核实 2.9.5）

### 5.1 兼容性（✅ 全部满足）

- **版本**：`nuqs@2.9.5`（2026-08 时点 latest）；
- **React 19**：peer 声明 `react >=18.2.0 || ^19.0.0-0` ✅；
- **react-router v7**：内置适配器 `nuqs/adapters/react-router/v7`，peer 声明 `react-router ^5 || ^6 || ^7 || ^8` ✅；
- **声明式 `<Routes>` 可用**：已读源码确认，v7 适配器基于 `useSearchParams` + `patchHistory`（包装 `history.pushState/replaceState`）+ `popstate` 监听实现，**不依赖** `createBrowserRouter`/`RouterProvider`。用法：`<BrowserRouter>` 内侧包 `<NuqsAdapter>` 即可（对应 `src/App.tsx`）。

### 5.2 能力清单（与本需求相关的部分）

| 能力 | 说明 | 对应需求 |
|---|---|---|
| `useQueryState` / `useQueryStates` | 单键/多键 URL 状态，`URL 是唯一数据源` | 核心 |
| `parseAsInteger/String/Float/Boolean/StringEnum/ArrayOf/Json/IsoDate/IsoDateTime/Timestamp` 等 | 类型安全解析器；`withDefault` 默认值**不写进 URL** | 筛选序列化 |
| `createParser({ parse, serialize, eq })` | 自定义解析器（如 dayjs、枚举、区间） | 日期/复杂值 |
| `urlKeys` | 重命名 URL 键，**天然支持多实例前缀** | 多表格同页 |
| `history: 'replace' \| 'push'` | 默认 replace（列表内部状态变化不污染历史栈）；push 用于需要后退的场合 | 翻页→详情→返回 |
| `limitUrlUpdates` / `throttleMs` | URL 更新节流，默认 50ms（Safari 建议 ≈120ms） | 高频输入防抖 |
| `clearOnDefault`（默认 true） | 设为默认值时清除该键，URL 保持干净 | URL 直达/分享 |
| key 隔离（watchKeys） | 每个 hook 只响应自己声明的键，无关 URL 变化不触发重渲染 | 多实例性能 |
| `inferParserType` | 从 parser 组推导 TS 类型 | 类型安全 |

### 5.3 边界与坑（必须写进实施计划）

1. **nuqs 不做 ProTable 绑定**。它给的是"URL 状态"这层，`pagination.current` 受控、`request` 时机、`manualRequest`、表单回填等 ProTable 桥接仍需自研胶水（见第六节）；
2. **pnpm 幽灵依赖**：v7 适配器从 `react-router` import（不是 `react-router-dom`）。pnpm 严格 node_modules 下必须**显式声明 `react-router` 为 frontend 直接依赖**（当前项目只声明了 `react-router-dom`），否则适配器解析失败；
3. **`parseAsArrayOf` 默认逗号分隔**，且 item 会 URI 编码；日期区间要自定义为 `ISO,ISO`（或时间戳）以免与分隔符冲突；
4. **`parseAsBoolean` 语义**：只把字符串 `'true'` 解析为 `true`，其余按默认值处理——布尔筛选用"键存在与否"建模更稳（`withDefault(false)` 或自定义）；
5. **URL 长度**：筛选字段多或值长时 URL 可能超 2KB 限制，需"只同步常用筛选 + 白名单"（现状 `urlFilterKeys` 已是白名单思路，保留）；
6. **nuqs 2.x 较新**（2.9.5），API 仍在演进：锁定版本、升级时看 changelog；
7. **Safari History API 限流更严**：URL 更新节流建议全局设 120ms 起步，避免 iOS Safari 丢历史条目。

---

## 六、目标架构（方案 A 详细设计）

### 6.1 分层

```
┌─ L3 页面 ─────────────────────────────────────┐
│ 声明 urlState 配置（字段名/类型/URL 键）        │
│ <UrlSyncedProTable v2 urlState={...} request=…>│
├─ L2 胶水层（自研，项目内）─────────────────────┤
│ UrlSyncedProTable v2 + useProTableUrlState    │
│ 表格状态↔URL 映射、request 时机、manualRequest │
├─ L1 状态定义层（自研，项目内）─────────────────┤
│ 字段类型→parser 映射（valueType registry）     │
│ key 命名约定 + 多实例前缀 + 保留键(scope 等)   │
├─ L0 基础设施（nuqs + react-router v7 适配器）─┤
│ NuqsAdapter 挂载、useQueryStates、节流/history │
└──────────────────────────────────────────────┘
```

### 6.2 数据流（核心原则：URL 是唯一数据源）

- **读**：组件不保存分页/筛选状态，全部从 URL 解析（`useQueryStates` + parser 组）→ 受控给 ProTable；
- **写**：用户操作（翻页/改筛选/点排序）→ 更新 URL（`replace`）→ URL 变化 → 触发一次请求；
- **跳详情**：`navigate('/xxx/:id/edit')`（默认 push）——列表 query 保留在 URL 里，返回时 `popstate` 恢复，组件按 URL 重新挂载出原状态；
- **URL 直达**：首次挂载即从 URL 解析出完整状态（page/filter/sort）→ 回填表单 → 发一次请求，**不先发默认请求**（依赖 6.4 的 manualRequest 处理）；
- **前进/后退**：`popstate` → URL 变化 → 重新请求，天然一致。

### 6.3 history 策略

- 列表内部状态变化一律 `replace`（避免历史栈被翻页刷满）；
- 详情/编辑跳转用 `push`（react-router 默认）；
- 可选增强：筛选提交用 `push` 让"查询"可后退（`useQueryStates(..., { history: 'push' })` 或调用时覆盖）——**本期默认 replace，列为可选开关**。

### 6.4 ProTable 的 manualRequest（manual:true）问题 —— 专项设计

已读 `pro-table@3.21.0` 源码，机制确认如下（仅 request 模式涉及）：

- `manualRequest=true` 时：内部 `formSearch` 初始为 `undefined` → `useFetchData` 的 `manual=true` → `manualRequestRef` 初始 `true`，**第一次 fetchList 直接 return（不发请求）**；
- 之后必须 `actionRef.current.reload()` 触发，reload 会把 `manualRequestRef` 置 `false`，后续请求正常；
- `request` 模式下请求副作用 = `[stringify(params), stringify(formSearch), stringify(proFilter), stringify(proSort)]`，任一变化 → 防抖后自动 fetchList；分页变化走 `onPageInfoChange`。

**胶水层决策（按模式区分）**：

1. **request 模式：封装内部默认开启 manualRequest 语义**（不向页面暴露），页面无需感知：
   - 挂载时由"URL 已解析出的状态"决定是否发请求——URL 里有 page/筛选/排序 → 回填后立即 `reload()`；URL 全空 → 直接发默认请求（等于现在不带 manualRequest 的行为），**不产生"默认请求 + 回填重发"的重复**；
   - 关键实现点：等待 ProTable 表单实例就绪后再 `setFieldsValue` + `reload()`（比现有"useEffect 里碰运气"可靠）；
2. **dataSource 模式：胶水层只做 URL 状态读写，不编排请求**——页面已自行 `useEffect` 监听 URL 状态拉数据（如 ApiServices/List 的 `useTableUrlState → listFilters → loadData`），胶水层保证"URL 状态 → 受控分页/筛选回填"一致即可，不重复触发请求；
3. 对外保留透传 `manualRequest` 的能力（个别页确实需要完全手动触发），此时胶水层只做 URL 读写、不做请求编排；
4. 竞态防护：请求序号（递增 id）或 `AbortController` 丢弃过期响应；筛选防抖复用 ProTable 自带 `debounceTime` + nuqs 节流。

> 注意：dataSource 模式下的**前端分页**（如 ApiServices/List 全量 `size:-1` 后前端翻页）在数据量大时并非最优，但属于后端分页改造范畴，**本期不做**，仅保证 URL 状态一致。

### 6.5 序列化设计（valueType → parser 映射）

在 L1 建一个"字段类型注册表"，页面声明 `valueType` 即可，避免每页手写 parse/serialize：

| 字段类型（valueType） | nuqs parser | URL 示例 |
|---|---|---|
| `string` | `parseAsString.withDefault('')` | `?keyword=abc` |
| `number` | `parseAsInteger` / `parseAsFloat` | `?age=18` |
| `boolean` | `parseAsBoolean.withDefault(false)`（或自定义"键存在"型） | `?enabled=true` |
| `enum` | `parseAsStringEnum(枚举值列表)` | `?status=published` |
| `array`（多选/标签） | `parseAsArrayOf(parseAsString, ',')` | `?tags=a,b,c` |
| `date` | `parseAsIsoDateTime`（dayjs 转换层） | `?date=2026-08-12T00:00:00Z` |
| `dateRange`（区间） | 自定义：`parseAsArrayOf(parseAsIsoDateTime, ',')`，序列化为 `start,end` | `?range=2026-08-01,2026-08-12` |
| `json`（复杂对象，谨慎） | `parseAsJson` | `?cfg=%7B...%7D` |
| 自定义 | `createParser({ parse, serialize, eq })` | — |

约定：
- 时间统一 UTC ISO-8601 入库（dayjs ↔ Date 在胶水层互转），展示层本地化，避免时区错乱；
- 键名默认与字段 `dataIndex` 一致，可用 `urlKeys` 重命名/加前缀（多实例：`urlKeys={{ page: '左表page', ... }}`，或统一前缀函数）；
- 保留键（`scope` 等）继续豁免，不被表格覆盖（沿用 `DEFAULT_RESERVED_URL_KEYS` 概念，迁移到 L1）。

### 6.6 排序（sorter）同步

- 读取：URL `sort=field:order`（单字段本期，多字段预留 `sort=field1:asc,field2:desc`）；
- 写入：ProTable `onChange(_, __, sorter)` 捕获 → 写 URL（replace）→ URL 变化触发重新请求；
- 恢复：列配置需要受控——为 `columns` 注入 `sortOrder`（从 URL 解析），antd Table 的列 `sortOrder` 为受控属性，ProTable 透传；
- **实施时验证点**：ProTable 在"受控 sortOrder + request"组合下是否有额外触发请求，若与 URL 驱动重复，用 6.4 的竞态防护统一兜住。

### 6.7 多实例与命名空间

- 每个表格实例声明 `urlKeys` 前缀（如 `devicesPage`、`usersPage`）或独立键名，避免同页多表互踩；
- nuqs 的 `useQueryStates` + `urlKeys` 天然支持，不需要自研命名空间；
- 单实例页面可不加前缀，保持 URL 友好（`?page=2&status=ok`）。

### 6.8 保留现状（不迁移）

- `scope`（域树）键、搜索区收起（localStorage）、`DEFAULT_PRO_TABLE_OPTIONS`、`useProTableSearchCollapse` 均保留；
- 现有 `tableUrlHelper` / `useUrlQueryState` 中仍被非表格页面（如 `TableBrowse/Data`）使用的能力，保留薄壳或收编进 L1，避免破坏性移除。

---

## 七、实施计划（分阶段）

### 阶段 0：准备与验证（0.5 天）

1. 安装 `nuqs`（锁版本 2.9.x）；把 `react-router` 显式加入 `frontend/package.json`（pnpm 幽灵依赖，见 5.3-2）；
2. `App.tsx` 中 `<BrowserRouter>` 内侧挂 `<NuqsAdapter>`；
3. 写一个最小 demo 页验证：`useQueryStates` 读写、`history` 策略、`popstate`、URL 直达。

### 阶段 1：L1 状态定义层（1~2 天）

4. 新建"字段类型注册表"（valueType → parser，含 dayjs/区间/枚举/数组）；
5. 迁移 key 约定与保留键（`page`/`pageSize`/`scope`）到 L1，保留对外兼容壳；
6. 提供 `urlKeys` 前缀工具（多实例）。

### 阶段 2：L2 胶水层 —— UrlSyncedProTable v2（2~3 天）

7. 基于现有组件重构：去掉 5 个 ref + 400ms 守卫，改为"URL 驱动一切"；
8. 实现 manualRequest 编排（6.4）、筛选回填时序（等表单就绪）、sorter 同步（6.6）、竞态防护（请求序号）；
9. 保留现有 props 兼容层（`urlFilterKeys`/`urlArrayKeys`/`syncUrl` 等），让已接入页面低改动迁移。

### 阶段 3：页面迁移（2~3 天）

10. 优先迁移 6 个裸 ProTable 页面（2.3 清单，用户反馈的重灾区）；
11. 审计其余 20 个已接入页面：确认搜索区筛选字段类型（当前以关键词/枚举为主，`dateTime` 多为列展示），为后续日期/区间筛选预留 parser；统一 pageSize 默认值；补遗漏的 sorter。

### 阶段 4：测试与回归（1~2 天）

12. 测试矩阵（见第八节）；
13. 重点回归：快速连点翻页、前进/后退、URL 直达刷新、多实例页、Safari。

---

## 八、验收标准（测试矩阵）

每个列表页（至少覆盖 2.3 的 6 个页面 + 2 个含日期筛选的页面）必须通过：

| # | 场景 | 期望 |
|---|---|---|
| 1 | 翻到第 3 页 → 点行进详情 → 浏览器返回 | 回到第 3 页，筛选不变 |
| 2 | 设置过滤（含日期区间；当前搜索区暂无日期字段则用枚举/多选替代）→ 进详情 → 返回 | 过滤条件与结果原样恢复 |
| 3 | 复制当前 URL 到新标签打开 / 刷新 | 直接呈现该页该筛选的结果（URL 直达） |
| 4 | 浏览器前进/后退 5 次 | 每次与 URL 状态一致，无重复请求/白屏 |
| 5 | 快速连续翻页 5 次 | 只发最后一次请求，无错乱（竞态防护生效） |
| 6 | 点列排序 → 进详情 → 返回 | 排序保持 |
| 7 | 同页两个表格（如有） | 互不干扰（前缀隔离） |
| 8 | 设置默认筛选值 | URL 中不出现该键（clearOnDefault） |
| 9 | Safari / iOS | URL 更新不丢历史、状态恢复正常 |
| 10 | 后端请求次数 | 挂载/回填不产生"默认请求 + 重复请求" |

---

## 九、风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| nuqs 2.x API 演进 | 升级破坏 | 锁定版本，升级看 changelog；胶水层集中收口，页面不直接依赖 nuqs API |
| pro-table 内部时序黑盒（manualRequest/受控分页/排序组合） | 边界行为难料 | 阶段 0 先做最小 demo 验证；5 个 ref 移除后统一竞态防护；测试矩阵覆盖 |
| 日期/时区序列化错乱 | 查询结果错 | 一律 UTC ISO 入库 + dayjs 转换层，展示本地化 |
| URL 超长 | 部分环境截断 | 白名单同步常用筛选（现状已如此），必要时压缩/省略次要字段 |
| 20 个已接入页面回归风险 | 改动量大 | 渐进迁移（先 6 个裸页面），保留 props 兼容层，每页独立验证 |
| pnpm 幽灵依赖（react-router） | 构建/运行时解析失败 | 显式声明依赖，阶段 0 验证 |

---

## 附录 A：关键源码事实（供实施参考，均已核实）

- **pro-table 3.21.0**（`node_modules/.pnpm/@ant-design+pro-table@3.21.0_*/node_modules/@ant-design/pro-table/es/`）
  - `typing.d.ts:301` — `manualRequest?: boolean`（ProTableProps 级属性，旧文档常写作 `manual`）；
  - `Table.js:349` — `manualRequest || search !== false` 时 `formSearch` 初始 `undefined`，不触发首次加载；
  - `Table.js:453` — `manual: formSearch === undefined` 传给 `useFetchData`；
  - `useFetchData.js:80,185` — `manualRequestRef` 初始 true，首次 fetchList 直接 return；reload 后置 false；
  - `useFetchData.js` effects — `[stringify(params), stringify(formSearch), stringify(proFilter), stringify(proSort)]` 任一变化触发防抖请求；分页走 `onPageInfoChange`。
- **nuqs 2.9.5**（`node_modules/.pnpm/nuqs@2.9.5/`）
  - 适配器导出：`nuqs/adapters/react-router/v7` → `NuqsAdapter` / `useOptimisticSearchParams`；基于 `useSearchParams` + `patchHistory`（包装 pushState/replaceState）+ `popstate`，不依赖 `createBrowserRouter`；
  - `parseAsArrayOf(itemParser, separator=',')`，item URI 编码；
  - `Options`：`history`（默认 replace）、`limitUrlUpdates`/`throttleMs`（默认 50ms，Safari ≈120ms）、`clearOnDefault`（默认 true）、`scroll`、`shallow`（默认 true）；
  - `useQueryStates(parsers, { urlKeys })` 支持键重命名/前缀；key 隔离按 hook 声明键生效。

## 附录 B：迁移后各文件职责

| 文件（建议） | 职责 |
|---|---|
| `src/utils/tableUrlState/parsers.ts` | 字段类型注册表（valueType → nuqs parser） |
| `src/utils/tableUrlState/keys.ts` | 键名约定、保留键、多实例前缀工具 |
| `src/hooks/useProTableUrlState.ts` | L2 胶水：表格状态 ↔ URL 状态桥接（供组件与手写表格复用） |
| `src/components/UrlSyncedProTable/index.tsx` | 升级为 v2：内部调用 useProTableUrlState，保留 props 兼容 |
| `src/utils/tableUrlHelper.ts` / `src/hooks/useUrlQueryState.ts` | 保留薄壳供非表格场景（TableBrowse/Data 等），不再承载表格主逻辑 |
