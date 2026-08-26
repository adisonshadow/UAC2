---
name: eadaf-api
version: 1.4.1
description: >-
  指导 AI 与外部系统集成方如何正确调用 EADAF 平台 API（鉴权、业务数据 API、参数 filter、
  OpenAPI 发现、用户 SSO、文件存储；以及授权 bizdata 内置 API 后在平台外建模、物化、Mock、编排 API 服务）。
  在对接 EADAF、编写调用脚本、解析 api-docs / apis.json 时使用本 Skill。
---

# EADAF API 调用 Skill

> **版本**：`1.4.1`（见 frontmatter `version`）  
> **适用对象**：外部应用后端、AI Agent、自动化集成脚本  
> **人类可读长文**：`docs/external-app-integration-guide.md`（应用 API）、`docs/sso-integration-guide.md`（用户 SSO）

---

## 1. 快速认知

| 概念 | 说明 |
|------|------|
| **应用（Application）** | 在 EADAF 注册的外部系统实体，拥有 `application_id` + `app_secret` |
| **应用访问令牌（JWT）** | 用 `app_secret` 换取，默认 24h，请求头 `Authorization: Bearer {token}`，`type=application` |
| **用户 SSO JWT** | 用户经 `/auth/login?app=` 登录后回调下发；验签用同一应用统一密钥；**不能**与应用 Token 混用 |
| **内置 API** | 平台能力 API。授权 `bizdata:*` 后可在 EADAF 控制台外完成建模、物化、Mock、编排 API 服务（见 §8） |
| **业务数据 API** | 已发布的实体 REST 服务，路径 `/api/v1/data/{routePath}` |
| **公开目录** | 无需登录即可查看某应用可访问 API：`GET /api/v1/applications-public/{key}/api-catalog` |
| **OpenAPI JSON** | 机器可读契约：`GET /api/v1/applications-public/{key}/apis.json`（纯 OpenAPI 对象，无 `{code,data}` 外壳） |

`{key}` 可为应用 **code**（如 `FMMS`）或 **application_id**（UUID）。

---

## 2. 鉴权流程（必须遵守）

### 2.1 换取应用 Token（公开接口，无需已有 Token）

```http
POST {base_url}/api/v1/applications/token
Content-Type: application/json

{
  "application_id": "<UUID>",
  "app_secret": "<64位十六进制>"
}
```

成功：`data.token` 为 JWT。失败常见：`401 无效的 app_secret`、`404 应用不存在`。

### 2.2 调用任意受保护 API

```http
Authorization: Bearer {token}
```

**安全**：`app_secret` 仅保存在调用方服务端，禁止写入前端、Git、日志或 URL。

### 2.3 用户 SSO（终端用户登录，不是应用 Token）

完整说明：仓库内 `docs/sso-integration-guide.md`。

硬性约定：

1. EADAF 应用 `redirect_uri` = **业务 BFF** 回调（勿填前端页）
2. `redirect_mode`：`POST_REDIRECT`（默认）或 `HEADER_REDIRECT`（BFF GET 回调时推荐）
3. EADAF → BFF 字段名：`access_token`（及可选 `refresh_token` / `user_info`）；BFF → 前端建议 `token`，并兼容 `access_token`
4. 验签密钥：`client_secret` / `app_secret`（旧 `salt` 仅兼容）；无独立「签名盐」必填项
5. 校验：`GET {base_url}/api/v1/auth/check?app={application_id}` + `Authorization: Bearer <user_jwt>`
6. 公开跳转信息：`GET {base_url}/api/v1/applications-sso/{application_id}`（不下发 `app_secret`）
7. 登录入口：`{eadaf_frontend}/auth/login?app={application_id}`
8. HashRouter：BFF 二次跳转必须是 `{FRONTEND}/#/auth/callback?token=...`

业务 BFF 自建（非 EADAF 路由）：`/auth/sso-config`、`/auth/callback`、`/auth/check` 等。

---

## 3. 业务数据 API

### 3.1 基本调用

