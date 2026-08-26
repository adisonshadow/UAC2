const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const config = require('../../config');

/** 对外仅暴露 cover / contain；contain 内部映射为 sharp inside（按比例适配，不留白） */
const FIT_VALUES = new Set(['cover', 'contain']);
const MIN_DIM = 1;
const MAX_DIM = 4096;

function parseCropQuery(query = {}) {
  const rawW = query.w;
  const rawH = query.h;
  let w = rawW !== undefined && rawW !== '' ? Number.parseInt(String(rawW), 10) : undefined;
  let h = rawH !== undefined && rawH !== '' ? Number.parseInt(String(rawH), 10) : undefined;
  const fit = query.fit ? String(query.fit).trim().toLowerCase() : undefined;

  if (w !== undefined && (Number.isNaN(w) || w < MIN_DIM || w > MAX_DIM)) {
    const err = new Error(`w 须在 ${MIN_DIM}–${MAX_DIM} 之间`);
    err.status = 400;
    throw err;
  }
  if (h !== undefined && (Number.isNaN(h) || h < MIN_DIM || h > MAX_DIM)) {
    const err = new Error(`h 须在 ${MIN_DIM}–${MAX_DIM} 之间`);
    err.status = 400;
    throw err;
  }
  if (fit && !FIT_VALUES.has(fit)) {
    const err = new Error(`fit 须为 cover 或 contain`);
    err.status = 400;
    throw err;
  }

  if (!w && !h) {
    w = 480;
  }

  return { w, h, fit };
}

function buildCacheFileName(objectId, { w, h, fit }) {
  const wPart = w ?? '';
  const hPart = h ?? '';
  const fitPart = fit ?? '';
  return `${objectId}_${wPart}x${hPart}_${fitPart}.webp`;
}

function ensureCacheDir() {
  const dir = config.storage.cropCacheDir;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 构建 sharp.resize 选项：
 * 1) 同时指定 w、h：fit=cover 覆盖裁剪到精确尺寸；fit=contain（默认）按比例缩放到框内（不留白，输出未必等于 w×h）
 * 2) 只指定 w 或 h：按原图比例自动计算另一边，忽略 fit
 */
function buildResizeOptions({ w, h, fit }) {
  const options = { withoutEnlargement: true };
  if (w) options.width = w;
  if (h) options.height = h;

  if (w && h) {
    // contain → inside：完整装入框内，保留比例，无 letterbox
    options.fit = fit === 'cover' ? 'cover' : 'inside';
  }
  // 仅一侧尺寸时不设 fit，sharp 按原图比例计算另一边

  return options;
}

async function cropImage({ objectId, sourcePath, query }) {
  if (!objectId) {
    const err = new Error('objectId 为必填项');
    err.status = 400;
    throw err;
  }
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    const err = new Error('原图文件不存在');
    err.status = 404;
    throw err;
  }

  const params = parseCropQuery(query);
  const cacheDir = ensureCacheDir();
  const cacheFileName = buildCacheFileName(objectId, params);
  const cachedImagePath = path.join(cacheDir, cacheFileName);

  if (fs.existsSync(cachedImagePath)) {
    return cachedImagePath;
  }

  await sharp(sourcePath)
    .resize(buildResizeOptions(params))
    .webp({ quality: 80 })
    .toFile(cachedImagePath);

  return cachedImagePath;
}

module.exports = {
  FIT_VALUES,
  parseCropQuery,
  buildResizeOptions,
  cropImage,
};
