export function materializedTableBrowseUrl(
  entityId: string,
  mode: 'schema' | 'data',
  connectionId?: string,
): string {
  const base = `/business_data/database/tables/${entityId}/${mode}`;
  if (!connectionId) return base;
  return `${base}?connectionId=${encodeURIComponent(connectionId)}`;
}
