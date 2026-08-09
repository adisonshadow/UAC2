-- 增量：requestParameterInterface 用 getADBEnumByCode 连接枚举（Edit/Test/Create 同源）
-- 用法：psql -f scripts/migrate-apiservice-getadb-enum-interface-skill.sql

UPDATE aibase.tools
SET
    review_markdown = CASE
      WHEN review_markdown LIKE '%getADBEnumByCode%' THEN review_markdown
      ELSE review_markdown || E'\n\n### 枚举参数（getADBEnumByCode）\n- 写法：`type StatusType = getADBEnumByCode(\"fmms:Xxx\");` 再 `status?: StatusType` 或 `StatusType[]`（多选）\n- 仅声明连接到枚举的字段，请求 Example / 测试 / 文档才渲染 Select；裸 `string` 不会变下拉\n- 必填不要写 `?`，面板显示 *'
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE function_name IN ('apiservice_create_service', 'apiservice_update_service');

UPDATE aibase.skills
SET
    content_markdown = CASE
      WHEN content_markdown LIKE '%getADBEnumByCode%' THEN content_markdown
      ELSE content_markdown || E'\n\n## 请求参数枚举（getADBEnumByCode）\n- `type StatusType = getADBEnumByCode(\"code\");` + `status?: StatusType` / `StatusType[]`\n- 只有这样声明的参数，Edit/Test/Create 的 Example 才显示单选/多选 Select\n- 类型标签显示别名（StatusType），必填字段显示 *'
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN (
    'bizdata-api-service-create',
    'bizdata-api-service-manage',
    'bizdata-api-service-test-fix'
  );
