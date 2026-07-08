/** 与后端 SYSTEM_STORAGE_BUCKET_CODE 保持一致 */
export const SYSTEM_STORAGE_BUCKET_CODE =
  (typeof process !== 'undefined' && process.env.APP_SYSTEM_STORAGE_BUCKET_CODE) || 'eadaf-system';

export function buildStoragePreviewPath(objectId: string) {
  return `/api/v1/storage/objects/${objectId}/preview`;
}

export function extractStorageObjectId(ref?: string | null): string | undefined {
  if (!ref?.trim()) return undefined;
  const trimmed = ref.trim();
  const match = trimmed.match(/\/api\/v1\/storage\/objects\/([0-9a-f-]{36})\/preview/i);
  return match?.[1];
}
