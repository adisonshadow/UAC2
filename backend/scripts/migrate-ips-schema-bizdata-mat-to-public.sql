-- IPS 域物化 Schema：bizdata_mat → public
-- 范围：仅 IPS 实体物理表 + 物化状态元数据 + IPS SQL 模式 API 服务
-- 不修改全局 database_connections.target_schema（仍有非 IPS 实体使用 bizdata_mat）

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) 物理表：双 Schema 并存
--    - public 空、bizdata_mat 有数据：丢弃空 public，再 SET SCHEMA
--    - public 已有表：丢弃 bizdata_mat 旧副本（避免同名冲突）
-- ---------------------------------------------------------------------------

-- ips_bom_scheme_node：数据在 bizdata_mat，public 为空表
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ips_bom_scheme_node'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'bizdata_mat' AND table_name = 'ips_bom_scheme_node'
  ) THEN
    IF (SELECT COUNT(*) FROM public.ips_bom_scheme_node) = 0
       AND (SELECT COUNT(*) FROM bizdata_mat.ips_bom_scheme_node) > 0 THEN
      DROP TABLE public.ips_bom_scheme_node;
      ALTER TABLE bizdata_mat.ips_bom_scheme_node SET SCHEMA public;
    ELSIF (SELECT COUNT(*) FROM public.ips_bom_scheme_node) >= 0 THEN
      DROP TABLE IF EXISTS bizdata_mat.ips_bom_scheme_node;
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  r RECORD;
  mat_cnt bigint;
  pub_cnt bigint;
BEGIN
  FOR r IN
    SELECT e.table_name
    FROM bizdata.entities e
    WHERE (e.code = 'IPS' OR e.code LIKE 'IPS:%')
      AND e.table_name IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_schema = 'bizdata_mat' AND t.table_name = e.table_name
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_name = e.table_name
      )
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM bizdata_mat.%I', r.table_name) INTO mat_cnt;
    EXECUTE format('SELECT COUNT(*) FROM public.%I', r.table_name) INTO pub_cnt;
    IF pub_cnt = 0 AND mat_cnt > 0 THEN
      EXECUTE format('DROP TABLE public.%I', r.table_name);
      EXECUTE format('ALTER TABLE bizdata_mat.%I SET SCHEMA public', r.table_name);
      RAISE NOTICE 'moved data-bearing table % from bizdata_mat -> public', r.table_name;
    ELSE
      EXECUTE format('DROP TABLE bizdata_mat.%I', r.table_name);
      RAISE NOTICE 'dropped stale bizdata_mat.% (public has % rows, mat had %)', r.table_name, pub_cnt, mat_cnt;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) 物理表：仅存在于 bizdata_mat → 迁入 public
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT e.table_name
    FROM bizdata.entities e
    WHERE (e.code = 'IPS' OR e.code LIKE 'IPS:%')
      AND e.table_name IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_schema = 'bizdata_mat' AND t.table_name = e.table_name
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_name = e.table_name
      )
  LOOP
    EXECUTE format('ALTER TABLE bizdata_mat.%I SET SCHEMA public', r.table_name);
    RAISE NOTICE 'SET SCHEMA public: %', r.table_name;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) 物化元数据：新增一条 success run，覆盖全部 IPS 实体最新版本 → target_schema=public
--    （避免直接改混合了 fmms 的历史 run）
-- ---------------------------------------------------------------------------
WITH ips_latest AS (
  SELECT DISTINCT ON (me.entity_id)
    me.entity_id,
    me.entity_version,
    me.table_name,
    me.ddl_applied,
    mr.connection_id
  FROM bizdata.materialization_entities me
  JOIN bizdata.materialization_runs mr ON mr.id = me.run_id
  JOIN bizdata.entities e ON e.id = me.entity_id
  WHERE mr.status = 'success'
    AND (e.code = 'IPS' OR e.code LIKE 'IPS:%')
  ORDER BY me.entity_id, mr.executed_at DESC NULLS LAST, mr.created_at DESC
),
ins_run AS (
  INSERT INTO bizdata.materialization_runs (
    id, connection_id, target_schema, status, sql_preview, generated_code,
    executed_at, error_message, created_by, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    COALESCE(
      (SELECT connection_id FROM ips_latest WHERE connection_id IS NOT NULL LIMIT 1),
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
    ),
    'public',
    'success',
    '-- migrated IPS materialized tables bizdata_mat -> public',
    jsonb_build_object(
      'migration', 'ips-schema-bizdata-mat-to-public',
      'at', to_jsonb(now())
    ),
    now(),
    NULL,
    NULL,
    now(),
    now()
  RETURNING id, connection_id
)
INSERT INTO bizdata.materialization_entities (
  id, run_id, entity_id, entity_version, table_name, ddl_applied, created_at
)
SELECT
  gen_random_uuid(),
  (SELECT id FROM ins_run),
  l.entity_id,
  l.entity_version,
  l.table_name,
  COALESCE(l.ddl_applied, true),
  now()
FROM ips_latest l;

-- ---------------------------------------------------------------------------
-- 4) IPS SQL 模式 API 服务：target_schema → public；脚本中的 schema 与之对齐
--    （禁止继续写死 bizdata_mat；统一为当前物化 schema public）
-- ---------------------------------------------------------------------------
UPDATE bizdata.api_services
SET
  target_schema = 'public',
  definition_script = replace(definition_script, '"bizdata_mat"', '"public"'),
  updated_at = now()
WHERE script_mode = 'sql'
  AND (
    scope_code = 'IPS'
    OR scope_code LIKE 'IPS:%'
    OR code = 'IPS'
    OR code LIKE 'IPS:%'
  );

COMMIT;

-- ---------------------------------------------------------------------------
-- 校验
-- ---------------------------------------------------------------------------
SELECT 'ips_physical' AS check_name, in_bizdata_mat, in_public, COUNT(*) AS cnt
FROM (
  SELECT
    e.code,
    EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'bizdata_mat' AND t.table_name = e.table_name
    ) AS in_bizdata_mat,
    EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_name = e.table_name
    ) AS in_public
  FROM bizdata.entities e
  WHERE e.code = 'IPS' OR e.code LIKE 'IPS:%'
) s
GROUP BY in_bizdata_mat, in_public
ORDER BY 2, 3;

SELECT 'ips_status_schema' AS check_name, target_schema, COUNT(*) AS cnt
FROM (
  SELECT DISTINCT ON (me.entity_id) mr.target_schema
  FROM bizdata.materialization_entities me
  JOIN bizdata.materialization_runs mr ON mr.id = me.run_id
  JOIN bizdata.entities e ON e.id = me.entity_id
  WHERE mr.status = 'success'
    AND (e.code = 'IPS' OR e.code LIKE 'IPS:%')
  ORDER BY me.entity_id, mr.executed_at DESC NULLS LAST, mr.created_at DESC
) t
GROUP BY target_schema;

SELECT 'ips_api_sql' AS check_name, target_schema,
  COUNT(*) FILTER (WHERE definition_script ILIKE '%bizdata_mat%') AS still_has_bizdata_mat,
  COUNT(*) AS total
FROM bizdata.api_services
WHERE script_mode = 'sql'
  AND (scope_code = 'IPS' OR scope_code LIKE 'IPS:%' OR code LIKE 'IPS:%')
GROUP BY target_schema;
