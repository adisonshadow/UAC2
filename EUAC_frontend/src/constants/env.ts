/**
 * 运行时 API 地址（值来自 config/env.ts，经 Umi define 注入）
 * 修改请前往 config/env.ts
 */
export const API_BASE_URL = process.env.APP_API_BASE_URL || '';

/** 开发环境走 devServer proxy；生产环境在配置了 API_BASE_URL 时使用绝对地址 */
export const resolveApiUrl = (path: string) => {
  if (process.env.NODE_ENV === 'development' || !API_BASE_URL) {
    return path;
  }
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
};

/** 流式 SSE 接口：与常规 API 同路径，开发环境走 devServer proxy */
export const resolveStreamApiUrl = (path: string) => resolveApiUrl(path);