```http
GET {base_url}/api/v1/data/{routePath}
Authorization: Bearer {token}
```

`routePath` 由 EADAF 管理员定义（如 `fmms/workCardFind`）。多 operation 服务需指定：

```http
GET {base_url}/api/v1/data/{routePath}?operation=find
```

### 3.1.1 HTTP 方法与 path 参数

OpenAPI / 目录中的 `httpMethod` + `routePattern` 与运行时一致，例如：

| operation | 推荐调用 | 兼容写法 |
|-----------|----------|----------|
| `deleteOne` | `DELETE /api/v1/data/{routePath}/{id}` | `POST /api/v1/data/{routePath}` + `{"id":"..."}` |
| `updateOne` | `PATCH /api/v1/data/{routePath}/{id}` + body `{ "body": {...} }` | `POST ...` + `{ "id", "body" }` |
| `findById` | `GET /api/v1/data/{routePath}/{id}` | `GET ...?id=` |
| `create` | `POST /api/v1/data/{routePath}` | — |

错误（含 **405 Method Not Allowed**）一律返回 JSON 信封 `{ code, message, data }`，不是纯文本。

### 3.2 响应外壳

```json
{
  "code": 200,
  "message": "调用成功",
  "data": { ... }
}
```

### 3.2.1 分页列表响应（find，必须）

所有带分页的列表类 `find` API，`data` **必须**为：

```json
{
  "items": [ /* 当前页记录 */ ],
  "pagination": {
    "total": 53,
    "page": 1,
    "pageSize": 10,
    "totalPages": 6,
    "hasNext": true
  }
}
```

| 字段 | 说明 |
|------|------|
| `items` | 当前页数据数组 |
| `pagination.total` | 总记录数（必须） |
| `pagination.page` | 当前页，从 1 开始 |
| `pagination.pageSize` | 每页条数 |
| `pagination.totalPages` | 总页数 |
| `pagination.hasNext` | 是否有下一页 |

**禁止**仅返回平铺的 `total` / `count` / `size` 而不含 `pagination` 对象。

请求侧分页参数仍为 `limit` + `skip`（见下表）；网关/Handler 据此计算 `page` 与 `pageSize`。

**SQL definition 注意**：`definitionScript` 只写查询条件与排序，**不要**写 `LIMIT`/`OFFSET`（含 `:limit`/`:skip`）。分页由网关外层施加；SQL 内再写会导致 skip 后空页、total 被截断。

### 3.3 参数传递方式

| 方式 | 示例 | 场景 |
|------|------|------|
| Query（GET/HEAD/DELETE） | `?limit=20&skip=0&operation=find` | 简单参数、分页 |
| JSON Body（POST） | `{"status":"open"}` | 写操作、复杂 body |
| `parameters` 嵌套（POST） | `{"parameters":{"filter":{"status":"pending"}}}` | 推荐，与测试页一致 |

GET 类 operation：**无 request body**，参数走 query string。对象型参数（如 `filter`）在 query 中需 JSON 字符串或按 OpenAPI 文档展开。

写操作 `body` / `set` 的字段名必须与实体 **fieldKey**（物化表列名）一致（以 OpenAPI / `$refEntity` 为准）。禁止传入未建模字段（如表中不存在的列），否则返回 400。

### 3.4 SSE 流式（只读）

```http
GET {base_url}/api/v1/stream/data/{routePath}?operation=find
Accept: text/event-stream
Authorization: Bearer {token}
```

仅支持读类 operation（`find` 等），事件：`meta` → `item`（多条）→ `done`。

### 3.5 应用令牌限制

业务数据 API 若配置了角色/组织访问策略，**应用令牌**可能收到 `403`。需管理员将目标服务设为「无限制」或调整策略。

---

## 4. `filter` 查询参数（重要）

`find`、`count`、`findOne`、`exists`、`distinct` 等读操作支持字段等值过滤。

### 4.1 GET 推荐写法（三种等价）

