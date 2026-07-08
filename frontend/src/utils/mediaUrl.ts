import { resolveApiUrl } from '@/constants/env';
import { extractStorageObjectId } from '@/constants/storage';

const STORAGE_OBJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 是否为 file_storage 对象 ID（UUID） */
export function isStorageObjectId(ref?: string | null): ref is string {
  if (!ref || typeof ref !== 'string') return false;
  const trimmed = ref.trim();
  return !!trimmed && STORAGE_OBJECT_ID_PATTERN.test(trimmed);
}

/** 解析 logo/avatar 等媒体引用为可展示的 URL（统一走 file_storage 预览接口） */
export function resolveMediaUrl(ref?: string | null): string | undefined {
  if (!ref?.trim()) return undefined;
  const trimmed = ref.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/api/v1/storage/objects/')) {
    return resolveApiUrl(trimmed);
  }
  if (trimmed.startsWith('/')) {
    return resolveApiUrl(trimmed);
  }
  if (isStorageObjectId(trimmed)) {
    return resolveApiUrl(`/api/v1/storage/objects/${trimmed}/preview`);
  }
  const objectId = extractStorageObjectId(trimmed);
  if (objectId) {
    return resolveApiUrl(`/api/v1/storage/objects/${objectId}/preview`);
  }
  return undefined;
}
