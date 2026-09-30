# EADAF + FPCU2 离线部署说明（生产）

目标：CentOS 8 x86_64 完全离线运行 **EADAF** 与业务应用 **FPCU2**（仅生产，无开发模式）。

仓库内 `deploy-offline/` **跟踪脚本与配置**（可进 GitHub）；镜像 tar、前端 dist、整包/补丁压缩包等大文件不入库，由 `pnpm offline:deploy` / `pnpm offline:patch` 生成后放在：

- `deploy-offline/docker-images/*.tar`
- `deploy-offline/frontend/dist/`
- `deploy-offline/releases/*.tar.gz`（发给客户的整包与补丁）

## 端口（保持与开发环境一致）

| 服务 | 容器名 | 端口 |
|------|--------|------|
| EADAF 管理端 | **EADAF-web** | **9527** |
| EADAF API | EADAF-api | **9526** |
| FPCU2 管理端 | FPCU2-web | **13308** |
| FPCU2 BFF | FPCU2-bff | **13303** |
| Postgres | EADAF-postgres | 35432 |
| Redis | EADAF-redis | 36379 |
| MySQL（BizData 可选） | EADAF-mysql | 13306 |

## 1. 安装静态 Docker（仅首次）

```bash
cd centos-docker-static
chmod +x install-docker-static.sh
./install-docker-static.sh
docker info
docker-compose version
```

按需放行防火墙：

```bash
firewall-cmd --add-port=9526/tcp --permanent
firewall-cmd --add-port=9527/tcp --permanent
firewall-cmd --add-port=13303/tcp --permanent
firewall-cmd --add-port=13308/tcp --permanent
firewall-cmd --reload
```

## 2. 修改配置

编辑 `.env`：

1. 将 `PUBLIC_HOST` 改为服务器局域网 IP（不含 `http://`）
2. 修改 `JWT_SECRET`、`ENCRYPTION_KEY`、数据库口令
3. 确认 `FPCU2_APP_SECRET`（与 SSO 一致）

`./up.sh` / `./ctl.sh` 会按 `PUBLIC_HOST` 自动写入：

- `EADAF_PUBLIC_URL` → `http://<PUBLIC_HOST>:9527`
- `FPCU2_PUBLIC_URL` → `http://<PUBLIC_HOST>:13308`
- `SSO_CALLBACK_URL` → `http://<PUBLIC_HOST>:13303/auth/callback`

## 3. 一键启动

```bash
chmod +x up.sh status.sh ctl.sh init-db.sh seed-fpcu.sh
./up.sh
```

`up.sh` 强制流水线：

1. 预检（`.env`、镜像 tar、`frontend/dist`）
2. 加载全部镜像
3. 起 postgres / redis / mysql 并等待 healthy
4. 初始化库 + 注册 FPCU 应用
5. 起 eadaf-api → eadaf-web / fpcu2-bff / fpcu2-web，逐步等待
6. FPCU seed
7. **`./status.sh` 巡检失败则整体失败**（不会假报「启动完成」）

## 4. 中途失败 / 只有数据库在跑时如何继续

典型现象：`docker ps` 里只有 **EADAF-postgres / EADAF-redis / EADAF-mysql**，没有 **EADAF-api、EADAF-web、FPCU2-bff、FPCU2-web**（端口 9526 / 9527 / 13303 / 13308 都起不来）。说明上次 `./up.sh` 在应用阶段失败或中断了。

**不要**卸 Docker，也**不要**执行 `docker compose down -v`（会清掉已初始化的库数据）。

### 推荐：直接再跑一遍 `./up.sh`

现场目录须是带 `docker-images/*.tar` 与 `frontend/dist` 的完整包（可用新整包覆盖脚本与资源，保留已有 `.env` 与数据卷）：

```bash
cd /path/to/deploy-offline

# 确认 .env 中 PUBLIC_HOST、JWT_SECRET、ENCRYPTION_KEY、数据库口令等正确
vi .env

chmod +x up.sh status.sh ctl.sh init-db.sh seed-fpcu.sh
./up.sh
```

`up.sh` 可重复执行：数据库已在跑会直接过；`init-db.sh` 发现已有表会跳过 DROP；随后补起 **eadaf-api → eadaf-web / fpcu2-bff / fpcu2-web**，再 seed 并以 `./status.sh` 判定是否成功。

### 备选：只补四个应用服务（库不动）

