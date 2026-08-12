import { CommentOutlined } from '@ant-design/icons';
import { FloatButton } from 'antd';
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolveConfig } from '../config/runtime';
import { AIBaseClient } from '../sdk/client';
import type { AIChatConfig, AIChatDisplayMode } from '../types';
import { registerAIChatControls } from '../utils/aiChatBridge';
import { registerBuiltinTools, unregisterBuiltinTools } from '../registry/builtinTools';
import { AIChatLayoutContext, type AIChatLayoutContextValue } from './context';
import { AIChatPromptsProvider } from './AIChatPromptsContext';
import { ChatReferenceProvider } from './ChatReferenceContext';
import {
  getCurrentPathname,
  getDisplayModeForPath,
  subscribePathname,
} from './pathnameDisplayMode';

// 懒挂载 AIChatPanel：首屏不加载 Panel 及其重依赖（gpt-vis/XMarkdown/Attachments 等），
// 推迟到 Panel 真正打开时按需加载，显著降低首屏冷启动的工作量。
const AIChatPanel = lazy(() => import('../ui/AIChatPanel'));

export interface AIChatProviderProps {
  config?: AIChatConfig;
  children: ReactNode;
}

export function AIChatProvider({ config, children }: AIChatProviderProps) {
  const resolved = useMemo(
    () => resolveConfig(config),
    [
      config?.apiBase,
      config?.scopeSlug,
      config?.applicationId,
      config?.systemPromptPrefix,
      config?.panelWidth,
      config?.headerOffset,
      config?.headerCaption,
      config?.defaultOpen,
      config?.hiddenPaths?.join(','),
      config?.fallbackSkillSlugs?.join(','),
      config?.welcome?.title,
      config?.welcome?.description,
      config?.prompts?.map((item) => item.key).join(','),
    ],
  );

  const client = useMemo(
    () => new AIBaseClient({ baseUrl: resolved.apiBase, getToken: resolved.getToken }),
    [resolved.apiBase, config?.getToken],
  );

  const initialMode = getDisplayModeForPath(getCurrentPathname(), resolved.hiddenPaths);
  const [chatOpen, setChatOpen] = useState(
    () => resolved.defaultOpen && initialMode !== 'hidden',
  );
  const [displayMode, setDisplayMode] = useState<AIChatDisplayMode>(() => initialMode);

  useEffect(() => {
    if (resolved.hiddenPaths.length === 0) return undefined;

    const syncFromPath = () => {
      const nextMode = getDisplayModeForPath(getCurrentPathname(), resolved.hiddenPaths);
      setDisplayMode(nextMode);
      if (nextMode === 'hidden') {
        setChatOpen(false);
      }
    };

    return subscribePathname(syncFromPath);
  }, [resolved.hiddenPaths]);

  const paddingRight = displayMode === 'sidebar' && chatOpen ? resolved.panelWidth : 0;

  const layoutValue = useMemo<AIChatLayoutContextValue>(
    () => ({
      chatOpen,
      setChatOpen,
      displayMode,
      setDisplayMode,
      panelWidth: resolved.panelWidth,
      paddingRight,
      headerOffset: resolved.headerOffset,
      config: resolved,
      client,
    }),
    [chatOpen, displayMode, paddingRight, resolved, client],
  );

  useEffect(() => {
    document.body.style.paddingRight = paddingRight > 0 ? `${paddingRight}px` : '0';
    return () => {
      document.body.style.paddingRight = '';
    };
  }, [paddingRight]);

  useEffect(() => {
    registerAIChatControls({ openPanel: () => setChatOpen(true) });
    registerBuiltinTools();
    return () => {
      registerAIChatControls(null);
      unregisterBuiltinTools();
    };
  }, []);

  return (
    <AIChatLayoutContext.Provider value={layoutValue}>
      <AIChatPromptsProvider>
        <ChatReferenceProvider>
          {children}
          {displayMode !== 'hidden' && chatOpen && (
            <Suspense fallback={null}>
              <AIChatPanel onClose={() => setChatOpen(false)} />
            </Suspense>
          )}
          {displayMode !== 'hidden' && !chatOpen && (
            <FloatButton
              className="aibase-chat-float-btn"
              icon={<CommentOutlined />}
              type="primary"
              tooltip="打开 AI 助手"
              style={{ right: 24, bottom: 24 }}
              onClick={() => setChatOpen(true)}
            />
          )}
        </ChatReferenceProvider>
      </AIChatPromptsProvider>
    </AIChatLayoutContext.Provider>
  );
}
