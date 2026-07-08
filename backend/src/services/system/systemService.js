const path = require('path');
const fs = require('fs/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');
const config = require('../../config');
const { BizdataSetting } = require('../../models');

const execFileAsync = promisify(execFile);

const SYSTEM_FEATURES_KEY = 'system_features';
const projectRoot = path.resolve(__dirname, '../../..');

function resolveBackupDir() {
  const envDir = process.env.DB_BACKUP_DIR;
  if (envDir) {
    if (envDir.startsWith('/')) return envDir;
    return path.join(projectRoot, envDir);
  }
  return path.join(projectRoot, 'db-backup');
}

function formatStandard(row) {
  if (!row) return null;
  const d = row.toJSON ? row.toJSON() : row;
  return {
    id: d.id,
    name: d.name,
    code: d.code,
    version: d.version,
    description: d.description,
    status: d.status,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

async function getSystemFeatures() {
  const setting = await BizdataSetting.findOne({ where: { key: SYSTEM_FEATURES_KEY } });
  const value = setting?.value || {};
  return {
    metadataEnabled: Boolean(value.metadataEnabled),
    apiServiceAllowWriteOperations: Boolean(value.apiServiceAllowWriteOperations),
    apiServiceTestAutoRollback: value.apiServiceTestAutoRollback !== false,
  };
}

async function updateSystemFeatures(payload) {
  const current = await getSystemFeatures();
  const next = {
    ...current,
    ...(payload.metadataEnabled !== undefined
      ? { metadataEnabled: Boolean(payload.metadataEnabled) }
      : {}),
    ...(payload.apiServiceAllowWriteOperations !== undefined
      ? { apiServiceAllowWriteOperations: Boolean(payload.apiServiceAllowWriteOperations) }
      : {}),
    ...(payload.apiServiceTestAutoRollback !== undefined
      ? { apiServiceTestAutoRollback: Boolean(payload.apiServiceTestAutoRollback) }
      : {}),
  };

  const [setting] = await BizdataSetting.findOrCreate({
    where: { key: SYSTEM_FEATURES_KEY },
    defaults: { value: next },
  });

  if (!setting.isNewRecord) {
    await setting.update({ value: next });
  }

  return next;
}

async function listBackups() {
  const backupDir = resolveBackupDir();
  try {
    const entries = await fs.readdir(backupDir);
    const dumps = entries.filter((name) => name.endsWith('.dump'));
    const items = [];

    for (const name of dumps) {
      const filePath = path.join(backupDir, name);
      const stat = await fs.stat(filePath);
      items.push({
        name,
        path: filePath,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      });
    }

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { backupDir, items };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { backupDir, items: [] };
    }
    throw error;
  }
}

async function runBackup() {
  const scriptPath = path.join(projectRoot, 'scripts', 'backup-db-now.sh');

  const { stdout, stderr } = await execFileAsync('bash', [scriptPath], {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: config.env },
    maxBuffer: 20 * 1024 * 1024,
    timeout: 600000,
  });

  const backups = await listBackups();
  return {
    stdout: stdout || '',
    stderr: stderr || '',
    latestBackup: backups.items[0] || null,
  };
}

module.exports = {
  SYSTEM_FEATURES_KEY,
  formatStandard,
  getSystemFeatures,
  updateSystemFeatures,
  listBackups,
  runBackup,
  resolveBackupDir,
};
