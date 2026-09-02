-- 连接串导入：细则放在 Skill，用户消息只发配置原文

UPDATE aibase.tools SET
    description = '创建数据库连接。PostgreSQL/MySQL：databaseName=库名、targetSchema=schema（MySQL Schema 即库，须 ≥8.0.13）；MongoDB：targetSchema 须等于 databaseName；Redis：databaseName 为 0-15 索引、targetSchema 为 Key 前缀，username/password 可选',
    parameters_schema = '{"type":"object","required":["name","dbType","host","databaseName"],"properties":{"name":{"type":"string"},"dbType":{"type":"string","enum":["postgresql","mysql","mongodb","redis"]},"host":{"type":"string"},"port":{"type":"integer"},"username":{"type":"string"},"password":{"type":"string"},"databaseName":{"type":"string"},"targetSchema":{"type":"string"},"isDefault":{"type":"boolean"}}}'::jsonb,
    review_markdown = E'## bizdata_create_database_connection\n\n从连接串/配置创建连接。\n\n- PostgreSQL：databaseName=库名；targetSchema=schema（缺省 bizdata_mat）；username/password 必填\n- MySQL（须 ≥ 8.0.13）：databaseName=登录库；targetSchema=物化目标库（Schema 即库）；默认端口 3306\n- MongoDB：databaseName=库名；targetSchema 必须等于 databaseName\n- Redis：databaseName 为 0–15；targetSchema 为 Key 前缀；username/password 可选\n- 创建前先 bizdata_list_database_connections，避免重复\n- 缺密码等关键项时追问用户，禁止编造\n- 禁止未调用本 Tool 就声称已创建',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_create_database_connection';

-- 用完整「从连接串」段落覆盖旧短段落（幂等：先删旧段再追加）
UPDATE aibase.skills SET
    content_markdown = regexp_replace(
      content_markdown,
      E'\n*## 从连接串 / 配置创建连接[\n\r].*$',
      '',
      'n'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-materialization'
  AND content_markdown LIKE '%## 从连接串 / 配置创建连接%';

UPDATE aibase.skills SET
    content_markdown = content_markdown || E'\n\n## 从连接串 / 配置创建连接\n用户消息通常只含配置原文（URI / docker-compose / .env / JDBC 等）。须按本段规则执行，勿要求用户复述细则。\n\n1. 先 `bizdata_list_database_connections`；若已有相同 host+port+databaseName（及同类 dbType）则说明已存在并跳过，勿重复创建\n2. 解析一条或多条：`postgres://`、`postgresql://`、`mysql://`、`jdbc:mysql://`、`mongodb://`、`redis://`、compose、环境变量等\n3. 按类型调用 `bizdata_create_database_connection`：\n   - PostgreSQL：`databaseName`=库名，`targetSchema`=schema（缺省 `bizdata_mat`）；username/password 必填\n   - MySQL（须 ≥ 8.0.13）：`databaseName`=登录库，`targetSchema`=物化目标库（Schema 即库，缺省 `bizdata_mat`）；默认端口 3306；username/password 必填\n   - MongoDB：`databaseName`=库名，`targetSchema` 必须与库名相同；username/password 必填\n   - Redis：`databaseName` 为 0–15 索引（如 `"0"`），`targetSchema` 为 Key 前缀（缺省可用 `bizdata_mat`）；username/password 可选\n4. 缺密码等关键项时向用户追问，不要编造\n5. 禁止未调用 `bizdata_create_database_connection` 就声称已创建；完成后简要汇总（名称、类型、host）\n',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-materialization'
  AND content_markdown NOT LIKE '%勿要求用户复述细则%';
