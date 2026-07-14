/** entityInfo.modelValidated：模型校验是否通过，默认 false */
export function isEntityModelValidated(entity?: API.BusinessDataEntity | null): boolean {
  return entity?.entityInfo?.modelValidated === true;
}

export function buildEntityValidatePrompt(entity: API.BusinessDataEntity): string {
  return `请对实体「${entity.label}」(${entity.code}) 执行完整的模型校验。

1. 调用 bizdata_validate_model，参数 entityCode: "${entity.code}"（markValidated 默认为 true）
2. 若 isValid 为 false，根据 errors 修复（枚举、索引、关系等）后重新校验，直至通过
3. 校验通过后实体将自动标记为「验证通过」`;
}

export function buildBatchValidatePrompt(scopePrefix?: string): string {
  const scopeHint = scopePrefix
    ? `请对 Scope「${scopePrefix}」下`
    : '请对当前业务数据模型中';
  return `${scopeHint}所有实体逐个执行 bizdata_validate_model（传 entityCode，markValidated 默认 true）。

批量创建或完善实体后必须执行本步骤；每个实体 isValid 为 true 时自动标记验证通过。全部完成后简要汇总结果。`;
}

/** FMMS 等 Scope 层级调整：必须用 rename，禁止 delete + create */
export function buildScopeRestructurePrompt(scopePrefix: string, targetScopeMap?: string): string {
  const mapHint = targetScopeMap
    ? `\n\n目标 Scope 映射（示例）：\n${targetScopeMap}`
    : '';
  return `请将 Scope「${scopePrefix}」下实体的 code 调整为新的二级子 Scope 结构。

**必遵流程**：
1. \`bizdata_list_entity_summaries\`（codePrefix="${scopePrefix}"）列出全部实体及当前 code
2. 对每个需调整的实体调用 **\`bizdata_rename_entity_code\`**，**仅传** \`entityCode\`（旧 code）+ \`code\`（新 code），**不要**传 fields/indexes/relations
3. 全部改完后再次 \`bizdata_list_entity_summaries\` 验证新 code 已生效
4. 对每个实体 \`bizdata_validate_model\`（传**新** entityCode）

**禁止**：\`bizdata_delete_entity\` + \`bizdata_create_entity\` 删除重建（会丢失物化/MOCK/关系且常导致虚假成功）。${mapHint}`;
}
