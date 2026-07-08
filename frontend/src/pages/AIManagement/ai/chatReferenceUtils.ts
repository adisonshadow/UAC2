type OptionItem = { label: string; value: string };

function resolveOptionLabels(ids: string[] | undefined, options?: OptionItem[]) {
  return (ids || []).map((id) => options?.find((item) => item.value === id)?.label || id);
}

export function buildSkillContentReference(params: {
  name?: string;
  slug?: string;
  description?: string;
  contentMarkdown?: string;
}) {
  const label = params.name
    ? `${params.name}（Skill 内容）`
    : params.slug
      ? `${params.slug}（Skill 内容）`
      : 'Skill 内容';

  return {
    type: 'skill-content',
    label,
    content: {
      slug: params.slug,
      name: params.name,
      description: params.description,
      contentMarkdown: params.contentMarkdown || '',
    },
    unique: true,
  } as const;
}

export function buildSkillFormReference(
  values: Record<string, unknown>,
  context?: {
    toolOptions?: OptionItem[];
    applicationOptions?: OptionItem[];
  },
) {
  const name = values.name as string | undefined;
  const slug = values.slug as string | undefined;
  const label = name ? `${name}（Skill 表单）` : slug ? `${slug}（Skill 表单）` : 'Skill 表单';

  return {
    type: 'skill-form',
    label,
    content: {
      name: values.name,
      slug: values.slug,
      description: values.description,
      applicationScope: values.applicationScope,
      applicationIds: values.applicationIds,
      applicationLabels: resolveOptionLabels(values.applicationIds as string[] | undefined, context?.applicationOptions),
      toolIds: values.toolIds,
      toolLabels: resolveOptionLabels(values.toolIds as string[] | undefined, context?.toolOptions),
      isActive: values.isActive,
      contentMarkdown: (values.contentMarkdown as string) || '',
    },
    unique: true,
  } as const;
}

export function buildSkillAutoOptimizePrompt(values: Record<string, unknown>) {
  const skillName = (values.name as string) || (values.slug as string) || '当前 Skill';
  return `请帮我优化 Skill「${skillName}」的配置与内容。

请根据引用中的 Skill 表单信息，重点优化：
1. 名称与描述是否清晰准确
2. Skill 内容（contentMarkdown）的结构、指令清晰度与可执行性
3. 关联 Tool 是否合理
4. 应用范围设置是否恰当

请给出优化后的完整 contentMarkdown，并说明主要改动点；如需调整其他字段，请一并说明建议值。`;
}
