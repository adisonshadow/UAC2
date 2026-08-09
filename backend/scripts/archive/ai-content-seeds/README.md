# 归档：历史 AI Skill/Tool 内容增量种子

这些脚本曾由 `initdb.sh --with-aibase-seed` 按顺序重放。现已收敛为仓库根目录下的权威种子：

- `../aibase-ai-seed.sql`（由 `../export-aibase-ai-seed.js` 从现库导出）
- `../aibase-seed.sql`（providers / models 示例）

**勿再把本目录脚本加回 initdb。** 需要刷新权威种子时：

```bash
cd backend && node scripts/export-aibase-ai-seed.js > scripts/aibase-ai-seed.sql
```

归档日期：2026-07-30
