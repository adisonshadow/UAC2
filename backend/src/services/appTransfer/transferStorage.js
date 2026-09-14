/**
 * 迁移包中的存储桶 / 对象文件收集与导入。
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { Op } = require('sequelize');
const models = require('../../models');
const { getStorageRoot, buildObjectRelativePath } = require('../storage/storageService');
const { isSystemBucketCode, getSystemBucketConfig } = require('../storage/systemBucketService');
const {
  extractStorageObjectId,
  collectFileEntries,
  resolvePackageFile,
  assertSafeRelativePath,
} = require('./transferZip');

function pickModelFields(model, row) {
  const attrs = model.getAttributes();
  const out = {};
  for (const key of Object.keys(attrs)) {
    if (key === 'created_at' || key === 'updated_at' || key === 'deleted_at') continue;
    if (Object.prototype.hasOwnProperty.call(row, key)) out[key] = row[key];
  }
  return out;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function collectAppStorage(app, options, warnings) {
  const storageBuckets = (await models.StorageBucket.findAll({
    where: { application_id: app.application_id },
    raw: true,
  })).map((r) => pickModelFields(models.StorageBucket, r));

  if (!options.includeFiles) {
    return { storageBuckets, storageObjects: [], storageFileEntries: [] };
  }

  const logoId = extractStorageObjectId(app.logo_url);
  const bucketIds = storageBuckets.map((b) => b.bucket_id);
  const or = [];
  if (bucketIds.length) or.push({ bucket_id: { [Op.in]: bucketIds } });
  or.push({ application_id: app.application_id });
  if (logoId) or.push({ object_id: logoId });
  if (!or.length) {
    return { storageBuckets, storageObjects: [], storageFileEntries: [] };
  }

  const objectRows = await models.StorageObject.findAll({ where: { [Op.or]: or }, raw: true });
  return decorateObjects(objectRows, storageBuckets, warnings);
}

async function collectPlatformStorage(eadafApp, options, warnings) {
  if (!options.includeFiles) {
    return { storageBuckets: [], storageObjects: [], storageFileEntries: [] };
  }
  const storageBuckets = (await models.StorageBucket.findAll({
    where: {
      [Op.or]: [
        { application_id: eadafApp.application_id },
        { application_id: null },
        { code: getSystemBucketConfig().code },
      ],
    },
    raw: true,
  })).map((r) => pickModelFields(models.StorageBucket, r));

  const bucketIds = storageBuckets.map((b) => b.bucket_id);
  const objectRows = bucketIds.length
    ? await models.StorageObject.findAll({ where: { bucket_id: { [Op.in]: bucketIds } }, raw: true })
    : [];
  return decorateObjects(objectRows, storageBuckets, warnings);
}

async function decorateObjects(objectRows, storageBuckets, warnings) {
  const neededBucketIds = [...new Set(objectRows.map((o) => o.bucket_id).filter(Boolean))];
  const known = new Map(storageBuckets.map((b) => [b.bucket_id, b]));
  const missingIds = neededBucketIds.filter((id) => !known.has(id));
  if (missingIds.length) {
    const extra = await models.StorageBucket.findAll({
      where: { bucket_id: { [Op.in]: missingIds } },
      raw: true,
    });
    extra.forEach((b) => known.set(b.bucket_id, b));
  }

  const storageObjects = objectRows.map((r) => ({
    ...pickModelFields(models.StorageObject, r),
    bucket_code: known.get(r.bucket_id)?.code || null,
  }));
  const { entries, missing } = collectFileEntries(storageObjects);
  if (missing.length) {
    const preview = missing.slice(0, 8).join(', ');
    warnings.push(
      `${missing.length} 个对象在磁盘上缺失,已跳过二进制: ${preview}${missing.length > 8 ? '…' : ''}`,
    );
  }
  return { storageBuckets, storageObjects, storageFileEntries: entries };
}

async function resolveCreatedBy(userId) {
  if (!userId) return null;
  const row = await models.User.findByPk(userId, { attributes: ['user_id'] });
  return row ? userId : null;
}

async function resolveApplicationId(ctx, sourceAppId) {
  if (!sourceAppId) return ctx.defaultStorageApplicationId || ctx.targetAppId || null;
  if (ctx.idMap.applications.has(sourceAppId)) {
    return ctx.idMap.applications.get(sourceAppId);
  }
  if (ctx.sourceAppId && sourceAppId === ctx.sourceAppId && ctx.targetAppId) {
    return ctx.targetAppId;
  }
  const exists = await models.Application.findByPk(sourceAppId, { attributes: ['application_id'] });
  if (exists) return sourceAppId;
  return ctx.defaultStorageApplicationId || ctx.targetAppId || null;
}

async function resolveTargetBucket(ctx, obj, transaction) {
  if (obj.bucket_id && ctx.idMap.buckets.has(obj.bucket_id)) {
    const mapped = ctx.idMap.buckets.get(obj.bucket_id);
    const row = await models.StorageBucket.findByPk(mapped, { transaction });
    if (row) return row;
  }
  if (obj.bucket_code) {
    const byCode = await models.StorageBucket.findOne({
      where: { code: obj.bucket_code },
      transaction,
    });
    if (byCode) {
      if (obj.bucket_id) ctx.idMap.buckets.set(obj.bucket_id, byCode.bucket_id);
      return byCode;
    }
  }
  return null;
}

async function copyObjectFile(srcAbs, destRelative) {
  const safe = assertSafeRelativePath(destRelative);
  const destAbs = path.join(getStorageRoot(), safe);
  ensureDir(path.dirname(destAbs));
  await fsp.copyFile(srcAbs, destAbs);
  return safe;
}

/**
 * @param {object} ctx ImportContext (beginSection/skipSection/itemFailed/idMap/strategy/file)
 * @param {{ defaultApplicationId?: string }} opts
 */
