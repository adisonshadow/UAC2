import { BulbOutlined, CloseOutlined, CommentOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons';
import type { BubbleListProps, ConversationItemType } from '@ant-design/x';
import { Bubble, Conversations, Prompts, Sender, Welcome, XProvider } from '@ant-design/x';
import type { BubbleListRef } from '@ant-design/x/es/bubble/interface';
import { useXConversations } from '@ant-design/x-sdk';
import { Avatar, Button, Popover, Select, Space, Tag, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAIBaseChat } from '../chat/useAIBaseChat';
import type { AIBaseModelInfo } from '../types';
import { useAIChatLayout } from '../provider/context';
import { useEffectiveAIChatConfig } from '../provider/AIChatPageScope';
import { useChatReference } from '../provider/ChatReferenceContext';
import { subscribeAIChatMessage } from '../utils/aiChatBridge';
import { formatMessageWithReferences } from '../utils/formatChatReferences';
import AssistantMarkdown from './AssistantMarkdown';
import './AIChatPanel.css';

const DEFAULT_CONVERSATIONS: ConversationItemType[] = [
  { key: 'default', label: '新会话', group: '今天' },
];

const renderAssistantContent = (
  content: ReactNode,
  info: { status?: string; extraInfo?: { reasoningContent?: string } },
) => (
  <AssistantMarkdown
    content={typeof content === 'string' ? content : String(content ?? '')}
    reasoningContent={info.extraInfo?.reasoningContent}
    status={info.status}
  />
);

const bubbleRole: BubbleListProps['role'] = {
  assistant: {
    placement: 'start',
    variant: 'borderless',
    contentRender: renderAssistantContent,
  },
  user: {
    placement: 'end',
    avatar: <Avatar icon={<UserOutlined />} />,
  },
};

interface AIChatPanelProps {
  onClose: () => void;
}

export default function AIChatPanel({ onClose }: AIChatPanelProps) {
  const { headerOffset, panelWidth, client } = useAIChatLayout();
  const config = useEffectiveAIChatConfig();
  const { references, removeReference, clearReferences } = useChatReference();
  const [messageApi, contextHolder] = message.useMessage();
  const [models, setModels] = useState<AIBaseModelInfo[]>([]);
  const [senderValue, setSenderValue] = useState('');
  const [deepThinking, setDeepThinking] = useState(false);
  const listRef = useRef<BubbleListRef>(null);

  const {
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
    getConversation,
    setConversation,
  } = useXConversations({
    defaultConversations: DEFAULT_CONVERSATIONS,
    defaultActiveConversationKey: DEFAULT_CONVERSATIONS[0].key,
  });

  const {
    messages,
    isRequesting,
    selectedSlug,
    setSelectedSlug,
    submitQuery,
    abort,
  } = useAIBaseChat(activeConversationKey);

  useEffect(() => {
    client.listModels().then(setModels).catch(() => messageApi.error('加载模型失败'));
  }, [client, messageApi]);

  useEffect(() => {
    if (!selectedSlug && models[0]?.slug) setSelectedSlug(models[0].slug);
  }, [models, selectedSlug, setSelectedSlug]);

  const bubbleItems = useMemo(
    () =>
      messages.map(({ id, message: msg, status }) => ({
        key: id,
        role: msg.role,
        content: msg.content,
        loading: status === 'loading',
        status,
        streaming: msg.role === 'assistant' && (status === 'loading' || status === 'updating'),
        extraInfo: { reasoningContent: (msg as { reasoningContent?: string }).reasoningContent },
      })),
    [messages],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    listRef.current?.scrollTo({ top: 'bottom', behavior });
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    requestAnimationFrame(() => scrollToBottom());
  }, [messages, scrollToBottom]);

  const handleSubmit = async (content: string) => {
    const displayText = content.trim();
    if (!displayText) return;
    if (!selectedSlug) {
      messageApi.warning('请先选择模型');
      return;
    }

    const apiText = formatMessageWithReferences(displayText, references);

    setSenderValue('');
    clearReferences();
    try {
      await submitQuery(apiText, { enableThinking: deepThinking, displayContent: displayText });
      requestAnimationFrame(() => scrollToBottom());

      const conversation = getConversation(activeConversationKey);
      if (conversation?.label === '新会话') {
        setConversation(activeConversationKey, { ...conversation, label: displayText.slice(0, 20) });
      }
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '发送失败');
    }
  };

  useEffect(() => {
    return subscribeAIChatMessage((text) => {
      void handleSubmit(text);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug, activeConversationKey, deepThinking, submitQuery]);

  const handleNewConversation = () => {
    if (messages.length) {
      const key = Date.now().toString();
      addConversation({ key, label: '新会话', group: '今天' });
      setActiveConversationKey(key);
      return;
    }
    messageApi.info('当前已是新会话');
  };

  const chatHeader = (
    <div className="aibase-chat-header">
      <div className="aibase-chat-header-title">{config.headerCaption}</div>
      <Space size={0}>
        <Button
          type="text"
          icon={<PlusOutlined />}
          className="aibase-chat-header-btn"
          onClick={handleNewConversation}
        />
        <Popover
          placement="bottomRight"
          trigger="click"
          styles={{ container: { padding: 0, maxHeight: 480 } }}
          content={
            <Conversations
              className="aibase-chat-conversations"
              items={conversations.map((item) =>
                item.key === activeConversationKey ? { ...item, label: `[当前] ${item.label}` } : item,
              )}
              activeKey={activeConversationKey}
              groupable
              onActiveChange={setActiveConversationKey}
              styles={{ item: { padding: '0 8px' } }}
            />
          }
        >
          <Button type="text" icon={<CommentOutlined />} className="aibase-chat-header-btn" />
        </Popover>
        <Button
          type="text"
          icon={<CloseOutlined />}
          className="aibase-chat-header-btn"
          onClick={onClose}
          aria-label="关闭 AI 助手"
        />
      </Space>
    </div>
  );

  return (
    <aside
      className="aibase-chat-panel"
      style={{ top: headerOffset, width: panelWidth }}
    >
      {contextHolder}
      <XProvider>
        {chatHeader}

        <div className="aibase-chat-list">
          {messages.length ? (
            <Bubble.List ref={listRef} items={bubbleItems} role={bubbleRole} autoScroll />
          ) : (
            <>
              <Welcome
                variant="borderless"
                title={config.welcome.title}
                description={config.welcome.description}
                className="aibase-chat-welcome"
              />
              <Prompts
                vertical
                title="你可以试试"
                items={config.prompts}
                onItemClick={(info) => handleSubmit(String(info.data?.description || ''))}
                styles={{ title: { fontSize: 14 } }}
              />
            </>
          )}
        </div>

        <div className="aibase-chat-send">
          {references.length > 0 && (
            <div className="aibase-chat-references">
              {references.map((ref) => (
                <Tag
                  key={ref.id}
                  closable
                  onClose={() => removeReference(ref.id)}
                  className="aibase-chat-ref-tag"
                >
                  {ref.label}
                </Tag>
              ))}
            </div>
          )}
          <Sender
            value={senderValue}
            onChange={setSenderValue}
            loading={isRequesting}
            onSubmit={handleSubmit}
            onCancel={abort}
            placeholder="输入消息，Enter 发送"
            footer={
              <div className="aibase-chat-send-footer">
                <Select
                  className="aibase-chat-model-select"
                  size="small"
                  variant="filled"
                  placeholder="选择模型"
                  value={selectedSlug}
                  popupMatchSelectWidth={false}
                  options={models.map((m) => ({
                    label: m.displayName,
                    value: m.slug,
                  }))}
                  onChange={setSelectedSlug}
                  disabled={isRequesting}
                />
                <Sender.Switch
                  icon={<BulbOutlined />}
                  checkedChildren="深度思考"
                  unCheckedChildren="深度思考"
                  value={deepThinking}
                  onChange={setDeepThinking}
                  disabled={isRequesting}
                />
              </div>
            }
          />
        </div>
      </XProvider>
    </aside>
  );
}
