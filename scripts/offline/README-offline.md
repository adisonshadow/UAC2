# EADAF + FPCU2 离线部署说明（生产）

目标：CentOS 8 x86_64 完全离线运行 **EADAF** 与业务应用 **FPCU2**（仅生产，无开发模式）。

## 端口（保持与开发环境一致）

| 服务 | 端口 |
|------|------|
| EADAF 管理端 | **9527** |
| EADAF API | **9526** |
| FPCU2 管理端 | **13308** |
| FPCU2 BFF | **13303** |
| Postgres（宿主机映射） | 35432 |
| Redis（宿主机映射） | 36379 |
| MySQL（宿主机映射，BizData 可选） | 13306 |

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

`./up.sh` 会按 `PUBLIC_HOST` 自动写入：

- `EADAF_PUBLIC_URL` → `http://<PUBLIC_HOST>:9527`
- `FPCU2_PUBLIC_URL` → `http://<PUBLIC_HOST>:13308`
- `SSO_CALLBACK_URL` → `http://<PUBLIC_HOST>:13303/auth/callback`

## 3. 一键启动

```bash
chmod +x up.sh init-db.sh seed-fpcu.sh
./up.sh
```

流程：加载镜像 → 起依赖 → 初始化 EADAF 库并注册 FPCU 应用 → 起 API/Web/BFF → FPCU 业务 seed。

## 4. 验证

- EADAF：`http://<PUBLIC_HOST>:9527`（默认超管见 seed，尽快改密）
- FPCU2：`http://<PUBLIC_HOST>:13308`（SSO 登录跳转 EADAF）
- 健康检查：
  - `curl -s http://127.0.0.1:9526/api/v1/health`
  - `curl -s http://127.0.0.1:13303/health`

## 5. 运行日志（宿主机保留）

- EADAF API：`./logs/api/`
- EADAF Nginx：`./logs/nginx/`
- FPCU2 Nginx：`./logs/fpcu2-nginx/`

## 6. 常用命令

```bash
docker-compose ps
docker-compose logs -f eadaf-api
docker-compose logs -f fpcu2-bff
docker-compose down
```

## 注意

- 本包无 Node 开发环境、无 Vite / nodemon。
- `init-db.sh` 在 schema 已有表时跳过 DROP，仍会幂等注册 FPCU 应用。
- `seed-fpcu.sh` 用 `data/.fpcu-seeded` 标记，避免重复 seed。
- 镜像架构须为 `linux/amd64`。
