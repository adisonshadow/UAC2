-- 实测4：调研空转修复 — 建模 Skill 补充「调研现状」示例 + 禁止 run_code 探路
-- 幂等：仅当尚未包含该段落时追加

UPDATE aibase.skills
SET
  content_markdown = content_markdown || E'\n\n## 调研现状（必遵，实测4）\n- **直接** native 调用业务 Tool，禁止用 `run_code` / `run_subagent` 探测可用 Tool。\n- 例：调研 `web` 域：\n  - `bizdata_list_entity_summaries({ codePrefix: \"web\" })`\n  - `bizdata_list_enums({ codePrefix: \"web\" })`（若工具支持 codePrefix；否则 list 后过滤）\n  - `bizdata_get_scope_description({ scopeCode: \"web\" })`\n  - 单实体字段：`bizdata_get_entity({ entityCode: \"web:User\" })`\n- `skill` 加载成功后 grantedTools 已同回合可用，请按 SOP 直接调用，勿再 tools.list() 探路。\n',
  updated_at = NOW()
WHERE slug = 'bizdata-model-design'
  AND content_markdown NOT LIKE '%调研现状（必遵%';
