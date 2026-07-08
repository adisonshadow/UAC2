import { createContext, useContext } from 'react';
import type { AIBaseClient } from '../sdk/client';
import type { AIChatDisplayMode, ResolvedAIChatConfig } from '../types';

export interface AIChatLayoutContextValue {
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  displayMode: AIChatDisplayMode;
  setDisplayMode: (mode: AIChatDisplayMode) => void;
  panelWidth: number;
  paddingRight: number;
  headerOffset: number;
  config: ResolvedAIChatConfig;
  client: AIBaseClient;
}

export const AIChatLayoutContext = createContext<AIChatLayoutContextValue | null>(null);

export function useAIChatLayout(): AIChatLayoutContextValue {
  const context = useContext(AIChatLayoutContext);
  if (!context) {
    throw new Error('useAIChatLayout 必须在 <AIChatProvider> 内使用');
  }
  return context;
}
