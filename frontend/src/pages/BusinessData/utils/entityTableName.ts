export function defaultTableNameFromCode(code: string): string {
  return code.trim().replace(/:/g, '_');
}

export function resolveEntityTableName(code: string, tableName?: string | null): string {
  const trimmed = tableName?.trim();
  return trimmed || defaultTableNameFromCode(code);
}

export function createEntityCodeUniqueRule(
  entities: API.BusinessDataEntity[],
  excludeEntityId?: string,
) {
  return {
    validator: async (_: unknown, value?: string) => {
      const code = value?.trim();
      if (!code) return;
      if (!code.includes(':')) {
        throw new Error('Code 须包含 Scope 层级，如 sales:order:Order');
      }
      const conflict = entities.find(
        (entity) => entity.id !== excludeEntityId && entity.code?.trim() === code,
      );
      if (conflict) {
        throw new Error(`Code「${code}」已被「${conflict.label}」（${conflict.code}）使用`);
      }
    },
  };
}

export function createTableNameUniqueRule(
  entities: API.BusinessDataEntity[],
  excludeEntityId?: string,
) {
  return {
    validator: async (_: unknown, value?: string) => {
      if (!value?.trim()) return;
      const name = value.trim();
      const conflict = entities.find((entity) => {
        if (entity.entityKind !== 'er_table' || entity.id === excludeEntityId) return false;
        return resolveEntityTableName(entity.code || '', entity.tableName) === name;
      });
      if (conflict) {
        throw new Error(`表名「${name}」已被「${conflict.label}」（${conflict.code}）使用`);
      }
    },
  };
}
