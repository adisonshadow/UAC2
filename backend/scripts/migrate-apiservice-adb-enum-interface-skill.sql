-- 增量：requestParameterInterface 支持 @adb-enum（与 @file 对齐）
-- 用法：psql -f scripts/migrate-apiservice-adb-enum-interface-skill.sql

UPDATE aibase.tools
SET
    review_markdown = CASE
      WHEN review_markdown LIKE '%@adb-enum%' THEN review_markdown
      ELSE review_markdown || E'\n\n### 枚举参数（@adb-enum）\n- 业务枚举字段须标注：`status?: string; // @adb-enum fmms:XxxStatus`\n- 与 `@file` 同级机器可读标记；禁止只写裸 `string` 却期望文档/测试下拉\n- 生成 interface 时对实体 adb-enum 字段自动带 `@adb-enum <enumCode>`'
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE function_name IN ('apiservice_create_service', 'apiservice_update_service')
  AND review_markdown NOT LIKE '%@adb-enum%';

UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## 请求参数 @adb-enum（必遵）\n- 枚举参数写 `field?: string; // @adb-enum <enumCode>`（对齐 `@file`）\n- 禁止只写裸 `string` 却期望 Edit/Test/文档出现下拉\n- 自动生成 interface 时实体 adb-enum 字段会带该标记',
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN (
    'bizdata-api-service-create',
    'bizdata-api-service-manage',
    'bizdata-api-service-test-fix'
  )
  AND content_markdown NOT LIKE '%请求参数 @adb-enum（必遵）%';
