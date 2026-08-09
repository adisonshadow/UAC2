-- AI 服务商与模型管理 Skills / Tools 种子（挂载 ai-management Scope）

INSERT INTO aibase.tools (
    id, scope_id, name, slug, function_name, description,
    execution_type, parameters_schema, review_markdown, server_config, is_active
)
VALUES
    (
        '99999999-9999-4999-8999-999999999911',
        '88888888-8888-4888-8888-888888888801',
        '列出 AI 服务商',
        'aibase-list-providers',
        'aibase_list_providers',
        '列出 AI 服务商配置',
        'client',
        '{"type":"object","properties":{"page":{"type":"integer"},"size":{"type":"integer"},"isActive":{"type":"boolean"}}}'::jsonb,
        '## aibase_list_providers',
        '{}'::jsonb,
        true
    ),
    (
        '99999999-9999-4999-8999-999999999912',
        '88888888-8888-4888-8888-888888888801',
        '获取 AI 服务商',
        'aibase-get-provider',
        'aibase_get_provider',
        '按 ID 获取 AI 服务商详情',
        'client',
        '{"type":"object","properties":{"providerId":{"type":"string"}},"required":["providerId"]}'::jsonb,
        E'## aibase_get_provider\n\n返回 apiKeySet 表示是否已配置密钥，不含明文。',
        '{}'::jsonb,
        true
    ),
    (
        '99999999-9999-4999-8999-999999999913',
        '88888888-8888-4888-8888-888888888801',
        '创建 AI 服务商',
        'aibase-create-provider',
        'aibase_create_provider',
        '创建 OpenAI Compatible 等 AI 服务商',
        'client',
        '{"type":"object","properties":{"name":{"type":"string"},"slug":{"type":"string"},"baseUrl":{"type":"string"},"apiKey":{"type":"string"},"adapterType":{"type":"string"}},"required":["name","baseUrl"]}'::jsonb,
        E'## aibase_create_provider\n\n- **不要向用户询问 baseUrl / adapterType**，能识别服务商时直接用 Skill 内置对照表\n- 仅向用户索取 **API Key**（及可选的显示名称）\n- slug 可选，小写字母数字连字符\n- adapterType 默认 `openai_compatible`',
        '{}'::jsonb,
        true
    ),
    (
        '99999999-9999-4999-8999-999999999914',
        '88888888-8888-4888-8888-888888888801',
        '更新 AI 服务商',
        'aibase-update-provider',
        'aibase_update_provider',
        '更新 AI 服务商配置或启用状态',
        'client',
        '{"type":"object","properties":{"providerId":{"type":"string"},"name":{"type":"string"},"slug":{"type":"string"},"baseUrl":{"type":"string"},"apiKey":{"type":"string"},"adapterType":{"type":"string"},"isActive":{"type":"boolean"}},"required":["providerId"]}'::jsonb,
        E'## aibase_update_provider\n\n传 apiKey 时将覆盖原密钥。',
        '{}'::jsonb,
        true
    ),
    (
        '99999999-9999-4999-8999-999999999915',
        '88888888-8888-4888-8888-888888888801',
        '停用 AI 服务商',
        'aibase-delete-provider',
        'aibase_delete_provider',
        '软删除（停用）AI 服务商',
        'client',
        '{"type":"object","properties":{"providerId":{"type":"string"}},"required":["providerId"]}'::jsonb,
        '## aibase_delete_provider',
        '{}'::jsonb,
        true
    ),
    (
        '99999999-9999-4999-8999-999999999921',
        '88888888-8888-4888-8888-888888888801',
        '列出 AI 模型',
        'aibase-list-models',
        'aibase_list_models',
        '列出 AI 模型，可按 providerId 过滤',
        'client',
        '{"type":"object","properties":{"page":{"type":"integer"},"size":{"type":"integer"},"providerId":{"type":"string"},"isActive":{"type":"boolean"}}}'::jsonb,
        '## aibase_list_models',
        '{}'::jsonb,
        true
    ),
    (
        '99999999-9999-4999-8999-999999999922',
        '88888888-8888-4888-8888-888888888801',
        '获取 AI 模型',
        'aibase-get-model',
        'aibase_get_model',
        '按 ID 获取 AI 模型详情',
        'client',
        '{"type":"object","properties":{"modelId":{"type":"string"}},"required":["modelId"]}'::jsonb,
        E'## aibase_get_model\n\n含 capabilities、inputTags、outputTags、defaultParams。',
        '{}'::jsonb,
        true
    ),
    (
        '99999999-9999-4999-8999-999999999923',
        '88888888-8888-4888-8888-888888888801',
        '创建 AI 模型',
        'aibase-create-model',
        'aibase_create_model',
        '创建 AI 模型并绑定服务商',
        'client',
        '{"type":"object","properties":{"providerId":{"type":"string"},"slug":{"type":"string"},"modelId":{"type":"string"},"displayName":{"type":"string"},"defaultParams":{"type":"object"},"capabilities":{"type":"array","items":{"type":"string"}},"inputTags":{"type":"array","items":{"type":"string"}},"outputTags":{"type":"array","items":{"type":"string"}}},"required":["providerId","modelId","displayName","capabilities"]}'::jsonb,
        E'## aibase_create_model\n\n### capabilities（能力标签）\n`text`, `vision`, `image_generation`, `audio_input`, `audio_output`, `embedding`, `function_calling`\n\n### inputTags / outputTags（模态）\n`text`, `image`, `audio`, `video`, `file`（文档）\n\n- 聊天附件能力由 **inputTags** 决定：如 `image` 允许图片，`file` 允许文档\n- slug 可省略，将根据 displayName 自动生成\n- modelId 为上游模型名，如 `deepseek-chat`',
        '{}'::jsonb,
        true
    ),
    (
        '99999999-9999-4999-8999-999999999924',
        '88888888-8888-4888-8888-888888888801',
        '更新 AI 模型',
        'aibase-update-model',
        'aibase_update_model',
        '更新 AI 模型配置',
        'client',
        '{"type":"object","properties":{"modelId":{"type":"string"},"providerId":{"type":"string"},"slug":{"type":"string"},"modelIdUpstream":{"type":"string"},"displayName":{"type":"string"},"defaultParams":{"type":"object"},"capabilities":{"type":"array","items":{"type":"string"}},"inputTags":{"type":"array","items":{"type":"string"}},"outputTags":{"type":"array","items":{"type":"string"}},"isActive":{"type":"boolean"}},"required":["modelId"]}'::jsonb,
        E'## aibase_update_model\n\n- 更新上游 modelId 时使用参数 `modelIdUpstream`\n- 修改 inputTags 会影响聊天面板附件按钮与可上传类型',
        '{}'::jsonb,
        true
    ),
    (
        '99999999-9999-4999-8999-999999999925',
        '88888888-8888-4888-8888-888888888801',
        '停用 AI 模型',
        'aibase-delete-model',
        'aibase_delete_model',
        '软删除（停用）AI 模型',
        'client',
        '{"type":"object","properties":{"modelId":{"type":"string"}},"required":["modelId"]}'::jsonb,
        '## aibase_delete_model',
        '{}'::jsonb,
        true
    )
