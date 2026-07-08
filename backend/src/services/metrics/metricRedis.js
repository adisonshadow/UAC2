const { getRedisClient } = require('../../utils/redisClient');

const PREFIX = 'eadaf:metrics:';
const RUN_LOCK_TTL = 300;
const SCHEDULER_LOCK_TTL = 600;
const LATEST_TTL = 86400;

async function acquireRunLock(metricId) {
  const client = await getRedisClient();
  if (!client) return true;
  const key = `${PREFIX}lock:run:${metricId}`;
  const result = await client.set(key, '1', { NX: true, EX: RUN_LOCK_TTL });
  return result === 'OK';
}

async function releaseRunLock(metricId) {
  const client = await getRedisClient();
  if (!client) return;
  await client.del(`${PREFIX}lock:run:${metricId}`);
}

async function acquireSchedulerLock(scheduleType) {
  const client = await getRedisClient();
  if (!client) return true;
  const key = `${PREFIX}lock:scheduler:${scheduleType}`;
  const result = await client.set(key, '1', { NX: true, EX: SCHEDULER_LOCK_TTL });
  return result === 'OK';
}

async function setLatest(code, payload) {
  const client = await getRedisClient();
  if (!client) return;
  const key = `${PREFIX}latest:${code}`;
  await client.set(key, JSON.stringify(payload), { EX: LATEST_TTL });
}

async function getLatest(code) {
  const client = await getRedisClient();
  if (!client) return null;
  const raw = await client.get(`${PREFIX}latest:${code}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = {
  acquireRunLock,
  releaseRunLock,
  acquireSchedulerLock,
  setLatest,
  getLatest,
};
