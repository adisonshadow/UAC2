/** 用户可见文案：仅意图 + 配置原文；解析/建连细则在 Skill bizdata-materialization */
export function buildConnectionImportPrompt(rawText: string): string {
  const text = String(rawText || '').trim();
  return `请根据以下连接串 / 配置创建数据库连接：

\`\`\`
${text}
\`\`\``;
}