```bash
cd /path/to/deploy-offline
./ctl.sh load-images eadaf-api eadaf-web fpcu2-bff fpcu2-web
./ctl.sh reinstall eadaf-api eadaf-web fpcu2-bff fpcu2-web
./ctl.sh seed --force   # 上次若未 seed 成功再跑
./status.sh
```

### 仍失败时排查

```bash
./ctl.sh status
./ctl.sh logs eadaf-api --tail 100
./ctl.sh logs eadaf-web --tail 100
ls frontend/dist/index.html   # 缺这个 EADAF-web 起不来
ls docker-images/*.tar        # 确认镜像 tar 在包内
```

注意：新编排容器名是 **EADAF-web**，不是旧包的 `EADAF-nginx`。仅拷贝脚本骨架、没有镜像 tar / `frontend/dist` 时无法补装应用。

## 5. 状态查看（必用）

```bash
./status.sh
# 或
./ctl.sh status
```

会打印每个模块的容器状态 / health / 端口，并探测：

- `http://127.0.0.1:9527/`（EADAF web）
- `http://127.0.0.1:9526/api/v1/health`
- `http://127.0.0.1:13308/`（FPCU2 web）
- `http://127.0.0.1:13303/health`

## 6. 分模块运维 / 覆盖重装

```bash
./ctl.sh ps
./ctl.sh logs eadaf-web --tail 100
./ctl.sh logs eadaf-api -f
./ctl.sh restart eadaf-web
./ctl.sh load-images eadaf-web          # 只重新 docker load 对应 tar
./ctl.sh reinstall eadaf-web            # load + force-recreate + status
./ctl.sh reinstall eadaf-api
./ctl.sh reinstall all                  # 覆盖重建全部模块（不删数据卷）
./ctl.sh seed --force                   # 强制重跑 FPCU seed
./ctl.sh down                           # 停栈，保留 volume
```

模块名：`postgres` `redis` `mysql` `eadaf-api` `eadaf-web` `fpcu2-bff` `fpcu2-web`

`reinstall` **不会**删除数据库 volume。要彻底清空数据需手动：

```bash
./ctl.sh down
# 危险：docker compose down -v
```

## 7. 「看不到 web」排查

1. `./ctl.sh status` — 看 **EADAF-web** / **FPCU2-web** 是否 running + healthy
2. `docker ps -a | grep -E 'EADAF-web|FPCU2-web'`
3. `./ctl.sh logs eadaf-web --tail 100`
4. 确认 `ls frontend/dist/index.html`
5. 覆盖重装前端：`./ctl.sh reinstall eadaf-web`
6. 宿主机日志：`./logs/nginx/`、`./logs/fpcu2-nginx/`

旧包里容器名可能是 `EADAF-nginx`；新编排已改为 **`EADAF-web`**。请用新版 `docker-compose.yml` + 运维脚本覆盖现场后再 `./ctl.sh reinstall eadaf-web`。

## 8. 运行日志（宿主机保留）

- EADAF API：`./logs/api/`
- EADAF Nginx：`./logs/nginx/`
- FPCU2 Nginx：`./logs/fpcu2-nginx/`

## 9. 验证账号

- EADAF：`http://<PUBLIC_HOST>:9527`（默认超管见 seed，尽快改密）
- FPCU2：`http://<PUBLIC_HOST>:13308`（SSO 登录跳转 EADAF）

## 10. 单模块升级小包（发给客户）

在开发机构建独立补丁（不必整包 `offline:deploy`）：

```bash
# 四个应用服务任选
pnpm offline:patch eadaf-api
pnpm offline:patch eadaf-web
pnpm offline:patch fpcu2-bff
pnpm offline:patch fpcu2-web

# 或一次打出 4 个独立包
pnpm offline:patch all
```

产物：`deploy-offline/releases/deploy-offline-patch-<模块>-v1.0.tar.gz`。

客户侧：

```bash
tar -zxvf deploy-offline-patch-fpcu2-bff-v1.0.tar.gz
cd deploy-offline-patch-fpcu2-bff-v1.0
DEPLOY_ROOT=/path/to/deploy-offline ./apply.sh
```

只覆盖对应服务，不删数据库。

整包归档同样在 `deploy-offline/releases/deploy-offline-v1.0.tar.gz`（由 `pnpm offline:deploy` 生成）。

## 注意

- 本包无 Node 开发环境、无 Vite / nodemon。
- `init-db.sh` 在 schema 已有表时跳过 DROP，仍会幂等注册 FPCU 应用。
- `seed-fpcu.sh` 用 `data/.fpcu-seeded` 标记；`./ctl.sh seed --force` 可重跑。
- 镜像架构须为 `linux/amd64`。
