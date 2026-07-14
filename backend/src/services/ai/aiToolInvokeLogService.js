const fs = require('fs');
const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');

const ENABLED = String(process.env.AI_TOOL_INVOKE_LOG_ENABLED || 'false').toLowerCase() === 'true';
const LOG_FILE =
  process.env.AI_TOOL_INVOKE_LOG_FILE || path.join(process.cwd(), 'logs/ai-tool-invoke-%DATE%.log');

let fileLogger = null;

function getFileLogger() {
  if (!ENABLED) return null;
  if (fileLogger) return fileLogger;

  const logDir = path.dirname(LOG_FILE.replace('%DATE%', 'init'));
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  fileLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.json(),
    ),
    transports: [
      new winston.transports.DailyRotateFile({
        filename: LOG_FILE,
        datePattern: 'YYYY-MM-DD',
        maxSize: process.env.LOG_ROTATION_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_ERROR_MAX_FILES || '30d',
      }),
    ],
  });

  return fileLogger;
}

function previewArgs(args) {
  try {
    const text = JSON.stringify(args || {});
    return text.length > 500 ? `${text.slice(0, 500)}…` : text;
  } catch {
    return String(args);
  }
}

function logAiToolInvokeFailure(entry) {
  const logger = getFileLogger();
  if (!logger) return;

  logger.info({
    event: 'ai_tool_invoke_failure',
    tool: entry.tool,
    executionType: entry.executionType,
    durationMs: entry.durationMs,
    userId: entry.userId,
    conversationKey: entry.conversationKey,
    turnId: entry.turnId,
    round: entry.round,
    argsPreview: previewArgs(entry.args),
    envelope: entry.envelope,
    error: entry.error,
    rawResultPreview: entry.rawResult ? previewArgs(entry.rawResult) : undefined,
  });
}

module.exports = {
  logAiToolInvokeFailure,
  isAiToolInvokeLogEnabled: () => ENABLED,
};
