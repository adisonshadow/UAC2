# EADAF 平台部署

本目录是平台运行时骨架。发给客户的压缩包在开发机生成，解压后的目录名仍是 `deploy-offline`。业务应用不在这个包里。

支持 CentOS、Ubuntu、Debian，以及 amd64 / arm64。

## 开发机打包

```bash
pnpm pack:eadaf
# 或非交互
bash scripts/deploy/pack-eadaf.sh --mode offline --os centos --arch amd64 --kind install --non-interactive --yes
```

| 种类 | 内容 |
|------|------|
| 安装 | 运行时引导 + 全部程序镜像 + 前端 dist + 初始化 SQL。安装时写入宿主机端口（容器内仍是 9526/9527） |
| 升级 | 程序镜像 + dist + 尚未执行的表结构 SQL。保留 `.env` 和数据卷，不重装 Docker / 集群 |
| 补丁 | `web` 前端、`api` 后端、`bizdata` 数据，可多选 |

数据补丁只 upsert 系统应用 EADAF 的 bizdata 模型（Scope、实体、字段、枚举、关系、API 服务、指标与管道）。不改表结构，不覆盖物化后的业务行。打包时机读开发库；没有对应 scope 的实体会失败，不会打空包。

产物默认在 `deploy/EADAF/`。

应用包：

```bash
pnpm pack:app
```

应用根目录需要 `eadaf.app.yaml`。FPCU2 可用 `preset: fpcu2`，示例在 `scripts/deploy/app-presets/fpcu2/eadaf.app.yaml.example`。产物在 `deploy/APP/`，文件名不含部署模式。

## 现场：离线或普通

```bash
cd deploy-offline
# 修改 .env：PUBLIC_HOST、JWT_SECRET、ENCRYPTION_KEY、数据库口令
chmod +x start.sh
./start.sh
```

- 离线：安装包内静态 Docker
- 普通：`install-docker.sh` 发现 Docker 已可用则跳过，否则用 yum/apt 安装（需要外网）

非交互：`./start.sh --os ubuntu --arch amd64 --action up`

`./up.sh` 会加载镜像、启动 Postgres / Redis / MySQL、初始化库、启动 API 与 Web，最后用 `./status.sh` 判断是否成功。库里已有表时不会 DROP。

```bash
./ctl.sh reinstall eadaf-web
./ctl.sh logs eadaf-api --tail 100
./ctl.sh down          # 停栈，保留数据卷
```

## 现场：K8s

```bash
./k8s/install.sh
```

镜像用 `k3s ctr`、`ctr -n k8s.io` 或 `docker load` 导入。对外端口是 Pod 的 `hostPort`，副本数为 1。没有 Helm，也没有 Ingress。

## 升级与补丁

在平台目录之外解压升级包或补丁包后：

```bash
DEPLOY_ROOT=/path/to/deploy-offline ./apply.sh
```

升级会先把 `schema-baseline.txt` 里的历史 SQL 记为已执行（旧库没有 `schema_migrations` 时），再只跑清单里未记录的新文件。

若现场还有旧整包留下的 FPCU 容器，平台升级不会删它们。之后用应用包接管。

## 应用包

平台已启动后：

```bash
DEPLOY_ROOT=/path/to/deploy-offline ./apply.sh
```

脚本读取平台的 `.deploy-mode`，走 compose 或 `kubectl apply`。应用的数据补丁写入的是该应用在 EADAF 里的 bizdata，不是另一套数据库。
