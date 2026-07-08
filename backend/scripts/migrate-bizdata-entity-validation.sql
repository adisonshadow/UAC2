-- 实体 modelValidated（是否验证通过）+ validate_model 写回 + Skill 批量校验说明

UPDATE aibase.tools SET
    description = '校验实体模型完整性；默认 markValidated=true，通过时写入 entityInfo.modelValidated=true',
    parameters_schema = '{"type":"object","properties":{"entityId":{"type":"string"},"entityCode":{"type":"string","description":"如 production:WorkOrder"},"markValidated":{"type":"boolean","description":"为 true 时根据校验结果更新是否验证通过，默认 true"}}}'::jsonb,
    review_markdown = E'## bizdata_validate_model\n\n**每个实体创建/修改后必须调用**（传 entityCode）。\n\n- 默认 `markValidated=true`：isValid 为 true 时自动将实体标记为「验证通过」（entityInfo.modelValidated）\n- 检查：status 是否误用 varchar、是否有索引、外键是否有关系\n- 批量创建实体后，须对**每个**实体各调用一次，直至全部通过',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_validate_model';

UPDATE aibase.skills SET
    content_markdown = content_markdown || E'\n\n## 验证通过标记\n- 新建实体默认「未验证通过」（modelValidated=false）\n- 批量创建或完善实体后，须对每个实体调用 `bizdata_validate_model`（entityCode，markValidated 默认 true）\n- isValid 为 true 时自动标记验证通过；实体列表会显示绿色对勾\n- 若校验失败，根据 errors 修复后重新校验直至通过',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design'
  AND content_markdown NOT LIKE '%验证通过标记%';
