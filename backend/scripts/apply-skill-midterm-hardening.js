#!/usr/bin/env node
/**
 * 中期治理：T9 Handler SDK 单一源 / T11 收敛冗余禁令 / T14 collection-pipeline UUID
 * 直接改现库，随后应重跑 export-aibase-ai-seed.js。
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const NODE_ENV = process.env.NODE_ENV || 'development';
const envFile = path.join(ROOT, `.env.${NODE_ENV}`);
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

const CHECK_HANDLER_REVIEW = `## apiservice_check_handler

返回 \`{ ok, diagnostics }\`。

### 何时调用
1. 修改 handler 后、create/update **之前**
2. \`apiservice_run_test\` **之前**（typescript）
3. **禁止**在 run_test 已成功后再调用本 Tool「再确认一遍」

### TypeScript Handler 契约（权威源 — Skill / 其他 Tool 勿重复展开全文）
- 推荐**只写函数体**（无需 export handler）；用只读 \`params\` + \`db(实体code)\`
- 示例：\`await db('fmms:WorkCard').where({ status: params.status }).take(20).getMany()\`
- **禁止** \`queryPg\`、手写 SQL、物化表名
- \`requestParameterInterface\` 声明全部 \`params.xxx\`
- 保存/测试前必须本 Tool 通过（按行修复）
- 创建/更新时同步 interface + handlerScript + requestOverrides

### Handler SDK（paginate / join / count）
- 分页+计数：\`.paginate({ limit: params.limit, skip: params.skip })\` → 响应须含 \`pagination\`（\`total, page, pageSize, totalPages, hasNext\`）；禁止 where 写两遍
- **禁止**仅返回 \`{ items, total }\` / \`{ items, count }\`
- \`count()\` 别名可用（=\`getCount()\`）；\`leftJoin(entity, alias, leftCol, rightCol)\` 仅等值 ON
- where：\`$gte/$in/$ilike/$isNull\`；params 经 SDK 参数化，禁止拼字符串 / queryPg
`;

const HANDLER_POINTER = `## TypeScript Handler / Handler SDK
- **契约权威源**：Tool \`apiservice_check_handler\` 的 review（调用前必读；保存/测试前须 check 通过）
- 只写函数体 + \`params\` + \`db(实体code)\`；禁止 \`queryPg\` / 手写 SQL / 物化表名
`;

const CREATE_SUCCESS = `## 成功判定与二次验证
以 Tool 信封 \`_verification.verified=true\` 为准，勿口头声称成功。
1. **创建后**：立刻 \`apiservice_list_services(codePrefix)\` 或 \`apiservice_get_service(code)\` 确认出现在列表
2. **发布后**：同样 list/get 确认 \`published\`
3. **测试**：\`apiservice_run_test\` 返回 \`success=true\`（及 verified）后立即收束
`;

const MANAGE_SUCCESS = `## 写操作二次验证
以 Tool 信封 \`verified\` / 状态字段为准，勿口头声称成功。
- 创建后：\`apiservice_list_services\` / \`get_service\` 确认已出现
- 发布/更新/禁用后：list 或 get 确认状态已持久化
- 测试：\`run_test\` success+verified 后立即收束，勿再反复 get handler
`;

const CREATE_TOOL_REVIEW = `## apiservice_create_service

- 一个服务 = 一个主 operation；禁止索要 connectionId
- typescript：函数体 + params + db(实体code)；**Handler 契约见 \`apiservice_check_handler\` review**
- **推荐**传 entityId；省略 connectionId 时按主实体物化推断
- 保存前必须 \`apiservice_check_handler\` 通过

### 响应文档（find 必遵）
- \`responseOverrides\`：\`data.items\` + \`data.pagination{ total, page, pageSize, totalPages, hasNext }\`
- Tool 未传时会自动补全默认 Schema/Example；仍须回读确认

### 成功判定
- \`_verification.verified=true\`；find 时 \`hasPaginationDocs=true\`
`;

const UPDATE_TOOL_REVIEW = `## apiservice_update_service

定位：serviceId / code / scopeCode+serviceSlug。

### TypeScript Handler
- **契约权威源**：\`apiservice_check_handler\` review；保存前必须 check 通过
- 用 \`paginate\` → 含 \`pagination\`；禁止双重 where / queryPg

### 响应文档（完善时必遵）
- find：**必须**写入 \`responseOverrides\`，形状为 \`data.items\` + \`data.pagination\`
- pagination 字段：\`total, page, pageSize, totalPages, hasNext\`
- **禁止**仅平铺 \`total\`/\`count\`；**禁止** \`"item": null\`

### 更新后校验顺序（必遵）
1. （可选）测前 \`apiservice_get_service\` 确认非占位
2. \`apiservice_run_test\`
3. **一旦 success=true（及 verified）→ 立即汇报并 STOP**
4. **禁止**测试成功后再 \`get_service\` / \`read_surfaces\`「查看完整 handler」
`;

/** Replace contiguous Handler-contract ## sections with a pointer. Keep test-fix「命名参数」专节. */
function replaceHandlerSections(markdown, pointer) {
  const lines = markdown.split('\n');
  const out = [];
  let i = 0;
  let replaced = false;
  const isHandlerHeading = (line) => {
    if (!/^##\s+/.test(line)) return false;
    if (/命名参数/.test(line)) return false;
    return (
      /^##\s+TypeScript Handler 契约/i.test(line) ||
      /^##\s+TypeScript Handler SDK/i.test(line) ||
      /^##\s+TypeScript Handler \/ Handler SDK/i.test(line) ||
      /^##\s+Handler SDK/i.test(line)
    );
  };

  while (i < lines.length) {
    if (isHandlerHeading(lines[i])) {
      while (i < lines.length && isHandlerHeading(lines[i])) {
        i += 1;
        while (i < lines.length && !/^##\s+/.test(lines[i])) i += 1;
      }
      if (!replaced) {
        out.push(pointer.trimEnd());
        out.push('');
        replaced = true;
      }
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n'), replaced };
}

function replaceSectionByTitle(markdown, titleIncludes, newSection) {
  const lines = markdown.split('\n');
  const out = [];
  let i = 0;
  let replaced = false;
  while (i < lines.length) {
    if (lines[i].startsWith('## ') && lines[i].includes(titleIncludes)) {
      i += 1;
      while (i < lines.length && !/^##\s+/.test(lines[i])) i += 1;
      if (!replaced) {
        out.push(newSection.trimEnd());
        out.push('');
        replaced = true;
      }
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n'), replaced };
}

const OLD_PIPELINE_ID = '77777777-7777-4777-8777-777777777710';
const NEW_PIPELINE_ID = '77777777-7777-4777-8777-777777777730';

async function main() {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '35432', 10),
    database: process.env.POSTGRES_DATABASE || 'fyMOM',
    user: process.env.POSTGRES_USER || 'yoyo',
    password: process.env.POSTGRES_PASSWORD || '123456',
  });
  await client.connect();
  await client.query('BEGIN');

  try {
    // T9: canonical check_handler review
    await client.query(
      `UPDATE aibase.tools SET review_markdown = $1, updated_at = CURRENT_TIMESTAMP WHERE function_name = 'apiservice_check_handler'`,
      [CHECK_HANDLER_REVIEW],
    );
    await client.query(
      `UPDATE aibase.tools SET review_markdown = $1, updated_at = CURRENT_TIMESTAMP WHERE function_name = 'apiservice_create_service'`,
      [CREATE_TOOL_REVIEW],
    );
    await client.query(
      `UPDATE aibase.tools SET review_markdown = $1, updated_at = CURRENT_TIMESTAMP WHERE function_name = 'apiservice_update_service'`,
      [UPDATE_TOOL_REVIEW],
    );

    for (const slug of [
      'bizdata-api-service-create',
      'bizdata-api-service-manage',
      'bizdata-api-service-test-fix',
    ]) {
      const { rows } = await client.query(
        `SELECT content_markdown FROM aibase.skills WHERE slug = $1`,
        [slug],
      );
      if (!rows[0]) throw new Error(`missing skill ${slug}`);
      let md = rows[0].content_markdown;
      const h = replaceHandlerSections(md, HANDLER_POINTER);
      if (!h.replaced) {
        console.warn(`WARN: no Handler sections replaced in ${slug}`);
      }
      md = h.text;

      if (slug === 'bizdata-api-service-create') {
        const s = replaceSectionByTitle(md, '成功判定', CREATE_SUCCESS);
        if (s.replaced) md = s.text;
        else console.warn(`WARN: success section not found in ${slug}`);
      }
      if (slug === 'bizdata-api-service-manage') {
        const s = replaceSectionByTitle(md, '写操作二次验证', MANAGE_SUCCESS);
        if (s.replaced) md = s.text;
        else console.warn(`WARN: manage success section not found`);
      }

      await client.query(
        `UPDATE aibase.skills SET content_markdown = $1, updated_at = CURRENT_TIMESTAMP WHERE slug = $2`,
        [md, slug],
      );
      console.log(`updated skill ${slug} (handler=${h.replaced})`);
    }

    // T11 light touch: model-design — trim repeated「禁止口头」near relation verification if overly long
    {
      const { rows } = await client.query(
        `SELECT content_markdown FROM aibase.skills WHERE slug = 'bizdata-model-design'`,
      );
      if (rows[0]) {
        let md = rows[0].content_markdown;
        const before = md.length;
        // Collapse duplicate「禁止口头「已生效」」style lines into one protocol reminder near 关系添加
        md = md.replace(
          /\*\*禁止\*\*口头「已生效」/g,
          '以 `_verification.verified=true` 为准（勿口头声称已生效）',
        );
        md = md.replace(
          /禁止口头「已生效」/g,
          '以 verified 为准（勿口头声称）',
        );
        // Deduplicate identical consecutive protocol lines
        md = md.replace(
          /(以 `_verification\.verified=true` 为准（勿口头声称已生效）\n)+/g,
          '以 `_verification.verified=true` 为准（勿口头声称已生效）\n',
        );
        if (md.length !== before) {
          await client.query(
            `UPDATE aibase.skills SET content_markdown = $1, updated_at = CURRENT_TIMESTAMP WHERE slug = 'bizdata-model-design'`,
            [md],
          );
          console.log(`updated bizdata-model-design (${before} → ${md.length} chars)`);
        } else {
          console.log('bizdata-model-design: no verbal-claim tweaks applied');
        }
      }
    }

    // T14: reassign collection-pipeline skill id
    const { rows: pipe } = await client.query(
      `SELECT id FROM aibase.skills WHERE slug = 'api-services-collection-pipeline'`,
    );
    const currentId = pipe[0] && String(pipe[0].id);
    if (currentId === OLD_PIPELINE_ID || currentId === '77777777-7777-4777-8777-777777777721') {
      const fromId = currentId;
      await client.query(`UPDATE aibase.skills SET slug = $1 WHERE id = $2`, [
        'api-services-collection-pipeline__old',
        fromId,
      ]);
      await client.query(
        `INSERT INTO aibase.skills (
           id, scope_id, name, slug, description, content_markdown,
           is_active, is_global, is_dedicated, completion_strategy, created_at, updated_at
         )
         SELECT $1::uuid, scope_id, name, 'api-services-collection-pipeline', description, content_markdown,
                is_active, is_global, is_dedicated, completion_strategy, created_at, CURRENT_TIMESTAMP
         FROM aibase.skills WHERE id = $2::uuid`,
        [NEW_PIPELINE_ID, fromId],
      );
      await client.query(
        `UPDATE aibase.skill_tools SET skill_id = $1::uuid WHERE skill_id = $2::uuid`,
        [NEW_PIPELINE_ID, fromId],
      );
      await client.query(
        `UPDATE aibase.skill_applications SET skill_id = $1::uuid WHERE skill_id = $2::uuid`,
        [NEW_PIPELINE_ID, fromId],
      );
      await client.query(`DELETE FROM aibase.skills WHERE id = $1::uuid`, [fromId]);
      console.log(`T14: collection-pipeline id ${fromId} → ${NEW_PIPELINE_ID}`);
    } else {
      console.log(`T14: skip (current id=${currentId})`);
    }

    await client.query('COMMIT');
    console.log('OK');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
