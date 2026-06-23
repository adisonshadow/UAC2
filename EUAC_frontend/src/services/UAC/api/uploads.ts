// @ts-ignore
/* eslint-disable */
import { request } from '@umijs/max';

/** 上传文件 [需要认证] 上传单个文件，支持图片自动转换为webp格式 POST /api/v1/uploads */
export async function postUploads(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.postUploadsParams,
  body: {},
  file?: File,
  options?: { [key: string]: any },
) {
  const formData = new FormData();

  if (file) {
    formData.append('file', file);
  }

  Object.keys(body).forEach((ele) => {
    const item = (body as any)[ele];

    if (item !== undefined && item !== null) {
      if (typeof item === 'object' && !(item instanceof File)) {
        if (item instanceof Array) {
          item.forEach((f) => formData.append(ele, f || ''));
        } else {
          formData.append(ele, JSON.stringify(item));
        }
      } else {
        formData.append(ele, item);
      }
    }
  });

  return request<{
    code?: number;
    message?: string;
    data?: {
      id?: string;
      type?: string;
      url?: string;
      original_name?: string;
      size?: number;
      mime_type?: string;
      extension?: string;
    };
  }>('/api/v1/uploads', {
    method: 'POST',
    params: {
      ...params,
    },
    data: formData,
    requestType: 'form',
    ...(options || {}),
  });
}

/** 获取文件信息 [需要认证] 获取指定文件的详细信息 GET /api/v1/uploads/${param0} */
export async function getUploadsFileId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getUploadsFileIdParams,
  options?: { [key: string]: any },
) {
  const { file_id: param0, ...queryParams } = params;
  return request<{
    code?: number;
    message?: string;
    data?: {
      file_id?: string;
      filename?: string;
      originalname?: string;
      mimetype?: string;
      size?: number;
      url?: string;
      created_at?: string;
    };
  }>(`/api/v1/uploads/${param0}`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  });
}

/** 删除文件 [需要认证] 删除指定文件 DELETE /api/v1/uploads/${param0} */
export async function deleteUploadsFileId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.deleteUploadsFileIdParams,
  options?: { [key: string]: any },
) {
  const { file_id: param0, ...queryParams } = params;
  return request<{ code?: number; message?: string; data?: any }>(
    `/api/v1/uploads/${param0}`,
    {
      method: 'DELETE',
      params: { ...queryParams },
      ...(options || {}),
    },
  );
}

/** 上传图片 [需要认证] 上传单个图片，支持压缩和格式转换 POST /api/v1/uploads/image */
export async function postUploadsImage(
  body: {
    /** 是否压缩图片 */
    compress?: boolean;
    /** 输出格式 */
    format?: 'jpeg' | 'jpg' | 'png' | 'webp' | 'gif';
    /** 压缩后的最大宽度 */
    width?: number;
    /** 压缩后的最大高度 */
    height?: number;
    /** 图片质量（1-100） */
    quality?: number;
  },
  image?: File,
  options?: { [key: string]: any },
) {
  const formData = new FormData();

  if (image) {
    formData.append('image', image);
  }

  Object.keys(body).forEach((ele) => {
    const item = (body as any)[ele];

    if (item !== undefined && item !== null) {
      if (typeof item === 'object' && !(item instanceof File)) {
        if (item instanceof Array) {
          item.forEach((f) => formData.append(ele, f || ''));
        } else {
          formData.append(ele, JSON.stringify(item));
        }
      } else {
        formData.append(ele, item);
      }
    }
  });

  return request<{
    code?: number;
    message?: string;
    data?: {
      id?: string;
      filename?: string;
      originalname?: string;
      mimetype?: string;
      size?: number;
    };
  }>('/api/v1/uploads/image', {
    method: 'POST',
    data: formData,
    requestType: 'form',
    ...(options || {}),
  });
}

/** 获取图片 获取指定图片，支持实时裁剪、格式转换和缓存 GET /api/v1/uploads/images/${param0} */
export async function getUploadsImagesFileId(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.getUploadsImagesFileIdParams,
  options?: { [key: string]: any },
) {
  const { file_id: param0, ...queryParams } = params;
  return request<string>(`/api/v1/uploads/images/${param0}`, {
    method: 'GET',
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 上传多个文件 [需要认证] 同时上传多个文件 POST /api/v1/uploads/multiple */
export async function postUploadsMultiple(
  body: {},
  files?: File[],
  options?: { [key: string]: any },
) {
  const formData = new FormData();

  if (files) {
    files.forEach((f) => formData.append('files', f || ''));
  }

  Object.keys(body).forEach((ele) => {
    const item = (body as any)[ele];

    if (item !== undefined && item !== null) {
      if (typeof item === 'object' && !(item instanceof File)) {
        if (item instanceof Array) {
          item.forEach((f) => formData.append(ele, f || ''));
        } else {
          formData.append(ele, JSON.stringify(item));
        }
      } else {
        formData.append(ele, item);
      }
    }
  });

  return request<{
    code?: number;
    message?: string;
    data?: {
      id?: string;
      filename?: string;
      originalname?: string;
      mimetype?: string;
      size?: number;
      path?: string;
    }[];
  }>('/api/v1/uploads/multiple', {
    method: 'POST',
    data: formData,
    requestType: 'form',
    ...(options || {}),
  });
}
