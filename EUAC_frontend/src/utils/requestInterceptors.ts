import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';
import { handleUnauthorized } from './auth';
import { NO_TOKEN_APIS, AUTH_HEADER, AUTH_PREFIX, AUTH_PAGES } from '@/constants/auth';

// 错误类型枚举
export enum ErrorShowType {
  SILENT = 0,
  WARN_MESSAGE = 1,
  ERROR_MESSAGE = 2,
  NOTIFICATION = 3,
  REDIRECT = 9,
}

// 响应数据结构
export interface ResponseStructure {
  success: boolean;
  data: any;
  code?: number;
  message?: string;
  showType?: ErrorShowType;
}

// 请求拦截器
export const requestInterceptors = [
  (url: string, options: AxiosRequestConfig) => {
    const { headers = {} } = options;

    // console.log('请求拦截器 - 开始处理请求:', {
    //   url,
    //   method: options.method || 'GET',
    //   isNoTokenApi: noTokenApis.some(api => url.includes(api)),
    //   currentHeaders: headers,
    // });

    // 检查是否是无需 token 的 API
    const isNoTokenApi = NO_TOKEN_APIS.some(api => url.includes(api));
    if (isNoTokenApi) {
    //   console.log('请求拦截器 - 无需 token 的 API，直接放行:', url);
      return { url, options };
    }

    // 其他所有 API 都需要 token
    const token = localStorage.getItem('token');

    if (!token) {
      console.log('请求拦截器 - 未找到 token，直接放行:', url);
      return { url, options };
    }

    // 确保 headers 是一个新对象
    const newHeaders = {
      ...headers,
      [AUTH_HEADER]: `${AUTH_PREFIX}${token}`,
    };

    return {
      url,
      options: {
        ...options,
        headers: newHeaders,
      },
    };
  },
];

// 响应拦截器
export const responseInterceptors = [
  async (response: AxiosResponse) => {
    const { status, data, config } = response;
    const requestUrl = config?.url || '';
    const isAuthCheckRequest = requestUrl.includes('/auth/check');
    
    // 处理 401 未授权的情况
    if (status === 401) {
      const currentPath = window.location.pathname;
      const isAuthPage = AUTH_PAGES.includes(currentPath as any);
      
      // auth/check 的 401 表示 token 无效，由调用方自行处理，避免重复登出
      if (!isAuthPage && !isAuthCheckRequest) {
        handleUnauthorized();
      }
      return response;
    }

    // 处理业务错误
    // 注意：这里我们只处理明确标记为失败的情况
    // 如果后端返回 code 200 且没有 success 字段，我们也认为是成功的
    if (data && data.success === false) {
      const error: any = new Error(data.message || '请求失败');
      error.name = 'BizError';
      error.info = {
        code: data.code,
        message: data.message,
        showType: data.showType || ErrorShowType.ERROR_MESSAGE,
        data: data.data,
      };
      throw error;
    }

    // 对于其他情况，包括：
    // 1. data.success === true
    // 2. data 中没有 success 字段，但有 code === 200
    // 3. 其他正常响应
    // 都直接返回响应
    return response;
  },
];

// 错误处理配置
export const errorConfig = {
  errorThrower: (res: ResponseStructure) => {
    const { success, data, code, message, showType } = res;
    if (!success) {
      const error: any = new Error(message);
      error.name = 'BizError';
      error.info = { code, message, showType, data };
      throw error;
    }
  },
  errorHandler: (error: any, opts: any) => {
    if (opts?.skipErrorHandler) throw error;

    // 处理业务错误
    if (error.name === 'BizError') {
      const errorInfo: ResponseStructure | undefined = error.info;
      if (errorInfo) {
        const { message: errorMessage, code } = errorInfo;
        switch (errorInfo.showType) {
          case ErrorShowType.SILENT:
            // 静默处理
            break;
          case ErrorShowType.WARN_MESSAGE:
            message.warning(errorMessage || '操作警告');
            break;
          case ErrorShowType.ERROR_MESSAGE:
            message.error(errorMessage || '操作失败');
            break;
          case ErrorShowType.NOTIFICATION:
            message.error(errorMessage || '操作失败');
            if (code) {
              message.info(`错误码：${code}`);
            }
            break;
          case ErrorShowType.REDIRECT:
            // 重定向到错误页面
            window.location.href = '/exception/error';
            break;
          default:
            message.error(errorMessage || '操作失败');
        }
      }
    } else if (error.response) {
      // Axios 的错误
      const { status } = error.response;
      const requestUrl = error.config?.url || '';
      const isAuthCheckRequest = requestUrl.includes('/auth/check');
      const currentPath = window.location.pathname;
      const isAuthPage = AUTH_PAGES.includes(currentPath as any);
      
      // 登录态检查或认证页面的 401 属于预期行为，不弹全局错误
      if ((isAuthPage && status === 401) || (opts?.skipErrorHandler && status === 401) || isAuthCheckRequest) {
        throw error;
      }
      
      message.error(`请求错误 ${status}: ${error.response.statusText}`);
    } else if (error.request) {
      // 请求已发出但没有收到响应
      message.error('服务器无响应，请稍后重试');
    } else {
      // 请求配置出错
      message.error('请求配置错误，请检查');
    }
  },
};