import { extractStorageObjectId } from '@/constants/storage';
import { isStorageObjectId, resolveMediaUrl } from '@/utils/mediaUrl';

/** @deprecated 使用 isStorageObjectId */
export function isValidUploadFileId(fileId?: string | null): fileId is string {
  return isStorageObjectId(fileId);
}

/** 规范化 avatar/logo 等媒体引用为 storage object UUID */
export function normalizeUploadFileId(fileId?: string | null): string | null {
  if (!fileId?.trim()) return null;
  const trimmed = fileId.trim();
  if (isStorageObjectId(trimmed)) return trimmed;
  return extractStorageObjectId(trimmed) ?? null;
}

/** 有效媒体引用才返回预览 URL */
export function getImageUrlIfValid(ref?: string | null): string | undefined {
  return resolveMediaUrl(ref);
}

export const getImageUrl = (ref: string) => getImageUrlIfValid(ref) ?? '';
