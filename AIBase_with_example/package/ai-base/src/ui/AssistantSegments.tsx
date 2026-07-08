import type { ActionPayload } from '@ant-design/x-card';
import { useCallback, useMemo, type ReactNode } from 'react';
import NextStepA2uiDeck, { NextStepStreamingPlaceholder } from '../a2ui/NextStepA2uiDeck';
import { extractA2uiCommandsPayload } from '../a2ui/parseA2uiCommands';
import type { AssistantSegment } from '../chat/chatToolSteps';
import { sendMockUserMessage } from '../utils/aiChatBridge';
import AssistantMarkdown from './AssistantMarkdown';
import ToolInvokeSteps from './ToolInvokeSteps';

export interface AssistantSegmentsProps {
  segments?: AssistantSegment[];
  /** 兜底：当无 segment（如历史消息）时回退展示的完整文本。 */
  fallbackContent: ReactNode;
  status?: string;
  reasoningContent?: string;
  nextStepPrompts?: Record<string, string | ((context: Record<string, unknown>) => string)>;
}

/** 单个文本段经 a2ui 指令抽取后的渲染数据 */
interface TextSegmentView {
  id: string;
  displayText: string;
  isStreamingBlock: boolean;
  hasSteps: boolean;
  steps: ReturnType<typeof extractA2uiCommandsPayload>['steps'];
}

/**
 * 按 AI 输出顺序渲染 assistant 回复：遍历 segments，文本段渲染为 Markdown，
 * 工具段渲染为单条 ThoughtChain，二者自然交错。
 *
 * 与旧实现（所有 Tool 堆在文字上方）的区别：顺序由 segments 数组决定，
 * 不再由「先 ToolInvokeSteps 后 AssistantMarkdown」的固定布局决定。
 */
export default function AssistantSegments({
  segments,
  fallbackContent,
  status,
  reasoningContent,
  nextStepPrompts = {},
}: AssistantSegmentsProps) {
  const hasActiveTool = segments?.some(
    (seg) => seg.kind === 'tool' && seg.step.status === 'loading',
  );

  const handleNextStepAction = useCallback(
    (payload: ActionPayload) => {
      const resolver = nextStepPrompts[payload.name];
      if (!resolver) {
        const labelCtx = payload.context?.label as { value?: string } | undefined;
        const label = labelCtx?.value?.trim();
        if (label) sendMockUserMessage(label);
        return;
      }
      const messageText =
        typeof resolver === 'function' ? resolver(payload.context ?? {}) : resolver;
      if (messageText.trim()) sendMockUserMessage(messageText);
    },
    [nextStepPrompts],
  );

  // 一次性把所有文本段做 a2ui 指令解析（useMemo 不能放在循环/条件里，故提到顶层）
  const textViews = useMemo<TextSegmentView[]>(() => {
    if (!segments?.length) return [];
    return segments
      .filter((seg): seg is Extract<AssistantSegment, { kind: 'text' }> => seg.kind === 'text')
      .map((seg) => {
        const parsed = extractA2uiCommandsPayload(seg.content);
        return {
          id: seg.id,
          displayText: parsed.displayText,
          isStreamingBlock: parsed.isStreamingBlock,
          hasSteps: parsed.hasSteps,
          steps: parsed.steps,
        };
      });
  }, [segments]);

  // 无 segment 视图时回退到整体文本（历史消息/降级路径）；同样提到顶层以遵守 Hooks 规则
  const fallbackParsed = useMemo(() => {
    if (segments?.length) return null;
    const text =
      typeof fallbackContent === 'string' ? fallbackContent : String(fallbackContent ?? '');
    return extractA2uiCommandsPayload(text);
  }, [segments, fallbackContent]);

  if (fallbackParsed) {
    return (
      <>
        <AssistantMarkdown
          content={fallbackParsed.displayText}
          reasoningContent={reasoningContent}
          status={status}
          contentStreaming={status === 'updating' && !hasActiveTool}
        />
        {fallbackParsed.isStreamingBlock ? <NextStepStreamingPlaceholder /> : null}
        {!fallbackParsed.isStreamingBlock && fallbackParsed.hasSteps ? (
          <NextStepA2uiDeck steps={fallbackParsed.steps} onAction={handleNextStepAction} />
        ) : null}
      </>
    );
  }

  // 末条文本段的 a2ui 步骤（NextStep 仅在结尾渲染一次）
  const lastText = textViews[textViews.length - 1];

  return (
    <>
      {(segments ?? []).map((segment) => {
        if (segment.kind === 'tool') {
          return <ToolInvokeSteps key={segment.id} step={segment.step} />;
        }
        const view = textViews.find((v) => v.id === segment.id);
        return (
          <AssistantMarkdown
            key={segment.id}
            content={view?.displayText ?? segment.content}
            reasoningContent={reasoningContent}
            status={status}
            contentStreaming={status === 'updating' && !hasActiveTool}
          />
        );
      })}
      {lastText?.isStreamingBlock ? <NextStepStreamingPlaceholder /> : null}
      {lastText && !lastText.isStreamingBlock && lastText.hasSteps ? (
        <NextStepA2uiDeck steps={lastText.steps} onAction={handleNextStepAction} />
      ) : null}
    </>
  );
}
