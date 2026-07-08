const { createClient } = require('redis');
const config = require('../config');
const logger = require('./logger');

let client = null;
let connectPromise = null;
let disabled = false;

function buildRedisUrl() {
  const { host, port, password } = config.redis;
  const auth = password
    ? `${encodeURIComponent('default')}:${encodeURIComponent(password)}@`
    : '';
  return `redis://${auth}${host}:${port}`;
}

async function connectRedis() {
  if (disabled) return null;
  if (client?.isOpen) return client;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      client = createClient({ url: buildRedisUrl() });
      client.on('error', (err) => {
        logger.warn('Redis client error', { message: err.message });
      });
      await client.connect();
      logger.info('Redis connected for metrics module');
      return client;
    } catch (err) {
      disabled = true;
      logger.warn('Redis unavailable, metrics will degrade to PostgreSQL only', {
        message: err.message,
      });
      client = null;
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

async function getRedisClient() {
  if (disabled) return null;
  if (client?.isOpen) return client;
  return connectRedis();
}

async function pingRedis() {
  const c = await getRedisClient();
  if (!c) return false;
  try {
    const pong = await c.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

module.exports = {
  connectRedis,
  getRedisClient,
  pingRedis,
};
