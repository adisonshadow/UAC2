-- 修复 AI 生成的 store 脚本：错误签名 store(ctx, parsed) + 不存在的 ctx.bizdata
-- 管道 equipment:test_device_runlog

UPDATE bizdata.collection_pipelines
SET
  parse_script = $parse$
function parse(raw, ctx) {
  const hex = String(raw || '').replace(/\s+/g, '');
  const addr = parseInt(hex.substring(0, 2), 16);
  const byteCount = parseInt(hex.substring(4, 6), 16);
  const registers = [];
  for (let i = 0; i < byteCount; i += 2) {
    const regVal = parseInt(hex.substring(6 + i * 2, 6 + i * 2 + 4), 16);
    registers.push(regVal);
  }
  const statusMap = { 1: 'running', 2: 'idle', 3: 'fault', 4: 'offline' };
  return {
    status: statusMap[registers[0]] || 'unknown',
    temperature: registers[1] / 10,
    pressure: registers[2] / 100,
    speed: registers[3],
    power_consumption: registers[4] / 10,
    equipment_code: 'EQ-' + String(addr).padStart(3, '0'),
    record_time: new Date().toISOString(),
  };
}
$parse$,
  store_script = $store$
async function store(data, ctx) {
  const { queryPg, tableQualified } = ctx;
  const equipments = await queryPg(
    `SELECT id FROM "bizdata_mat"."equipment" WHERE code = $1 LIMIT 1`,
    [data.equipment_code],
  );
  if (equipments.length === 0) {
    throw new Error('设备不存在: ' + data.equipment_code);
  }
  const rows = await queryPg(
    `INSERT INTO ${tableQualified} (id, equipment_id, status, temperature, pressure, speed, power_consumption, record_time, description)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      equipments[0].id,
      data.status,
      data.temperature,
      data.pressure,
      data.speed,
      data.power_consumption,
      data.record_time,
      '采集管道自动采集',
    ],
  );
  return { success: true, logId: rows[0]?.id };
}
$store$
WHERE code = 'equipment:test_device_runlog';

-- 强化 suggest_scripts Tool review
UPDATE aibase.tools
SET review_markdown = E'## collection_pipeline_suggest_scripts\n\n通过 mutation 同步到 edit/create Surface。\n\n### 脚本契约（必须）\n- parse(raw, ctx) → 对象，字段对齐 targetStructure\n- **store(data, ctx)** — 第一参数为 parse 结果，第二参数为 ctx\n- **禁止** `store(ctx, data)` 或 `store(ctx, parsed)` 参数顺序\n- **禁止** `ctx.bizdata.find/create` — 不存在该 API\n- store 须使用 **ctx.queryPg**、**ctx.tableQualified** 写入绑定实体的物化表
- 物化表 id 列通常无默认值，INSERT 须显式 `gen_random_uuid()` 或传入 UUID\n- 关联表查询可用 queryPg 直接 SQL，如 `SELECT id FROM "bizdata_mat"."equipment" WHERE code = $1`\n\n### 示例\n```javascript\nasync function store(data, ctx) {\n  const { queryPg, tableQualified } = ctx;\n  const rows = await queryPg(\n    `INSERT INTO ${tableQualified} (col1, col2) VALUES ($1, $2) RETURNING id`,\n    [data.col1, data.col2],\n  );\n  return { insertedId: rows[0]?.id };\n}\n```'
WHERE function_name = 'collection_pipeline_suggest_scripts';
