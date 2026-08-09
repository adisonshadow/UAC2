-- find SQL：分页由网关独占，definition 勿写 LIMIT/OFFSET

UPDATE aibase.tools
SET
    review_markdown = regexp_replace(
      review_markdown,
      '含 `:limit`、`:skip` 等命名参数',
      '只写 SELECT/WHERE/ORDER BY；**禁止** SQL 内 LIMIT/OFFSET（网关按请求 limit/skip 外层分页）',
      'g'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE function_name IN ('apiservice_create_service', 'apiservice_update_service')
  AND review_markdown LIKE '%:limit%';

UPDATE aibase.skills
SET
    content_markdown = content_markdown
        || E'\n\n## find SQL 分页（重要）\ndefinitionScript **禁止**写 `LIMIT :limit OFFSET :skip`（或任何 LIMIT/OFFSET）。\n网关在外层统一 `LIMIT/OFFSET`，并在完整结果集上 COUNT。SQL 内再写会导致：skip>0 时 items 为空、total 被内层 LIMIT 截断。\n请求参数仍声明 `limit?`/`skip?`；TypeScript 用 `.paginate({ limit, skip })`。',
    updated_at = CURRENT_TIMESTAMP
WHERE slug IN (
    'bizdata-api-service-create',
    'bizdata-api-service-manage',
    'bizdata-api-service-test-fix'
)
  AND content_markdown NOT LIKE '%find SQL 分页（重要）%';
