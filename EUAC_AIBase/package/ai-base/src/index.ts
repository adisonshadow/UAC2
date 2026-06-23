export { AIChatProvider } from './provider/AIChatProvider';
export type { AIChatProviderProps } from './provider/AIChatProvider';
export { AIChatDisplay } from './provider/AIChatDisplay';
export type { AIChatDisplayProps } from './provider/AIChatDisplay';
export { AIChatPageScope, useEffectiveAIChatConfig } from './provider/AIChatPageScope';
export type { AIChatPageScopeProps, AIChatPageScopeConfig } from './provider/AIChatPageScope';
export { ChatReferenceProvider, useChatReference } from './provider/ChatReferenceContext';
export type {
  ChatReferenceItem,
  AddReferenceParams,
  ChatReferenceContextValue,
  ChatReferenceProviderProps,
} from './provider/ChatReferenceContext';
export { useAIChatLayout } from './provider/context';
export { useAIChatDisplayMode } from './provider/useAIChatDisplayMode';
export { useSendAIChatMessage } from './hooks/useSendAIChatMessage';
export {
  sendAIChatMessage,
  sendMockUserMessage,
  registerAIChatControls,
} from './utils/aiChatBridge';
export type { AIChatControls } from './utils/aiChatBridge';
export { formatMessageWithReferences } from './utils/formatChatReferences';

export {
  registerFunctionCall,
  unregisterFunctionCall,
  getFunctionCallDef,
  getAllFunctionCalls,
} from './registry/functionRegistry';

export { AIBaseClient } from './sdk';

export type {
  AIChatConfig,
  AIChatDisplayMode,
  ResolvedAIChatConfig,
  AIBaseScope,
  AIBaseTool,
  OpenAIToolDefinition,
  AIBaseSkill,
  AIBaseModelInfo,
  AIBaseClientOptions,
  ToolInvokeResult,
  FunctionCallDef,
} from './types';
