# EADAF

企业智能数据应用底座（Enterprise AI-Driven Data Application Foundation）是一套面向企业应用的数据智能应用平台，由统一身份权限、三方应用接入、业务数据建模、API 服务与 AI 能力编排组成。本仓库是 **pnpm monorepo**。

## 1. 仓库组成

| 目录 | 说明 |
|------|------|
| `backend` | Koa + Sequelize REST API |
| `frontend` | React + Vite 管理端 |
| `AIBase_with_example` | AI Base 演示与 `@eadaf/ai-base` 源码包 |
| `deploy-offline` | 平台运行时骨架（离线 / 普通 / K8s 共用，不含业务应用） |
| `scripts/deploy` | 开发机打包脚本（平台包、应用包） |
| `deploy/EADAF`、`deploy/APP` | 打包产物目录（不入库） |

## 2. 能力概览

### 2.1 身份与访问管理（IAM）

- **成员管理**：账号全生命周期、部门归属、状态控制、密码重置
- **组织管理**：多层级部门树（邻接表 + 闭包表）
- **角色管理**：RBAC 角色定义与权限绑定
- **角色绑定**：成员、组织均可绑定多个角色；成员有效角色 = 直接角色 ∪ 组织继承角色
- **权限**：菜单、按钮、API 三级权限资源
- **认证**：登录验证码、JWT / Refresh Token、会话校验

### 2.2 应用与单点登录（SSO）

- **应用**：三方应用注册、密钥与回调配置
- **SSO**：统一认证入口，按应用配置对接（如 OAuth 2.0、SAML）
- **API 接入**：应用侧 API 连通与数据范围配置

### 2.3 业务数据（BizData）

- **数据模型**：Scope 树、ER 实体、字段、枚举、关系的可视化设计
- **数据执行**：按实体生成 DDL / 结构预览，向目标库执行物化
- **数据库连接**：支持 PostgreSQL、MongoDB、Redis 连接管理与测试
- **物化历史**：执行记录、版本 stale 状态、按连接筛选
- **AI 联动**：通过 AISurface / Tool 与对话侧联动刷新页面状态

### 2.4 AI 管理（AIBase）

- **服务商与模型**：Provider、Model、能力标签管理
- **Scopes / Tools / Skills**：工具注册、Skill 编排、应用绑定
- **AI 网关**：统一 Chat 上游转发、流式响应、Tool 调用
- **请求日志**：AI 调用审计与排查
- **前端 AI Chat**：基于 `@eadaf/ai-base` 的嵌入式对话与 Tool 步骤展示

## 3. 本地开发配置

### 3.1 环境要求

- Node.js **≥ 22.13**（与 `backend` 的 `engines` 一致）
- pnpm **10+**（仓库使用 `pnpm@10.33.2`）
- PostgreSQL 14+（开发默认 `localhost:35432`）
- Redis（开发默认 `localhost:36379`，可选）

### 3.2 安装依赖

在仓库根目录执行一次即可，不要再进 `backend` 单独 `npm install`。

```bash
pnpm install
```

### 3.3 初始化数据库

```bash
cd backend
cp .env.development .env.development.local   # 按需修改连接信息
pnpm init-db                                 # 结构 + 超管 + EADAF 全局/专用 Skill/Tool
# pnpm init-db-with-mock                     # 另含 Mock 用户/部门与销售示例实体
# pnpm init-db-with-aibase-seed              # 另含 Demo 全量 AI 种子（会 TRUNCATE Skill/Tool）
```

默认 `init-db` 会 **DROP 并重建 `uac` schema**，只用于本机或空库。它不会写入销售域测试实体。EADAF 系统 Skill（如 `bizdata-model-design`）由 `scripts/migrate-eadaf-ai-skills.sql` 幂等写入。

### 3.4 同步 Skill 与 Tool

本地改完 Skill / Tool、需要推到已有库时用下面的命令。它不重置库。

```bash
cd backend
pnpm export-eadaf-ai-skills    # 从本地库导出 upsert SQL，然后提交

# 目标库上执行
pnpm migrate-eadaf-ai-skills
```

### 3.5 启动服务

仓库根目录一条命令会先等 API 监听成功，再起前端：

```bash
pnpm dev          # API 9526 + 管理端 9527
pnpm killdev      # 停掉本次 dev 拉起的进程
```

也可以分两个终端：

```bash
cd backend && pnpm dev     # API，默认 9526，nodemon 热重载
cd frontend && pnpm dev    # 管理端，默认 9527
```

- 管理端：<http://localhost:9527>
- API 文档：<http://localhost:9526/swagger>
- 健康检查：`curl http://localhost:9526/api/v1/health`

### 3.6 默认账号

`init-db` 创建超级管理员 **admin / 123456**（见 `backend/scripts/superadmin.sql`）。初始化完成后尽快修改密码。

## 4. pm2 托管

