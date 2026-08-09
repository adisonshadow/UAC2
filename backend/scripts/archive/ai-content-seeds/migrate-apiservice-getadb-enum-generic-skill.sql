-- 修正：getADBEnumByCode 须为泛型类型 getADBEnumByCode<"code">，不能是函数调用
-- 用法：psql -f scripts/migrate-apiservice-getadb-enum-generic-skill.sql

UPDATE aibase.tools
SET
    review_markdown = regexp_replace(
      review_markdown,
      'getADBEnumByCode\(\"([^\"]+)\"\)',
      'getADBEnumByCode<"\1">',
      'g'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE function_name IN ('apiservice_create_service', 'apiservice_update_service')
  AND review_markdown LIKE '%getADBEnumByCode(%';

UPDATE aibase.skills
SET
    content_markdown = regexp_replace(
      content_markdown,
      'getADBEnumByCode\(\"([^\"]+)\"\)',
      'getADBEnumByCode<"\1">',
      'g'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN (
    'bizdata-api-service-create',
    'bizdata-api-service-manage',
    'bizdata-api-service-test-fix'
  )
  AND content_markdown LIKE '%getADBEnumByCode(%';

-- 若尚无泛型说明则追加一句
UPDATE aibase.tools
SET
    review_markdown = review_markdown
      || E'\n- 注意：须写 `getADBEnumByCode<"code">`（类型泛型），禁止 `getADBEnumByCode("code")` 函数调用写法（TS 报 2749）',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name IN ('apiservice_create_service', 'apiservice_update_service')
  AND review_markdown LIKE '%getADBEnumByCode%'
  AND review_markdown NOT LIKE '%类型泛型%';