```http
# 1) filter JSON 字符串（推荐）
GET .../WorkstationFind?limit=20&skip=0&filter={"stationNo":"D01"}

# 2) 顶层字段
GET .../WorkstationFind?stationNo=D01

# 3) bracket 写法
GET .../WorkstationFind?filter[stationNo]=D01
```

POST / 测试页可用对象：

```json
{
  "limit": 20,
  "skip": 0,
  "filter": { "stationNo": "D01" }
}
```

### 4.2 优先级（顶层 > filter）

| 来源 | 优先级 | 说明 |
|------|--------|------|
| **顶层参数字段** | 高 | 如 `stationNo=D01`，或自定义 SQL 的 `:stationNo` |
| **`filter` 内同名字段** | 低 | 仅当顶层未提供该字段时生效 |

示例：顶层 `stationNo=D01` 时，忽略 `filter.stationNo`。

非 SQL `:param` 的顶层标量字段会进入外层 `WHERE`（等值匹配）。

### 4.3 自定义 definition SQL（`:param`）

服务若使用自定义 SQL 且含 **`:status`** 等命名参数：

- 优先在 **顶层** 传 `"status": "pending"` 完成 SQL 替换；
- 若顶层未传，**`filter.status` 会自动填入 `:status`**（自 v1.0.0 起）；
- 已在 SQL 中处理的字段，**不会**再在外层 WHERE 重复过滤。

### 4.4 物化表（无自定义 SQL）

`filter` 会转换为 `WHERE col = $n`（`null` → `IS NULL`）。仅支持**标量等值**，暂不支持范围/模糊/嵌套操作符对象。

### 4.5 常见错误

| 错误写法 | 后果 |
|----------|------|
| `filter` 传非法 JSON 字符串 | 400 参数校验失败 |
| 只填 filter 但服务 SQL 必填 `:status` 且未实现 filter 回填（旧版本） | `自定义 SQL 包含未填写的参数: :status` |
| 以为 filter 会模糊匹配 | 实际为等值匹配 |

---

## 5. 读操作参数速查

| operation | 常用参数 | 说明 |
|-----------|----------|------|
| `find` | `limit`, `skip`, `filter` | 列表分页 |
| `count` | `filter` | 计数 |
| `findOne` / `exists` | `filter` | 单条 / 是否存在 |
| `findById` | `id`（path） | 按主键 |
| `distinct` | `field`, `filter` | 去重字段 |

`limit` / `skip` 为分页字段，**不要**放进 `filter`。

---

## 6. API 发现（给 AI 用）

对应用 `{key}`，按优先级读取：

1. **本 Skill（Markdown）**  
   `GET {base_url}/api/v1/applications-public/{key}/api-skill.md`  
   人类页面：`{frontend}/public/applications/{key}/api-docs/api-skill`

2. **OpenAPI 3.0 JSON**  
   `GET {base_url}/api/v1/applications-public/{key}/apis.json`

3. **结构化目录**  
   `GET {base_url}/api/v1/applications-public/{key}/api-catalog`  
   含 `services[].operations[]` 的 `parametersSchema`、`mockParameters`（请求 Example）、`responseInterface`。

4. **在线文档**  
   `{frontend}/public/applications/{key}/api-docs`

发现接口后，以 **operation 的 `parametersSchema`** 为准构造请求，以 **`mockParameters` / request Example** 为参考样本。

---

## 7. 内置 API 片段

```http
GET {base_url}/api/v1/users?page=1&size=20
GET {base_url}/api/v1/departments/tree
```

须在应用「可访问内置 API」中授权对应 `permission code`（如 `user:account:list`）。

应用令牌调用已授权的内置 API 时，**不受角色/组织限制**（按应用授权鉴权）。完整请求/响应以公开目录 `builtinApis[].operations[]` 或 `apis.json` 为准。

---

## 8. 在 EADAF 外部用 bizdata 内置 API 交付数据与接口

当管理员为应用勾选了 **`bizdata` 域内置 API**（`builtin_api_scope.permissionCodes` 含 `bizdata:entity:*`、`bizdata:materialization:*` 等）后，外部后端 / AI Agent **不必打开 EADAF 控制台**，即可用同一套应用 Token 完成：

