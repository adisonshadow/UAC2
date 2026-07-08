/** 统一会话分组：全站 AI Chat 暂共用一组 IndexedDB 历史 */
const EADAF_UNIFIED_SESSION_GROUP = 'eadaf';

/**
 * 从路由 pathname 解析 AI Chat 会话分组（IndexedDB namespace 后缀）。
 *
 * 当前策略：全站统一为 `eadaf`，切换菜单/模块时共享同一会话列表与消息历史。
 *
 * 旧策略（按一级路由分段，各模块独立会话）——保留注释供后续恢复：
 *
 * ```ts
 * const segments = pathname.split('/').filter(Boolean);
 * if (!segments.length) return 'default';
 * return segments[0];
 * ```
 *
 * 旧分组 ID 对照（pathname 第一段 → sessionGroupId）：
 * - `/member_org/*`     → `member_org`
 * - `/permissions/*`    → `permissions`   （与 member_org 分裂，曾共用 MemberOrgAI）
 * - `/business_data/*`  → `business_data`
 * - `/api_services/*`   → `api_services`
 * - `/ai_management/*`  → `ai_management`
 * - `/service_provider/*` → `service_provider`
 * - `/file_storage/*`   → `file_storage`
 * - `/system/settings`  → `system`
 * - `/auth/*`           → `auth`
 * - `/account/center`   → `account`
 */
export function resolveChatSessionGroupFromPathname(_pathname: string): string {
  return EADAF_UNIFIED_SESSION_GROUP;
}
