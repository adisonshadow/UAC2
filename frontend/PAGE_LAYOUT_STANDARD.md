# Frontend 页面布局规范

> 本规范定义 frontend 项目中列表页、表单页、2 列布局页面的统一标准。
> 所有新建页面和现有页面改造须遵循此规范；下列场景**必须**使用对应标准组件，禁止页面内再造一套。

---

## 0. 标准组件强制使用

| 组件 | 路径 | 必须使用的位置 |
|------|------|----------------|
| **AnimatedOutlet** | `@/components/AnimatedOutlet` | **仅**主布局 `AppLayout` 内渲染路由子页（页面过渡动画）。业务页不要自行包一层；公开 API 文档等独立布局可刻意绕开 |
| **ScopeDomainTree** | `@/components/ScopeDomainTree` | 2 列模式**左侧域 / Scope 树**（「全部」+ 前缀域 + 数量）。业务可薄封装映射字段（如 `ApiServiceDomainTree`），底层必须是本组件；禁止页面直接裸写 `antd Tree` 做域选择 |
| **PageContainerTitleWithBack** | `@/components/PageContainerTitleWithBack` | 新建 / 编辑 / 测试 / 详情等**子页标题**（含返回）。`FixHeaderPage` 的 `title`、或仍用 `PageContainer` 的短表单页 `title` 均用此组件 |
| **TableActions**（含 `TABLE_ACTION_COLUMN_BASE` / `TableActionButton`） | `@/components/TableActions` | 所有列表**操作列**；规则见 [1.3](#13-操作列schema--procolumns) |
| **UrlSyncedProTable** | `@/components/UrlSyncedProTable` | 需要**筛选 / 分页进 URL** 的列表（模式一、模式二右侧表）。禁止业务页手写 `useSearchParams` 同步 ProTable；Drawer/Modal 内表用 `syncUrl={false}` |
| **TitleWithHelp** | `@/components/TitleWithHelp` | 表单字段 / Card / Schema 列标题旁需要**说明文案**时（`?` 图标）。短说明用默认 `helpMode="popover"`，长文档/代码示例用 `helpMode="modal"`；禁止自造问号 + Popover |
| **FixHeaderPage** | `@/components/FixHeaderPage` | 独立路由的新建 / 编辑 / 测试页外壳，见 [§3](#3-新建编辑页-fixheaderpage) |

配套 hooks（与上表一起用，勿另起炉灶）：

| Hook / 常量 | 路径 | 用途 |
|-------------|------|------|
| `useScopeFromUrl` | `@/hooks/useUrlQueryState` | 左侧域 ↔ URL `scope` |
| `useTableUrlState` | 同上 | 非 ProTable 场景读写筛选+分页 |
| `useProTableSearchCollapse` | `@/hooks/useProTableSearchCollapse` | 查询区折叠持久化 |
| `DEFAULT_PRO_TABLE_OPTIONS` | `@/constants/proTable` | density / reload / setting / fullScreen |

---

## 1. 列表页通用规则

### 1.1 PageContainer 标题与面包屑

**所有列表页** 不显示 PageContainer 的页面标题和面包屑导航。

```tsx
// ✅ 正确
<PageContainer pageHeaderRender={() => <></>}>
  <ProTable ... />
</PageContainer>

// ✅ 2 列模式不使用 PageContainer
// ❌ 禁止：<PageContainer title="成员列表">
// ❌ 禁止：<PageContainer>（默认显示面包屑）
```

### 1.2 全局「新建」按钮样式

所有列表页的 `toolBarRender` 中的「新建」按钮使用全局渐变样式（**仅工具栏主操作**，查询区「查询」按钮不适用，见 [1.4](#14-protable-查询过滤区)）：

```tsx
<Button
  type="primary"
  className="btn-gradient-primary"
  icon={<PlusOutlined />}
  onClick={() => navigate('/xxx/create')}
>
  新建
</Button>
```

CSS 定义见 `src/global.scss`：

```scss
.btn-gradient-primary {
  background: linear-gradient(135deg, rgb(98, 83, 235), rgb(4, 204, 254)) !important;
  border: none;
  color: #fff !important;
  &:hover:not(:disabled) {
    background: linear-gradient(135deg, rgb(108, 89, 235), #36c8ff) !important;
    box-shadow: 0 4px 12px rgba(98, 83, 225, 0.35);
  }
  &:active:not(:disabled) {
    background: linear-gradient(135deg, rgb(93, 56, 203), rgb(3, 125, 213)) !important;
  }
}
```

### 1.3 操作列（Schema / ProColumns）

操作列统一复用 `@/components/TableActions`，**禁止**在页面里手写一套对齐 / Tooltip / link 按钮样式。

#### 列配置

```tsx
import {
  TABLE_ACTION_COLUMN_BASE,
  TableActions,
  TableActionButton,
} from '@/components/TableActions';

{
  ...TABLE_ACTION_COLUMN_BASE,
  // width = 操作按钮数量 × 24 + 12 × 2（左右各 12px 内边距）
  width: buttonCount * 24 + 12 * 2,
  render: (_, record) => (
    <TableActions>
      {/* 操作按钮 */}
    </TableActions>
  ),
}
```

`TABLE_ACTION_COLUMN_BASE` 约定（见 `src/components/TableActions/index.tsx`）：

| 属性 | 值 | 说明 |
|------|-----|------|
| `title` | `'操作'` | 固定文案 |
| `valueType` | `'option'` | ProTable 操作列 |
| `fixed` | `'right'` | 固定在表格右侧 |
| `align` | `'center'` | **水平居中**（表头与单元格一致） |

`TableActions` 容器：`Space size={0}`，`justifyContent: 'center'`，占满单元格宽度。

#### 宽度公式

```
width = 操作按钮数量 × 24 + 12 × 2
```

| 按钮数 | 计算 | 常用 width |
|--------|------|------------|
| 1 | 24 + 24 = 48 | `48` / `50` |
| 2 | 48 + 24 = 72 | `70` |
| 3 | 72 + 24 = 96 | `96` / `100` |
| 4 | 96 + 24 = 120 | `120` |

按**该行稳定出现的最大按钮数**取 width（含按状态条件渲染、但会占位的图标，如「未发布 / 已发布」切换）。不要随意放大导致右侧空白过多。

#### 操作按钮样式与 Tooltip

统一使用 `TableActionButton`（内部已封装）：

- `type="link"` + `size="small"`
- **仅图标、无文字**（`icon={<EditOutlined />}` 等）
- 每个按钮必须有 `title`，由组件包一层 `<Tooltip title={title}>`
- `onClick` 内已 `e.stopPropagation()`，避免触发行点击
- 危险操作：`danger` + 删除类图标；需二次确认时外层包 `Popconfirm`，内层仍保留 Tooltip（可直接用 antd `Button` + `Tooltip`，样式与 `TableActionButton` 一致：`type="link" size="small"`）

```tsx
// ✅ 推荐
<TableActions>
  <TableActionButton
    title="编辑"
    icon={<EditOutlined />}
    onClick={() => onEdit(record)}
  />
  <Popconfirm title="确定删除？" onConfirm={() => onDelete(record.id)}>
    <Tooltip title="删除">
      <Button
        type="link"
        size="small"
        danger
        icon={<DeleteOutlined />}
        onClick={(e) => e.stopPropagation()}
      />
    </Tooltip>
  </Popconfirm>
</TableActions>

// ❌ 禁止：操作列放文字「编辑」「删除」
// ❌ 禁止：无 Tooltip 的纯图标按钮
// ❌ 禁止：align / justifyContent 改回 right / flex-end
```

#### 操作列按钮精简

- 不要出现「预览」按钮，用「编辑」替代。
- 常见操作：编辑、删除，以及业务专有操作（发布、测试、执行等）。

### 1.4 ProTable 查询过滤区

| 场景 | 规则 |
|------|------|
| **内容过滤** | 默认启用 ProTable `search`，列级过滤；优先 `useProTableSearchCollapse(pageId)`（`labelWidth: 'auto'`，折叠状态持久化） |
| **「查询」按钮** | **不要**加 `btn-gradient-primary`。全局样式见 `src/overrides.scss`：浅灰底、非强调主色，与工具栏「新建」渐变区分 |
| **刷新** | `options.reload: true`，不允许额外自定义刷新按钮 |
| **密度** | antd 6 下统一 `options.density: false`（`DEFAULT_PRO_TABLE_OPTIONS`） |
| **表格设置** | `options.setting: true` |
| **全屏** | `options.fullScreen: true` |

查询区「查询」按钮全局覆写（勿在页面内再写一套）：

```scss
/* src/overrides.scss */
.ant-pro-query-filter-container .ant-btn-primary {
  background-color: #d9dfeb !important;
  color: var(--ant-button-default-color);

  &:hover {
    background-color: #dfe8f9 !important;
    color: #2a4e96 !important;
  }
}
```

列表页推荐：

```tsx
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import { useProTableSearchCollapse } from '@/hooks/useProTableSearchCollapse';

const search = useProTableSearchCollapse('ai_management.tools');

<UrlSyncedProTable
  search={search}
  options={DEFAULT_PRO_TABLE_OPTIONS}
  urlFilterKeys={['name', 'status']} // 需持久化的筛选项；省略则同步除 reserved 外全部
  ...
/>
```

过滤条件与分页的 URL 约定见 [2.3](#23-列表状态-url-持久化)。2 列布局时左侧域选择（`scope`）一并写入 URL。

### 1.5 headerTitle

列表 ProTable 必须设置 `headerTitle`，描述表的用途。

```tsx
<ProTable headerTitle="成员列表" ... />
```

即使是最简单的列表（如文件浏览器 `/file_storage/browser`），也要补上 `headerTitle`。

### 1.6 Schema 文件统一

每个列表页应有独立的 Schema 文件（`schema.tsx` 或 `Schemas/index.tsx`），包含列定义、表单字段定义等。不允许将列定义直接写在页面组件中（如 `AIManagement/Tools`、`AIManagement/Skills` 等已有 schema 的做法是正确的）。操作列可在页面里展开 `render`（需业务回调），但列基础配置与宽度公式仍须符合 [1.3](#13-操作列schema--procolumns)。

### 1.7 同一列两个值垂直排列

当一列包含两个不同类型的值（如 Scope 名称 + 编码），应使用垂直排列（`<Space direction="vertical" size={0}>`）：

```tsx
<Space direction="vertical" size={0}>
  <span>{record.label}</span>
  <Text type="secondary" style={{ fontSize: 12 }}>{record.code}</Text>
</Space>
```

### 1.8 新建/编辑禁止使用 offcanvas（Drawer）

- **新建、编辑**必须使用新页面（路由跳转），布局见 [§3 FixHeaderPage](#3-新建编辑页fixheaderpage)。
- **简单的配置表单**（字段少、表单简单）可以使用 Modal。
- **禁止使用 Drawer（offcanvas）** 做新建和编辑，特别是权限配置（菜单/按钮/API 权限等）。

### 1.9 Tree 节点无可展开子级时不显示折叠图标

所有使用 Tree 的地方（**`ScopeDomainTree` 已内置处理**、`ApiDomainTreePicker`、`CodePathTreeTable`、ProTable expandable 等），当节点没有子级时，必须 `isLeaf: true` 或设置 `children: undefined` 以隐藏折叠图标。2 列左侧域选择一律走 `ScopeDomainTree`，不要另写一套 Tree。

---

## 2. 列表页两种模式

### 2.1 模式一：单纯列表（ProTable）

适用场景：成员管理、角色管理、服务商管理、Tools、Skills 等。

要求：
- 使用 `<PageContainer pageHeaderRender={() => <></>}>` 包裹
- **必须**使用 `UrlSyncedProTable`（筛选 + 分页写入 URL，见 [2.3](#23-列表状态-url-持久化)）；无分页列表可 `pagination={false}`，仍优先用该组件
- 必须设置 `headerTitle`
- 默认启用 ProTable search（过滤栏），查询按钮样式见 [1.4](#14-protable-查询过滤区)
- 有分页时使用内置 `pagination`（由 `UrlSyncedProTable` 同步 URL）
- `options={DEFAULT_PRO_TABLE_OPTIONS}`
- 操作列必须用 `TableActions` / `TableActionButton`（见 [§0](#0-标准组件强制使用)）

变种：
- **TreeTable**：如组织架构，使用 ProTable + `expandable` + `childrenColumnName`
- **无分页**：如组织架构、角色管理，设置 `pagination={false}`

### 2.2 模式二：2 列模式（左侧导航 + 右侧详情/表格）

适用场景：指标管理、元数据、API 服务列表、物化执行、模型设计。

要求：
- **不使用 PageContainer 组件**
- 使用 `antd Splitter` 组件实现左右分栏（允许侧边栏折叠）
- 左右两列**独立 Scroll**，高度 = 页面高度减去顶部 header（`calc(100vh - 56px)`）
- 水平与视口**无 margin**；路由通常配置 `noContentPadding: true`
- 左侧域树**必须**用 `ScopeDomainTree`（或基于它的薄封装）；与 `useScopeFromUrl` 绑定；不要页面内裸写 `Tree`
- 右侧列表**必须**用 `UrlSyncedProTable` + `TableActions` 操作列
- **左侧域选择、右侧查询过滤、分页三者均持久化到 URL**（见 [2.3](#23-列表状态-url-持久化)）

参考实现：

```tsx
import ScopeDomainTree from '@/components/ScopeDomainTree';
import { UrlSyncedProTable } from '@/components/UrlSyncedProTable';
import { useScopeFromUrl } from '@/hooks/useUrlQueryState';

const [scope, setScope] = useScopeFromUrl(); // → URL ?scope=

<div style={{ height: 'calc(100vh - 56px)' }}>
  <Splitter>
    <Splitter.Panel defaultSize={260} min={200} max="40%" collapsible>
      <div style={{ height: '100%', overflow: 'auto', paddingRight: 8 }}>
        <ScopeDomainTree
          items={listItems}           // 或 treeData={预构建树}
          selectedScope={scope}
          onSelect={setScope}
          loading={loading}
        />
      </div>
    </Splitter.Panel>
    <Splitter.Panel>
      <div style={{ height: '100%', overflow: 'auto', paddingLeft: 4 }}>
        <UrlSyncedProTable
          search={search}
          urlFilterKeys={['keyword', 'status', 'tag']}
          options={DEFAULT_PRO_TABLE_OPTIONS}
          ...
        />
      </div>
    </Splitter.Panel>
  </Splitter>
</div>
```

业务域树字段名与通用组件不一致时，做薄封装映射即可（参考 `ApiServiceDomainTree` → 内部仍渲染 `ScopeDomainTree`）。

### 2.3 列表状态 URL 持久化

列表交互状态以 **URL search 为唯一数据源**，刷新 / 分享链接可恢复同一视图。禁止只放在组件本地 state 里丢刷新。

| 交互 | URL 键（约定） | 实现 |
|------|----------------|------|
| **左侧域 / Scope 选择** | `scope` | `useScopeFromUrl()`；选「全部」时删除该键；**切换域时清空 `page` / `pageSize`** |
| **查询过滤**（关键字、状态、标签等） | 与表单字段同名（如 `keyword`、`status`、`tag`） | `UrlSyncedProTable` 或 `useTableUrlState`；提交查询 / 重置时回写；空值不写进 URL |
| **分页** | `page`（1-based）、`pageSize` | 同上；`page=1`、`pageSize=默认值` 时省略对应键 |

约定与工具：
- 键名常量：`TABLE_SCOPE_KEY` / `TABLE_PAGE_KEY` / `TABLE_PAGE_SIZE_KEY`（`src/utils/tableUrlHelper.ts`）
- `scope`、`page`、`pageSize` 为 **reserved**，不参与筛选字段序列化
- 显式同步哪些筛选字段时传 `urlFilterKeys`（或 `useTableUrlState({ filterKeys })`）；不传则同步除 reserved 外的全部参数
- Drawer / Modal 内嵌表格：`UrlSyncedProTable` 设 `syncUrl={false}`，避免污染外层列表 URL

示例 URL：

```
/api_services/list?scope=IPS&keyword=hours&status=published&page=2&pageSize=10
```

刷新后应恢复：左侧选中 `IPS`、查询区条件、第 2 页。

---

## 3. 新建/编辑页：FixHeaderPage

新建、编辑、测试等**独立路由页**统一使用 `FixHeaderPage`（`src/components/FixHeaderPage`），路由配置 `noContentPadding: true`。高度为 `calc(100vh - 56px)`：顶栏固定，正文区独立纵向滚动。

### 3.1 顶栏结构

`fix-header-page__header-main` 为三列网格：`1fr | auto | 1fr`（左标题 / 中导航 / 右操作）。

| Slot | Props | 用途 |
|------|--------|------|
| 左侧 | `title` / `subTitle` | **`title` 必须**为 `<PageContainerTitleWithBack title="…" />`（可用 `backTo` 指定返回列表路径）；`subTitle` 放版本、状态 Tag、快捷「发布」等 |
| 中间 | `centerSlot` | **仅长新建/编辑页**的分区导航（见 3.2） |
| 右侧 | `extra` | 去测试、AI 完善、保存 / 保存并发布等主操作 |

表单区内字段 / 区块标题需要说明时，使用 **`TitleWithHelp`**（见 [§0](#0-标准组件强制使用)），例如：

```tsx
<Form.Item label={<TitleWithHelp title="管道短名" help={pipelineSlugHelp} />}>
  ...
</Form.Item>

<Card title={<TitleWithHelp title="访问协议" help={TRANSPORT_HELP} />}>
  ...
</Card>

// 长说明
<TitleWithHelp title="Handler SDK" help={<HandlerSdkHelpModalContent />} helpMode="modal" />
```

```tsx
<FixHeaderPage
  title={<PageContainerTitleWithBack title="编辑 API 服务 · code" />}
  subTitle={/* 版本 / 状态 / 发布 */}
  centerSlot={<XxxSectionNav />}   // 仅长表单
  extra={
    <Space>
      <Button>去测试</Button>
      <Button className="ai-btn" icon={<RobotOutlined />}>AI 完善</Button>
      <Button type="primary" loading={submitting}>保存</Button>
    </Space>
  }
>
  {/* 表单正文，可配合 section id 供 centerSlot 滚动定位 */}
</FixHeaderPage>
```

参考实现：
- 长编辑：`/api_services/:id/edit`、`/api_services/create`、采集管道新建/编辑
- 无中间导航：`/api_services/:id/test`（仅 title + extra）

保存成功后跳转回列表页并刷新（或按产品约定进入编辑/测试页）。

### 3.2 centerSlot：仅长新建/编辑页使用

`centerSlot`（DOM：`fix-header-page__center`）用于**内容很长、需分区锚点滚动**的新建/编辑页，例如 API 服务的「信息 / 请求 / 处理 / 响应」、采集管道同类 SectionNav。

规则：
- **长表单新建/编辑**：提供 `centerSlot`（`Space.Compact` + `Button`，当前分区 `type="primary"`），点击后通过 `useFixHeaderPageScroll().scrollToElement` 滚到对应 `id` 区块
- **短表单、测试页、图谱/只读页**：**不要**塞 `centerSlot`（可留空）；顶栏只保留 title（+ subTitle）与 extra
- 禁止用 `centerSlot` 放保存按钮或与分区无关的工具条（那些放 `extra`）

### 3.3 简单配置 Modal

- 字段少、表单简单的创建/编辑可以使用 Modal（如 Bucket 新建/编辑）。
- Modal 宽度建议 480–640px。
- Modal 内部不要嵌套 Drawer。

---

## 4. 全局布局规范

### 4.1 页面高度与路由出口

- 顶部 header 统一高度 56px。
- 列表页内容区高度自适应（ProTable 默认）。
- 2 列模式 / `FixHeaderPage` 内容区高度 = `calc(100vh - 56px)`。
- 全屏编辑、2 列、FixHeaderPage 类页面设置路由 `noContentPadding: true`。
- 主布局内容区**只通过** `AppLayout` 内的 **`AnimatedOutlet`** 渲染子路由（`eadaf-page-transition`）；业务页不要再包一层过渡容器。

### 4.2 字体与间距

- 遵循 Ant Design 6 设计令牌（4px 网格）。
- 表内 size 统一 `defaultSize="small"`（或与现有列表一致的 `medium` 约定时保持页内统一）。

### 4.3 颜色与按钮层级

| 用途 | 样式 |
|------|------|
| 列表工具栏「新建」等主 CTA | `type="primary"` + `btn-gradient-primary` |
| 查询区「查询」 | ProTable 默认 primary，由 `overrides.scss` 覆写为浅灰强调（非渐变） |
| FixHeaderPage「保存」 | `type="primary"`（可不用渐变，与编辑页现有一致） |
| 危险操作（删除） | `danger` |
| 表格操作列 | `TableActionButton` / link + Tooltip，见 [1.3](#13-操作列schema--procolumns) |
| AI 入口 | `className="ai-btn"` |
| 字段说明 | `TitleWithHelp`（popover / modal） |
