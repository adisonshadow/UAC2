-- 修复 run_code 调物化状态失败：status Tool 支持按实体过滤 + Skill 引导 native 带 entityCodes
-- 幂等：可重复执行

-- ---------------------------------------------------------------------------
-- 1. bizdata_get_materialization_status：参数 + review
-- ---------------------------------------------------------------------------
UPDATE aibase.tools SET
    parameters_schema = '{
      "type": "object",
      "properties": {
        "connectionId": {
          "type": "string",
          "description": "数据库连接 UUID；多连接时建议传，避免全连接笛卡尔积"
        },
        "entityCodes": {
          "type": "array",
          "items": { "type": "string" },
          "description": "按实体 code 过滤（如 FPV:Drone）；优先于全量拉取后再 JS walk"
        },
        "entityIds": {
          "type": "array",
          "items": { "type": "string" },
          "description": "按实体 UUID 过滤"
        }
      }
    }'::jsonb,
    description = '获取各实体当前版本与物化版本对比；可按 entityCodes/entityIds/connectionId 过滤',
    review_markdown = E'## bizdata_get_materialization_status

查看实体模型版本 vs 已物化版本（stale / latest / not_materialized）。

### 参数
- `connectionId`：多连接时建议传
- `entityCodes`：指定实体 code 数组（如 `["FPV:Drone","FPV:Mission"]`），**不要**无过滤拉全量再 JS walk
- `entityIds`：可选，按 UUID 过滤

### 返回
每项含 `entityCode`（与 `code` 相同）、`staleStatus`、`currentVersion`、`materializedVersion`、`connectionId` 等。

### 调用方式
- **优先 native** 直接调用本 Tool
- 禁止用 `run_code` 对全量结果做 walk 过滤；若确需编排，`await tools.bizdata_get_materialization_status({ entityCodes, connectionId })` 即可',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_get_materialization_status';

-- ---------------------------------------------------------------------------
-- 2. 物化 Skill：查指定实体用 native + entityCodes（幂等追加）
-- ---------------------------------------------------------------------------
UPDATE aibase.skills SET
    content_markdown = content_markdown || E'\n\n## 物化状态查询（必遵）\n'
      || E'- 查指定实体：native 调用 `bizdata_get_materialization_status({ entityCodes: ["Scope:Entity"], connectionId })`\n'
      || E'- 返回字段含 `entityCode`（与 `code` 相同）及 `staleStatus`\n'
      || E'- **禁止**用 `run_code` 拉全量再 JS walk 过滤；需要切片时把 `entityCodes` 传给本 Tool\n',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-materialization'
  AND content_markdown NOT LIKE '%物化状态查询（必遵）%';
