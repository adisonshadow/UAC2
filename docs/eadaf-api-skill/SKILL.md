---
name: eadaf-api
version: 1.0.0
description: >-
  指导 AI 与外部系统集成方如何正确调用 EADAF 平台 API（鉴权、业务数据 API、参数 filter、
  OpenAPI 发现）。在对接 EADAF、编写调用脚本、解析 api-docs / apis.json 时使用本 Skill。
---

# EADAF API 调用 Skill

> **版本**：`1.0.0`（见 frontmatter `version`）  
> **适用对象**：外部应用后端、AI Agent、自动化集成脚本  
> **人类可读长文**：仓库内 `docs/external-app-integration-guide.md`

---

## 1. 快速认知

| 概念 | 说明 |
|------|------|
| **应用（Application）** | 在 EADAF 注册的外部系统实体，拥有 `application_id` + `app_secret` |
| **访问令牌（JWT）** | 用 `app_secret` 换取，默认 24h，请求头 `Authorization: Bearer {token}` |
| **内置 API** | 用户/组织/角色等平台 API，路径 `/api/v1/users` 等 |
| **业务数据 API** | 已发布的实体 REST 服务，路径 `/api/v1/data/{routePath}` |
| **公开目录** | 无需登录即可查看某应用可访问 API：`GET /api/v1/applications-public/{key}/api-catalog` |
| **OpenAPI JSON** | 机器可读契约：`GET /api/v1/applications-public/{key}/apis.json`（纯 OpenAPI 对象，无 `{code,data}` 外壳） |

`{key}` 可为应用 **code**（如 `FMMS`）或 **application_id**（UUID）。

---

## 2. 鉴权流程（必须遵守）

### 2.1 换取 Token（公开接口，无需已有 Token）

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

### 3.2 响应外壳

```json
{
  "code": 200,
  "message": "调用成功",
  "data": { ... }
}
```

读类 `find` 的 `data.preview` 或业务载荷中常见 `{ "items": [...], "count": N }`（以具体服务响应 schema 为准）。

### 3.3 参数传递方式

| 方式 | 示例 | 场景 |
|------|------|------|
| Query（GET/HEAD/DELETE） | `?limit=20&skip=0&operation=find` | 简单参数、分页 |
| JSON Body（POST） | `{"status":"open"}` | 写操作、复杂 body |
| `parameters` 嵌套（POST） | `{"parameters":{"filter":{"status":"pending"}}}` | 推荐，与测试页一致 |

GET 类 operation：**无 request body**，参数走 query string。对象型参数（如 `filter`）在 query 中需 JSON 字符串或按 OpenAPI 文档展开。

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

`find`、`count`、`findOne`、`exists`、`distinct` 等读操作在 schema 中提供 **`filter`** 对象，用于字段等值过滤。

### 4.1 正确写法

过滤条件必须放在 **`filter` 对象内**，不要误写在顶层：

```json
{
  "limit": 20,
  "skip": 0,
  "filter": {
    "status": "pending"
  }
}
```

在 API 文档 / 测试页的 **filter** 输入框中，只填内层对象即可：

```json
{"status": "pending"}
```

### 4.2 优先级（顶层 > filter）

| 来源 | 优先级 | 说明 |
|------|--------|------|
| **顶层参数字段** | 高 | 如顶层 `status`，或自定义 SQL 的 `:status` 命名参数 |
| **`filter` 内同名字段** | 低 | 仅当顶层未提供该字段时生效 |

示例：顶层 `"status": "in_progress"` 时，忽略 `filter.status`。

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
| `{"status":"pending"}` 写在顶层（非 SQL 参数场景） | 可能被校验剥离或不起过滤作用 |
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

---

## 8. 采集与文件（简述）

| 能力 | 方法 | 路径 |
|------|------|------|
| 采集管道 | POST | `/api/v1/ingest/{routePath}`，body 为原始字节，非 JSON |
| 文件上传 | POST | `/api/v1/storage/objects/upload`（multipart） |
| 文件下载 | GET | `/api/v1/storage/objects/{objectId}/download` |

---

## 9. AI 调用检查清单

- [ ] 已用 `application_id` + `app_secret` 换取 Token
- [ ] 业务 API 使用正确 `routePath` 与 `operation`
- [ ] 读类过滤使用 **`filter` 对象**，未误用顶层字段
- [ ] 知悉顶层参数 / SQL `:param` 优先于 `filter`
- [ ] GET 参数走 query；复杂对象参考 OpenAPI / api-catalog
- [ ] 需要机器可读契约时拉取 `apis.json`，需要调用约定时读本 Skill
- [ ] 对照 `parametersSchema` 与 Example，不臆造字段名

---

## 10. 版本记录

| 版本 | 说明 |
|------|------|
| **1.0.0** | 首版：鉴权、业务 API、filter 语义与优先级、API 发现、自定义 SQL `:param` 与 filter 回填 |

升级 Skill 时请递增 `version`，调用方可对比 frontmatter 或文档内版本表。
