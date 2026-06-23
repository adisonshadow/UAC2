const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const env = process.env.NODE_ENV || 'development';
const envFile = path.join(__dirname, '../../', `.env.${env}`);

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else {
  dotenv.config({ path: path.join(__dirname, '../../', '.env.development') });
}

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return value === 'true' || value === '1';
}

function parseInt(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function parseList(value, defaultValue = []) {
  if (!value) {
    return defaultValue;
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

const defaultUploadTypes = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    maxSize: 5242880,
    needAuth: false
  },
  video: {
    mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    extensions: ['.mp4', '.webm', '.mov'],
    maxSize: 104857600,
    needAuth: true
  },
  document: {
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    extensions: ['.pdf', '.doc', '.docx'],
    maxSize: 10485760,
    needAuth: true
  }
};

const postgresql = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT, 35432),
  database: process.env.POSTGRES_DATABASE || 'fyMOM',
  user: process.env.POSTGRES_USER || 'yoyo',
  password: process.env.POSTGRES_PASSWORD || '123456',
  schema: process.env.POSTGRES_SCHEMA || 'uac',
  max_connections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS, 20),
  idle_timeout: parseInt(process.env.POSTGRES_IDLE_TIMEOUT, 30000),
  connection_timeout: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT, 2000),
  ssl: parseBool(process.env.POSTGRES_SSL, false)
};

const api = {
  port: parseInt(process.env.API_PORT, 3000),
  host: process.env.API_HOST || 'localhost',
  cors: {
    origin: parseList(process.env.CORS_ORIGIN, ['http://localhost:3000', 'http://localhost:8080']),
    methods: parseList(process.env.CORS_METHODS, ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    allowedHeaders: parseList(process.env.CORS_ALLOWED_HEADERS, ['Content-Type', 'Authorization']),
    credentials: parseBool(process.env.CORS_CREDENTIALS, true),
    maxAge: parseInt(process.env.CORS_MAX_AGE, 86400)
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 900000),
    max: parseInt(process.env.RATE_LIMIT_MAX, 100)
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'my-jwt-secret-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10)
  },
  loginVerify: {
    enabled: parseBool(process.env.LOGIN_VERIFY_ENABLED, true),
    expiresIn: parseInt(process.env.LOGIN_VERIFY_EXPIRES_IN, 300)
  },
  sso: {
    redirectMode: {
      default: process.env.SSO_REDIRECT_MODE || 'POST_REDIRECT'
    }
  }
};

const upload = {
  types: defaultUploadTypes,
  defaultType: process.env.UPLOAD_DEFAULT_TYPE || 'image'
};

const logging = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
  file: process.env.LOG_FILE || 'logs/app.log',
  rotation: {
    maxSize: process.env.LOG_ROTATION_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_ROTATION_MAX_FILES || '14d',
    zippedArchive: parseBool(process.env.LOG_ROTATION_ZIPPED, true),
    errorMaxFiles: process.env.LOG_ERROR_MAX_FILES || '30d',
    exceptionsMaxFiles: process.env.LOG_EXCEPTIONS_MAX_FILES || '30d',
    rejectionsMaxFiles: process.env.LOG_REJECTIONS_MAX_FILES || '30d'
  }
};

const redis = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 36379),
  password: process.env.REDIS_PASSWORD || ''
};

const ai = {
  encryptionKey: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  upstreamTimeoutMs: parseInt(process.env.AI_UPSTREAM_TIMEOUT_MS, 60000)
};

const salesDemo = {
  dbPath: process.env.SALES_DEMO_DB_PATH || './data/sales-demo.db',
  sqlPath: process.env.SALES_DEMO_SQL_PATH || '../EUAC_AIBase/scripts/sales-demo-db.sql'
};

module.exports = {
  env,
  postgresql,
  api,
  upload,
  logging,
  redis,
  ai,
  salesDemo,
  jwt: {
    secret: env === 'test' ? process.env.TEST_JWT_SECRET : api.security.jwtSecret,
    refreshSecret: env === 'test' ? process.env.TEST_JWT_REFRESH_SECRET : api.security.jwtSecret,
    expiresIn: api.security.jwtExpiresIn,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  }
};
