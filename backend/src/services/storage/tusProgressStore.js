const { Op } = require('sequelize');
const StorageUploadSession = require('../../models/storage_upload_session');
const { getRedisClient } = require('../../utils/redisClient');
const logger = require('../../utils/logger');
const config = require('../../config');

const REDIS_PREFIX = 'storage:tus:';

function redisKey(uploadId) {
  return `${REDIS_PREFIX}${uploadId}`;
}

function toPlain(session) {
  if (!session) return null;
  const json = session.toJSON ? session.toJSON() : session;
  return {
    uploadId: json.upload_id,
    bucketId: json.bucket_id,
    filename: json.filename,
    mimeType: json.mime_type,
    uploadLength: Number(json.upload_length || 0),
    offset: Number(json.offset_bytes || 0),
    status: json.status,
    expiresAt: json.expires_at,
    contentMd5: json.content_md5,
    expectedMd5: json.expected_md5,
    objectId: json.object_id,
    relativePath: json.relative_path,
    uploadedRanges: Array.isArray(json.uploaded_ranges) ? json.uploaded_ranges : [],
    errorMessage: json.error_message,
    applicationId: json.application_id,
    createdBy: json.created_by,
    ownerKind: json.owner_kind,
    createdAt: json.created_at,
    updatedAt: json.updated_at,
  };
}

function ttlMsFromExpiresAt(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(ms, 1000);
}

async function writeRedis(sessionRow) {
  const client = await getRedisClient();
  if (!client) return;
  const plain = toPlain(sessionRow);
  try {
    await client.hSet(redisKey(plain.uploadId), {
      offset: String(plain.offset),
      uploadLength: String(plain.uploadLength),
      status: plain.status || '',
      filename: plain.filename || '',
      bucketId: plain.bucketId || '',
      ownerKind: plain.ownerKind || '',
      createdBy: plain.createdBy || '',
      applicationId: plain.applicationId || '',
      ranges: JSON.stringify(plain.uploadedRanges || []),
    });
    await client.pExpire(redisKey(plain.uploadId), ttlMsFromExpiresAt(plain.expiresAt));
  } catch (error) {
    logger.warn('tus Redis 进度写入失败（已忽略）', { message: error.message, uploadId: plain.uploadId });
  }
}

async function deleteRedis(uploadId) {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.del(redisKey(uploadId));
  } catch (error) {
    logger.warn('tus Redis 进度删除失败（已忽略）', { message: error.message, uploadId });
  }
}

async function createSession(payload) {
  const expirationMs = config.storage.tus.expirationMs;
  const row = await StorageUploadSession.create({
    upload_id: payload.uploadId,
    bucket_id: payload.bucketId,
    filename: payload.filename,
    mime_type: payload.mimeType || null,
    upload_length: payload.uploadLength || 0,
    offset_bytes: 0,
    status: 'uploading',
    expires_at: new Date(Date.now() + expirationMs),
    expected_md5: payload.expectedMd5 || null,
    uploaded_ranges: [],
    application_id: payload.applicationId || null,
    created_by: payload.createdBy || null,
    owner_kind: payload.ownerKind || 'user',
  });
  await writeRedis(row);
  return toPlain(row);
}

async function getSession(uploadId) {
  const row = await StorageUploadSession.findByPk(uploadId);
  return row ? toPlain(row) : null;
}

async function getSessionRow(uploadId) {
  return StorageUploadSession.findByPk(uploadId);
}

function isOwner(session, authContext) {
  if (!session || !authContext) return false;
  if (authContext.kind === 'user') {
    return session.ownerKind === 'user' && String(session.createdBy || '') === String(authContext.userId || '');
  }
  if (authContext.kind === 'application') {
    return session.ownerKind === 'application'
      && String(session.applicationId || '') === String(authContext.applicationId || '');
  }
  return false;
}

async function updateProgress(uploadId, { offset, range, status }) {
  const row = await StorageUploadSession.findByPk(uploadId);
  if (!row) return null;
  const patch = {};
  if (offset != null) patch.offset_bytes = offset;
  if (status) patch.status = status;
  if (range && Number.isFinite(range.offset) && Number.isFinite(range.length) && range.length > 0) {
    const ranges = Array.isArray(row.uploaded_ranges) ? [...row.uploaded_ranges] : [];
    ranges.push({ offset: range.offset, length: range.length, at: new Date().toISOString() });
    patch.uploaded_ranges = ranges.slice(-200);
  }
  await row.update(patch);
  await writeRedis(row);
  return toPlain(row);
}

async function updateSession(uploadId, fields) {
  const row = await StorageUploadSession.findByPk(uploadId);
  if (!row) return null;
  const mapped = {};
  if (fields.status != null) mapped.status = fields.status;
  if (fields.offset != null) mapped.offset_bytes = fields.offset;
  if (fields.contentMd5 != null) mapped.content_md5 = fields.contentMd5;
  if (fields.objectId != null) mapped.object_id = fields.objectId;
  if (fields.relativePath != null) mapped.relative_path = fields.relativePath;
  if (fields.errorMessage != null) mapped.error_message = fields.errorMessage;
  await row.update(mapped);
  if (['completed', 'duplicate', 'expired', 'failed'].includes(row.status)) {
    await deleteRedis(uploadId);
  } else {
    await writeRedis(row);
  }
  return toPlain(row);
}

async function listRecoverableFinalizes() {
  const rows = await StorageUploadSession.findAll({
    where: { status: { [Op.in]: ['pending_finalize', 'finalizing'] } },
  });
  return rows.map(toPlain);
}

async function listExpiredActive() {
  const rows = await StorageUploadSession.findAll({
    where: {
      status: { [Op.in]: ['uploading', 'pending_finalize', 'finalizing', 'failed'] },
      expires_at: { [Op.lt]: new Date() },
    },
  });
  return rows.map(toPlain);
}

async function listTerminalForCleanup() {
  const rows = await StorageUploadSession.findAll({
    where: { status: { [Op.in]: ['completed', 'duplicate'] } },
    attributes: ['upload_id', 'status', 'updated_at'],
  });
  return rows.map(toPlain);
}

module.exports = {
  toPlain,
  createSession,
  getSession,
  getSessionRow,
  isOwner,
  updateProgress,
  updateSession,
  deleteRedis,
  listRecoverableFinalizes,
  listExpiredActive,
  listTerminalForCleanup,
  redisKey,
};
