import type { AIChatPromptItem, ChatReferenceItem } from '@EADAF/ai-base';

function refsOfType(refs: ChatReferenceItem[], type: string) {
  return refs.filter((r) => r.type === type);
}

function refLabel(ref: ChatReferenceItem): string {
  const c = (ref.content || {}) as Record<string, unknown>;
  return String(ref.label || c.name || c.label || c.code || c.role_name || ref.type);
}

function entityRefs(refs: ChatReferenceItem[]) {
  return refsOfType(refs, 'entity');
}

/** 成员管理 */
export function buildMemberPrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const users = refsOfType(refs, 'user');
  if (users.length === 1) {
    const name = refLabel(users[0]);
    return [
      { key: 'u1', description: `查看「${name}」的角色、部门与权限范围` },
      { key: 'u2', description: `为「${name}」分配合适的业务角色` },
      { key: 'u3', description: `「${name}」应限制在哪些 bizdata Scope？` },
      { key: 'u4', description: '列出所有成员' },
    ];
  }
  return [
    { key: '1', description: '列出所有成员' },
    { key: '2', description: '创建只能管理 equipment 域数据与 API 的用户' },
    { key: '3', description: '如何为新员工配置角色与部门？' },
    { key: '4', description: '点击成员姓名旁的 @ 将成员加入对话上下文' },
  ];
}

/** 组织架构 */
export function buildDepartmentPrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const depts = refsOfType(refs, 'department');
  if (depts.length === 1) {
    const name = refLabel(depts[0]);
    return [
      { key: 'd1', description: `在「${name}」下创建子部门` },
      { key: 'd2', description: `为「${name}」配置继承角色` },
      { key: 'd3', description: `「${name}」下现有成员与角色分布` },
      { key: 'd4', description: '列出完整组织架构树' },
    ];
  }
  return [
    { key: '1', description: '列出当前组织架构' },
    { key: '2', description: '在某个一级部门下创建子部门' },
    { key: '3', description: '部门继承角色如何生效？' },
    { key: '4', description: '点击部门名称旁的 @ 引用部门上下文' },
  ];
}

/** 角色管理 */
export function buildRolePrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const roles = refsOfType(refs, 'role');
  if (roles.length === 1) {
    const name = refLabel(roles[0]);
    return [
      { key: 'r1', description: `查看「${name}」已分配的权限` },
      { key: 'r2', description: `为「${name}」补充 equipment 域 API 权限` },
      { key: 'r3', description: `「${name}」适合绑定哪些 bizdata Scope？` },
      { key: 'r4', description: '列出所有角色' },
    ];
  }
  return [
    { key: '1', description: '列出所有角色' },
    { key: '2', description: '创建 equipment 域仅管数据模型与 API 的角色' },
    { key: '3', description: '角色继承与部门角色有什么区别？' },
    { key: '4', description: '点击角色名称旁的 @ 引用角色上下文' },
  ];
}

/** 权限 */
export function buildPermissionPrompts(
  resourceType: string,
  refs: ChatReferenceItem[],
): AIChatPromptItem[] {
  const typeLabel =
    resourceType === 'MENU' ? '菜单' : resourceType === 'BUTTON' ? '按钮' : 'API';
  const perms = refsOfType(refs, 'permission');
  if (perms.length === 1) {
    const code = refLabel(perms[0]);
    return [
      { key: 'p1', description: `解释权限「${code}」的用途与适用场景` },
      { key: 'p2', description: `哪些角色应拥有「${code}」？` },
      { key: 'p3', description: `为「${code}」补充更清晰的描述` },
      { key: 'p4', description: `列出所有 ${typeLabel} 权限` },
    ];
  }
  return [
    { key: '1', description: `列出所有 ${typeLabel} 权限` },
    { key: '2', description: `为业务数据模块补充 ${typeLabel} 权限项` },
    { key: '3', description: '权限 code 命名规范是什么？' },
    { key: '4', description: '点击权限编码旁的 @ 引用该权限' },
  ];
}

