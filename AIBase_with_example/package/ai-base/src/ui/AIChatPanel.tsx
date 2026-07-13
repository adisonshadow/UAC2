import { BulbOutlined, CloseOutlined, CommentOutlined, PaperClipOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons';
import type { BubbleListProps, ConversationItemType } from '@ant-design/x';
import { Attachments, Bubble, Conversations, Prompts, Sender, Welcome, XProvider } from '@ant-design/x';
import type { Attachment, AttachmentsRef } from '@ant-design/x/es/attachments';
import type { BubbleListRef } from '@ant-design/x/es/bubble/interface';
import { useXConversations } from '@ant-design/x-sdk';
import { Avatar, Button, Popover, Progress, Select, Space, Tag, Tooltip, message } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAIBaseChat } from '../chat/useAIBaseChat';
import type { AIBaseModelInfo } from '../types';
import { useAIChatLayout } from '../provider/context';
import { useEffectiveAIChatConfig } from '../provider/AIChatPageScope';
import { useChatSessionGroupId } from '../provider/ChatSessionGroupContext';
import { useChatReference } from '../provider/ChatReferenceContext';
import { registerAIChatSessionControls, subscribeAIChatMessage } from '../utils/aiChatBridge';
import { formatMessageWithReferences } from '../utils/formatChatReferences';
import { extractAiChatErrorMessage } from '../utils/formatAiChatError';
import {
  getChatStorageNamespace,
  loadChatMeta,
  saveChatMeta,
} from '../storage/chatHistoryDb';
import {
  chatSelectedModelSlugKey,
  getUserHabit,
  setUserHabit,
} from '../storage/userHabit';
import { useDebouncedEffect } from '../storage/useDebouncedEffect';
import {
  getModelAttachmentAccept,
  isFileAllowedForModel,
  supportsModelAttachments,
} from '../utils/modelAttachmentConfig';
import type { AssistantSegment } from '../chat/chatToolSteps';
import AssistantBubbleContent from './AssistantBubbleContent';
import { scrollBubbleListToBottom } from './bubbleListScroll';
import './AIChatPanel.css';
import '../a2ui/NextStepA2uiDeck.css';

const DEFAULT_CONVERSATIONS: ConversationItemType[] = [
  { key: 'default', label: '新会话', group: '今天' },
];

interface AIChatPanelProps {
  onClose: () => void;
}

