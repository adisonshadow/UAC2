# 页面修改 TODO

> 按页面分组，列出每个页面需要做的修改。
> 引用规范以 `[规范 X.Y]` 标注，参考规范文档 PAGE_LAYOUT_STANDARD.md。

---

## 通用基础设施（需优先完成）

### G-1: 全局"新建"按钮样式
- **位置**: `src/global.scss` 或新建 `src/styles/btn-gradient.less`
- **描述**: 定义 `.btn-gradient-primary` 全局 CSS 类，用于所有页面"新建"按钮。
- **引用**: [规范 1.2]

### G-2: 修改 TABLE_ACTION_COLUMN_BASE 操作列右对齐
- **位置**: `src/components/TableActions/index.tsx`
- **描述**: 将 `align: 'center'` 改为 `align: 'right'`；将 `TableActions` 组件的 `justifyContent: 'center'` 改为 `justifyContent: 'flex-end'`。
- **影响范围**: 所有使用 `TABLE_ACTION_COLUMN_BASE` 的页面
- **引用**: [规范 1.3]

### G-3: 全局 `noContentPadding` 支持确认
- **位置**: `src/layouts/AppLayout.tsx`（或主布局组件）
- **描述**: 确保路由配置中 `noContentPadding: true` 的页面（model-design, metrics/dashboard）不额外增加 padding。

---

## 各页面修改

### P1: `/member_org/member` — 成员管理

| # | 修改项 | 描述 |
|---|--------|------|
| P1-1 | 按钮样式 | "新建"按钮使用全局渐变样式 `.btn-gradient-primary` |
| P1-2 | 操作列对齐 | 依赖 G-2 全局修改（当前 `align: 'center'`，需改为 right） |
| P1-3 | Schema 文件 | 已有 `Schemas/index.tsx` ✅ 无需修改 |

---

### P2: `/member_org/organization` — 组织架构管理

| # | 修改项 | 描述 |
|---|--------|------|
| P2-1 | 按钮样式 | "新建"按钮使用全局渐变样式 |
| P2-2 | 操作列对齐 | 依赖 G-2 |
| P2-3 | **自定义搜索 → ProTable 内置 search** | 当前使用自定义 `SearchForm` 组件且 `search={false}`，应改用 ProTable 内置 search。移除 `SearchForm` 占位的 `headerTitle`，改用 `headerTitle="组织架构管理"` 加正式 `search` 配置 |
| P2-4 | Schema 文件 | 已有 `Schemas/index.tsx` ✅ |

---

### P3: `/member_org/role` — 角色管理

| # | 修改项 | 描述 |
|---|--------|------|
| P3-1 | 按钮样式 | "新建"按钮使用全局渐变样式 |
| P3-2 | 操作列对齐 | 依赖 G-2 |
| P3-3 | **自定义搜索 → ProTable 内置 search** | 当前 `search={false}` + 自定义 `SearchForm`，改为 ProTable 内置 search，移除自定义 `Radio.Group` 状态筛选，改为列级 `valueEnum` 过滤 |
| P3-4 | **新建/编辑禁止 Drawer** | 当前新建角色用 Modal ✅（可保留），但编辑/详情使用 Drawer ❌。详情/编辑应改为独立新页面（路由 `/member_org/role/:id/edit`），或保留 Modal 形式但移除 Drawer。引用 [规范 1.9] |
| P3-5 | Schema 文件 | 已有 `schema.tsx` ✅ |

---

### P4: `/permissions/menu` — 菜单权限
### P5: `/permissions/button` — 按钮权限
### P6: `/permissions/api` — 内置 API 权限

三个页面共用 `PermissionTable` 组件。