1. **数据模型设计**（Scope / 实体 / 字段 / 枚举 / 关系）
2. **物化**（把模型落到目标库表）
3. **写入 Mock 数据**
4. **创建 / 编辑 API 服务并测试**，发布后即可按 §3 作为业务数据 API 调用

推荐先读本应用已授权清单：`GET /api/v1/applications-public/{key}/api-catalog` 的 `builtinApis`（只会出现已勾选的 code）。未授权的 code 会 `403`。

### 8.1 建议流水线

```
exists 探活 → 建模（实体/字段）→ 数据库连接 → 物化预览/执行
    → Mock 数据 → 创建 API 服务（draft）→ check-handler / test → publish
    → 用 §3 DataAPI 真正调用
```

新建前用 `exists` 接口探活，避免重复创建：

| 目的 | 方法 | 路径 | permission code |
|------|------|------|-----------------|
| Scope 下是否已有实体 | GET | `/api/v1/business-data/scopes/exists?code=` | `bizdata:scope:exists` |
| 实体 code 是否已存在 | GET | `/api/v1/business-data/entities/exists?code=` | `bizdata:entity:exists` |
| 枚举 code 是否已存在 | GET | `/api/v1/business-data/enums/exists?code=` | `bizdata:enum:exists` |

始终 `200`；看 `data.exists`。存在则改用 get/update，不要再 POST create。

### 8.2 数据模型设计

| 步骤 | 方法 | 路径 | permission code |
|------|------|------|-----------------|
| 全量模型快照 | GET | `/api/v1/business-data/schema` | `bizdata:entity:schema` |
| Scope 树 | GET | `/api/v1/business-data/scopes` | `bizdata:scope:list` |
| 创建实体 | POST | `/api/v1/business-data/entities` | `bizdata:entity:create` |
| 保存字段 | PUT | `/api/v1/business-data/entities/{id}/fields` | `bizdata:entity:save_fields` |
| 创建枚举 | POST | `/api/v1/business-data/enums` | `bizdata:enum:create` |
| 创建关系 | POST | `/api/v1/business-data/relations` | `bizdata:relation:create` |

创建实体最小体：

```http
POST {base_url}/api/v1/business-data/entities
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "sales:order:Order",
  "label": "订单"
}
```

`code` 为 **Scope:…:Entity**（冒号分层）。字段 `fieldKey` 即物化列名，后续 DataAPI 写字段必须与此一致（见 §3.3）。

### 8.3 物化

| 步骤 | 方法 | 路径 | permission code |
|------|------|------|-----------------|
| 连接列表 | GET | `/api/v1/business-data/database-connections` | `bizdata:connection:list` |
| 创建连接 | POST | `/api/v1/business-data/database-connections` | `bizdata:connection:create` |
| 测连接 | POST | `/api/v1/business-data/database-connections/{id}/test` | `bizdata:connection:test` |
| 预览 SQL/TS | POST | `/api/v1/business-data/materialization/preview` | `bizdata:materialization:preview` |
| 执行物化 | POST | `/api/v1/business-data/materialization/execute` | `bizdata:materialization:execute` |
| 物化状态 | GET | `/api/v1/business-data/materialization/status` | `bizdata:materialization:status` |

```http
POST {base_url}/api/v1/business-data/materialization/preview
Authorization: Bearer {token}
Content-Type: application/json

{ "entityIds": ["<entity-uuid>"], "connectionId": "<connection-uuid>" }
```

执行物化同样传 `entityIds` + `connectionId`。目标 Schema/库不存在时可能 `409`，确认后带 `createTargetIfMissing: true` 重试。先 `preview` 再 `execute`，不要直接对生产库 dry-run 以外的 execute。

### 8.4 添加 Mock 数据

物化成功后，向物理表插入测试行：

```http
POST {base_url}/api/v1/business-data/materialization/tables/{entityId}/mock-data?connectionId={connectionId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "rows": [
    { "orderNo": "MOCK-001", "status": "open" }
  ]
}
```

