import { ThoughtChain } from '@ant-design/x';
import type { ThoughtChainItemType } from '@ant-design/x';
import type { ChatToolStep } from '../chat/chatToolSteps';

function formatStepDescription(step: ChatToolStep): string {
  if (step.status === 'loading') return '执行中…';
  if (step.status === 'error') return step.error || '执行失败';
  if (typeof step.durationMs === 'number') return `已完成 · ${step.durationMs}ms`;
  return '已完成';
}

function toThoughtChainItem(step: ChatToolStep): ThoughtChainItemType {
  return {
    key: step.id,
    title: step.displayName,
    description: formatStepDescription(step),
    status: step.status,
    blink: step.status === 'loading',
  };
}

interface ToolInvokeStepsProps {
  /** 单个 Tool 调用步骤；每个 Tool 渲染为一条独立的 ThoughtChain（单 item，支持多状态）。 */
  step?: ChatToolStep;
}

/**
 * 渲染单条 Tool 调用为一条独立 ThoughtChain（仅一个节点）。
 * 由 AssistantSegments 在按输出顺序遍历 segments 时逐个调用，
 * 这样每个 Tool 各占一行，不再合并到同一条链里。
 */
export default function ToolInvokeSteps({ step }: ToolInvokeStepsProps) {
  if (!step) return null;
  return (
    <div className="aibase-tool-invoke-steps">
      <ThoughtChain key={step.id} line={false} items={[toThoughtChainItem(step)]} />
    </div>
  );
}
