-- 连接串创建：失败纪律 + dbType 固定枚举（禁止乱探）

UPDATE aibase.tools SET
    review_markdown = E'## bizdata_create_database_connection\n\n从连接串/配置创建连接。\n\n### dbType（仅小写，禁止改写）\n`postgresql` | `mysql` | `mongodb` | `redis`\n\n### 字段\n- PostgreSQL：databaseName=库名；targetSchema=schema（缺省 bizdata_mat）；username/password 必填\n- MySQL（须 ≥ 8.0.13）：databaseName=登录库（无业务库可用 `mysql`）；targetSchema=物化目标库（Schema 即库，缺省 bizdata_mat）；默认端口 3306\n- MongoDB：databaseName=库名；targetSchema 必须等于 databaseName\n- Redis：databaseName 为 0–15；targetSchema 为 Key 前缀；username/password 可选\n\n### 失败纪律（必遵）\n- 创建失败时：只根据本 Tool 返回的错误修正参数后重试本 Tool\n- **禁止**再调枚举列表、Swagger、OpenAPI、裸 http_request、用其它 dbType 做对照实验\n- 创建前先 bizdata_list_database_connections，避免重复\n- 缺密码等关键项时追问用户，禁止编造\n- 禁止未调用本 Tool 就声称已创建',
    updated_at = CURRENT_TIMESTAMP
WHERE function_name = 'bizdata_create_database_connection';

-- 替换「从连接串」整段（含失败纪律）
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
    content_markdown = content_markdown || E'\n\n## 从连接串 / 配置创建连接\n用户消息通常只含配置原文（URI / docker-compose / .env / JDBC 等）。须按本段规则执行，勿要求用户复述细则。\n\n1. 先 `bizdata_list_database_connections`；若已有相同 host+port+databaseName（及同类 dbType）则说明已存在并跳过，勿重复创建\n2. 解析一条或多条；`dbType` **仅**小写：`postgresql` | `mysql` | `mongodb` | `redis`（禁止改大小写或臆造别名）\n3. 按类型调用 `bizdata_create_database_connection`：\n   - PostgreSQL：`databaseName`=库名，`targetSchema`=schema（缺省 `bizdata_mat`）；username/password 必填\n   - MySQL（须 ≥ 8.0.13）：`databaseName`=登录库（无业务库可用 `mysql`），`targetSchema`=物化目标库（缺省 `bizdata_mat`）；默认端口 3306；username/password 必填\n   - MongoDB：`databaseName`=库名，`targetSchema` 必须与库名相同；username/password 必填\n   - Redis：`databaseName` 为 0–15 索引，`targetSchema` 为 Key 前缀；username/password 可选\n4. 缺密码等关键项时向用户追问，不要编造\n5. **创建失败纪律**：只根据 Tool 错误修正参数后重试 `bizdata_create_database_connection`；**禁止**再调枚举列表 / Swagger / OpenAPI / 裸 http_request / 用其它 dbType 做对照实验\n6. 禁止未调用 create Tool 就声称已创建；完成后简要汇总（名称、类型、host）\n',
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bizdata-materialization'
  AND content_markdown NOT LIKE '%创建失败纪律%';
