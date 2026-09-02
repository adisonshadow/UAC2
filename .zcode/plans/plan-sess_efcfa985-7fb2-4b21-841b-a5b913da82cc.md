# 操作日志功能方案 — 计划

## 本次交付物

**只写一份方案文档，不做任何实现**（用户需先审阅）：创建 `docs/操作日志方案计划.md`，完全遵循现有方案文档规范（参照 `docs/钩子管理方案计划.md`）：`> 状态：**待审阅**` 元数据头、编号章节（背景与目标 → 已确认决策 → 能力清单 → 核心架构 → 数据库 DDL 草案 → 记录机制 → API 设计 → 权限设计 → 前端 UI → 覆盖域清单 → 迁移兼容 → 分阶段实施 → 风险与开放问题 → 修订记录）。

## 方案核心内容（文档将详细展开的设计）

### 1. 现状结论（已核实）
- `uac.operation_logs` 表已存在（`backend/src/models/operation_log.js` + `schemas.sql`），仅有 7 处写入（用户管理 5 + 角色管理 2），**无任何查询 API 与前端页面**
- 缺陷：`user_id` 存的是被操作的目标用户而非操作者；无 IP/UA/trace_id；`created_at` 无索引；其他管理域全部未接入
- 参照实现：AI 请求日志（`adminAiRequestLogRoutes.js` + `aiRequestLogController.js` + 前端 `RequestLogs` 页面）

### 2. 表结构演进（迁移脚本草案 `backend/scripts/migrate-operation-log-audit.sql`）
新增列：`operator_id`（操作者，FK uac.users）、`operator_name`（快照，防用户删除后无法显示）、`operator_type`（USER/APPLICATION/SYSTEM）、`resource_name`（资源名快照）、`domain`（模块域）、`ip`、`user_agent`、`trace_id`、`duration_ms`、`request_summary JSONB`；新增索引 `(created_at DESC)`、`operator_id`、`(domain, created_at DESC)`。存量数据 operator 置空，前端显示"—"。

### 3. 混合式记录机制（用户已确认）
- 新建声明式中间件 `backend/src/middlewares/operationAudit.js`，逐路由挂载（项目惯例）：声明 domain/operationType/resourceType 与 resource_id 提取规则；`await next()` 后按 `ctx.status` 判定成败，自动采集操作者（`ctx.state.user`/`application`）、IP、UA、traceId、耗时；`setImmediate` 异步落库，失败仅 winston 记录不阻断主流程（现有惯例）
- 控制器通过 `ctx.state.auditContext = { resource_id, resource_name, old_data, new_data }` 传递手动快照，**落库收敛到中间件一处**；现有 7 处 inline `OperationLog.create` 迁移为该模式（operation_type 语义不变，`user.test.js` 现有断言保持通过）
- 脱敏：提供 `redactFields()` 工具（剔除 password/secret 等）；request_summary 只存方法/路径/主键字段摘要，不存请求体全文

### 4. 查询 API（沿用 aiRequestLog 模式）
- `GET /api/v1/admin/operation-logs`：分页 page/size（1–100），筛选 operator/domain/operation_type/resource_type/resource_id/status/时间范围/关键字/trace_id，按 created_at DESC；列表不返回大 JSONB，详情才返回
- `GET /api/v1/admin/operation-logs/:log_id`：详情含 old_data/new_data/request_summary
- `{code, message, data:{items,total,page,size}}` 信封 + formatLog 驼峰转换 + Swagger JSDoc；导出 CSV/统计接口列为增强项

### 5. 权限设计（用户已确认：内置API权限体系）
- `catalog.js` 注册 `system:operation-log:list/get`（domain: system），路由挂 `authWithBuiltinApiGuard`，管理员可经 `uac.builtin_api_configs` 配置角色/部门级 access_restriction
- 前端菜单：`/system/operation-logs`，需在 `uac-permissions-catalog-seed.sql` 补 `system:manage` MENU 权限（当前无记录=默认放行，方案中明确默认授予 SUPER_ADMIN 的配置建议）

### 6. 前端页面
`frontend/src/pages/System/OperationLogs/index.tsx` + `schema.tsx`，克隆 RequestLogs 模式：UrlSyncedProTable + parseApiListResponse + DEFAULT_PRO_TABLE_OPTIONS + useProTableSearchCollapse（遵循 PAGE_LAYOUT_STANDARD.md）；列：时间/操作者/模块/操作类型/资源/状态/耗时/IP；详情 Drawer 用 ProDescriptions + JSON 展示（简易 diff 视图列为增强）；enums.ts 补 valueEnum；semanticRegistry/routeElements/routeUi 三处注册 + `/system` 根菜单组（"系统"+图标，AppLayout iconMap 同步）

### 7. 全域覆盖清单（用户已确认：一步到位）
按路由模块逐域列表：user/role/department/permission/application（含密钥重置，强制脱敏）/bizdata（实体、物化手动执行、数据库连接、数据标准、元数据、采集管道）/apiservice（含发布/下线）/ai（provider/model/tool/skill）/storage（bucket、文件删除）/automation（钩子）/system（设置、备份）/auth（登录/登出，与 login_attempts 并存）；原则：只记管理写操作 + 敏感读（导出），例行读操作与自动调度触发的运行不记（列为开放问题供审阅确认）

### 8. 实施分期（虽全覆盖仍分批交付）
A 表迁移+模型+中间件 → B 查询 API+权限注册+seed → C 前端页面+菜单 → D 存量写入点迁移+全域路由接入 → E 增强（导出/统计/保留期自动清理，建议默认 180 天，复用现有 scheduler 模式）

### 9. 风险与开放问题（文档中如实列出）
- JWT 仅含 user_id/username，requireBuiltinApiPermission 对用户令牌在无 restriction 配置时放行——权限真正收紧依赖 builtin_api_configs 配置，方案中给出建议配置
- 高频操作域（物化等）记录粒度、大 JSONB 查询性能、异步写入在进程退出时的少量丢失容忍度
