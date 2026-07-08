import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { resolveConfig } from '../config/runtime';
import type { AIChatConfig, ResolvedAIChatConfig } from '../types';
import { useAIChatDynamicPrompts } from './AIChatPromptsContext';
import { useAIChatLayout } from './context';

export type AIChatPageScopeConfig = Partial<
  Pick<
    AIChatConfig,
    | 'scopeSlug'
    | 'applicationId'
    | 'fallbackSkillSlugs'
    | 'topLevelSkillMarkdown'
    | 'systemPromptPrefix'
    | 'welcome'
    | 'prompts'
    | 'headerCaption'
    | 'exposeAllClientTools'
    | 'nextStepPrompts'
  >
>;

export const AIChatPageScopeContext = createContext<AIChatPageScopeConfig | null>(null);

export function useAIChatPageScopeConfig(): AIChatPageScopeConfig | null {
  return useContext(AIChatPageScopeContext);
}

export function useEffectiveAIChatConfig(): ResolvedAIChatConfig {
  const { config: rootConfig } = useAIChatLayout();
  const pageScope = useAIChatPageScopeConfig();
  const dynamicPrompts = useAIChatDynamicPrompts();

  return useMemo(() => {
    const base = !pageScope
      ? rootConfig
      : resolveConfig({
          apiBase: rootConfig.apiBase,
          getToken: rootConfig.getToken,
          panelWidth: rootConfig.panelWidth,
          headerOffset: rootConfig.headerOffset,
          defaultOpen: rootConfig.defaultOpen,
          hiddenPaths: rootConfig.hiddenPaths,
          scopeSlug: pageScope.scopeSlug ?? rootConfig.scopeSlug,
          applicationId: pageScope.applicationId ?? rootConfig.applicationId,
          fallbackSkillSlugs: pageScope.fallbackSkillSlugs ?? rootConfig.fallbackSkillSlugs,
          topLevelSkillMarkdown: pageScope.topLevelSkillMarkdown ?? rootConfig.topLevelSkillMarkdown,
          systemPromptPrefix: pageScope.systemPromptPrefix ?? rootConfig.systemPromptPrefix,
          welcome: pageScope.welcome ?? rootConfig.welcome,
          prompts: pageScope.prompts ?? rootConfig.prompts,
          headerCaption: pageScope.headerCaption ?? rootConfig.headerCaption,
          exposeAllClientTools: pageScope.exposeAllClientTools ?? rootConfig.exposeAllClientTools,
          nextStepPrompts: pageScope.nextStepPrompts ?? rootConfig.nextStepPrompts,
        });

    if (dynamicPrompts == null) return base;

    return {
      ...base,
      prompts: dynamicPrompts,
    };
  }, [rootConfig, pageScope, dynamicPrompts]);
}

export interface AIChatPageScopeProps extends AIChatPageScopeConfig {
  children: ReactNode;
}

export function AIChatPageScope({
  children,
  scopeSlug,
  applicationId,
  fallbackSkillSlugs,
  topLevelSkillMarkdown,
  systemPromptPrefix,
  welcome,
  prompts,
  headerCaption,
  exposeAllClientTools,
  nextStepPrompts,
}: AIChatPageScopeProps) {
  const value = useMemo(
    () => ({
      scopeSlug,
      applicationId,
      fallbackSkillSlugs,
      topLevelSkillMarkdown,
      systemPromptPrefix,
      welcome,
      prompts,
      headerCaption,
      exposeAllClientTools,
      nextStepPrompts,
    }),
    [
      scopeSlug,
      applicationId,
      fallbackSkillSlugs?.join(','),
      topLevelSkillMarkdown,
      systemPromptPrefix,
      welcome?.title,
      welcome?.description,
      prompts?.map((p) => p.key).join(','),
      headerCaption,
      exposeAllClientTools,
      nextStepPrompts,
    ],
  );

  return (
    <AIChatPageScopeContext.Provider value={value}>{children}</AIChatPageScopeContext.Provider>
  );
}
