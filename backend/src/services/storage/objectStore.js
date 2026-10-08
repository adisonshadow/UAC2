/**
 * 成品文件放在 MinIO。对象键沿用 storage_objects.relative_path。
 * 未完成的 tus 分片不进这里。
 */
const fs = require('fs');
const { Client } = require('minio');
const config = require('../../config');

function assertObjectKey(key) {
  const normalized = String(key || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').includes('..')) {
    const err = new Error('非法对象键');
    err.status = 400;
    throw err;
  }
  return normalized;
}

function shouldCopyStoredObject({ existing, strategy, objectMissing, hasPackageFile }) {
  if (!hasPackageFile) return false;
  if (!existing) return true;
  if (strategy === 'overwrite') return true;
  return objectMissing === true;
}

function bucketName() {
  return config.storage.minio.bucket;
}

function parseEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    const err = new Error(`MINIO_ENDPOINT 不是合法地址: ${endpoint}`);
    err.status = 503;
    throw err;
  }
  const useSSL = url.protocol === 'https:';
  const port = url.port ? Number(url.port) : (useSSL ? 443 : 80);
  return { endPoint: url.hostname, port, useSSL };
}

let client;
let bucketReady;

function getClient() {
  if (client) return client;
  const minio = config.storage.minio;
  if (!minio.endpoint || !minio.accessKey || !minio.secretKey) {
    const err = new Error('未配置 MinIO（MINIO_ENDPOINT / MINIO_ACCESS_KEY / MINIO_SECRET_KEY）');
    err.status = 503;
    throw err;
  }
  const parsed = parseEndpoint(minio.endpoint);
  client = new Client({
    endPoint: parsed.endPoint,
    port: parsed.port,
    useSSL: parsed.useSSL,
    accessKey: minio.accessKey,
    secretKey: minio.secretKey,
  });
  return client;
}

function wrapStoreError(error) {
  if (error && error.status) throw error;
  const err = new Error((error && error.message) || '对象存储不可用');
  err.status = 503;
  err.cause = error;
  throw err;
}

function isNotFound(error) {
  const code = error && (error.code || error.name);
  return code === 'NotFound' || code === 'NoSuchKey' || code === 'NoSuchBucket';
}

async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const minio = getClient();
      const name = bucketName();
      const exists = await minio.bucketExists(name);
      if (!exists) await minio.makeBucket(name, config.storage.minio.region || 'us-east-1');
    })().catch((error) => {
      bucketReady = null;
      throw error;
    });
  }
  try {
    await bucketReady;
  } catch (error) {
    wrapStoreError(error);
  }
}

async function putFile(key, filePath, meta) {
  const objectKey = assertObjectKey(key);
  await ensureBucket();
  const size = fs.statSync(filePath).size;
  try {
    await getClient().fPutObject(bucketName(), objectKey, filePath, meta || {});
  } catch (error) {
    wrapStoreError(error);
  }
  return { key: objectKey, size };
}

async function putBuffer(key, buffer, meta) {
  const objectKey = assertObjectKey(key);
  await ensureBucket();
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  try {
    await getClient().putObject(bucketName(), objectKey, body, body.length, meta || {});
  } catch (error) {
    wrapStoreError(error);
  }
  return { key: objectKey, size: body.length };
}

async function getStream(key) {
  const objectKey = assertObjectKey(key);
  await ensureBucket();
  try {
    return await getClient().getObject(bucketName(), objectKey);
  } catch (error) {
    if (isNotFound(error)) {
      const err = new Error('对象不存在');
      err.status = 404;
      throw err;
    }
    wrapStoreError(error);
  }
  return null;
}

async function getBuffer(key) {
  const stream = await getStream(key);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function stat(key) {
  const objectKey = assertObjectKey(key);
  await ensureBucket();
  try {
    return await getClient().statObject(bucketName(), objectKey);
  } catch (error) {
    if (isNotFound(error)) return null;
    wrapStoreError(error);
  }
  return null;
}

async function remove(key) {
  const objectKey = assertObjectKey(key);
  await ensureBucket();
  try {
    await getClient().removeObject(bucketName(), objectKey);
  } catch (error) {
    if (isNotFound(error)) return;
    wrapStoreError(error);
  }
}

function listByPrefix(prefix) {
  const objectPrefix = String(prefix || '').replace(/\\/g, '/').replace(/^\/+/, '');
  return ensureBucket().then(() => new Promise((resolve, reject) => {
    const keys = [];
    const stream = getClient().listObjectsV2(bucketName(), objectPrefix, true);
    stream.on('data', (obj) => {
      if (obj && obj.name) keys.push(obj.name);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(keys));
  })).catch((error) => wrapStoreError(error));
}

async function removeByPrefix(prefix) {
  const keys = await listByPrefix(prefix);
  if (!keys.length) return 0;
  await ensureBucket();
  try {
    await getClient().removeObjects(bucketName(), keys);
  } catch (error) {
    wrapStoreError(error);
  }
  return keys.length;
}

module.exports = {
  assertObjectKey,
  shouldCopyStoredObject,
  ensureBucket,
  putFile,
  putBuffer,
  getStream,
  getBuffer,
  stat,
  remove,
  listByPrefix,
  removeByPrefix,
};
