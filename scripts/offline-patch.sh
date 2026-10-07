#!/usr/bin/env bash
# 兼容入口：平台补丁。业务应用请用 scripts/deploy/pack-app.sh。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mod="${1:-}"
case "$mod" in
  eadaf-api) parts=api ;;
  eadaf-web) parts=web ;;
  all) parts=web,api ;;
  fpcu2-bff|fpcu2-web)
    echo "业务应用补丁已从平台包拆出。请在应用目录放置 eadaf.app.yaml 后执行:" >&2
    echo "  pnpm pack:app -- --app-dir <应用目录> --kind patch --patch web|api|bizdata" >&2
    exit 1
    ;;
  -h|--help|help|"")
    cat <<'EOF'
用法: pnpm offline:patch <eadaf-api|eadaf-web|all>

平台补丁只有前端 web、后端 api。数据补丁:
  bash scripts/deploy/pack-eadaf.sh --mode offline --kind patch --patch bizdata --arch amd64 --non-interactive --yes

业务应用请使用 pnpm pack:app。
EOF
    exit 0
    ;;
  *)
    echo "未知模块: $mod" >&2
    exit 1
    ;;
esac
exec bash "$SCRIPT_DIR/deploy/pack-eadaf.sh" \
  --mode offline \
  --kind patch \
  --patch "$parts" \
  --arch "${OFFLINE_ARCH:-amd64}" \
  --os "${OFFLINE_OS:-centos}" \
  --non-interactive \
  --yes
