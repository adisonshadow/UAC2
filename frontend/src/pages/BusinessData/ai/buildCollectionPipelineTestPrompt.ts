/** AI Chat 自动测试采集管道的提示词 */
export function buildCollectionPipelineTestPrompt(input: { code?: string; name?: string }) {
  const label = input.name || input.code || '当前采集管道';
  return `请为采集管道「${label}」执行自动测试。

请按以下步骤通过 Tool 执行（不要向用户索要 pipelineId）：
1. 使用 aibase_read_surfaces（surfaceId=bizdata.collection-pipeline.test）读取当前测试页上下文
2. 调用 collection_pipeline_get_test_profile 获取样本与脚本
3. 若 rawInput 为空，使用 profile 中的 sampleData
4. 调用 collection_pipeline_run_test（runType=ai_test）并解读 parseOutput / storeOutput / rolledBack

测试会在事务内执行存储并回滚（rolledBack=true），请向用户说明这一点。`;
}

/** AI Chat 生成解析/存储脚本的提示词 */
export function buildCollectionPipelineScriptPrompt(input: {
  code?: string;
  name?: string;
  protocolType?: string;
}) {
  const label = input.name || input.code || '当前采集管道';
  const protocol = input.protocolType || 'serial';
  return `请为采集管道「${label}」（协议：${protocol}）生成 parse 与 store 脚本。

请按以下步骤通过 Tool 执行：
1. aibase_read_surfaces 读取 create/edit 页（sampleData、targetStructure、entityId）
2. collection_pipeline_suggest_scripts 写入脚本草稿到当前表单
3. 向用户简要说明解析逻辑与 INSERT 字段映射

parse 脚本须 export function parse(raw, ctx)；store 脚本须 export async function store(data, ctx)，使用 ctx.queryPg 与 ctx.tableQualified。`;
}
