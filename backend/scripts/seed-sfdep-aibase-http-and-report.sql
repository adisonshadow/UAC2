-- SFDEP / AIBase：公共 http_request Tool + 刑侦报告 Skill 关联
-- 可重复执行（ON CONFLICT / 条件插入）
-- 用法（在 EADAF 库）：
--   psql "$DATABASE_URL" -f backend/scripts/seed-sfdep-aibase-http-and-report.sql

BEGIN;

-- 1) 公共 http_request Tool（server_builtin）
INSERT INTO aibase.tools (
  id, scope_id, name, slug, function_name, description, execution_type,
  parameters_schema, review_markdown, server_config, is_active, created_at, updated_at
) VALUES (
  'a1000000-0001-4000-8000-000000000001',
  '88888888-8888-4888-8888-888888888801',
  '公共 HTTP 请求',
  'http-request',
  'http_request',
  '向 EADAF/BFF/外部 API 发起 HTTP 请求（类 curl）。相对路径或受信主机自动携带当前登录用户 JWT；外部 URL 不带用户 JWT。用于没有专用 Tool 的探查。',
  'server_builtin',
  '{
    "type": "object",
    "required": ["url"],
    "properties": {
      "method": {
        "type": "string",
        "enum": ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"],
        "description": "HTTP 方法，默认 GET"
      },
      "url": {
        "type": "string",
        "description": "绝对 URL，或相对路径如 /api/v1/ai/models（相对路径走 EADAF 本机并自动带用户 JWT）"
      },
      "headers": {
        "type": "object",
        "additionalProperties": { "type": "string" },
        "description": "可选请求头；受信主机下 Authorization 会被当前用户 JWT 覆盖"
      },
      "body": {
        "description": "请求体：对象会 JSON 序列化；字符串原样发送"
      },
      "timeoutMs": {
        "type": "integer",
        "description": "超时毫秒，默认 15000，最大 60000"
      }
    }
  }'::jsonb,
  E'## http_request\n\n- 查未封装 API 时使用\n- EADAF/BFF 用相对路径或受信 host，后端自动注入当前用户 JWT\n- 外部 URL 不带登录态；可选手动 header（勿填用户 JWT）\n- 响应体可能截断',
  '{"handler":"http_request"}'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  function_name = EXCLUDED.function_name,
  description = EXCLUDED.description,
  execution_type = EXCLUDED.execution_type,
  parameters_schema = EXCLUDED.parameters_schema,
  review_markdown = EXCLUDED.review_markdown,
  server_config = EXCLUDED.server_config,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- function_name 唯一：若已存在不同 id，仍确保可用
UPDATE aibase.tools
SET
  description = '向 EADAF/BFF/外部 API 发起 HTTP 请求（类 curl）。相对路径或受信主机自动携带当前登录用户 JWT；外部 URL 不带用户 JWT。用于没有专用 Tool 的探查。',
  execution_type = 'server_builtin',
  server_config = '{"handler":"http_request"}'::jsonb,
  parameters_schema = (
    SELECT parameters_schema FROM aibase.tools WHERE id = 'a1000000-0001-4000-8000-000000000001'
  ),
  is_active = true,
  updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'http_request'
  AND id <> 'a1000000-0001-4000-8000-000000000001';

-- 2) 挂到全局 Framework Skill
INSERT INTO aibase.skill_tools (id, skill_id, tool_id, sort_order)
SELECT
  'a1000000-0001-4000-8000-000000000011',
  s.id,
  COALESCE(
    (SELECT id FROM aibase.tools WHERE function_name = 'http_request' AND is_active = true ORDER BY updated_at DESC LIMIT 1),
    'a1000000-0001-4000-8000-000000000001'::uuid
  ),
  90
FROM aibase.skills s
WHERE s.slug = 'aibase-chat-framework'
ON CONFLICT (id) DO NOTHING;

INSERT INTO aibase.skill_tools (id, skill_id, tool_id, sort_order)
SELECT gen_random_uuid(), s.id, t.id, 90
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'aibase-chat-framework'
  AND t.function_name = 'http_request'
  AND t.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM aibase.skill_tools st
    WHERE st.skill_id = s.id AND st.tool_id = t.id
  );

