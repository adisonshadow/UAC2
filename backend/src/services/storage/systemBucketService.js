const config = require('../../config');
const StorageBucket = require('../../models/storage_bucket');
const logger = require('../../utils/logger');

function getSystemBucketConfig() {
  return config.storage.systemBucket;
}

function isSystemBucketCode(code) {
  return code === getSystemBucketConfig().code;
}

function isSystemBucket(record) {
  if (!record) return false;
  const code = record.code || record.get?.('code');
  return isSystemBucketCode(code);
}

async function ensureSystemBucket() {
  const { code, name, description } = getSystemBucketConfig();
  const applicationId = config.systemApplication.applicationId || null;

  const [bucket, created] = await StorageBucket.findOrCreate({
    where: { code },
    defaults: {
      name,
      description,
      application_id: applicationId,
      status: 'ACTIVE',
      access_mode: 'public',
      access_restrictions: {},
    },
  });

  if (created) {
    logger.info('已创建系统内置 Storage Bucket', { code, bucketId: bucket.bucket_id });
  }

  return bucket;
}

module.exports = {
  getSystemBucketConfig,
  isSystemBucketCode,
  isSystemBucket,
  ensureSystemBucket,
};
