const fs = require('fs').promises;
const path = require('path');
const { findApplicationByKey } = require('./applicationApiCatalogService');

const SKILL_FILE_PATH = path.join(__dirname, '../../../docs/eadaf-api-skill/SKILL.md');

async function assertApplicationApiEnabled(applicationKey) {
  const application = await findApplicationByKey(applicationKey);
  if (!application) {
    throw Object.assign(new Error('应用不存在'), { status: 404 });
  }
  if (!application.api_enabled) {
    throw Object.assign(new Error('该应用未启用 API'), { status: 400 });
  }
  return application;
}

async function readSkillMarkdown() {
  return fs.readFile(SKILL_FILE_PATH, 'utf8');
}

function parseSkillVersion(markdown) {
  const match = String(markdown || '').match(/^---[\s\S]*?\nversion:\s*['"]?([^'"\n]+)['"]?/m);
  return match ? match[1].trim() : null;
}

/**
 * 返回 EADAF API 调用 Skill（Markdown 原文，供 AI / 工具直接读取）。
 */
async function getPublicApiSkillMarkdown(applicationKey) {
  await assertApplicationApiEnabled(applicationKey);
  const markdown = await readSkillMarkdown();
  return {
    markdown,
    version: parseSkillVersion(markdown),
    contentType: 'text/markdown; charset=utf-8',
  };
}

module.exports = {
  getPublicApiSkillMarkdown,
  parseSkillVersion,
};