| # | 修改项 | 描述 |
|---|--------|------|
| P4/5/6-1 | 按钮样式 | 新建按钮使用全局渐变样式 |
| P4/5/6-2 | 操作列对齐 | 依赖 G-2 |
| P4/5/6-3 | **自定义搜索 → ProTable 内置 search** | 当前使用自定义 `SearchForm` + `search={false}` + 颜色透明度模拟状态行。改为 ProTable 内置 search，状态筛选使用列级 `valueEnum` + `search` 带过滤 |
| P4/5/6-4 | **新建/编辑禁止 Drawer** | 当前权限详情使用 Drawer ❌，新建使用 Modal ✅（可保留）。编辑应改为新页面或 Modal，移除 Drawer |
| P4/5/6-5 | Schema 文件 | 当前列定义直接在组件中。应抽取独立 `schema.tsx` 文件 |
| P4/5/6-6 | 自定义 Radio 状态筛选 | 当前顶部 `Radio.Group`（有效/全部）应移除，改用 ProTable search 的列级 `valueEnum` 过滤 |

---

### P7: `/permissions/builtin-api` — 内置 API 权限

| # | 修改项 | 描述 |
|---|--------|------|
| P7-1 | **PageContainer 标题** | 当前 `pageHeaderRender` 未定义，默认显示面包屑和标题。添加 `pageHeaderRender={() => <></>}` |
| P7-2 | **移除自定义刷新按钮** | 当前 `toolBarRender` 中有 "刷新" 按钮，但 ProTable `options` 已包含 `reload: true`。移除自定义刷新按钮 |
| P7-3 | **Tree 折叠图标问题** | 当前有多层域节点（doman -> subdomain -> API），部分 API 节点不正确地显示折叠图标。检查 `buildTreeRows` 中 `isLeaf` 属性设置，确保叶子节点 `children: undefined` 并隐藏折叠图标 |
| P7-4 | 操作列对齐 | 当前操作列使用 `align: 'right'` 已符合 ✅，但可能受 G-2 全局影响需调整 |
| P7-5 | Schema 文件 | 列定义在组件内部。应抽取独立 `schema.tsx` |

---

### P8: `/business_data/metrics` — 指标管理

| # | 修改项 | 描述 |
|---|--------|------|
| P8-1 | **改为 2 列模式（Splitter）** | 当前使用 `PageContainer + Card + CodePathTreeTable` 单纯列表模式，应改为 2 列 Splitter 布局：左侧为 Scope 树导航（使用图标区分，移除"类型"列），右侧为指标详情或表格 |
| P8-2 | **不使用 PageContainer** | 改为 2 列模式后移除 PageContainer，直接使用 `<div style={{ height: 'calc(100vh - 56px)' }}>` + Splitter |
| P8-3 | **左侧导航简洁化** | 移除"类型"列，用图标区分（`<CalculatorOutlined />` 表示指标，`<DatabaseOutlined />` 表示数据实体） |
| P8-4 | **Scope / 指标列垂直排列** | 当前 "Scope / 指标" 列显示 "文章分类数 content:article:category_count" 一行展示，应改为 `<Space direction="vertical" size={0}>` 分两行 |
| P8-5 | 按钮样式 | "新建指标"使用全局渐变样式 |

---

### P9: `/business_data/metrics/create` — 新建指标
### P10: `/business_data/metrics/:id/edit` — 编辑指标

| # | 修改项 | 描述 |
|---|--------|------|
| P9/10-1 | 已使用新页面 ✅ | 符合规范，无需修改 |
| P9/10-2 | 检查表单页是否使用 `PageContainerTitleWithBack` | 已使用 ✅ |

---

### P11: `/business_data/metadata` — 元数据

| # | 修改项 | 描述 |
|---|--------|------|
| P11-1 | **替换为 Splitter 2 列布局** | 当前使用 `Row/Col 10/14` + `PageContainer title`，应改为 Splitter 布局，左右独立 Scroll |
| P11-2 | **移除 PageContainer** | 2 列模式不使用 PageContainer |
| P11-3 | **左侧独立 Scroll + 正确高度** | 左右面板高度应为 `calc(100vh - 56px)`，当前没有独立 Scroll，宽高均不对 |
| P11-4 | **左侧导航简洁化** | 左侧 CodePathTreeTable 当前有"类型"列（显示"数据实体"/"指标"/"枚举"），应移除该列，用图标区分（`<DatabaseOutlined />` 实体、`<CalculatorOutlined />` 指标、`<FileTextOutlined />` 枚举） |
| P11-5 | **垂直排列** | 左侧 "Scope / 逻辑元数据" 列中 scope:entity 应分两行垂直排列 |

