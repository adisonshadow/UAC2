#!/bin/bash
# 已废弃：历史 AI Chat Skill 增量迁移入口。
# 权威数据请使用 aibase-ai-seed.sql；刷新：
#   cd backend && node scripts/export-aibase-ai-seed.js > scripts/aibase-ai-seed.sql
# 旧脚本见 archive/ai-content-seeds/
set -euo pipefail
echo "migrate-ai-chat-behavior.sh 已废弃。请改用 scripts/aibase-ai-seed.sql（见 archive/ai-content-seeds/README.md）。" >&2
exit 1
