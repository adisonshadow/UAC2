const winston = require('winston');
const fs = require('fs');
const path = require('path');
const config = require('../config');
require('winston-daily-rotate-file');

const logDir = path.dirname(config.logging.file);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
);

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'silly' : config.logging.level,
    format: logFormat,
    transports: [
        new winston.transports.DailyRotateFile({
            filename: path.join(logDir, 'app-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: config.logging.rotation.maxSize,
            maxFiles: config.logging.rotation.maxFiles,
            zippedArchive: config.logging.rotation.zippedArchive,
            format: logFormat
        }),
        new winston.transports.DailyRotateFile({
            filename: path.join(logDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: config.logging.rotation.maxSize,
            maxFiles: config.logging.rotation.errorMaxFiles,
            zippedArchive: config.logging.rotation.zippedArchive,
            level: 'error',
            format: logFormat
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

logger.exceptions.handle(
    new winston.transports.DailyRotateFile({
        filename: path.join(logDir, 'exceptions-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: config.logging.rotation.maxSize,
        maxFiles: config.logging.rotation.exceptionsMaxFiles,
        zippedArchive: config.logging.rotation.zippedArchive
    })
);

logger.rejections.handle(
    new winston.transports.DailyRotateFile({
        filename: path.join(logDir, 'rejections-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: config.logging.rotation.maxSize,
        maxFiles: config.logging.rotation.rejectionsMaxFiles,
        zippedArchive: config.logging.rotation.zippedArchive
    })
);

module.exports = logger;
