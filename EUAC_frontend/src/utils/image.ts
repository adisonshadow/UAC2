import { resolveApiUrl } from '@/constants/env';

const UPLOAD_FILE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** uploads 图片 file_id（UUID），过滤 seed 里的无效占位值 */
export function isValidUploadFileId(fileId?: string | null): fileId is string {
  if (!fileId || typeof fileId !== 'string') {
    return false;
  }
  const trimmed = fileId.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
    return false;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return false;
  }
  return UPLOAD_FILE_ID_PATTERN.test(trimmed);
}

/** 规范化 avatar/logo 等 uploads 引用，无效则视为未设置 */
export function normalizeUploadFileId(fileId?: string | null): string | null {
  return isValidUploadFileId(fileId) ? fileId.trim() : null;
}

/** 有效 file_id 才返回图片 URL，否则 undefined（避免 Avatar/Image 发起无效请求） */
export function getImageUrlIfValid(fileId?: string | null): string | undefined {
  if (!isValidUploadFileId(fileId)) {
    return undefined;
  }
  return resolveApiUrl(`/api/v1/uploads/images/${fileId.trim()}`);
}

export const getImageUrl = (file_id: string) => getImageUrlIfValid(file_id) ?? '';