也可传 `rowCount` 让服务生成占位行。列名必须是实体 **fieldKey**。浏览已有数据：`GET /api/v1/business-data/materialization/tables/{entityId}/rows`（`bizdata:materialization:table_rows`）。

Mock 只用于联调；正式业务写入应走已发布的 DataAPI（§3），以便校验、权限与审计生效。

### 8.5 创建 / 编辑 API 服务（含测试）

编排接口在 `/api/v1/admin/api-services`（与控制台同源）。应用令牌在应用已启用 API 的前提下可调用；**写模型/物化仍必须具备对应 `bizdata:*` 授权**。只把这些写权限发给可信应用。

| 步骤 | 方法 | 路径 |
|------|------|------|
| **operation 目录（必读）** | GET | `/api/v1/admin/api-services/operations/catalog` |
| 列表 / 创建 draft | GET / POST | `/api/v1/admin/api-services` |
| 读 / 改 | GET / PATCH | `/api/v1/admin/api-services/{id}` |
| 按 code 读取 | GET | `/api/v1/admin/api-services/by-code/{code}` |
| Handler 语法检查 | POST | `/api/v1/admin/api-services/check-handler` |
| 测试上下文（参数结构 + Example） | GET | `/api/v1/admin/api-services/{id}/test-profile` |
| 生成测试参数 | POST | `/api/v1/admin/api-services/{id}/suggest-test-params` |
| 保存请求 Example | PUT | `/api/v1/admin/api-services/{id}/test-mock-parameters` |
| **执行测试** | POST | `/api/v1/admin/api-services/{id}/test` |
| 发布 / 停用 / 启用 | POST | `/api/v1/admin/api-services/{id}/publish` 等 |

创建 draft 时建议带上 `scopeCode` + `serviceSlug`（或完整 `code`）、`name`、`entityId`、`connectionId`、`enabledOperations`、`scriptMode`（`sql` / `typescript`）。TypeScript Handler 保存前先 `check-handler`；请求参数以 `requestParameterInterface` 为唯一真相源。

#### 8.5.1 一个实体应创建哪些 API（给 AI）

平台 operation 名是 **Mongo 语义 → REST** 的固定目录，**禁止自造**（没有 `getDetailById` / `inertOne` 这类名字）。机器可读清单：`GET /api/v1/admin/api-services/operations/catalog`。

**约定：一个 API 服务 = 一个主 operation。** `enabledOperations` **只传一项**，例如 `["find"]`。不要把 find/update/delete 塞进同一个服务。

对每个已物化实体，**默认创建下面这套 CRUD**（用户未指定子集时按此套件建；已存在则 skip）：

| 用途 | operation（唯一合法名） | HTTP | path 后缀 | 说明 |
|------|-------------------------|------|-----------|------|
| 列表 | `find` | GET | `''` | 分页列表；参数 `limit`/`skip`/`filter`（§4、§5） |
| 按条件取一条 | `findOne` | GET | `/one` | 等值 filter，不命中则空 |
| 按主键详情 | `findById` | GET | `/{id}` | **不要**写成 `getDetailById` |
| 是否存在 | `exists` | GET | `/exists` | 返回是否存在，不回完整行 |
| 插入一条 | `insertOne` | POST | `''` | 与 `create` **运行时等价，只建其中一个**（推荐 `insertOne`） |
| 批量插入 | `insertMany` | POST | `/many` | body 为行数组 |
| 部分更新一条 | `updateOne` | PATCH | `/{id}` | body 只含要改的 fieldKey |
| 全量替换一条 | `replaceOne` | PUT | `/{id}/replace` | 用整份文档替换 |
| 按条件批量更新 | `updateMany` | PATCH | `''` | 须有明确 filter，禁止无过滤全表更新 |
| 按主键删除 | `deleteOne` | DELETE | `/{id}` | |
| 按条件批量删除 | `deleteMany` | DELETE | `''` | 须有明确 filter，禁止无过滤全表删除 |

