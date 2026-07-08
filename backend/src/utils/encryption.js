const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey() {
  const keyHex = config.ai.encryptionKey;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY 必须为 64 位 hex 字符串（32 字节）');
  }
  return Buffer.from(keyHex, 'hex');
}

function encryptApiKey(plainText) {
  if (!plainText) {
    return null;
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptApiKey(encryptedText) {
  if (!encryptedText) {
    return null;
  }
  const key = getEncryptionKey();
  const [ivHex, authTagHex, dataHex] = encryptedText.split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error('无效的加密 API Key 格式');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

module.exports = {
  encryptApiKey,
  decryptApiKey
};
