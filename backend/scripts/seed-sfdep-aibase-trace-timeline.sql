-- SFDEP / AIBase：作案过程时空轨迹 Skill + client Tool
-- 可重复执行（ON CONFLICT / 条件插入）
-- 用法（在 EADAF 库）：
--   psql "$DATABASE_URL" -f backend/scripts/seed-sfdep-aibase-trace-timeline.sql
-- Skill 正文权威副本：AI_3D_CI/docs/SKILL：作案过程时空轨迹还原.md

BEGIN;

-- 1) client Tool：保存时空轨迹
INSERT INTO aibase.tools (
  id, scope_id, name, slug, function_name, description, execution_type,
  parameters_schema, review_markdown, server_config, is_active, created_at, updated_at
) VALUES (
  'a1000000-0001-4000-8000-000000000004',
  '88888888-8888-4888-8888-888888888801',
  '保存作案时空轨迹',
  'sfdep-save-trace-timeline',
  'sfdep_save_trace_timeline',
  '将作案过程时空轨迹节点批量写入 TraceTimelineNode（在 SFDEP 前端执行）。默认 replaceExisting=true 先删后建。',
  'client',
  '{
    "type": "object",
    "required": ["nodes"],
    "properties": {
      "sceneId": { "type": "string", "description": "默认现场 id；节点可覆盖" },
      "replaceExisting": { "type": "boolean", "description": "是否删除旧节点后再写入，默认 true" },
      "nodes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "occurredAt": { "type": "string" },
            "time": { "type": "string" },
            "label": { "type": "string" },
            "sceneId": { "type": "string" },
            "posX": { "type": "number" },
            "posY": { "type": "number" },
            "posZ": { "type": "number" },
            "position": {
              "type": "object",
              "properties": {
                "x": { "type": "number" },
                "y": { "type": "number" },
                "z": { "type": "number" }
              }
            },
            "confidence": { "type": "string", "description": "高/中/低 或 HIGH/MEDIUM/LOW" },
            "sortOrder": { "type": "number" },
            "traces": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "kind": { "type": "string" },
                  "evidenceId": { "type": "string" },
                  "title": { "type": "string" },
                  "detail": { "type": "string" }
                }
              }
            }
          }
        }
      }
    }
  }'::jsonb,
  E'## sfdep_save_trace_timeline\n\n- nodes 必填\n- 默认 replaceExisting=true\n- 必须在轨迹生成完成后调用，禁止只在对话里描述',
  '{}'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  function_name = EXCLUDED.function_name,
  description = EXCLUDED.description,
  execution_type = 'client',
  parameters_schema = EXCLUDED.parameters_schema,
  review_markdown = EXCLUDED.review_markdown,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 确保 function_name 指向活跃 client Tool
UPDATE aibase.tools
SET
  description = '将作案过程时空轨迹节点批量写入 TraceTimelineNode（在 SFDEP 前端执行）。默认 replaceExisting=true 先删后建。',
  execution_type = 'client',
  is_active = true,
  updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'sfdep_save_trace_timeline'
  AND id <> 'a1000000-0001-4000-8000-000000000004';

-- 同步工作区 Tool 描述（含物证位置，供轨迹还原）
UPDATE aibase.tools
SET
  description = '读取当前案件工作区（现场/物证位置/材料/待办/时间线）摘要，供报告与时空轨迹还原使用（在 SFDEP 前端执行）。',
  updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'sfdep_get_case_workspace';