ON CONFLICT (function_name) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    parameters_schema = EXCLUDED.parameters_schema,
    review_markdown = EXCLUDED.review_markdown,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO aibase.skills (id, scope_id, name, slug, description, content_markdown, is_active, is_global, is_dedicated)
VALUES
    (
        '99999999-9999-4999-8999-999999999931',
        '88888888-8888-4888-8888-888888888801',
        'AI 服务商管理',
        'aibase-provider-manage',
        '辅助创建、配置与维护 AI 服务商（Provider）',
        E'# AI 服务商管理助手\n\n你是 EADAF AI 服务商管理助手，帮助管理员配置大模型上游连接。\n\n## 与用户沟通（必读）\n- 用户通常**不懂技术**，禁止询问 baseUrl、endpoint、OpenAI 兼容路由、adapterType 等细节\n- 能从服务商名称推断配置时，**直接使用下方对照表**，不要让用户确认技术参数\n- 只需向用户索取：**API Key**；名称可由用户口述或你代填\n- 创建前可用一句话说明将采用的配置（如「我将按火山方舟默认地址为您创建」），但**不要用问句**让用户做技术选择\n\n## 已知服务商 baseUrl\n\nadapterType 均为 `openai_compatible`。EADAF 网关会在 baseUrl 后自动拼接 `/chat/completions`（或 `/v1/chat/completions`）。\n\n| 用户说法 / 名称 | name 建议 | baseUrl |\n|----------------|-----------|--------|\n| 火山方舟 / 火山引擎 / Volcengine / Ark | 火山方舟 | `https://ark.cn-beijing.volces.com/api/v3` |\n| DeepSeek | DeepSeek | `https://api.deepseek.com` |\n| 通义 / 阿里云 / DashScope / 百炼 | 阿里云通义 | `https://dashscope.aliyuncs.com/compatible-mode` |\n| OpenAI | OpenAI | `https://api.openai.com` |\n| 智谱 / GLM / ChatGLM | 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` |\n| Moonshot / Kimi / 月之暗面 | Moonshot | `https://api.moonshot.cn` |\n| 硅基流动 / SiliconFlow | 硅基流动 | `https://api.siliconflow.cn` |\n\n未在上表且无法检索到官方文档时，再简要说明需要用户补充的信息（仍避免 baseUrl 术语，改问「服务商全称或官网」）。\n\n## 概念\n- **Provider**：AI 服务商，含 baseUrl、apiKey、adapterType\n- apiKey 仅在创建/更新时传入，get 接口只返回 apiKeySet\n\n## 页面上下文\n- 用 `aibase_read_surfaces` 读取服务商列表页/抽屉表单状态\n\n## 工作流程\n1. `aibase_list_providers` 了解现有服务商\n2. 新建：识别服务商 → 查表得 baseUrl → `aibase_create_provider`（name、baseUrl、apiKey）\n3. 调整：`aibase_get_provider` 后 `aibase_update_provider`\n4. 停用：`aibase_delete_provider`\n\n## 注意\n- baseUrl 填根地址即可，不要手动加 `/chat/completions`\n- slug 创建后谨慎修改\n- 创建模型前须先有可用 Provider\n\n## UI 同步\n- 写操作成功后列表会自动刷新，**不要**提示用户手动刷新',
        true,
        false,
        true
    ),
    (
        '99999999-9999-4999-8999-999999999932',
        '88888888-8888-4888-8888-888888888801',
        'AI 模型管理',
        'aibase-model-manage',
        '辅助创建、配置与维护 AI 模型及多模态能力',
        E'# AI 模型管理助手\n\n你是 EADAF AI 模型管理助手，帮助管理员注册可用大模型并配置能力与模态。\n\n## 概念\n- **modelId**：模型 ID（如 deepseek-chat）\n- **slug**：EADAF 内调用标识（聊天选模型、API slug 参数）\n- **capabilities**：能力标签（function_calling、vision、text 等）\n- **inputTags / outputTags**：输入输出模态，决定聊天附件能力\n\n## 模态与聊天附件\n| inputTag | 含义 | 聊天附件 |\n|----------|------|----------|\n| text | 文本 | 基础对话 |\n| image | 图片 | 可上传 image/* |\n| audio | 音频 | 可上传 audio/* |\n| video | 视频 | 可上传 video/* |\n| file | 文档 | 可上传 pdf/doc/txt 等 |\n\n仅 text 时不显示附件按钮。\n\n## 工作流程\n1. `aibase_list_providers` 确认 providerId\n2. `aibase_list_models` 查看已有模型\n3. 新建：`aibase_create_model`（providerId、modelId、displayName、capabilities、inputTags）\n4. 调整模态/能力：`aibase_update_model`\n5. 停用：`aibase_delete_model`\n\n## 常用 defaults\n- 纯文本对话：capabilities=`["text","function_calling"]`，inputTags=`["text"]`\n- 视觉模型：capabilities 含 `vision`，inputTags 含 `image`\n\n## UI 同步\n- 写操作成功后列表会自动刷新，**不要**提示用户手动刷新',
        true,
        false,
        true
    )
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    content_markdown = EXCLUDED.content_markdown,
    scope_id = EXCLUDED.scope_id,
    is_active = EXCLUDED.is_active,
    is_global = EXCLUDED.is_global,
    is_dedicated = EXCLUDED.is_dedicated,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (ORDER BY t.function_name) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'aibase-provider-manage'
  AND t.function_name IN (
    'aibase_list_providers', 'aibase_get_provider', 'aibase_create_provider',
    'aibase_update_provider', 'aibase_delete_provider', 'aibase_read_surfaces'
  )
ON CONFLICT DO NOTHING;

INSERT INTO aibase.skill_tools (skill_id, tool_id, sort_order)
SELECT s.id, t.id, row_number() OVER (ORDER BY t.function_name) - 1
FROM aibase.skills s
CROSS JOIN aibase.tools t
WHERE s.slug = 'aibase-model-manage'
  AND t.function_name IN (
    'aibase_list_providers', 'aibase_list_models', 'aibase_get_model',
    'aibase_create_model', 'aibase_update_model', 'aibase_delete_model',
    'aibase_read_surfaces'
  )
ON CONFLICT DO NOTHING;
