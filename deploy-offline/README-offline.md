# EADAF 平台部署

本目录是平台运行时骨架。EADAF 包和应用包都在开发机导出，再拷到 Linux 上导入。支持 CentOS、Ubuntu、Debian，以及 amd64 / arm64。

先导入 EADAF 包，平台启动后再导入应用包。应用包不含运行时安装，它读取平台目录里的 `.deploy-mode`。

## 1. 导出

在 EADAF 仓库根目录执行。

### 1.1 导出 EADAF 包

```bash
pnpm pack:eadaf
# 非交互示例
bash scripts/deploy/pack-eadaf.sh --mode offline --os centos --arch amd64 --kind install --non-interactive --yes
```

交互顺序：模式 → 默认发行版 → CPU 架构 → 安装 / 升级 / 补丁 →（仅安装包）前后端端口 → 版本 → 输出目录。

默认目录 `deploy/EADAF/`。

| 种类 | 内容 |
|------|------|
| 安装 | 运行时引导 + 全部程序镜像 + 前端 dist + 初始化 SQL。端口只写入宿主机映射，容器内仍是 9526 / 9527 |
| 升级 | 程序镜像 + dist + 尚未执行的表结构 SQL。保留现场 `.env` 与数据卷 |
| 补丁 | `web` 前端、`api` 后端、`bizdata` 数据，可多选 |

数据补丁只 upsert 系统应用 EADAF 的 BizData 模型（Scope、实体、字段、枚举、关系、API 服务、指标与管道）。不改表结构，不覆盖物化后的业务行。开发库里没有对应 scope 的实体时导出失败。

### 1.2 导出应用包

```bash
pnpm pack:app
```

交互顺序：应用目录 → CPU 架构（与 EADAF 包一致）→ 安装 / 升级 / 补丁 →（仅安装包）应用前后端端口 → 版本 → 输出目录。

应用根目录需要 `eadaf.app.yaml`。FPCU2 可用 `preset: fpcu2`，示例在 `scripts/deploy/app-presets/fpcu2/eadaf.app.yaml.example`。

默认目录 `deploy/APP/`。文件名不含部署模式。应用的数据补丁写入该应用在 EADAF 中的 BizData。

## 2. 导入 EADAF 包

### 2.1 导入安装包（离线或普通）

安装包解压后的目录名是 `deploy-offline`。

```bash
tar -zxf eadaf-offline-install-amd64-v1.2.0-20261007.tar.gz
cd deploy-offline
# 编辑 .env：PUBLIC_HOST、JWT_SECRET、ENCRYPTION_KEY、数据库口令
chmod +x start.sh
./start.sh
```

- 离线：安装包内的静态 Docker
- 普通：`install-docker.sh` 发现 Docker 已可用则跳过，否则用 yum/apt 安装（需要外网）

非交互：`./start.sh --os ubuntu --arch amd64 --action up`。

`./up.sh` 会加载镜像、启动 Postgres / Redis / MySQL、初始化库、启动 API 与 Web，最后用 `./status.sh` 判断是否成功。库里已有表时不会 DROP。

```bash
./ctl.sh reinstall eadaf-web
./ctl.sh logs eadaf-api --tail 100
./ctl.sh down          # 停栈，保留数据卷
```

### 2.2 导入安装包（K8s）

```bash
tar -zxf eadaf-k8s-install-amd64-v1.2.0-20261007.tar.gz
cd deploy-offline
./k8s/install.sh
```

镜像用 `k3s ctr`、`ctr -n k8s.io` 或 `docker load` 导入。对外端口是 Pod 的 `hostPort`，副本数为 1。

### 2.3 导入升级包或补丁包

在平台目录之外解压，再用 `DEPLOY_ROOT` 指到正在运行的 `deploy-offline`。

```bash
tar -zxf eadaf-offline-upgrade-amd64-v1.2.0-20261007.tar.gz
cd eadaf-offline-upgrade-amd64-v1.2.0-20261007
DEPLOY_ROOT=/path/to/deploy-offline ./apply.sh
```

升级先把 `schema-baseline.txt` 里的历史 SQL 记为已执行（旧库没有 `schema_migrations` 时），再只跑清单里未记录的新文件。补丁不跑表结构迁移。

若现场还有旧整包留下的 FPCU 容器，平台升级不会删它们。之后按第 3 节用应用包接管。

## 3. 导入应用包

平台已启动后，解压应用包并指定平台目录：

```bash
tar -zxf fpcu2-install-amd64-v0.1.3-20261007.tar.gz
cd fpcu2-install-amd64-v0.1.3-20261007
DEPLOY_ROOT=/path/to/deploy-offline ./apply.sh
```

安装、升级、补丁都用这条命令。离线 / 普通会加载镜像并叠加 Compose；K8s 会 `kubectl apply`。应用包不安装 Docker，也不创建集群。
