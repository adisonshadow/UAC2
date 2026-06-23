/**
 * 项目环境配置（唯一入口）
 * 端口、API 地址等环境相关项，请只修改此文件
 */
export const APP_ENV = {
  /** 前端开发服务器端口 */
  port: 9527,

  /** 开发环境：后端 API 地址（devServer proxy 转发目标） */
  devApiBaseUrl: 'http://localhost:9526',

  /** 生产环境：后端 API 地址（跨域部署填完整 URL；同源 Nginx 代理 /api 时留空） */
  prodApiBaseUrl: '',
} as const;

/** 当前构建/运行模式下的 API 基础地址 */
export const resolveAppApiBaseUrl = () =>
  process.env.NODE_ENV === 'development'
    ? APP_ENV.devApiBaseUrl
    : APP_ENV.prodApiBaseUrl;
