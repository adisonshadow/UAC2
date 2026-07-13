# EADAF Frontend 页面布局规范

> 本规范定义 frontend 项目中列表页、表单页、2 列布局页面的统一标准。
> 所有新建页面和现有页面改造须遵循此规范。

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

### 1.2 全局"新建"按钮样式

所有列表页的 `toolBarRender` 中的"新建"按钮使用全局渐变样式：

```tsx
<Button
  type="primary"
  className="btn-gradient-primary"  // 或使用全局 styled component
  icon={<PlusOutlined />}
  onClick={() => navigate('/xxx/create')}
>
  新建
</Button>
```

CSS 定义：

```less
.btn-gradient-primary {
  background: linear-gradient(135deg,rgb(98, 83, 235),rgb(4, 204, 254));
  border: none;
  color: #fff;
  &:hover {
    background: linear-gradient(135deg,rgb(108, 89, 235), #36c8ff);
    box-shadow: 0 4px 12px rgba(98, 83, 225, 0.35);
  }
  &:active {
    background: linear-gradient(135deg,rgb(93, 56, 203),rgb(3, 125, 213));
  }
  // antd v6 兼容
  &:not(:disabled):not(.ant-btn-disabled):hover {
    background: linear-gradient(135deg,rgb(98, 83, 235),rgb(4, 204, 254)) !important;
    border-color: transparent !important;
  }
}
```

### 1.3 操作列右对齐

列表的操作列通过 `fixed: 'right'` 固定右侧，列内容**右对齐**（不是居中，也不是"操作"标题居中而按钮居中）。

```tsx
// ✅ 正确 — TableActionColumnBase 定义
export const TABLE_ACTION_COLUMN_BASE = {
  title: '操作',
  valueType: 'option' as const,
  fixed: 'right' as const,
  align: 'right',       // 右对齐
};

// ✅ TableActions 容器
export function TableActions({ children }: { children: ReactNode }) {
  return (
    <Space size={0} style={{ width: '100%', justifyContent: 'flex-end' }}>
      {children}
    </Space>
  );
}
```

### 1.4 统一使用 ProTable 内置功能

| 场景 | 规则 |
|------|------|
| **内容过滤** | 默认启用 search（`search` 参数），支持列级过滤 |
| **刷新** | 通过 `options.reload: true`（ProTable 内置刷新按钮），不允许额外自定义刷新按钮 |
| **密度** | antd 6 下统一 `options.density: false`（避免 DensityIcon 告警） |
| **表格设置** | 统一 `options.setting: true` 允许用户自定义列 |
| **全屏** | 统一 `options.fullScreen: true` |

### 1.5 headerTitle

列表 ProTable 必须设置 `headerTitle`，描述表的用途。

```tsx
<ProTable headerTitle="成员列表" ... />
```

即使是最简单的列表（如文件浏览器 `/file_storage/browser`），也要补上 `headerTitle`。

### 1.6 操作列按钮精简

- 操作列中**不要出现"预览"按钮**，用"编辑"替代。
- 操作按钮包括：编辑、删除、以及业务专有操作（如发布、测试、执行等）。

### 1.7 Schema 文件统一

每个列表页应有独立的 Schema 文件（`schema.tsx` 或 `Schemas/index.tsx`），包含列定义、表单字段定义等。不允许将列定义直接写在页面组件中（如 `AIManagement/Tools`、`AIManagement/Skills` 等已有 schema 的做法是正确的）。

### 1.8 同一列两个值垂直排列

当一列包含两个不同类型的值（如 Scope 名称 + 编码），应使用垂直排列（`<Space direction="vertical" size={0}>`），参考：

```tsx
<Space direction="vertical" size={0}>
  <span>{record.label}</span>
  <Text type="secondary" style={{ fontSize: 12 }}>{record.code}</Text>
</Space>
```

### 1.9 新建/编辑禁止使用 offcanvas（Drawer）

- **新建、编辑**必须使用新页面（路由跳转），布局参考 `/api_services/:id/edit`。
- **简单的配置表单**（如字段少、表单简单）可以使用 Modal。
- **禁止使用 Drawer（offcanvas）** 做新建和编辑，特别是权限配置（菜单/按钮/API 权限等）。

### 1.10 Tree 节点无可展开子级时不显示折叠图标

所有使用 Tree 组件的地方（`ApiDomainTreePicker`、`CodePathTreeTable`、ProTable expandable 等），当节点没有子级时，必须 `isLeaf: true` 或设置 `children: undefined` 以隐藏折叠图标。

---

## 2. 列表页两种模式

### 2.1 模式一：单纯列表（ProTable）

适用场景：成员管理、角色管理、服务商管理、Tools、Skills 等。

要求：
- 使用 `<PageContainer pageHeaderRender={() => <></>}>` 包裹
- 使用 ProTable
- 必须设置 `headerTitle`
- 默认启用 ProTable search（过滤栏）
- 有分页时使用 ProTable 内置 `pagination`

变种：
- **TreeTable**：如组织架构，使用 ProTable + `expandable` + `childrenColumnName`
- **无分页**：如组织架构、角色管理，设置 `pagination={false}`

### 2.2 模式二：2 列模式（左侧导航 + 右侧详情/表格）

适用场景：指标管理、元数据、API 服务列表、物化执行、模型设计。

要求：
- **不使用 PageContainer 组件**
- 使用 `antd Splitter` 组件实现左右分栏（允许侧边栏折叠）
- 左右两列**独立 Scroll**，高度 = 页面高度减去顶部 header（`calc(100vh - 56px)`）
- 水平与视口**无 margin**
- 左侧（导航侧）尽可能简洁：用图标区分类型（如 `DatabaseOutlined`、`CalculatorOutlined`），不展示"类型"文字列

参考实现：

```tsx
// ✅ 正确 — 2 列布局模板
<div style={{ height: 'calc(100vh - 56px)' }}>
  <Splitter>
    <Splitter.Panel defaultSize={320} min={240} max="50%">
      <div style={{ height: '100%', overflow: 'auto', paddingRight: 8 }}>
        {/* 左侧导航 - 独立 Scroll */}
      </div>
    </Splitter.Panel>
    <Splitter.Panel>
      <div style={{ height: '100%', overflow: 'auto' }}>
        {/* 右侧内容/表格 - 独立 Scroll */}
      </div>
    </Splitter.Panel>
  </Splitter>
</div>
```

---

## 3. 表单页规则

### 3.1 新建/编辑页面

- 使用新页面（独立路由），不覆盖当前页。
- 布局参考 `/api_services/:id/edit`：顶部有返回按钮（`PageContainerTitleWithBack`），表单区域居中。
- 保存后跳转回列表页并刷新。

### 3.2 简单配置 Modal

- 字段少、表单简单的创建/编辑可以使用 Modal（如 Bucket 新建/编辑）。
- Modal 宽度建议 480–640px。
- Modal 内部不要嵌套 Drawer。

---

## 4. 全局布局规范

### 4.1 页面高度

- 顶部 header 统一高度 56px。
- 列表页内容区高度自适应（ProTable 默认）。
- 2 列模式内容区高度 = `calc(100vh - 56px)`。
- 全屏编辑类页面（如 model-design）设置 `noContentPadding: true`。

### 4.2 字体与间距

- 遵循 Ant Design 6 设计令牌（4px 网格）。
- 表内 size 统一 `defaultSize="small"`。

### 4.3 颜色

- 主操作按钮（新建、保存）使用规范中的渐变风格。
- 危险操作（删除）使用 danger。
- 其他辅助操作用 link 类型。