-- 3) SFDEP client Tools
INSERT INTO aibase.tools (
  id, scope_id, name, slug, function_name, description, execution_type,
  parameters_schema, review_markdown, server_config, is_active, created_at, updated_at
) VALUES (
  'a1000000-0001-4000-8000-000000000002',
  '88888888-8888-4888-8888-888888888801',
  '读取案件工作区',
  'sfdep-get-case-workspace',
  'sfdep_get_case_workspace',
  '读取当前案件的现场、物证、数字材料等摘要，供刑侦报告生成使用（在 SFDEP 前端执行）。',
  'client',
  '{"type":"object","properties":{}}'::jsonb,
  E'## sfdep_get_case_workspace\n\n返回当前案件工作区摘要。无参数。',
  '{}'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  execution_type = 'client',
  parameters_schema = EXCLUDED.parameters_schema,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO aibase.tools (
  id, scope_id, name, slug, function_name, description, execution_type,
  parameters_schema, review_markdown, server_config, is_active, created_at, updated_at
) VALUES (
  'a1000000-0001-4000-8000-000000000003',
  '88888888-8888-4888-8888-888888888801',
  '保存刑侦综合分析报告',
  'sfdep-save-investigation-report',
  'sfdep_save_investigation_report',
  '将生成的 Markdown 刑侦综合分析报告保存为 DigitalMaterial（kind=REPORT），并在材料树「报告」分类下打开。',
  'client',
  '{
    "type": "object",
    "required": ["title", "markdown"],
    "properties": {
      "title": { "type": "string", "description": "报告标题" },
      "markdown": { "type": "string", "description": "完整 Markdown 报告正文" }
    }
  }'::jsonb,
  E'## sfdep_save_investigation_report\n\n- title / markdown 必填\n- 必须在报告生成完成后调用，禁止只在对话里输出',
  '{}'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  execution_type = 'client',
  parameters_schema = EXCLUDED.parameters_schema,
  is_active = true,
  updated_at = CURRENT_TIMESTAMP;

-- 4) 关联到 criminal-investigation-report Skill + 完成策略 + 绑定 SFDEP
UPDATE aibase.skills
SET
  is_dedicated = true,
  is_global = false,
  completion_strategy = '{
    "requiredTools": ["sfdep_save_investigation_report"],
    "successCriteria": ["已调用 sfdep_save_investigation_report 且 verified=true", "报告已落入材料树「报告」分类"],
    "completionKeywords": ["报告已保存", "报告生成完成"],
    "terminationStrictness": "strict"
  }'::jsonb,
  content_markdown = CASE
    WHEN content_markdown IS NULL OR content_markdown NOT LIKE '%sfdep_get_case_workspace%'
    THEN content_markdown || E'\n\n---\n\n## 运行时调用约定（SFDEP）\n\n1. 先调用 `sfdep_get_case_workspace` 获取当前案件材料摘要。\n2. 按本 Skill 结构生成完整 Markdown 报告；缺失信息标注「待补充」。\n3. **必须**调用 `sfdep_save_investigation_report` 落库，禁止只在对话中输出报告。\n4. 可用 `http_request` 探查其它已授权 API（相对路径自动带用户 JWT）。\n'
    ELSE content_markdown
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'criminal-investigation-report';

INSERT INTO aibase.skill_applications (id, skill_id, application_id)
SELECT gen_random_uuid(), s.id, '10000000-0001-4000-8000-000000000088'
FROM aibase.skills s
WHERE s.slug = 'criminal-investigation-report'
  AND NOT EXISTS (
    SELECT 1 FROM aibase.skill_applications sa
    WHERE sa.skill_id = s.id
      AND sa.application_id = '10000000-0001-4000-8000-000000000088'
  );

INSERT INTO aibase.skill_tools (id, skill_id, tool_id, sort_order)
SELECT gen_random_uuid(), s.id, t.id, x.sort_order
FROM aibase.skills s
CROSS JOIN (
  VALUES
    ('sfdep_get_case_workspace', 0),
    ('sfdep_save_investigation_report', 1),
    ('http_request', 2)
) AS x(function_name, sort_order)
JOIN aibase.tools t ON t.function_name = x.function_name AND t.is_active = true
WHERE s.slug = 'criminal-investigation-report'
  AND NOT EXISTS (
    SELECT 1 FROM aibase.skill_tools st
    WHERE st.skill_id = s.id AND st.tool_id = t.id
  );

COMMIT;
