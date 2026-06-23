const { v4: uuidv4 } = require('uuid');

const CAPABILITIES = [
  'text',
  'vision',
  'image_generation',
  'audio_input',
  'audio_output',
  'embedding',
  'function_calling'
];

const MODALITIES = ['text', 'image', 'audio', 'video', 'file'];

const IO_DIRECTIONS = ['input', 'output'];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG_PATTERN.test(slug);
}

function generateSlugFromText(text) {
  const normalized = String(text || 'item')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60);

  if (normalized && isValidSlug(normalized)) {
    return normalized;
  }

  return `item-${uuidv4().slice(0, 8)}`;
}

async function resolveUniqueSlug(Model, sourceText, options = {}) {
  const { transaction, excludeId } = options;
  const base = generateSlugFromText(sourceText);
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await Model.findOne({ where: { slug: candidate }, transaction });
    if (!existing || (excludeId && existing.id === excludeId)) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

function validateCapabilities(capabilities) {
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    return { valid: false, message: 'capabilities 必须为非空数组' };
  }
  const invalid = capabilities.filter((item) => !CAPABILITIES.includes(item));
  if (invalid.length > 0) {
    return { valid: false, message: `无效 capability: ${invalid.join(', ')}` };
  }
  return { valid: true };
}

function validateModalities(tags, fieldName) {
  if (!Array.isArray(tags)) {
    return { valid: false, message: `${fieldName} 必须为数组` };
  }
  const invalid = tags.filter((item) => !MODALITIES.includes(item));
  if (invalid.length > 0) {
    return { valid: false, message: `无效 ${fieldName}: ${invalid.join(', ')}` };
  }
  return { valid: true };
}

module.exports = {
  CAPABILITIES,
  MODALITIES,
  IO_DIRECTIONS,
  SLUG_PATTERN,
  isValidSlug,
  generateSlugFromText,
  resolveUniqueSlug,
  validateCapabilities,
  validateModalities
};