async function importStorageBucketsSection(ctx, opts = {}) {
  const section = ctx.beginSection('storageBuckets');
  const buckets = Array.isArray(ctx.file.storageBuckets) ? ctx.file.storageBuckets : [];
  if (!buckets.length) {
    return ctx.skipSection(section, '文件无存储桶');
  }
  const defaultApplicationId = opts.defaultApplicationId
    || ctx.defaultStorageApplicationId
    || ctx.targetAppId
    || null;
  try {
    for (const bucket of buckets) {
      if (!bucket.code) {
        ctx.itemFailed(section, '(无 code)', new Error('存储桶缺少 code'));
        continue;
      }
      if (isSystemBucketCode(bucket.code)) {
        const existing = await models.StorageBucket.findOne({ where: { code: bucket.code } });
        if (!existing) {
          ctx.itemFailed(section, bucket.code, new Error('目标缺少系统桶,请先执行 init-db'));
          continue;
        }
        if (bucket.bucket_id) ctx.idMap.buckets.set(bucket.bucket_id, existing.bucket_id);
        section.counts.skipped += 1;
        section.notes.push(`系统桶「${bucket.code}」按 code 匹配,未重建`);
        continue;
      }
      const overrides = { application_id: defaultApplicationId };
      if (bucket.access_restrictions?.role_ids?.length) {
        section.errors.push(`存储桶「${bucket.code}」的 access_restrictions.role_ids 指向目标实例角色,请导入后人工核对`);
      }
      await ctx.upsertMeta(
        models.StorageBucket,
        bucket,
        'code',
        ctx.idMap.buckets,
        overrides,
        section,
        {},
      );
    }
  } catch (e) {
    ctx.markFailed(section, e.message);
  }
  return section;
}

/**
 * 保留原 object_id,把 zip files/ 拷到 STORAGE_ROOT。
 */
