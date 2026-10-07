#!/usr/bin/env bash
# 兼容入口：离线安装包。平台包不再包含业务应用。
# 仍可用 OFFLINE_OS / OFFLINE_ARCH。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/deploy/pack-eadaf.sh" \
  --mode offline \
  --kind install \
  --os "${OFFLINE_OS:-centos}" \
  --arch "${OFFLINE_ARCH:-amd64}" \
  --non-interactive \
  --yes \
  "$@"