-- 2) 专用 Skill
INSERT INTO aibase.skills (
  id, scope_id, name, slug, description, content_markdown,
  is_active, is_global, is_dedicated, completion_strategy, created_at, updated_at
) VALUES (
  'a1000000-0001-4000-8000-000000000014',
  '88888888-8888-4888-8888-888888888801',
  '根据物证材料还原作案时空轨迹',
  'sfdep-crime-trace-timeline',
  '根据脚印、血迹及其他痕迹，客观还原作案过程时空序列并写入 TraceTimelineNode',
  E'# SKILL：作案过程时空轨迹还原\n\n**Skill slug**：`sfdep-crime-trace-timeline`\n\n## 与案情推演的分工\n\n本 Skill 是痕迹驱动的**客观还原**（可播放时间轴），不是假设—验证推演。无痕迹依据的推测须标低可信度，禁止编造精确坐标。\n\n## 工作原则\n\n1. 每个节点至少关联一条痕迹（脚印/血迹/其他痕迹），尽量绑定 evidenceId\n2. 时间线有序（相对时刻或 ISO）\n3. 坐标优先用物证 position；缺失则 confidence=低 并在 detail 说明\n4. **必须**调用 `sfdep_save_trace_timeline` 落库，禁止只在对话中描述\n5. 默认 `replaceExisting=true`，避免重复堆叠\n\n## Tool 流程\n\n1. `sfdep_get_case_workspace`\n2. （可选）`http_request` 补洞\n3. `sfdep_save_trace_timeline`：sceneId?、replaceExisting、nodes[]（occurredAt/time、label、position、confidence、traces、sortOrder）\n\n落库成功后告知「时空轨迹已落库」。\n',
  true,
  false,
  true,
  '{
    "requiredTools": ["sfdep_save_trace_timeline"],
    "successCriteria": ["已调用 sfdep_save_trace_timeline 且 verified=true", "时空轨迹节点已写入 TraceTimelineNode"],
    "completionKeywords": ["时空轨迹已落库", "轨迹节点已保存"],
    "blockKeywords": ["接下来您可以", "建议您"],
    "terminationStrictness": "strict"
  }'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  content_markdown = EXCLUDED.content_markdown,
  is_active = true,
  is_global = false,
  is_dedicated = true,
  completion_strategy = EXCLUDED.completion_strategy,
  updated_at = CURRENT_TIMESTAMP;

-- slug 冲突时（不同 id）仍更新
UPDATE aibase.skills
SET
  name = '根据物证材料还原作案时空轨迹',
  description = '根据脚印、血迹及其他痕迹，客观还原作案过程时空序列并写入 TraceTimelineNode',
  is_dedicated = true,
  is_global = false,
  is_active = true,
  completion_strategy = '{
    "requiredTools": ["sfdep_save_trace_timeline"],
    "successCriteria": ["已调用 sfdep_save_trace_timeline 且 verified=true", "时空轨迹节点已写入 TraceTimelineNode"],
    "completionKeywords": ["时空轨迹已落库", "轨迹节点已保存"],
    "blockKeywords": ["接下来您可以", "建议您"],
    "terminationStrictness": "strict"
  }'::jsonb,
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'sfdep-crime-trace-timeline'
  AND id <> 'a1000000-0001-4000-8000-000000000014';

-- 3) 绑定 SFDEP 应用
INSERT INTO aibase.skill_applications (id, skill_id, application_id)
SELECT gen_random_uuid(), s.id, '10000000-0001-4000-8000-000000000088'
FROM aibase.skills s
WHERE s.slug = 'sfdep-crime-trace-timeline'
  AND NOT EXISTS (
    SELECT 1 FROM aibase.skill_applications sa
    WHERE sa.skill_id = s.id
      AND sa.application_id = '10000000-0001-4000-8000-000000000088'
  );

-- 4) 关联 Tools
INSERT INTO aibase.skill_tools (id, skill_id, tool_id, sort_order)
SELECT gen_random_uuid(), s.id, t.id, x.sort_order
FROM aibase.skills s
CROSS JOIN (
  VALUES
    ('sfdep_get_case_workspace', 0),
    ('sfdep_save_trace_timeline', 1),
    ('http_request', 2)
) AS x(function_name, sort_order)
JOIN aibase.tools t ON t.function_name = x.function_name AND t.is_active = true
WHERE s.slug = 'sfdep-crime-trace-timeline'
  AND NOT EXISTS (
    SELECT 1 FROM aibase.skill_tools st
    WHERE st.skill_id = s.id AND st.tool_id = t.id
  );

COMMIT;