async function importStorageObjectsSection(ctx, opts = {}) {
  const section = ctx.beginSection('storageObjects');
  section.counts.copied = 0;
  const objects = Array.isArray(ctx.file.storageObjects) ? ctx.file.storageObjects : [];
  const includeFiles = ctx.file.options?.includeFiles === true;
  if (!includeFiles && !objects.length) {
    return ctx.skipSection(section, '未勾选 includeFiles,跳过对象文件');
  }
  if (!objects.length) {
    return ctx.skipSection(section, '文件无存储对象');
  }
  const filesDir = opts.filesDir || (ctx.file.__package && ctx.file.__package.filesDir) || null;
  const defaultApplicationId = opts.defaultApplicationId
    || ctx.defaultStorageApplicationId
    || ctx.targetAppId
    || null;

  try {
    for (const obj of objects) {
      const label = obj.name || obj.object_id || '(对象)';
      try {
        if (!obj.object_id) {
          ctx.itemFailed(section, label, new Error('缺少 object_id'));
          continue;
        }
        const bucketRow = await resolveTargetBucket(ctx, obj);
        if (!bucketRow) {
          ctx.itemFailed(section, label, new Error(`找不到目标桶 ${obj.bucket_code || obj.bucket_id || ''}`));
          continue;
        }
        const destRelative = obj.relative_path
          ? assertSafeRelativePath(String(obj.relative_path).replace(/\\/g, '/'))
          : buildObjectRelativePath(bucketRow.code, obj.object_id, obj.name);
        const applicationId = await resolveApplicationId(ctx, obj.application_id) || defaultApplicationId;
        const createdBy = await resolveCreatedBy(obj.created_by);
        let contentMd5 = obj.content_md5 || null;
        if (contentMd5) {
          const dup = await models.StorageObject.findOne({
            where: { bucket_id: bucketRow.bucket_id, content_md5: contentMd5 },
          });
          if (dup && dup.object_id !== obj.object_id) {
            contentMd5 = null;
            section.notes.push(`对象「${label}」与已有文件 MD5 相同,已去掉 content_md5 以避免冲突`);
          }
        }

        const payload = {
          object_id: obj.object_id,
          bucket_id: bucketRow.bucket_id,
          name: obj.name || 'file',
          mime_type: obj.mime_type || null,
          size: obj.size == null ? 0 : Number(obj.size),
          relative_path: destRelative,
          content_md5: contentMd5,
          application_id: applicationId,
          created_by: createdBy,
        };

        const existing = await models.StorageObject.findByPk(obj.object_id);
        if (existing) {
          if (ctx.strategy === 'overwrite') {
            await existing.update({
              bucket_id: payload.bucket_id,
              name: payload.name,
              mime_type: payload.mime_type,
              size: payload.size,
              relative_path: payload.relative_path,
              content_md5: payload.content_md5,
              application_id: payload.application_id,
              created_by: payload.created_by,
            });
            section.counts.updated += 1;
          } else {
            section.counts.skipped += 1;
            continue;
          }
        } else {
          await models.StorageObject.create(payload);
          section.counts.created += 1;
        }

        const srcAbs = resolvePackageFile(filesDir, obj.relative_path || destRelative);
        if (srcAbs) {
          await copyObjectFile(srcAbs, destRelative);
          section.counts.copied += 1;
        } else if (includeFiles) {
          section.notes.push(`对象「${label}」包内无二进制,仅写入元数据`);
        }
      } catch (e) {
        ctx.itemFailed(section, label, e);
      }
    }
    if (section.counts.failed > 0 && section.counts.created === 0 && section.counts.updated === 0 && section.counts.copied === 0) {
      section.status = 'failed';
    }
  } catch (e) {
    ctx.markFailed(section, e.message);
  }
  return section;
}

module.exports = {
  collectAppStorage,
  collectPlatformStorage,
  importStorageBucketsSection,
  importStorageObjectsSection,
};