/** 应用 */
export function buildApplicationPrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const apps = refsOfType(refs, 'application');
  if (apps.length === 1) {
    const name = refLabel(apps[0]);
    return [
      { key: 'a1', description: `检查「${name}」的 API / SSO 配置是否完整` },
      { key: 'a2', description: `为「${name}」配置 bizdata Scope 数据范围` },
      { key: 'a3', description: `「${name}」应启用哪些 API 数据权限？` },
      { key: 'a4', description: '列出所有应用' },
    ];
  }
  return [
    { key: '1', description: '列出所有应用' },
    { key: '2', description: '新建应用需要配置哪些项？' },
    { key: '3', description: '应用 Scope 与 bizdata 实体前缀的关系' },
    { key: '4', description: '点击应用名称旁的 @ 引用应用上下文' },
  ];
}

/** API 服务列表 */
export function buildApiServiceListPrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const services = refsOfType(refs, 'api-service');
  const entities = entityRefs(refs);

  if (services.length === 1) {
    const name = refLabel(services[0]);
    return [
      { key: 's1', description: `为「${name}」生成 mock 测试参数并执行测试` },
      { key: 's2', description: `发布「${name}」并说明路由与状态` },
      { key: 's3', description: `检查「${name}」SQL 与绑定实体是否一致` },
      { key: 's4', description: `「${name}」适合哪些调用场景？` },
      { key: 's5', description: '列出所有 API 服务' },
    ];
  }

  if (entities.length >= 1) {
    const names = entities.map(refLabel).join('、');
    return [
      { key: 'e1', description: `为「${names}」创建或补齐 API 服务` },
      { key: 'e2', description: `列出与「${names}」相关的已发布 API` },
      { key: 'e3', description: '批量为引用实体创建 find API' },
      { key: 'e4', description: 'API 服务 code 与域划分规则' },
    ];
  }

  return [
    { key: '1', description: '列出当前所有 API 服务' },
    { key: '2', description: '如何发布 draft 状态的 API 服务？' },
    { key: '3', description: '打开测试弹窗后如何生成 mock 参数并测试 API？' },
    { key: '4', description: '从实体批量创建 CRUD API 的流程' },
    { key: '5', description: '点击服务名称旁的 @ 引用 API 上下文' },
  ];
}

/** 文件 Bucket */
export function buildStorageBucketPrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const buckets = refsOfType(refs, 'storage-bucket');
  if (buckets.length === 1) {
    const name = refLabel(buckets[0]);
    return [
      { key: 'b1', description: `检查「${name}」的访问策略是否合理` },
      { key: 'b2', description: `「${name}」应限制哪些角色或 Scope？` },
      { key: 'b3', description: `为「${name}」推荐 public / authenticated 模式` },
      { key: 'b4', description: '列出所有 Bucket' },
    ];
  }
  return [
    { key: '1', description: '列出所有 Bucket 及访问模式' },
    { key: '2', description: '如何配置 Bucket 的角色与 Scope 限制？' },
    { key: '3', description: '系统内置 Bucket 与业务 Bucket 的区别' },
    { key: '4', description: '点击 Bucket 名称旁的 @ 引用存储上下文' },
  ];
}

/** AI Scope */
export function buildAIScopePrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const scopes = refsOfType(refs, 'ai-scope');
  if (scopes.length === 1) {
    const name = refLabel(scopes[0]);
    return [
      { key: 'as1', description: `「${name}」下有哪些 Skill 和 Tool？` },
      { key: 'as2', description: `为「${name}」规划新的 Tool / Skill` },
      { key: 'as3', description: `检查「${name}」Scope 描述是否清晰` },
    ];
  }
  return [
    { key: '1', description: '列出所有 AI Scope' },
    { key: '2', description: 'business-data Scope 包含哪些能力？' },
    { key: '3', description: 'Scope 与 Skill / Tool 的归属关系' },
  ];
}