---

### P12: `/business_data/materialization/execute` — 执行物化

| # | 修改项 | 描述 |
|---|--------|------|
| P12-1 | **宽高修正** | 当前使用 `<PageContainer pageHeaderRender={() => <></>}>` + `<Splitter style={{ height: 'calc(100vh - 120px)' }}>`，高度和宽度均不对。2 列模式应：移除 PageContainer，高度改为 `calc(100vh - 56px)`，水平无 margin |
| P12-2 | **移除 PageContainer** | 2 列模式不应用 PageContainer 包裹 |
| P12-3 | **垂直排列** | 左侧树节点 "物化配置" 区域实体列表的 scope + 名称应分两行垂直排列 |

---

### P13: `/business_data/model-design` — 数据模型设计

| # | 修改项 | 描述 |
|---|--------|------|
| P13-1 | 已使用 Splitter ✅ | 符合规范 |
| P13-2 | 已不使用 PageContainer ✅ | 符合规范 |
| P13-3 | 高度 `calc(100vh - 56px)` ✅ | 符合规范 |
| P13-4 | 按钮样式 | "新建实体" 按钮使用渐变样式（非 primary 可保留，但若 primary 应渐变） |

---

### P14: `/business_data/data-standards` — 数据标准

| # | 修改项 | 描述 |
|---|--------|------|
| P14-1 | **PageContainer 标题** | 当前 `<PageContainer title="数据标准">`，列表页不应显示标题。改为 `pageHeaderRender={() => <></>}` |
| P14-2 | **新建/编辑禁止 Drawer** | 当前使用 Drawer ❌。改为新页面路由或 Modal ✅。字段简单可用 Modal |
| P14-3 | 按钮样式 | "新建数据标准"使用全局渐变样式 |
| P14-4 | 操作列对齐 | 依赖 G-2 |
| P14-5 | Schema 文件 | 已有 `schema.tsx` ✅ |

---

### P15: `/business_data/database` — 数据库预览

| # | 修改项 | 描述 |
|---|--------|------|
| P15-1 | **PageContainer 标题** | 检查是否显示标题。若是列表页，应隐藏 |

---

### P16: `/business_data/collection-pipelines` — 采集结构化（API 服务菜单下）

| # | 修改项 | 描述 |
|---|--------|------|
| P16-1 | **PageContainer 标题** | 当前 `<PageContainer title="采集数据结构化">`，列表页不应显示标题。改为 `pageHeaderRender={() => <></>}` |
| P16-2 | 按钮样式 | "新建管道"使用全局渐变样式 |
| P16-3 | 操作列对齐 | 依赖 G-2 |
| P16-4 | Schema 文件 | 列定义在页面组件内。应抽取独立 `schema.tsx` |

---

### P17: `/api_services/list` — API 服务列表

| # | 修改项 | 描述 |
|---|--------|------|
| P17-1 | **改为 Splitter 2 列布局** | 当前使用 Card + Card 模拟左右布局，高度和宽度不满足规范。改为 Splitter，左侧为域树（可折叠），右侧为 ProTable |
| P17-2 | **PageContainer 已隐藏 ✅** | 已使用 `pageHeaderRender={() => <></>}` |
| P17-3 | **Tree 折叠图标问题** | 左侧 `ApiServiceDomainTree` 中叶子节点（API 节点）有时仍显示折叠图标。检查 `ApiDomainTreePicker` 中 `isLeaf: !!item.isApiNode` 确保叶子节点不显示 expand icon |
| P17-4 | 按钮样式 | "新建"使用全局渐变样式 |
| P17-5 | Schema 文件 | 列定义在组件内部 (`columns` 函数)。应抽取独立 `schema.tsx` |

