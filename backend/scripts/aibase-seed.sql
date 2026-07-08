-- AIBase 示例种子数据（apiKey 需通过管理 API 补录）

INSERT INTO aibase.providers (id, name, slug, base_url, adapter_type, is_active)
VALUES
    ('11111111-1111-1111-1111-111111111101', 'DeepSeek', 'deepseek', 'https://api.deepseek.com', 'openai_compatible', true),
    ('11111111-1111-1111-1111-111111111102', '阿里云通义', 'aliyun-qwen', 'https://dashscope.aliyuncs.com/compatible-mode', 'openai_compatible', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO aibase.models (id, provider_id, slug, model_id, display_name, default_params, is_active)
VALUES
    (
        '22222222-2222-2222-2222-222222222201',
        '11111111-1111-1111-1111-111111111101',
        'deepseek-chat',
        'deepseek-chat',
        'DeepSeek Chat',
        '{"temperature": 0.7, "max_tokens": 4096}'::jsonb,
        true
    ),
    (
        '22222222-2222-2222-2222-222222222202',
        '11111111-1111-1111-1111-111111111102',
        'qwen-vl-plus',
        'qwen-vl-plus',
        'Qwen VL Plus',
        '{"temperature": 0.5}'::jsonb,
        true
    )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO aibase.model_capabilities (model_id, capability)
VALUES
    ('22222222-2222-2222-2222-222222222201', 'text'),
    ('22222222-2222-2222-2222-222222222201', 'function_calling'),
    ('22222222-2222-2222-2222-222222222202', 'text'),
    ('22222222-2222-2222-2222-222222222202', 'vision')
ON CONFLICT (model_id, capability) DO NOTHING;

INSERT INTO aibase.model_io_tags (model_id, direction, modality)
VALUES
    ('22222222-2222-2222-2222-222222222201', 'input', 'text'),
    ('22222222-2222-2222-2222-222222222201', 'output', 'text'),
    ('22222222-2222-2222-2222-222222222202', 'input', 'text'),
    ('22222222-2222-2222-2222-222222222202', 'input', 'image'),
    ('22222222-2222-2222-2222-222222222202', 'output', 'text')
ON CONFLICT (model_id, direction, modality) DO NOTHING;