export function buildAISkillListPrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const skills = refsOfType(refs, 'ai-skill');
  if (skills.length === 1) {
    const name = refLabel(skills[0]);
    return [
      { key: 'sk1', description: `优化 Skill「${name}」的指令内容` },
      { key: 'sk2', description: `「${name}」应关联哪些 Tool？` },
      { key: 'sk3', description: `检查「${name}」的应用范围设置` },
    ];
  }
  return [
    { key: '1', description: '列出所有 Skill 及关联 Tool' },
    { key: '2', description: '如何为新业务场景设计 Skill？' },
    { key: '3', description: 'bizdata 相关 Skill 有哪些？' },
  ];
}

export function buildAIToolListPrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const tools = refsOfType(refs, 'ai-tool');
  if (tools.length === 1) {
    const name = refLabel(tools[0]);
    return [
      { key: 't1', description: `说明 Tool「${name}」的参数与使用场景` },
      { key: 't2', description: `哪些 Skill 应引用「${name}」？` },
      { key: 't3', description: `检查「${name}」的 review 说明是否完整` },
    ];
  }
  return [
    { key: '1', description: '列出 business-data Scope 下的 Tool' },
    { key: '2', description: 'client Tool 与 server Tool 如何选择？' },
    { key: '3', description: '如何为数据模型设计新增 Tool？' },
  ];
}

export function buildAIProviderPrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const providers = refsOfType(refs, 'ai-provider');
  if (providers.length === 1) {
    const name = refLabel(providers[0]);
    return [
      { key: 'pr1', description: `检查「${name}」连接配置是否正常` },
      { key: 'pr2', description: `为「${name}」注册常用对话模型` },
      { key: 'pr3', description: `「${name}」支持哪些能力标签？` },
    ];
  }
  return [
    { key: '1', description: '列出当前所有 AI 服务商' },
    { key: '2', description: '如何接入 DeepSeek / 火山方舟？' },
    { key: '3', description: '服务商停用后模型如何处理？' },
  ];
}

export function buildAIModelListPrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const models = refsOfType(refs, 'ai-model');
  if (models.length === 1) {
    const name = refLabel(models[0]);
    return [
      { key: 'm1', description: `「${name}」的 capabilities 与多模态配置建议` },
      { key: 'm2', description: `如何让「${name}」支持图片附件？` },
      { key: 'm3', description: `检查「${name}」是否适合 function calling` },
    ];
  }
  return [
    { key: '1', description: '列出所有已启用的 AI 模型' },
    { key: '2', description: '如何配置支持 vision 的模型？' },
    { key: '3', description: 'capabilities 与 inputTags 如何配合？' },
  ];
}

/** 数据标准 */
export function buildDataStandardPrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const standards = refsOfType(refs, 'data-standard');
  if (standards.length === 1) {
    const name = refLabel(standards[0]);
    return [
      { key: 'ds1', description: `哪些元数据引用了标准「${name}」？` },
      { key: 'ds2', description: `完善标准「${name}」的描述与版本说明` },
      { key: 'ds3', description: `为 equipment 域字段关联「${name}」` },
    ];
  }
  return [
    { key: '1', description: '列出所有启用的数据标准' },
    { key: '2', description: '创建一条测试环境数据标准' },
    { key: '3', description: '数据标准与元数据字段如何关联？' },
  ];
}

/** 指标表单（新建 / 编辑） */
export function buildMetricFormPrompts(
  mode: 'create' | 'edit',
  metric?: { label?: string; code?: string; metricType?: string },
): AIChatPromptItem[] {
  if (mode === 'edit' && (metric?.label || metric?.code)) {
    const name = metric.label || metric.code || '当前指标';
    const typeHint = metric.metricType === 'formula' ? '公式' : 'SQL';
    return [
      { key: 'mf1', description: `优化「${name}」的 ${typeHint} 定义与调度` },
      { key: 'mf2', description: `「${name}」的业务口径应如何描述？` },
      { key: 'mf3', description: `检查「${name}」依赖的数据源与连接` },
      { key: 'mf4', description: '执行该指标并解释结果含义' },
    ];
  }
  return [
    { key: 'mc1', description: '为订单域创建日订单量 SQL 指标' },
    { key: 'mc2', description: 'SQL 指标与公式复合指标如何选择？' },
    { key: 'mc3', description: 'cron 定时调度配置示例' },
    { key: 'mc4', description: '指标 code 与 Scope 前缀命名规范' },
  ];
}

