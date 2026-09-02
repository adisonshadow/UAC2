import type { AIChatPromptItem, ChatReferenceItem } from '@eadaf/ai-base';

export interface ApiServiceCreatePromptContext {
  primaryOperation?: string;
  hasDefinitionScript?: boolean;
  serviceCode?: string;
}

interface ParsedScopeRef {
  code: string;
  name: string;
}

interface ParsedEntityRef {
  code?: string;
  label: string;
  tableName?: string;
}

function parseReferences(references: ChatReferenceItem[]) {
  const scopes: ParsedScopeRef[] = [];
  const entities: ParsedEntityRef[] = [];

  references.forEach((ref) => {
    const content = (ref.content || {}) as Record<string, unknown>;
    if (ref.type === 'scope') {
      const code = String(content.code || '').trim();
      if (!code) return;
      scopes.push({
        code,
        name: String(content.name || ref.label || code),
      });
    }
    if (ref.type === 'entity') {
      entities.push({
        code: content.code ? String(content.code) : undefined,
        label: String(content.label || ref.label || content.code || '实体'),
        tableName: content.tableName ? String(content.tableName) : undefined,
      });
    }
  });

  return { scopes, entities };
}

const DEFAULT_PROMPTS: AIChatPromptItem[] = [
  { key: 'default-1', description: '如何用 apiservice_create_services_batch 为业务实体批量创建 CRUD API？' },
  { key: 'default-2', description: 'find 和 aggregate 分别适合什么场景？' },
  { key: 'default-3', description: 'API 服务 code 命名规则是什么？' },
  { key: 'default-4', description: '从左侧数据模型树添加 Scope 或实体引用后创建 API' },
];

function entityLabel(entity: ParsedEntityRef) {
  return entity.label || entity.code || '实体';
}

function scopeLabel(scope: ParsedScopeRef) {
  return scope.name || scope.code;
}

function promptsForSingleEntity(
  entity: ParsedEntityRef,
  ctx: ApiServiceCreatePromptContext,
): AIChatPromptItem[] {
  const label = entityLabel(entity);
  const code = entity.code || label;
  const prompts: AIChatPromptItem[] = [
    {
      key: 'entity-1',
      description: `先 bizdata_get_entity 读取「${label}」字段，再用 apiservice_create_service 创建 find API（勿只写 SQL）`,
    },
    {
      key: 'entity-2',
      description: `先 bizdata_get_entity，再 apiservice_create_services_batch 为「${label}」批量创建 CRUD API`,
    },
    {
      key: 'entity-3',
      description: `推荐「${label}」的 API code 与显示名称（仍须走创建 Tool 落库）`,
    },
  ];

  if (ctx.hasDefinitionScript) {
    prompts.push({
      key: 'entity-4',
      description: `对照 bizdata_get_entity 字段，检查当前 SQL 是否适合「${label}」的 ${ctx.primaryOperation || 'find'}，并用 apiservice_create_service / update 落库`,
    });
  } else if (entity.tableName) {
    prompts.push({
      key: 'entity-4',
      description: `读取「${label}」字段后，用 apiservice_create_service 创建（可省略 definitionScript，由 Tool 按物化表「${entity.tableName}」生成默认 SQL）`,
    });
  } else {
    prompts.push({
      key: 'entity-4',
      description: `bizdata_get_entity 查看「${label}」（${code}）字段，再 apiservice_create_service 创建`,
    });
  }

  return prompts;
}

function promptsForMultipleEntities(entities: ParsedEntityRef[]): AIChatPromptItem[] {
  const names = entities.map(entityLabel).join('、');
  return [
    {
      key: 'multi-1',
      description: `分别 bizdata_get_entity 读取「${names}」字段，再为各实体 apiservice_create_service 创建 find API`,
    },
    {
      key: 'multi-2',
      description: `分别为引用的 ${entities.length} 个实体调用 apiservice_create_service 创建 find API`,
    },
    {
      key: 'multi-3',
      description: '对引用实体先 get_entity，再 apiservice_create_services_batch 批量创建 CRUD',
    },
    {
      key: 'multi-4',
      description: '推荐跨实体 API 的 code 命名与域划分',
    },
  ];
}

function promptsForSingleScope(scope: ParsedScopeRef): AIChatPromptItem[] {
  const label = scopeLabel(scope);
  return [
    {
      key: 'scope-1',
      description: `列出「${label}」域下适合暴露 API 的实体`,
    },
    {
      key: 'scope-2',
      description: `列出「${label}」核心实体后，逐个 get_entity 并用 create_services_batch 创建 CRUD API`,
    },
    {
      key: 'scope-3',
      description: `为「${label}」域设计一个汇总/统计类 API`,
    },
    {
      key: 'scope-4',
      description: `「${label}」域已有 API 服务吗？还缺哪些？`,
    },
  ];
}

function promptsForMultipleScopes(scopes: ParsedScopeRef[]): AIChatPromptItem[] {
  const names = scopes.map(scopeLabel).join('、');
  return [
    {
      key: 'scopes-1',
      description: `概述「${names}」各域下的实体与 API 建议`,
    },
    {
      key: 'scopes-2',
      description: '为引用的 Scope 域批量规划 CRUD API',
    },
    {
      key: 'scopes-3',
      description: '跨 Scope 实体 JOIN 查询 API 怎么设计？',
    },
    {
      key: 'scopes-4',
      description: '这些域的 API code 如何统一命名？',
    },
  ];
}

function promptsForScopeAndEntities(
  scopes: ParsedScopeRef[],
  entities: ParsedEntityRef[],
  ctx: ApiServiceCreatePromptContext,
): AIChatPromptItem[] {
  const scope = scopes[0];
  const entityPrompts = promptsForSingleEntity(entities[0], ctx).slice(0, 2);
  return [
    ...entityPrompts,
    {
      key: 'mix-1',
      description: `在「${scopeLabel(scope)}」域内，为其余实体补充 API`,
    },
    {
      key: 'mix-2',
      description: `「${scopeLabel(scope)}」域 + 引用实体的 API 命名建议`,
    },
  ];
}

export function buildApiServiceCreatePrompts(
  references: ChatReferenceItem[],
  ctx: ApiServiceCreatePromptContext = {},
): AIChatPromptItem[] {
  const { scopes, entities } = parseReferences(references);

  if (entities.length === 1 && scopes.length === 0) {
    return promptsForSingleEntity(entities[0], ctx);
  }
  if (entities.length > 1) {
    if (scopes.length > 0 && entities.length <= 2) {
      return promptsForScopeAndEntities(scopes, entities, ctx);
    }
    return promptsForMultipleEntities(entities);
  }
  if (scopes.length === 1) {
    return promptsForSingleScope(scopes[0]);
  }
  if (scopes.length > 1) {
    return promptsForMultipleScopes(scopes);
  }

  if (ctx.serviceCode) {
    return [
      { key: 'form-1', description: '用 apiservice_create_service / update_service 优化并落库当前 SQL（勿只改对话文案）' },
      { key: 'form-2', description: `检查 code「${ctx.serviceCode}」与操作类型是否匹配` },
      { key: 'form-3', description: '如何用 Tool 为业务实体批量创建 CRUD API？' },
      { key: 'form-4', description: '从左侧数据模型树添加 Scope 或实体引用' },
    ];
  }

  return DEFAULT_PROMPTS;
}
