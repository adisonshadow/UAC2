export function buildEntityReference(entity: API.BusinessDataEntity) {
  return {
    type: 'entity',
    label: entity.label || entity.code || '实体',
    content: {
      id: entity.id,
      code: entity.code,
      label: entity.label,
      entityKind: entity.entityKind,
      tableName: entity.tableName,
      version: entity.version,
      isLocked: entity.isLocked,
      status: entity.status,
    },
    unique: true,
  } as const;
}

export function buildFieldReference(entity: API.BusinessDataEntity, field: API.BusinessDataField) {
  return {
    type: 'field',
    label: field.columnInfo?.label || field.fieldKey || '字段',
    content: {
      entityCode: entity.code,
      entityLabel: entity.label,
      fieldKey: field.fieldKey,
      label: field.columnInfo?.label,
      typeormConfig: field.typeormConfig,
    },
    unique: false,
  } as const;
}