/** 指标看板 */
export function buildMetricDashboardPrompts(): AIChatPromptItem[] {
  return [
    { key: 'md1', description: '帮我为现有指标创建合适的看板卡片' },
    { key: 'md2', description: '解释当前看板各域卡片的业务含义' },
    { key: 'md3', description: '哪些卡片缺历史数据或维度数据？' },
    { key: 'md4', description: '为 content 域推荐折线 / 柱状 / 趋势卡片组合' },
  ];
}

/** 文件浏览器 */
export function buildStorageBrowserPrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const objects = refsOfType(refs, 'storage-object');
  if (objects.length === 1) {
    const name = refLabel(objects[0]);
    return [
      { key: 'so1', description: `「${name}」的访问权限与所属 Bucket` },
      { key: 'so2', description: `哪些角色可以访问「${name}」？` },
      { key: 'so3', description: '列出当前 Bucket 下的文件' },
    ];
  }
  const buckets = refsOfType(refs, 'storage-bucket');
  if (buckets.length === 1) {
    const name = refLabel(buckets[0]);
    return [
      { key: 'sb1', description: `列出 Bucket「${name}」中的文件` },
      { key: 'sb2', description: `「${name}」的访问策略说明` },
      { key: 'sb3', description: `上传到「${name}」的权限要求` },
    ];
  }
  return [
    { key: '1', description: '列出各 Bucket 下的近期上传文件' },
    { key: '2', description: '公开 Bucket 与授权 Bucket 有何区别？' },
    { key: '3', description: '图片预览失败如何排查？' },
    { key: '4', description: '点击文件名旁的 @ 引用文件上下文' },
  ];
}

/** 业务指标 */
export function buildMetricPrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const metrics = refsOfType(refs, 'metric');
  if (metrics.length === 1) {
    const name = refLabel(metrics[0]);
    return [
      { key: 'mt1', description: `执行指标「${name}」并解释结果` },
      { key: 'mt2', description: `优化「${name}」的 SQL / 公式与调度` },
      { key: 'mt3', description: `「${name}」的业务含义与适用场景` },
      { key: 'mt4', description: '列出所有指标' },
    ];
  }
  const entities = entityRefs(refs);
  if (entities.length >= 1) {
    const label = refLabel(entities[0]);
    return [
      { key: 'me1', description: `为「${label}」设计 2～3 个核心指标` },
      { key: 'me2', description: `列出 sales / equipment 域已有指标` },
      { key: 'me3', description: 'SQL 聚合与复合公式指标如何选择？' },
    ];
  }
  return [
    { key: '1', description: '列出所有业务指标' },
    { key: '2', description: '为客户与订单域创建常用统计指标' },
    { key: '3', description: '定时指标调度如何配置？' },
    { key: '4', description: '点击指标旁的 @ 引用指标上下文' },
  ];
}

/** 逻辑元数据 */
export function buildMetadataPrompts(
  refs: ChatReferenceItem[],
  selectedCode?: string,
): AIChatPromptItem[] {
  const tables = refsOfType(refs, 'metadata-table');
  const targetCode = tables.length ? refLabel(tables[0]) : selectedCode;

  if (targetCode) {
    return [
      { key: 'md1', description: `为「${targetCode}」补全字段业务释义` },
      { key: 'md2', description: `为「${targetCode}」关联合适的数据标准` },
      { key: 'md3', description: `检查「${targetCode}」敏感等级设置` },
      { key: 'md4', description: '从数据模型同步元数据骨架' },
    ];
  }

  const entities = entityRefs(refs);
  if (entities.length >= 1) {
    const code = (entities[0].content as { code?: string })?.code || refLabel(entities[0]);
    return [
      { key: 'e1', description: `同步并完善「${code}」的逻辑元数据` },
      { key: 'e2', description: `为「${code}」字段补充元数据编码` },
      { key: 'e3', description: '元数据与数据标准的关联规则' },
    ];
  }

  return [
    { key: '1', description: '从数据模型同步元数据骨架' },
    { key: '2', description: '为 equipment 域实体补全元数据' },
    { key: '3', description: '如何批量设置字段敏感等级？' },
    { key: '4', description: '点击元数据条目旁的 @ 引用上下文' },
  ];
}