**按需再加**（不要默认群建）：`count` / `countDocuments`（计数）、`distinct`、`aggregate`、`save`（PUT 全量保存）、`clone`、`findOneAndUpdate`、`findOneAndDelete`。

编码建议：`code` = `{实体 Scope 前缀}:{实体末段}{操作后缀}`，后缀驼峰：`Find` / `FindOne` / `FindById` / `Exists` / `InsertOne` / `InsertMany` / `UpdateOne` / `ReplaceOne` / `UpdateMany` / `DeleteOne` / `DeleteMany`。例：实体 `sales:order:Order` → `sales:order:OrderFind`、`sales:order:OrderFindById`。创建前用 `GET .../admin/api-services?codePrefix=` 或 `by-code` 查重。

```http
POST {base_url}/api/v1/admin/api-services
Authorization: Bearer {token}
Content-Type: application/json

{
  "scopeCode": "sales:order",
  "serviceSlug": "OrderFind",
  "name": "订单列表",
  "entityId": "<entity-uuid>",
  "enabledOperations": ["find"],
  "scriptMode": "typescript"
}
```

```http
POST {base_url}/api/v1/admin/api-services/{id}/test
Authorization: Bearer {token}
Content-Type: application/json

{
  "operation": "find",
  "parameters": { "limit": 20, "skip": 0 }
}
```

每个服务创建后：`check-handler`（TS）→ `/test`（`success=true`）→ `publish`。测试会对参数做校验再执行。写类 operation 默认在事务中回滚（是否落库取决于 `apiServiceTestAutoRollback`）。发布后的调用路径是 `/api/v1/data/{routePath}`（§3），不是 admin `/test`。

#### 8.5.2 调用时对照 §3

发布后的 HTTP 方法 / path 与上表一致（见 §3.1.1）。`find` 响应必须是 `items` + `pagination`（§3.2.1）。写字段名必须是实体 **fieldKey**。

### 8.6 给 AI 的约束

- 先 `api-catalog` / `apis.json` 再发写请求，对照 `parametersSchema` 与 Example，不臆造字段名。
- 没有 `bizdata:entity:create` 等写权限时，不要尝试「先建表再补授权」。
- 不要跳过物化直接对未物化实体发 DataAPI 写操作。
- `publish` 之后用 §3 的业务 API，不要把 admin `/test` 当生产入口。
- 为实体编排 API 时：operation 名必须来自目录（`findById` 不是 `getDetailById`）；**一服务一 operation**；默认按 §8.5.1 CRUD 套件创建并查重。

---

## 9. 采集与文件

| 能力 | 方法 | 路径 |
|------|------|------|
| 采集管道 | POST | `/api/v1/ingest/{routePath}`，body 为原始字节，非 JSON |
| 轻量上传（≤100MB） | POST | `/api/v1/storage/objects/upload`（multipart：`file` + `bucketCode`） |
| 超大文件 / 断点续传 | POST / HEAD / PATCH / DELETE | `/api/v1/storage/tus`（tus 1.0，可传小文件，默认上限 5GB） |
| 续传结果 | GET | `/api/v1/storage/tus/{id}/result`（轮询至 `completed` / `duplicate`） |
| MD5 去重预检 | POST | `/api/v1/storage/objects/dedup-check`（JSON：`bucketCode` + `md5`） |
| 文件下载 | GET | `/api/v1/storage/objects/{objectId}/download` |
| 文件预览 | GET | `/api/v1/storage/objects/{objectId}/preview` |
| 图片自动裁剪 | GET | `/api/v1/storage/objects/{objectId}/crop?w=&h=&fit=`（返回 webp，磁盘缓存） |

上传均需 `Authorization: Bearer {token}`（用户 JWT 或应用 JWT）。业务字段只存返回的 **objectId（UUID）**，不要把文件二进制塞进 DataAPI。

**图片裁剪（crop）：**

