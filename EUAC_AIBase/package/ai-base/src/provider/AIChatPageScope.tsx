import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { resolveConfig } from '../config/runtime';
import type { AIChatConfig, ResolvedAIChatConfig } from '../types';
import { useAIChatLayout } from './context';

export type AIChatPageScopeConfig = Partial<
  Pick<
    AIChatConfig,
    'scopeSlug' | 'fallbackSkillSlugs' | 'systemPromptPrefix' | 'welcome' | 'prompts' | 'headerCaption'
  >
>;

export const AIChatPageScopeContext = createContext<AIChatPageScopeConfig | null>(null);

export function useAIChatPageScopeConfig(): AIChatPageScopeConfig | null {
  return useContext(AIChatPageScopeContext);
}

export function useEffectiveAIChatConfig(): ResolvedAIChatConfig {
  const { config: rootConfig } = useAIChatLayout();
  const pageScope = useAIChatPageScopeConfig();

  return useMemo(() => {
    if (!pageScope) return rootConfig;
    return resolveConfig({
      apiBase: rootConfig.apiBase,
      getToken: rootConfig.getToken,
      panelWidth: rootConfig.panelWidth,
      headerOffset: rootConfig.headerOffset,
      defaultOpen: rootConfig.defaultOpen,
      hiddenPaths: rootConfig.hiddenPaths,
      scopeSlug: pageScope.scopeSlug ?? rootConfig.scopeSlug,
      fallbackSkillSlugs: pageScope.fallbackSkillSlugs ?? rootConfig.fallbackSkillSlugs,
      systemPromptPrefix: pageScope.systemPromptPrefix ?? rootConfig.systemPromptPrefix,
      welcome: pageScope.welcome ?? rootConfig.welcome,
      prompts: pageScope.prompts ?? rootConfig.prompts,
      headerCaption: pageScope.headerCaption ?? rootConfig.headerCaption,
    });
  }, [rootConfig, pageScope]);
}

export interface AIChatPageScopeProps extends AIChatPageScopeConfig {
  children: ReactNode;
}

export function AIChatPageScope({
  children,
  scopeSlug,
  fallbackSkillSlugs,
  systemPromptPrefix,
  welcome,
  prompts,
  headerCaption,
}: AIChatPageScopeProps) {
  const value = useMemo(
    () => ({
      scopeSlug,
      fallbackSkillSlugs,
      systemPromptPrefix,
      welcome,
      prompts,
      headerCaption,
    }),
    [
      scopeSlug,
      fallbackSkillSlugs?.join(','),
      systemPromptPrefix,
      welcome?.title,
      welcome?.description,
      prompts?.map((p) => p.key).join(','),
      headerCaption,
    ],
  );

  return (
    <AIChatPageScopeContext.Provider value={value}>{children}</AIChatPageScopeContext.Provider>
  );
}