/** 物化执行 */
export function buildMaterializationExecutePrompts(
  refs: ChatReferenceItem[],
  ctx?: { selectedCount?: number; connectionName?: string },
): AIChatPromptItem[] {
  const entities = entityRefs(refs);
  if (entities.length >= 1) {
    const names = entities.map(refLabel).join('、');
    return [
      { key: 'mat1', description: `预览「${names}」在当前连接的物化 SQL` },
      { key: 'mat2', description: `执行物化：${names}` },
      { key: 'mat3', description: `检查「${names}」物化版本是否落后模型` },
    ];
  }
  if (ctx?.selectedCount && ctx.selectedCount > 0) {
    return [
      { key: 'sel1', description: `预览已选 ${ctx.selectedCount} 个实体的物化脚本` },
      { key: 'sel2', description: '执行当前选中实体的物化（dryRun 先预览）' },
      { key: 'sel3', description: '哪些已选实体物化版本过期？' },
    ];
  }
  const conn = ctx?.connectionName;
  return [
    { key: '1', description: conn ? `查看「${conn}」下各实体物化状态` : '查看各实体物化版本状态' },
    { key: '2', description: '预览当前连接的物化脚本' },
    { key: '3', description: '哪些表需要重新物化？' },
    { key: '4', description: '从模型树引用实体后生成物化预览' },
  ];
}

/** 物化数据库现状 */
export function buildMaterializedDatabasePrompts(refs: ChatReferenceItem[]): AIChatPromptItem[] {
  const entities = entityRefs(refs);
  if (entities.length >= 1) {
    const name = refLabel(entities[0]);
    return [
      { key: 'db1', description: `「${name}」当前物化版本与模型版本对比` },
      { key: 'db2', description: `重新物化「${name}」需要哪些步骤？` },
      { key: 'db3', description: `查看「${name}」对应物理表结构` },
    ];
  }
  return [
    { key: '1', description: '哪些实体物化版本不是最新？' },
    { key: '2', description: '解释 stale / synced 物化状态' },
    { key: '3', description: '如何切换连接查看物化现状？' },
  ];
}

/** 实体引用（模型设计器等已有专用逻辑时可复用） */
export function buildEntityContextPrompts(
  refs: ChatReferenceItem[],
  selected?: API.BusinessDataEntity | null,
): AIChatPromptItem[] {
  if (selected) {
    const label = selected.label || selected.code || '当前实体';
    if (selected.entityKind === 'json_schema') {
      return [
        { key: '1', description: `优化「${label}」的 JSON Schema` },
        { key: '2', description: `检查「${label}」字段定义` },
        { key: '3', description: '列出所有业务实体' },
      ];
    }
    return [
      { key: '1', description: `为「${label}」补充常用字段` },
      { key: '2', description: `为「${label}」自动创建和补齐索引` },
      { key: '3', description: `为「${label}」自动创建和补齐关系` },
      { key: '4', description: '列出所有业务实体' },
    ];
  }

  const entities = entityRefs(refs);
  if (entities.length === 1) {
    const label = refLabel(entities[0]);
    return [
      { key: 'e1', description: `查看实体「${label}」的字段与关系` },
      { key: 'e2', description: `为「${label}」完善字段与索引` },
      { key: 'e3', description: `为「${label}」建立与其他实体的关系` },
    ];
  }

  return [
    { key: '1', description: '列出当前所有业务实体' },
    { key: '2', description: '概述各 Scope 下的实体分布' },
    { key: '3', description: '创建实体时如何同时配置索引与关系？' },
  ];
}
