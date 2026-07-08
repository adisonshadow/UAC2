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