---

### P18: `/file_storage/browser` — 文件浏览器

| # | 修改项 | 描述 |
|---|--------|------|
| P18-1 | **缺少 PageContainer + headerTitle** | 当前整个页面没有 PageContainer 包裹，也没有 `headerTitle`。添加 `<PageContainer pageHeaderRender={() => <></>}>` 包裹 ProTable，并设置 `headerTitle="文件浏览器"` |
| P18-2 | 按钮样式 | "上传文件"使用全局渐变样式 |
| P18-3 | 操作列对齐 | 依赖 G-2 |
| P18-4 | Schema 文件 | 列定义在组件内部。应抽取独立 `schema.tsx` |

---

### P19: `/file_storage/buckets` — Bucket 管理

| # | 修改项 | 描述 |
|---|--------|------|
| P19-1 | **PageContainer 标题** | 当前 `<PageContainer title="Bucket 管理">`，列表页不应显示标题。改为 `pageHeaderRender={() => <></>}` |
| P19-2 | ModalForm 可保留 ✅ | 当前使用 ModalForm 做新建/编辑，字段简单，符合规范 |
| P19-3 | 按钮样式 | "新建 Bucket"使用全局渐变样式 |
| P19-4 | 操作列对齐 | 依赖 G-2 |
| P19-5 | Schema 文件 | 列定义在组件内部。应抽取独立 `schema.tsx` |

---

### P20: `/ai_management/tools` — Tools

| # | 修改项 | 描述 |
|---|--------|------|
| P20-1 | **操作列移除"查看"按钮** | 当前操作列有"查看"（预览）和"编辑"，应移除"查看"，只保留"编辑"。引用 [规范 1.6] |
| P20-2 | 按钮样式 | "新建 Tool"使用全局渐变样式 |
| P20-3 | 操作列对齐 | 依赖 G-2 |
| P20-4 | Schema 文件 | 已有 schema ✅ |

---

### P21: `/ai_management/skills` — Skills

| # | 修改项 | 描述 |
|---|--------|------|
| P21-1 | **操作列移除"查看"按钮** | 当前操作列有"查看"和"编辑"，移除"查看"，只保留"编辑" |
| P21-2 | 按钮样式 | "新建 Skill"使用全局渐变样式 |
| P21-3 | 操作列对齐 | 依赖 G-2 |
| P21-4 | Schema 文件 | 已有 schema ✅ |

---

### P22: `/ai_management/providers` — AI 服务商

| # | 修改项 | 描述 |
|---|--------|------|
| P22-1 | **操作列移除"查看"按钮** | 当前有"查看"和"编辑"，移除"查看" |
| P22-2 | 按钮样式 | "新建服务商"使用全局渐变样式 |
| P22-3 | 操作列对齐 | 依赖 G-2 |
| P22-4 | Schema 文件 | 已有 schema ✅ |

---

### P23: `/ai_management/models` — AI 模型

| # | 修改项 | 描述 |
|---|--------|------|
| P23-1 | **操作列移除"查看"按钮** | 当前有"查看"和"编辑"，移除"查看" |
| P23-2 | 按钮样式 | "新建模型"使用全局渐变样式 |
| P23-3 | 操作列对齐 | 依赖 G-2 |
| P23-4 | Schema 文件 | 已有 schema ✅ |

---

### P24: `/ai_management/scopes` — Scopes

| # | 修改项 | 描述 |
|---|--------|------|
| P24-1 | **操作列移除"查看"按钮** | 当前有"查看"和"编辑"，移除"查看" |
| P24-2 | 按钮样式 | "新建 Scope"使用全局渐变样式 |
| P24-3 | 操作列对齐 | 依赖 G-2 |
| P24-4 | Schema 文件 | 已有 schema ✅ |

