import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig, type Method } from 'axios';
import { API_BASE_URL } from '@/constants/env';
import {
  errorConfig,
  requestInterceptors,
  responseInterceptors,
} from '@/utils/requestInterceptors';

export interface RequestOptions extends Omit<AxiosRequestConfig, 'url' | 'method'> {
  method?: Method | string;
  data?: unknown;
  params?: Record<string, unknown>;
  skipErrorHandler?: boolean;
  [key: string]: unknown;
}

const axiosInstance = axios.create({
  timeout: 10000,
  ...(process.env.NODE_ENV !== 'development' && API_BASE_URL ? { baseURL: API_BASE_URL } : {}),
});

axiosInstance.interceptors.request.use((config) => {
  const url = config.url || '';
  let nextUrl = url;
  let nextConfig: AxiosRequestConfig = { ...config };

  for (const interceptor of requestInterceptors) {
    const result = interceptor(nextUrl, nextConfig);
    nextUrl = result.url;
    nextConfig = { ...nextConfig, ...result.options };
  }

  return { ...nextConfig, url: nextUrl } as InternalAxiosRequestConfig;
});

axiosInstance.interceptors.response.use(
  async (response) => {
    let next = response;
    for (const interceptor of responseInterceptors) {
      next = await interceptor(next);
    }
    return next;
  },
  (error) => {
    const opts = error.config?.skipErrorHandler ? { skipErrorHandler: true } : {};
    errorConfig.errorHandler(error, opts);
    return Promise.reject(error);
  },
);

export async function request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
  const { skipErrorHandler, method = 'GET', data, params, headers, ...rest } = options;

  try {
    const response = await axiosInstance.request<T>({
      url,
      method: method as Method,
      data,
      params,
      headers,
      skipErrorHandler,
      ...rest,
    } as AxiosRequestConfig & { skipErrorHandler?: boolean });

    return response.data as T;
  } catch (error) {
    if (skipErrorHandler) {
      throw error;
    }
    throw error;
  }
}

export default request;