前后端都提供 `pm2dev` / `pm2prod`。底层是 `pm2 startOrReload`：没在跑就启动，已在跑就按新配置重载，重复执行不会多出进程。

pm2 是 workspace 的 devDependency，不必全局安装。根目录用 `pnpm --filter ./backend exec pm2 <cmd>`；进到包目录后可以直接用 `pm2`。

### 4.1 启动

```bash
# 仓库根目录同时挂起前后端
pnpm pm2dev        # 开发：uac-api-dev + eadaf-web-dev
pnpm pm2prod       # 生产：uac-api + eadaf-web

# 或只挂一边
pnpm --filter ./backend pm2dev
pnpm --filter ./frontend pm2prod
```

### 4.2 进程对照

| 命令 | pm2 进程名 | 说明 |
|------|-----------|------|
| `backend pm2dev` | `uac-api-dev` | `NODE_ENV=development`，pm2 watch 文件变更后自动重启 |
| `backend pm2prod` | `uac-api` | `NODE_ENV=production`，加载 `.env.production` |
| `frontend pm2dev` | `eadaf-web-dev` | Vite 开发服务（9527，自带 HMR） |
| `frontend pm2prod` | `eadaf-web` | `vite preview` 托管已构建的 `dist`。需要先 `pnpm --filter ./frontend build`。`/api/v1` 代理到 `localhost:9526` |

配置文件：`backend/ecosystem.config.cjs`、`frontend/ecosystem.config.cjs`。每个文件里有 dev / prod 两个进程，脚本用 `--only` 选择。

### 4.3 常用操作

```bash
pm2 list                       # 查看进程
pm2 logs uac-api --lines 200   # 查看日志
pm2 stop uac-api-dev           # 停止（保留进程项）
pm2 delete uac-api eadaf-web   # 移除进程项
pm2 kill                       # 关闭 pm2 守护进程
```

## 5. 打包与部署

开发机打出压缩包，到 Linux 服务器上再安装。平台包不含业务应用。只支持 CentOS、Ubuntu、Debian，以及 amd64 / arm64。

现场步骤见 [deploy-offline/README-offline.md](./deploy-offline/README-offline.md)。服务器上用 Node 直接跑开发环境见 [docs/dev-server-deploy.md](./docs/dev-server-deploy.md)。

### 5.1 三种运行模式

三种模式共用同一套程序镜像，差别只在目标机如何准备 Docker 或 K8s。

| 模式 | 现场如何准备运行时 | 程序镜像 |
|------|------------------|----------|
| 离线 | 包内静态 Docker | 包内 `docker load` |
| 普通 | 目标机能上网，用 yum/apt 安装 Docker；已经装好则跳过 | 包内 `docker load` |
| K8s | 最小清单，`hostPort`，副本数 1。不含 Helm、不含 Ingress | 导入到节点（`k3s ctr` / `ctr -n k8s.io` / `docker load`） |

应用包不分模式。现场 `apply.sh` 读取平台目录里的 `.deploy-mode`，再走 Compose 或 `kubectl`。

导出在开发机完成，得到 `.tar.gz`。导入在目标 Linux 上完成：先导入 EADAF 包，平台起来之后再导入应用包。

### 5.2 导出 EADAF 包

在本仓库根目录执行。交互顺序：模式 → 默认发行版 → CPU 架构 → 安装 / 升级 / 补丁 →（仅安装包）前后端端口 → 版本 → 输出目录。

```bash
pnpm pack:eadaf
```

默认写到 `deploy/EADAF/`。文件名：

| 种类 | 文件名 |
|------|--------|
| 安装、升级 | `eadaf-<模式>-<种类>-<架构>-v<版本>-<日期>.tar.gz` |
| 补丁 | `eadaf-<模式>-patch-<种类>-<架构>-v<版本>-<日期>.tar.gz` |

补丁种类是 `web`（前端）、`api`（后端）、`bizdata`（数据），多选用 `web+api`。只有数据补丁时文件名不带架构。

| 种类 | 包里有什么 |
|------|------------|
| 安装 | 运行时引导 + 全部程序镜像 + 前端 dist + 初始化 SQL。端口只写入宿主机映射，容器内仍是 API `9526`、Web `9527` |
| 升级 | 程序镜像 + 前端 dist + 尚未执行的表结构 SQL |
| 补丁 | 只含所选种类。数据补丁只含系统应用 `EADAF` 的 BizData 模型 upsert |

数据补丁从开发库读取 `EADAF` 的 `bizdata_scope_codes`。没有 scope、或 scope 下没有实体时，导出失败，不会打出空包或整库。

兼容入口（只出离线包）：

```bash
pnpm offline:deploy                              # 离线安装包，默认 centos + amd64
OFFLINE_OS=ubuntu OFFLINE_ARCH=arm64 pnpm offline:deploy
pnpm offline:patch eadaf-api                     # 后端补丁
pnpm offline:patch eadaf-web                     # 前端补丁
pnpm offline:patch all                           # web + api
```