---

### P25: `/ai_management/request-logs` — 请求日志

| # | 修改项 | 描述 |
|---|--------|------|
| P25-1 | **PageContainer 标题** | 当前 `<PageContainer>`（无参数），默认显示面包屑。添加 `pageHeaderRender={() => <></>}` |
| P25-2 | **启用搜索** | 当前 `search={false}`，请求日志应有搜索/过滤功能（按时间、模型、状态等） |
| P25-3 | headerTitle | 添加 `headerTitle="请求日志"` |
| P25-4 | Schema 文件 | 已有 schema ✅ |

---

### P26: `/service_provider/applications` — 应用管理

| # | 修改项 | 描述 |
|---|--------|------|
| P26-1 | 按钮样式 | "新建"按钮使用全局渐变样式 |
| P26-2 | 操作列对齐 | 依赖 G-2 |
| P26-3 | Schema 文件 | 已有 `Schemas` 目录 ✅ |

---

### P27: `/system/settings` — 系统设置

非列表页，不适用上述规范。保持现状。

---

### P28: `/account/center` — 个人中心

非列表页，不适用上述规范。保持现状。

---

### P29: Tree 全局折叠图标问题

| # | 修改项 | 描述 | 涉及页面 |
|---|--------|------|----------|
| T-1 | **ApiDomainTreePicker** | 检查 `toTreeNodes` 中 `isLeaf: !!item.isApiNode`，确保当 `item.children` 为空数组时也正确设置 `isLeaf: true` | API 服务列表、应用 Scope 配置 |
| T-2 | **CodePathTreeTable** | 检查 `flattenCodePathTree` 中的 Scope node，确保没有子级的节点不显示折叠图标 | 指标管理、元数据 |
| T-3 | **BuiltinApi Tree** | 检查 `buildTreeRows` 中的叶子节点设置 `children: undefined`（而不是 `children: {}`） | 内置 API 权限 |
| T-4 | **ProTable expandable** | 确保使用 expandable 的 ProTable 中叶子节点正确设置了 `childrenColumnName` 下无 children | 组织架构、角色管理、权限管理 |

---

## 优先级建议

```
第一优先级（影响面最大，基础能力）
  G-1 (全局按钮样式 CSS)
  G-2 (操作列右对齐)
  
第二优先级（明显不规范的页面）
  P8  metrics     — 改为 2 列 Splitter
  P11 metadata    — 改为 2 列 Splitter + 修复 Scroll
  P12 execute     — 宽高修复 + 移除 PageContainer
  P17 api_services — 改为 Splitter
  
第三优先级（PageContainer 标题修复）
  P7  builtin-api
  P14 data-standards
  P15 database
  P16 collection-pipelines
  P19 buckets
  P25 request-logs

第四优先级（功能冗余/替换）
  P2 org         — 自定义搜索→内置 search
  P3 role        — 自定义搜索→内置 search + Drawer→新页面
  P4/5/6 perms  — 自定义搜索→内置 + Drawer→新页面/MODAL + Schema 抽取
  P18 browser    — 补充 PageContainer + headerTitle
  P20-24 AI pages — 移除"查看"按钮

第五优先级（Schema 文件抽取）
  P18 browser
  P19 buckets
  P16 collection-pipelines
  P4/5/6 perms
  P17 api_services list

第六优先级（Tree 折叠图标修复）
  T1 ApiDomainTreePicker
  T2 CodePathTreeTable
  T3 BuiltinApi tree
  T4 ProTable expandable
```

---

## 修改原则

1. **一次改动一个逻辑单元**：先完成 G-1 和 G-2 全局修改，再逐个页面推进。
2. **每个页面修改前，先抽取 Schema 文件**（若没有），再修改布局。
3. **2 列模式页面**：按照 model-design 页面作为参考实现。
4. **每次修改后**：确认 build 通过，页面渲染正常。
