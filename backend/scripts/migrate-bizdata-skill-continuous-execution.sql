-- 增量：强化 Skill — 写了「第N步」必须立刻调 Tool，校验必须实际调用 validate_model
UPDATE aibase.skills SET
    content_markdown = content_markdown || E'\n- **禁止**只写「第五步：模型校验」等标题而不调用 `bizdata_validate_model`；校验须对每个实体各传 entityCode 调用一次。',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design'
  AND content_markdown NOT LIKE '%第五步：模型校验%';
