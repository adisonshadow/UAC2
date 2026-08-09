-- 业务数据模型设计 Skill：阶段边界 + A2UI 完成引导
UPDATE aibase.skills SET
    content_markdown = content_markdown || E'\n\n## 阶段边界（必遵）\n- **默认任务范围**：仅**逻辑模型**（枚举 → 字段 → 索引 → 关系 → `bizdata_validate_model` 校验）\n- 全部目标实体的 `bizdata_validate_model` 均 isValid=true 后，**本阶段结束**，停止 Tool 调用\n- **禁止**在本阶段调用：物化（`bizdata_execute_materialization` 等）、MOCK 数据、API 服务、指标、采集管道\n- 仅当用户**明确**要求「一并物化 / 创建 API / 创建指标 / 全套服务」时，才在总结中说明需切换对应页面；**仍不要**在本页调用下游 Tool\n\n## 阶段完成后的下一步（A2UI）\n全部实体校验通过后，按 **aibase-chat-framework** 约定，在回复末尾输出 `a2ui-commands` 块，建议 3～5 条，例如：\n- materialize：执行物化\n- create_api：创建 CRUD API\n- create_metrics：创建业务指标\n- refine_model：继续完善字段与关系\n\n根据实际上下文调整 label，不要重复已完成的步骤。',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-model-design'
  AND content_markdown NOT LIKE '%## 阶段边界（必遵）%';
