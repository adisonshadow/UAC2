# EADAF

**EADAF** 企业智能数据应用底座（Enterprise AI-Driven Data Application Foundation）是一套面向企业应用的数据智能应用平台，由统一身份权限、三方应用接入、业务数据建模、API服务与 AI 能力编排组成。

本仓库为 **pnpm monorepo**，主要包含：

| 目录 | 说明 |
|------|------|
| `backend` | Koa + Sequelize REST API |
| `rontend` | React + Vite 管理端 |
| `AIBase_with_example` | AI Base 演示与 `@eadaf/ai-base` 源码包 |

---

## 能力概览

### 身份与访问管理（IAM）

- **成员管理**：账号全生命周期、部门归属、状态控制、密码重置
- **组织管理**：多层级部门树（邻接表 + 闭包表）
- **角色管理**：RBAC 角色定义与权限绑定
- **角色绑定**：成员、组织均可绑定多个角色；成员有效角色 = 直接角色 ∪ 组织继承角色
- **权限**：菜单、按钮、API 三级权限资源
- **认证**：登录验证码、JWT / Refresh Token、会话校验

### 应用与单点登录（SSO）

- **应用**：三方应用注册、密钥与回调配置
- **SSO**：统一认证入口，支持多种 SSO 协议对接（如 OAuth 2.0、SAML 等，按应用配置）
- **API 接入**：应用侧 API 连通与数据范围配置

### 业务数据（BizData）

- **数据模型**：Scope 树、ER 实体、字段、枚举、关系的可视化设计
- **数据执行**：按实体生成 DDL / 结构预览，向目标库执行物化
- **数据库连接**：支持 PostgreSQL、MongoDB、Redis 连接管理与测试
- **物化历史**：执行记录、版本 stale 状态、按连接筛选
- **AI 联动**：通过 AISurface / Tool 与对话侧联动刷新页面状态

### AI 管理（AIBase）

- **服务商与模型**：Provider、Model、能力标签管理
- **Scopes / Tools / Skills**：工具注册、Skill 编排、应用绑定
- **AI 网关**：统一 Chat 上游转发、流式响应、Tool 调用
- **请求日志**：AI 调用审计与排查
- **前端 AI Chat**：基于 `@eadaf/ai-base` 的嵌入式对话与 Tool 步骤展示

---

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+（开发默认 `localhost:35432`）
- Redis（开发默认 `localhost:36379`，可选）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 初始化数据库（后端）

```bash
cd backend
cp .env.development .env.development.local   # 按需修改连接信息
npm install
npm run init-db-with-aibase-seed            # 含 UAC + AIBase + 业务数据种子
```

### 3. 启动服务

```bash
# 终端 1：API（默认 9526，nodemon 热重载）
cd backend && npm run dev

# 终端 2：前端（默认 9527）
cd rontend && pnpm dev
```

- 管理端：<http://localhost:9527>
- API 文档：<http://localhost:9526/swagger>
- 健康检查：`curl http://localhost:9526/api/v1/health`

### 4. 默认账号

`init-db` 会创建超级管理员（见 `backend/scripts/superadmin.sql`）。**初始化完成后请尽快修改或删除该账号。**

---

## 关键注意事项

1. **`init-db` 会 DROP 并重建 `uac` schema**，仅用于开发/首次安装，勿对生产库执行。
2. **端口约定**：API `9526`、前端 `9527`；修改时需同步 `backend/.env.*` 与 `rontend/config/env.ts` 中的 `CORS_ORIGIN` / `devApiBaseUrl`。
3. **配置入口**：后端以 `.env.development` / `.env.production` 为准（非 `config.json`）。
4. **AI Base 联动**：修改 `AIBase_with_example/package/ai-base` 后需 `pnpm build`，前端可执行 `pnpm refresh:ai-base` 刷新依赖。
5. **增量迁移**：部分功能有独立 SQL（如 `scripts/migrate-*.sql`），在已有库上按需手动执行。
6. **业务数据物化**：目标 Schema/库不存在时，前端会提示确认后自动创建（PostgreSQL / MongoDB）。

---

## 子项目文档

- [backend/README.md](./backend/README.md) — API 服务
- [rontend/README.md](./rontend/README.md) — 管理端前端
