import { Think } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import '@ant-design/x-markdown/themes/light.css';
import { useEffect, useState } from 'react';
import { markdownChartComponents } from './gptVisComponents';

const STREAMING_STATUSES = new Set(['loading', 'updating']);

interface Props {
  content: string;
  reasoningContent?: string;
  status?: string;
}

export default function AssistantMarkdown({ content, reasoningContent, status }: Props) {
  const isStreaming = status ? STREAMING_STATUSES.has(status) : false;
  const reasoningStreaming = isStreaming && !content.trim() && !!reasoningContent?.trim();
  const [reasoningExpanded, setReasoningExpanded] = useState(true);

  useEffect(() => {
    if (!isStreaming && reasoningContent) {
      setReasoningExpanded(false);
    }
  }, [isStreaming, reasoningContent]);

  return (
    <>
      {reasoningContent ? (
        <Think
          title={isStreaming ? '思考中…' : '思考过程'}
          loading={reasoningStreaming}
          expanded={reasoningExpanded}
          onExpand={setReasoningExpanded}
          blink={reasoningStreaming}
          style={{ marginBottom: 8 }}
        >
          <XMarkdown
            content={reasoningContent}
            className="x-markdown-light"
            openLinksInNewTab
            escapeRawHtml
            streaming={{
              hasNextChunk: isStreaming,
              enableAnimation: true,
            }}
          />
        </Think>
      ) : null}
      <XMarkdown
        content={content}
        className="x-markdown-light"
        openLinksInNewTab
        paragraphTag="div"
        components={markdownChartComponents}
        dompurifyConfig={{
          ADD_ATTR: ['data-axis-x-title', 'data-axis-y-title', 'data-title'],
        }}
        streaming={{
          hasNextChunk: isStreaming,
          enableAnimation: true,
          tail: isStreaming,
        }}
      />
    </>
  );
}
