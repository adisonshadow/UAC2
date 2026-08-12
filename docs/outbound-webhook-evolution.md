# 提交外部 API（Outbound Webhook）演化路线

> 产品入口：**API 服务 → 提交外部 API**（`/api_services/outbound-webhooks`）  
> 方向：EADAF **主动调用外部系统**（出站），与 [外部应用接入指南](./external-app-integration-guide.md)（外部调入 EADAF）互补。

---

## 1. 现状与已落地能力

### 核心链路

业务 Data API（HTTP）调用成功 → `api_hook` → 运行 `transform_script` → 按配置 HTTP 外呼 → 写入 `outbound_webhook_runs`。  
外呼失败只记日志 / run，**不阻断**业务 API 主流程。

### 本轮（P1）已具备

| 能力 | 说明 |
|------|------|
| CRUD / 发布 / 禁用 / 测试 | 管理端真实接口，非纯 Demo |
| 请求结构（TS interface） | 文档与 AI 生成用 |
| 请求 Demo（JSON Example） | 与 API 服务同类双栏 |
| HTTP Method | 默认 `POST`，支持 `PUT` / `PATCH` |
| 可选鉴权 | `none` / `bearer` / `api_key`；密钥加密落库（编辑页掩码，空提交保留） |
| 密钥发送方式 | Bearer 头；API Key 可选 Header 或 Query |
| 响应契约 | 成功 / 异常 Schema + Example |
| 异常判定规则 | 如 `code != 200`、`isOK != 'SUCCESS'`；默认非 2xx HTTP 亦判失败 |
| 触发明细 | 表单内说明 hook 时机、入参形态、失败不阻断 |

### 刻意不做的产品边界

- **不**新建独立「钩子管理中心」（见下节）
- 出站契约文档面向管理员配置，**不**写入外部应用接入指南主体（该指南讲入站）

---

## 2. 钩子架构判断：为何暂不建「钩子管理中心」

| 论据 | 说明 |
|------|------|
| 已有产品位 | 「提交外部 API」即当前唯一出站 hook（`trigger_type = api_hook`） |
| 触发源单一 | 仅业务 Data API **HTTP 成功路径**；无多源事件可管 |
| 空壳风险 | 独立中心在只有一种订阅时会增加导航与概念成本，收益低 |
| 演进路径 | **先把本模块触发明细与可靠性做实**；出现第二类触发源后再抽中心 |

**何时该建独立钩子 / 事件中心（进入 P3 的门槛）：**

- 至少两类稳定触发源（例如：业务 API + 采集成功 / 定时 / 域事件）
- 需要跨模块统一订阅、重试策略、审计视图
- 同一事件需扇出到多个异构动作（不只 HTTP 外呼）

在此之前：继续在本模块扩展 `trigger_type` 与明细 UI，避免过早抽象。

---

## 3. 分阶段路线图

### P1（本轮）— 契约与可选鉴权

- [x] Method、请求 Demo、响应成功/异常 + 规则求值
- [x] 可选鉴权与密钥缓存（加密 + 掩码）
- [x] 触发明细（非独立中心）
- [x] 本文档

### P2 — 运维与可靠性

- 列表：禁用按钮、状态筛选、`disabled` 展示修正
- 运行历史 UI（`GET /:id/runs` 已有后端）
- 非阻塞异步触发（当前 `await` 在业务 API 请求路径上）
- 可配置超时 / 重试 / DLQ
- 触发条件过滤（仅业务成功码、按 operation、字段表达式）
- AI Skill surface 与 `ApiServicesAI` 挂载对齐

### P3 — 多源钩子 / 事件中心

- 独立钩子管理中心（或事件订阅中心）
- 多 `trigger_type`：ingest 成功、定时、域事件等
- SSE / WebSocket 调用路径是否触发的策略
- 统一审计与告警入口

### P4 — 协议与高级鉴权

- 非 JSON：`application/xml`、`form-urlencoded` 等 Content-Type
- HMAC 签名出站
- OAuth2 client-credentials（含 token 缓存与刷新）
- 限流、熔断、失败告警通道

---

## 4. 与入站文档的关系

| 文档 | 方向 |
|------|------|
| [external-app-integration-guide.md](./external-app-integration-guide.md) | 外部系统 → EADAF（应用 Token、DataAPI、ingest、SSO） |
| 本文档 | EADAF → 外部系统（提交外部 API / 未来钩子中心） |

出站一般**不依赖**外部应用的入站 JWT；密钥由管理员在出站配置中单独维护。

---

## 5. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-08-10 | 初版：P1 契约增强范围与钩子中心判断 |
