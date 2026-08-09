-- bizdata-api-service-manage：发布防幻觉硬约束 + publish Tool review

UPDATE aibase.tools
SET
    review_markdown = COALESCE(review_markdown, '') || E'

## 发布成功判定（硬约束）
- **禁止**未调用 `apiservice_publish_service` 或 Tool 信封 `verified !== true` 时向用户声称「已发布 / published / 0 draft」
- **禁止**将 `apiservice_run_test` 成功等同于发布成功；测试通过 ≠ published
- 发布声称前：`apiservice_publish_service` 返回 `_verification.status` 必须为 `published`
- 汇总声称「全域无 draft」前：**必须** `apiservice_list_services`（codePrefix=域，size 足够大）并引用 `statusSummary.draft` 为 0
- 若 `statusSummary.draft > 0`，向用户说明剩余 draft 列表，禁止脑补「全部已发布」
',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'apiservice-publish-service'
  AND review_markdown NOT LIKE '%发布成功判定（硬约束）%';

UPDATE aibase.skills
SET
    content_markdown = content_markdown || E'

## 批量测试与发布（防幻觉）
1. **必须** `apiservice_list_draft_services`（codePrefix=域）获取 draft 清单
2. 仅对清单内 code 逐服务：`apiservice_run_test` → `apiservice_publish_service`
3. `apiservice_publish_service` 对已是 published 的服务会返回 `alreadyPublished=true` / verified=false，**不计入**发布进度
4. 汇总前再次 `apiservice_list_draft_services` 或 `apiservice_list_services`+statusSummary 确认 draft 数量
5. **禁止**对已是 published 的服务重复 publish 并声称「处理了 draft」
',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-api-service-manage'
  AND content_markdown NOT LIKE '%apiservice_list_draft_services%';