- 路径参数为 **objectId**；query 支持 `w`、`h`（1–4096 像素）、`fit`（`cover` | `contain`）。
- **同时指定 w、h**：`fit=cover` 覆盖裁剪到精确尺寸；`fit=contain`（默认）按原图比例缩放到框内（不留白，输出宽高未必等于 w×h）。
- **只指定 w 或 h**：按原图比例自动计算另一边，忽略 `fit`。
- `w` 与 `h` 均未传时默认 `w=480`。
- 响应 `Content-Type: image/webp`；鉴权与 preview 相同（公开桶可匿名）。
- 内置 API 编码：`storage:object:crop`；缓存目录环境变量 `IMG_CROP_CACHE_DIR`（默认 `backend/img_crop_cache`）。

**选择哪条上传通道：**

- **≤100MB**：可用轻量 multipart；超过 **必须** 走 tus。
- tus 也可传小文件。客户端用 [tus-js-client](https://github.com/tus/tus-js-client)（或任意 tus 1.0 实现）。
- `Upload-Metadata` 必填 `bucketCode`、`filename`；可选 `contentType`、`md5`、`applicationId`。
- 最后一次 PATCH 后轮询 `/result`：`uploading` / `pending_finalize` / `finalizing` 继续等；`completed` / `duplicate` 取 `data.object`；`failed` / `expired` 失败。
- 同 Bucket 内相同内容 MD5 会去重，返回已有 object，不重复落盘。

---

## 10. AI 调用检查清单

- [ ] 已用 `application_id` + `app_secret` 换取 **应用** Token（调 DataAPI / 内置 API）
- [ ] 用户登录场景走 SSO（见 §2.3），未把应用 Token 当作用户 JWT
- [ ] 业务 API 使用正确 `routePath` 与 `operation`
- [ ] 读类过滤使用 **`filter` 对象**，未误用顶层字段
- [ ] 知悉顶层参数 / SQL `:param` 优先于 `filter`
- [ ] GET 参数走 query；复杂对象参考 OpenAPI / api-catalog
- [ ] 需要机器可读契约时拉取 `apis.json`，需要调用约定时读本 Skill
- [ ] 列表 `find` 响应含 `data.items` + `data.pagination`（total/page/pageSize/totalPages/hasNext）
- [ ] 文件：≤100MB 可用 multipart；更大必须 tus；业务只存 objectId
- [ ] 对照 `parametersSchema` 与 Example，不臆造字段名
- [ ] 若要在平台外建模 / 物化 / Mock / 编排 API：确认已授权对应 `bizdata:*`，并走 §8 流水线；编排时按 §8.5.1 为实体创建 CRUD 套件（一服务一 operation）

---

## 11. 版本记录

| 版本 | 说明 |
|------|------|
| **1.4.1** | §8.5.1：引导 AI 按平台目录为实体创建 CRUD operation 套件（一服务一 operation） |
| **1.4.0** | 新增 §8：授权 bizdata 内置 API 后，可在 EADAF 外部做数据模型设计、物化、Mock、创建/编辑/测试 API 服务 |
| **1.3.0** | 文件存储：轻量 100MB multipart + tus 断点续传、result 轮询、MD5 去重 |
| **1.2.0** | 新增用户 SSO 约定（§2.3）；区分应用 Token 与用户 JWT；链到 `docs/sso-integration-guide.md` |
| **1.1.3** | 写字段名须与 fieldKey 一致（无别名映射）；拒绝未建模列；number 校验避免 NaN 误报 |
| **1.1.2** | PATCH `body`/`set` 部分更新；GET `filter` 支持 JSON 字符串 / 顶层字段 / `filter[k]` |
| **1.1.1** | Delete/Update 等支持 REST 方法 + path id（DELETE/PATCH .../{id}）；405 统一 JSON 信封；OpenAPI 路径 `:id`→`{id}` |
| **1.1.0** | find 分页响应统一为 `items` + `pagination{ total, page, pageSize, totalPages, hasNext }` |
| **1.0.0** | 首版：鉴权、业务 API、filter 语义与优先级、API 发现、自定义 SQL `:param` 与 filter 回填 |

升级 Skill 时请递增 `version`，调用方可对比 frontmatter 或文档内版本表。
