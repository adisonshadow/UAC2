-- API 服务 list/filter Tool：status=ALL、软前缀、与 list 同源说明

UPDATE aibase.tools
SET
    description = '按 status/codePrefix 过滤 API 服务（与 list_services 同源，默认 size=-1）。status=ALL 不过滤；找 draft 须传 status=draft 或改用 apiservice_list_draft_services',
    review_markdown = E'## apiservice_filter_services\n\n与 **`apiservice_list_services` 同源**（同一查询）。\n\n### 参数\n- `codePrefix`：前缀匹配（精确 / `prefix:` 域段 / 末段软前缀）。例 `IPS:production`、`IPS:production:BomInstance`（可匹配 `BomInstanceCreate`）\n- `status`：`draft` | `published` | `disabled` | **`ALL`（不过滤）**；省略等同 ALL\n- `size` / `page`：默认 size=-1 全量\n\n### 注意\n- **禁止**用本 Tool 替代实体覆盖率对比（须 `list_services` + `bizdata_list_entity_summaries`）\n- 找 draft 优先 `apiservice_list_draft_services`\n- 超预算时结果含 `truncated` / `hint`，勿把半截 JSON 当成 total=0\n',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_filter_services';

UPDATE aibase.tools
SET
    description = '列出 API 服务（默认 size=-1）。status=ALL 不过滤；找 draft 须传 status=draft 或用 apiservice_list_draft_services',
    review_markdown = COALESCE(review_markdown, '') || E'\n\n### status / codePrefix\n- `status=ALL` 或省略 = 不过滤（勿把 ALL 当成字面状态）\n- `codePrefix` 支持末段软前缀，如 `scope:Entity` 匹配 `scope:EntityCreate`\n',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_list_services'
  AND COALESCE(review_markdown, '') NOT LIKE '%status=ALL%';

UPDATE aibase.tools
SET
    description = '获取 API 服务详情；默认省略脚本正文，改 SQL/Handler 时传 includeScripts=true',
    review_markdown = COALESCE(review_markdown, '') || E'\n\n### 脚本正文\n默认不返回 `definitionScript` / `handlerScript`；需要全文时传 `includeScripts=true`。\n',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'apiservice_get_service'
  AND COALESCE(review_markdown, '') NOT LIKE '%includeScripts%';
