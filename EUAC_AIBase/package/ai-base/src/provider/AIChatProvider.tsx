import { CommentOutlined } from '@ant-design/icons';
import { FloatButton } from 'antd';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolveConfig } from '../config/runtime';
import { AIBaseClient } from '../sdk/client';
import type { AIChatConfig, AIChatDisplayMode } from '../types';
import AIChatPanel from '../ui/AIChatPanel';
import { registerAIChatControls } from '../utils/aiChatBridge';
import { AIChatLayoutContext, type AIChatLayoutContextValue } from './context';
import { ChatReferenceProvider } from './ChatReferenceContext';
import {
  getCurrentPathname,
  getDisplayModeForPath,
  subscribePathname,
} from './pathnameDisplayMode';

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
    return () => registerAIChatControls(null);
  }, []);

  return (
    <AIChatLayoutContext.Provider value={layoutValue}>
      <ChatReferenceProvider>
        {children}
        {displayMode !== 'hidden' && chatOpen && (
          <AIChatPanel onClose={() => setChatOpen(false)} />
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
    </AIChatLayoutContext.Provider>
  );
}
