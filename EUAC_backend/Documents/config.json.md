# 配置文件说明 (config.json)

## 数据库配置 (postgresql)
```json
{
  "host": "localhost",        // 数据库主机地址
  "port": 15432,             // 数据库端口
  "database": "fyMOM",       // 数据库名称
  "user": "yoyo",            // 数据库用户名
  "password": "123456",      // 数据库密码
  "schema": "uac",           // 数据库模式
  "max_connections": 20,     // 最大连接数
  "idle_timeout": 30000,     // 空闲连接超时时间（毫秒）
  "connection_timeout": 2000,// 连接超时时间（毫秒）
  "ssl": false               // 是否启用 SSL
}
```

## API 配置 (api)
```json
{
  "port": 3000,              // API 服务端口
  "host": "localhost",       // API 服务主机地址
  "cors": {                  // CORS 配置
    "origin": ["http://localhost:3000", "http://localhost:8080"],  // 允许的源
    "methods": ["GET", "POST", "PUT", "DELETE", "PATCH"],         // 允许的 HTTP 方法
    "allowedHeaders": ["Content-Type", "Authorization"],          // 允许的请求头
    "credentials": true,     // 是否允许携带凭证
    "maxAge": 86400         // 预检请求缓存时间（秒）
  },
  "rateLimit": {            // 速率限制配置
    "windowMs": 900000,     // 时间窗口（毫秒）
    "max": 100             // 最大请求次数
  },
  "security": {             // 安全配置
    "jwtSecret": "my-jwt-secret-key",  // JWT 密钥
    "jwtExpiresIn": "24h",            // JWT 过期时间
    "bcryptSaltRounds": 10            // 密码加密轮数
  },
  "loginVerify": {          // 登录验证配置
    "enabled": true,        // 是否启用验证
    "expiresIn": 300       // 验证码过期时间（秒）
  }
}
```

## 文件上传配置 (upload)
```json
{
  "types": {                // 文件类型配置
    "image": {              // 图片类型
      "mimeTypes": [        // 允许的 MIME 类型
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp"
      ],
      "extensions": [       // 允许的文件扩展名
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp"
      ],
      "maxSize": 5242880,  // 最大文件大小（5MB）
      "needAuth": false    // 是否需要认证才能访问文件
    },
    "video": {              // 视频类型
      "mimeTypes": [
        "video/mp4",
        "video/webm",
        "video/quicktime"
      ],
      "extensions": [
        ".mp4",
        ".webm",
        ".mov"
      ],
      "maxSize": 104857600, // 最大文件大小（100MB）
      "needAuth": true      // 是否需要认证才能访问文件
    },
    "document": {           // 文档类型
      "mimeTypes": [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ],
      "extensions": [
        ".pdf",
        ".doc",
        ".docx"
      ],
      "maxSize": 10485760,  // 最大文件大小（10MB）
      "needAuth": true      // 是否需要认证才能访问文件
    }
  },
  "defaultType": "image"    // 默认文件类型
}
```

## 日志配置 (logging)
```json
{
  "level": "info",          // 日志级别
  "format": "json",         // 日志格式
  "file": "logs/app.log",   // 日志文件路径
  "rotation": {             // 日志轮转配置
    "maxSize": "20m",       // 单个日志文件最大大小
    "maxFiles": "14d",      // 日志文件保留时间
    "zippedArchive": true,  // 是否压缩归档
    "errorMaxFiles": "30d", // 错误日志保留时间
    "exceptionsMaxFiles": "30d",  // 异常日志保留时间
    "rejectionsMaxFiles": "30d"   // 拒绝日志保留时间
  }
}
```

## 配置说明

### 数据库配置
- `host`: 数据库服务器地址，默认为 localhost
- `port`: 数据库端口号，默认为 15432
- `database`: 数据库名称，默认为 fyMOM
- `user`: 数据库用户名，默认为 yoyo
- `password`: 数据库密码，默认为 123456
- `schema`: 数据库模式，默认为 uac
- `max_connections`: 连接池最大连接数，默认为 20
- `idle_timeout`: 空闲连接超时时间，默认为 30000 毫秒
- `connection_timeout`: 连接超时时间，默认为 2000 毫秒
- `ssl`: 是否启用 SSL 连接，默认为 false

### API 配置
- `port`: API 服务端口，默认为 3000
- `host`: API 服务主机地址，默认为 localhost
- `cors`: 跨域资源共享配置
  - `origin`: 允许访问的源地址列表
  - `methods`: 允许的 HTTP 方法列表
  - `allowedHeaders`: 允许的请求头列表
  - `credentials`: 是否允许携带凭证
  - `maxAge`: 预检请求缓存时间
- `rateLimit`: 请求速率限制配置
  - `windowMs`: 时间窗口大小
  - `max`: 时间窗口内最大请求数
- `security`: 安全相关配置
  - `jwtSecret`: JWT 密钥
  - `jwtExpiresIn`: JWT 令牌过期时间
  - `bcryptSaltRounds`: 密码加密轮数
- `loginVerify`: 登录验证配置
  - `enabled`: 是否启用验证
  - `expiresIn`: 验证码过期时间

### 文件上传配置
- `types`: 支持的文件类型配置
  - `image`: 图片类型配置
    - `mimeTypes`: 允许的 MIME 类型列表
    - `extensions`: 允许的文件扩展名列表
    - `maxSize`: 最大文件大小（字节）
    - `needAuth`: 是否需要认证才能访问文件，默认为 false
  - `video`: 视频类型配置
    - `mimeTypes`: 允许的 MIME 类型列表
    - `extensions`: 允许的文件扩展名列表
    - `maxSize`: 最大文件大小（字节）
    - `needAuth`: 是否需要认证才能访问文件，默认为 true
  - `document`: 文档类型配置
    - `mimeTypes`: 允许的 MIME 类型列表
    - `extensions`: 允许的文件扩展名列表
    - `maxSize`: 最大文件大小（字节）
    - `needAuth`: 是否需要认证才能访问文件，默认为 true
- `defaultType`: 默认文件类型，默认为 image

### 日志配置
- `level`: 日志级别，可选值：error, warn, info, verbose, debug, silly
- `format`: 日志格式，可选值：json, simple
- `file`: 日志文件路径
- `rotation`: 日志轮转配置
  - `maxSize`: 单个日志文件最大大小
  - `maxFiles`: 日志文件保留时间
  - `zippedArchive`: 是否压缩归档
  - `errorMaxFiles`: 错误日志保留时间
  - `exceptionsMaxFiles`: 异常日志保留时间
  - `rejectionsMaxFiles`: Promise 拒绝日志保留时间 