export default function AIChatPanel({ onClose }: AIChatPanelProps) {
  const { headerOffset, panelWidth, client } = useAIChatLayout();
  const config = useEffectiveAIChatConfig();
  const sessionGroupId = useChatSessionGroupId();
  const storageNamespace = useMemo(
    () => getChatStorageNamespace({ ...config, sessionGroupId }),
    [config, sessionGroupId],
  );
  const { references, removeReference, clearReferences } = useChatReference();
  const [messageApi, contextHolder] = message.useMessage();
  const [models, setModels] = useState<AIBaseModelInfo[]>([]);
  const [senderValue, setSenderValue] = useState('');
  const [deepThinking, setDeepThinking] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [hydratedNamespace, setHydratedNamespace] = useState<string | null>(null);
  const historyReady = hydratedNamespace === storageNamespace;
  // 瞬态系统消息（如 AI 报错）：仅展示，不进 messages/上下文/持久化。切换会话时清除。
  const [systemNotices, setSystemNotices] = useState<{ id: string; content: string }[]>([]);
  const listRef = useRef<BubbleListRef>(null);
  const attachRef = useRef<AttachmentsRef>(null);
  const modelsLoadDoneRef = useRef(false);
  const pendingExternalMessageRef = useRef<string | null>(null);

  const {
    conversations,
    activeConversationKey,
    setActiveConversationKey,
    addConversation,
    getConversation,
    setConversation,
    setConversations,
  } = useXConversations({
    defaultConversations: DEFAULT_CONVERSATIONS,
    defaultActiveConversationKey: DEFAULT_CONVERSATIONS[0].key,
  });

  useEffect(() => {
    let cancelled = false;
    void loadChatMeta(storageNamespace).then((meta) => {
      if (cancelled) return;
      if (meta?.conversations?.length) {
        setConversations(meta.conversations);
      } else {
        setConversations(DEFAULT_CONVERSATIONS);
      }
      if (meta?.activeConversationKey) {
        setActiveConversationKey(meta.activeConversationKey);
      } else {
        setActiveConversationKey(DEFAULT_CONVERSATIONS[0].key);
      }
      setHydratedNamespace(storageNamespace);
    });
    return () => {
      cancelled = true;
    };
  }, [storageNamespace, setConversations, setActiveConversationKey]);

  useDebouncedEffect(
    () => {
      if (!historyReady) return;
      void saveChatMeta(storageNamespace, {
        conversations,
        activeConversationKey,
      });
    },
    [historyReady, storageNamespace, conversations, activeConversationKey],
    300,
  );

  const {
    messages,
    isRequesting,
    selectedSlug,
    setSelectedSlug,
    submitQuery,
    abort,
    contextUsagePercent,
  } = useAIBaseChat(activeConversationKey, {
    persistMessages: historyReady,
    storageNamespace,
  });

  const selectedModel = useMemo(
    () => models.find((item) => item.slug === selectedSlug),
    [models, selectedSlug],
  );
  const attachmentEnabled = supportsModelAttachments(selectedModel?.inputTags);
  const attachmentAccept = getModelAttachmentAccept(selectedModel?.inputTags);

  useEffect(() => {
    modelsLoadDoneRef.current = false;
    client
      .listModels()
      .then((list) => {
        setModels(list);
        modelsLoadDoneRef.current = true;
      })
      .catch(() => {
        modelsLoadDoneRef.current = true;
        messageApi.error('加载模型失败');
      });
  }, [client, messageApi]);

  useEffect(() => {
    if (!models.length) return;
    const savedSlug = getUserHabit(chatSelectedModelSlugKey(), '');
    const validSaved = savedSlug && models.some((item) => item.slug === savedSlug);
    const nextSlug = validSaved ? savedSlug : models[0]?.slug;
    if (nextSlug && nextSlug !== selectedSlug) {
      setSelectedSlug(nextSlug);
      if (nextSlug !== savedSlug) {
        setUserHabit(chatSelectedModelSlugKey(), nextSlug);
      }
    }
  }, [models, selectedSlug, setSelectedSlug]);

  const handleModelChange = (slug: string) => {
    const nextModel = models.find((item) => item.slug === slug);
    setAttachments((prev) =>
      prev.filter((item) => {
        const file = item.originFileObj as File | undefined;
        return file ? isFileAllowedForModel(file, nextModel?.inputTags) : false;
      }),
    );
    setUserHabit(chatSelectedModelSlugKey(), slug);
    setSelectedSlug(slug);
  };

  const bubbleItems = useMemo(
    () => [
      ...messages.map(({ id, message: msg, status }) => {
        const text = typeof msg.content === 'string' ? msg.content.trim() : '';
        const segments = (msg as { segments?: AssistantSegment[] }).segments;
        const hasBody = !!segments?.length || !!text;
        const isPlaceholder = text === '正在思考中...' || text === '正在生成回复...';

        return {
          key: id,
          role: msg.role,
          content: msg.content,
          loading: status === 'loading' && !hasBody && (!text || isPlaceholder),
          status,
          streaming: msg.role === 'assistant' && (status === 'loading' || status === 'updating'),
          extraInfo: {
            reasoningContent: (msg as { reasoningContent?: string }).reasoningContent,
            segments,
          },
        };
      }),
      // 瞬态系统消息（AI 报错等）：不入对话上下文，仅展示
      ...systemNotices.map((notice) => ({
        key: notice.id,
        role: 'system-error',
        content: notice.content,
      })),
    ],
    [messages, systemNotices],
  );

  const bubbleRole = useMemo<BubbleListProps['role']>(
    () => ({
      assistant: {
        placement: 'start',
        variant: 'borderless',
        contentRender: (content, info) => (
          <AssistantBubbleContent
            content={content}
            status={info.status}
            reasoningContent={info.extraInfo?.reasoningContent}
            segments={info.extraInfo?.segments}
            nextStepPrompts={config.nextStepPrompts}
          />
        ),
      },
      user: {
        placement: 'end',
        avatar: <Avatar icon={<UserOutlined />} />,
      },
      // AI 报错等系统消息：红色、居中、无边框，不入对话上下文
      'system-error': {
        placement: 'start',
        variant: 'borderless',
        contentRender: (content) => <div className="aibase-chat-system-error">{content}</div>,
      },
    }),
    [config.nextStepPrompts],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    scrollBubbleListToBottom(listRef, behavior);
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    scrollToBottom(messages.length <= 1 ? 'instant' : 'smooth');
  }, [messages.length, scrollToBottom]);

  const resolveModelForSubmit = useCallback(() => {
    if (selectedSlug) {
      return { slug: selectedSlug, model: selectedModel };
    }
    if (models.length > 0) {
      const first = models[0];
      setSelectedSlug(first.slug);
      setUserHabit(chatSelectedModelSlugKey(), first.slug);
      return { slug: first.slug, model: first };
    }
    return null;
  }, [models, selectedModel, selectedSlug, setSelectedSlug]);

  const handleSubmit = useCallback(
    async (content: string) => {
      const displayText = content.trim();
      if (!displayText && attachments.length === 0) return;

      const resolved = resolveModelForSubmit();
      if (!resolved) {
        if (!modelsLoadDoneRef.current) {
          pendingExternalMessageRef.current = displayText;
          return;
        }
        messageApi.warning('暂无可用 AI 模型，请先在「AI 管理」中配置并启用模型');
        return;
      }

      const { slug, model } = resolved;
      const apiText = formatMessageWithReferences(displayText, references);
      const pendingAttachments = attachments;

      setSenderValue('');
      setAttachments([]);
      clearReferences();
      try {
        await submitQuery(apiText, {
          enableThinking: deepThinking,
          displayContent: displayText,
          attachments: pendingAttachments,
          inputTags: model?.inputTags,
          modelSlug: slug,
        });
        requestAnimationFrame(() => scrollToBottom());

        const conversation = getConversation(activeConversationKey);
        const titleSource = displayText || pendingAttachments.map((item) => item.name).join('、');
        if (conversation?.label === '新会话' && titleSource) {
          setConversation(activeConversationKey, { ...conversation, label: titleSource.slice(0, 20) });
        }
      } catch (error) {
        // AI 报错以内联系统消息展示（红色、不入对话上下文/持久化）
        setSystemNotices((prev) => [
          ...prev,
          { id: `sys-${Date.now()}`, content: extractAiChatErrorMessage(error) },
        ]);
      }
    },
    [
      activeConversationKey,
      attachments,
      clearReferences,
      deepThinking,
      getConversation,
      messageApi,
      references,
      resolveModelForSubmit,
      scrollToBottom,
      setConversation,
      submitQuery,
    ],
  );

  useEffect(() => {
    const pending = pendingExternalMessageRef.current;
    if (!pending || !modelsLoadDoneRef.current) return;

    if (models.length > 0) {
      pendingExternalMessageRef.current = null;
      void handleSubmit(pending);
      return;
    }

    pendingExternalMessageRef.current = null;
    messageApi.warning('暂无可用 AI 模型，请先在「AI 管理」中配置并启用模型');
  }, [handleSubmit, messageApi, models, selectedSlug]);

  const handleAttachmentChange = ({ fileList }: { fileList: Attachment[] }) => {
    const inputTags = selectedModel?.inputTags;
    const next = fileList.filter((item) => {
      const file = item.originFileObj as File | undefined;
      if (!file) return true;
      const allowed = isFileAllowedForModel(file, inputTags);
      if (!allowed) {
        messageApi.warning(`当前模型不支持附件类型：${file.name}`);
      }
      return allowed;
    });
    setAttachments(next);
  };

  useEffect(() => {
    registerAIChatSessionControls({
      loadConversation: setActiveConversationKey,
      getActiveConversationKey: () => activeConversationKey,
      getStorageNamespace: () => storageNamespace,
    });
    return () => registerAIChatSessionControls(null);
  }, [activeConversationKey, storageNamespace, setActiveConversationKey]);

  useEffect(() => {
    return subscribeAIChatMessage((text) => {
      void handleSubmit(text);
    });
  }, [handleSubmit]);

  // 切换会话时清除瞬态系统消息（错误不入持久化，切回也不复现）
  useEffect(() => {
    setSystemNotices([]);
  }, [activeConversationKey]);

  const handleNewConversation = () => {
    const key = Date.now().toString();
    addConversation({ key, label: '新会话', group: '今天' });
    setActiveConversationKey(key);
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
          {!messages.length && !systemNotices.length ? (
            <div className="aibase-chat-empty">
              <Welcome
                variant="borderless"
                title={config.welcome.title}
                description={config.welcome.description}
                className="aibase-chat-welcome"
              />
              <Prompts
                vertical
                title="您可以试试"
                items={config.prompts}
                onItemClick={(info) => handleSubmit(String(info.data?.description || ''))}
                styles={{ title: { fontSize: 14 } }}
              />
            </div>
          ) : (
            <Bubble.List
              ref={listRef}
              className="aibase-chat-bubble-list"
              items={bubbleItems}
              role={bubbleRole}
              autoScroll
            />
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
            header={
              attachmentEnabled ? (
                <Sender.Header open={attachments.length > 0} forceRender>
                  <Attachments
                    ref={attachRef}
                    items={attachments}
                    onChange={handleAttachmentChange}
                    overflow="scrollX"
                    beforeUpload={() => false}
                    accept={attachmentAccept}
                    multiple
                  />
                </Sender.Header>
              ) : undefined
            }
            footer={
              <div className="aibase-chat-send-footer">
                {attachmentEnabled && (
                  <Button
                    type="text"
                    size="small"
                    className="aibase-chat-attach-btn"
                    icon={<PaperClipOutlined />}
                    disabled={isRequesting}
                    aria-label="添加附件"
                    onClick={() =>
                      attachRef.current?.select({
                        accept: attachmentAccept,
                        multiple: true,
                      })
                    }
                  />
                )}
                {models.length > 1 && (
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
                    onChange={handleModelChange}
                    disabled={isRequesting}
                  />
                )}
                <Sender.Switch
                  icon={<BulbOutlined />}
                  checkedChildren="深度思考"
                  unCheckedChildren="深度思考"
                  value={deepThinking}
                  onChange={setDeepThinking}
                  disabled={isRequesting}
                />
                <Tooltip title={`上下文用量 ${contextUsagePercent}%（过高时将自动整理历史消息）`}>
                  <Progress
                    type="circle"
                    percent={contextUsagePercent}
                    size={20}
                    showInfo={false}
                    className="aibase-chat-context-progress"
                    strokeColor={contextUsagePercent >= 85 ? '#faad14' : undefined}
                  />
                </Tooltip>
              </div>
            }
          />
        </div>
      </XProvider>
    </aside>
  );
}