### 5.3 导出应用包

在本仓库根目录执行，源码指向应用仓库。交互顺序：应用目录 → CPU 架构（与 EADAF 包一致）→ 安装 / 升级 / 补丁 →（仅安装包）应用前后端端口 → 版本 → 输出目录。

```bash
pnpm pack:app
```

应用仓库根目录需要 `eadaf.app.yaml`。FPCU2 使用 `preset: fpcu2`，示例见 `scripts/deploy/app-presets/fpcu2/eadaf.app.yaml.example`。

默认写到 `deploy/APP/`。文件名不含离线 / 普通 / K8s：

| 种类 | 文件名 |
|------|--------|
| 安装、升级 | `<应用名>-<种类>-<架构>-v<版本>-<日期>.tar.gz` |
| 补丁 | `<应用名>-patch-<种类>-<架构>-v<版本>-<日期>.tar.gz` |

应用数据补丁写入的是该应用在 EADAF 里的 BizData，不是应用自带的另一套库。

### 5.4 导入 EADAF 包

把对应 `.tar.gz` 拷到目标机后解压。安装包解压出来的目录名是 `deploy-offline`。升级包和补丁包的目录名与压缩包文件名相同，不要直接盖到正在运行的目录上。

#### 5.4.1 导入安装包

离线或普通：

```bash
tar -zxf eadaf-offline-install-amd64-v1.2.0-20261007.tar.gz
cd deploy-offline
# 编辑 .env：PUBLIC_HOST、JWT_SECRET、ENCRYPTION_KEY、数据库口令
chmod +x start.sh up.sh status.sh ctl.sh init-db.sh
./start.sh
```

K8s 安装包在同一目录执行 `./k8s/install.sh`。

非交互示例：`./start.sh --os ubuntu --arch amd64 --action up`。

#### 5.4.2 导入升级包或补丁包

`DEPLOY_ROOT` 指向已经在跑的平台目录。升级保留 `.env` 和数据卷，不重装 Docker / 集群。补丁不跑表结构迁移。

```bash
tar -zxf eadaf-offline-upgrade-amd64-v1.2.0-20261007.tar.gz
cd eadaf-offline-upgrade-amd64-v1.2.0-20261007
DEPLOY_ROOT=/path/to/deploy-offline ./apply.sh
```

补丁包同样是解压后执行 `./apply.sh`。升级用 `uac.schema_migrations` 记账；旧库第一次升级只把 `schema-baseline.txt` 里已发布过的 SQL 记为已执行，不重放。

若现场还留着旧整包里的 FPCU 容器，这次升级不会删除它们。之后用应用包接管。

### 5.5 导入应用包

先完成第 5.4 节，确认 EADAF 已经启动，再导入应用包。`apply.sh` 读取平台目录里的 `.deploy-mode`，离线 / 普通走 Compose，K8s 走 `kubectl apply`。

```bash
tar -zxf fpcu2-install-amd64-v0.1.3-20261007.tar.gz
cd fpcu2-install-amd64-v0.1.3-20261007
DEPLOY_ROOT=/path/to/deploy-offline ./apply.sh
```

应用的升级包、补丁包用同一条命令。应用包不负责安装 Docker 或创建集群。

## 6. 注意事项

### 6.1 不要对已有数据的库执行 init-db

`pnpm init-db` 会 DROP 并重建 `uac` schema。已有库只执行对应的 `migrate-*.sql`，或按第 5.4.2 节导入升级包。

### 6.2 端口

本地开发默认 API `9526`、管理端 `9527`，监听 `0.0.0.0`。修改本地端口时同时改 `backend/.env.*` 与 `frontend/config/env.ts`。

发给客户的安装包只改宿主机映射和 `EADAF_PUBLIC_URL`。容器内端口保持 9526 / 9527，nginx 把 `/api` 反代到 `eadaf-api:9526`。前端生产构建使用相对路径 `/api/v1`。

### 6.3 配置文件

后端以 `.env.development` / `.env.production` 为准，不读 `config.json`。

### 6.4 构建前端前先构建 AI Base

本仓库通过 workspace 引用 `@eadaf/ai-base`，没有把它发布到 npm。修改 `AIBase_with_example/package/ai-base` 后先在该目录 `pnpm build`，再构建前端。前端也可执行 `pnpm refresh:ai-base` 刷新依赖。

### 6.5 业务数据物化

目标 Schema 或库不存在时，前端会提示确认，然后自动创建（PostgreSQL / MongoDB）。

## 7. 相关文档

1. [deploy-offline/README-offline.md](./deploy-offline/README-offline.md) — 导出与导入 EADAF 包、应用包
2. [docs/dev-server-deploy.md](./docs/dev-server-deploy.md) — 服务器 DEV 部署（目录、Docker、nvm、init-db、pm2）
3. [backend/README.md](./backend/README.md) — API 服务
4. [frontend/README.md](./frontend/README.md) — 管理端前端
