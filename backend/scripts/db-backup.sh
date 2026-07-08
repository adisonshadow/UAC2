#!/bin/bash
# 兼容旧命令：委托给 backup-db-now.sh
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backup-db-now.sh" "$@"
