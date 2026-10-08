/**
 * STORAGE_ROOT 在部署里是绝对路径（如 /data/upload，挂在数据卷上）。
 * path.join(cwd, 绝对路径) 会得到 /app/backend/data/upload，文件写进容器层。
 */
const path = require('path');

function resolveStorageRoot(configured, cwd = process.cwd()) {
  const raw = configured == null ? '' : String(configured).trim();
  const root = raw || 'upload_test';
  return path.isAbsolute(root) ? path.resolve(root) : path.resolve(cwd, root);
}

module.exports = {
  resolveStorageRoot,
};
