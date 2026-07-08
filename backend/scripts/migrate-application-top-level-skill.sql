-- 应用顶层 Skill 说明（可选，描述本应用 Skill/Tool 用法）

ALTER TABLE uac.applications
  ADD COLUMN IF NOT EXISTS top_level_skill_markdown TEXT;

COMMENT ON COLUMN uac.applications.top_level_skill_markdown IS '应用顶层 Skill 说明（可选，描述本应用 Skill/Tool 用法）';
