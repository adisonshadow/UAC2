/**
 * 钩子脚本类型声明（ambient，无 import/export）。
 * 与 handlerSdk.d.ts（db SDK 类型）在类型检查时拼接为完整声明集。
 * 运行时注入的绑定必须与此处声明一一对应：event / ctx（含 ctx.db）/ db。
 */

interface HookEventPayload {
  [key: string]: unknown;
}

interface HookEvent {
  /** 事件唯一 ID（UUID） */
  id: string;
  /** 事件类型，如 bizdata.record.updated */
  type: string;
  /** 事件发生时间（ISO 字符串） */
  occurredAt: string;
  /** 事件链深度；钩子动作引起的后续事件递增，≥3 会被拦截 */
  depth: number;
  payload: HookEventPayload;
}

interface HookInfo {
  id: string;
  name: string;
}

interface HookExecutionContext {
  /** 事件负载（event.payload 的只读别名） */
  payload: HookEventPayload;
  /** 写运行日志（存入运行记录，可在运行历史中查看） */
  log(...args: unknown[]): void;
  /** 受控数据库 SDK（仅实体白名单操作符；无网络与文件访问） */
  db: typeof db;
  /** 当前钩子信息 */
  hook: HookInfo;
}

declare const event: HookEvent;
declare const ctx: HookExecutionContext;
