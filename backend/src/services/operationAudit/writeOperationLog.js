const { OperationLog } = require('../../models');
const logger = require('../../utils/logger');

const SYNC = process.env.OPERATION_AUDIT_SYNC === 'true';

/**
 * 唯一落库点。record 须为纯 JSON 可序列化对象。
 * @param {object} record
 * @returns {Promise<void>}
 */
async function writeOperationLog(record) {
  const persist = async () => {
    try {
      await OperationLog.create(record);
    } catch (err) {
      logger.error('写操作日志失败', {
        path: record?.request_summary?.path,
        domain: record?.domain,
        operation_type: record?.operation_type,
        error: err.message,
      });
    }
  };

  if (SYNC) {
    await persist();
    return;
  }

  setImmediate(() => {
    persist();
  });
}

module.exports = {
  writeOperationLog,
  isSyncMode: () => SYNC,
};
