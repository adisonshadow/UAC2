export { AIChatProvider } from './provider/AIChatProvider';
export type { AIChatProviderProps } from './provider/AIChatProvider';
export { AIChatDisplay } from './provider/AIChatDisplay';
export type { AIChatDisplayProps } from './provider/AIChatDisplay';
export { AIChatPageScope, useEffectiveAIChatConfig } from './provider/AIChatPageScope';
export type { AIChatPageScopeProps, AIChatPageScopeConfig } from './provider/AIChatPageScope';
export { ChatSessionGroupProvider, useChatSessionGroupId } from './provider/ChatSessionGroupContext';
export type { ChatSessionGroupProviderProps } from './provider/ChatSessionGroupContext';
export { ChatReferenceProvider, useChatReference } from './provider/ChatReferenceContext';
export type {
  ChatReferenceItem,
  AddReferenceParams,
  ChatReferenceContextValue,
  ChatReferenceProviderProps,
} from './provider/ChatReferenceContext';
export { useAIChatLayout } from './provider/context';
export { useAIChatDisplayMode } from './provider/useAIChatDisplayMode';
export {
  AIChatPromptsProvider,
  useAIChatPrompts,
  useSetAIChatPrompts,
  useAIChatDynamicPrompts,
} from './provider/AIChatPromptsContext';
export type { AIChatPromptsContextValue, AIChatPromptsProviderProps } from './provider/AIChatPromptsContext';
export { useSendAIChatMessage } from './hooks/useSendAIChatMessage';
export {
  sendAIChatMessage,
  sendMockUserMessage,
  registerAIChatControls,
  registerAIChatSessionControls,
  loadAIChatConversation,
  getActiveAIChatConversationKey,
  getAIChatStorageNamespace,
} from './utils/aiChatBridge';
export type { AIChatControls, AIChatSessionControls } from './utils/aiChatBridge';
export { formatMessageWithReferences } from './utils/formatChatReferences';
export { extractAiChatErrorMessage, readChatErrorMessage } from './utils/formatAiChatError';
export { setToolInvokeLogger, logToolInvoke, withToolInvokeLog, formatToolInvokeError, subscribeToolInvoke } from './utils/toolInvokeLogger';
export type { ToolInvokeLogEntry, ToolInvokeLogger, ToolInvokeSide, ToolInvokeListener } from './utils/toolInvokeLogger';

export {
  registerAISurface,
  unregisterAISurface,
  getAISurface,
  getAllAISurfaces,
  readAllAISurfaces,
} from './registry/aiSurfaceRegistry';
export { emitAIMutation, subscribeAIMutation, emitMutationFromToolResult } from './registry/aiMutationBus';
export { useAISurface, useAIMutationHandler } from './provider/useAISurface';

export {
  registerFunctionCall,
  unregisterFunctionCall,
  getFunctionCallDef,
  getAllFunctionCalls,
  invokeFunctionCall,
  clearFunctionCalls,
  subscribeFunctionCalls,
} from './registry/functionRegistry';
export type { RegisterFunctionCallOptions } from './registry/functionRegistry';

export {
  registerSkillCompletionPolicy,
  unregisterSkillCompletionPolicy,
  clearSkillCompletionPolicies,
  getSkillCompletionStrategy,
  resolveTerminationCompletionStrategy,
} from './registry/skillPolicyRegistry';
export type { SkillCompletionPolicyOverride } from './registry/skillPolicyRegistry';

// Skill 加载缓存失效：管理后台编辑 Skill 后调用以刷新前端缓存（见 p2-skill-tool-caching.md）
export { invalidateSkillCache } from './registry/skillCache';

export { useFunctionCall } from './hooks/useFunctionCall';
export type { UseFunctionCallOptions } from './hooks/useFunctionCall';

export { serializeToolResultForContext, resolveToolResultBudget } from './utils/toolResultBudget';
export type { TrimmedToolResult } from './utils/toolResultBudget';
export { aggregateToolResults } from './utils/aggregateToolResults';
export {
  supportsModelAttachments,
  supportsModelVoiceInput,
  MODEL_CAPABILITY_AUDIO_INPUT,
} from './utils/modelAttachmentConfig';
/**
 * 结构化终止（task_complete / update_plan）机制。
 * 开启方式：在 AIChatConfig 设 enableStructuredTermination: true。
 * 详见 docs/AIBase 成熟闭环与 Planning next moves 统一方案.md。
 */
export {
  TASK_COMPLETE_TOOL,
  UPDATE_PLAN_TOOL,
  ASK_USER_TOOL,
  ASK_USER_OPENAI_TOOL,
  HARNESS_TOOL_NAMES,
  HARNESS_OPENAI_TOOLS,
} from './registry/builtinTools';
export {
  formatUserChoiceMessage,
  isUserChoiceRequestData,
} from './chat/userChoice';
export type {
  AskUserArgs,
  UserChoiceMode,
  UserChoiceOption,
  UserChoiceRequest,
  UserChoiceSubmission,
} from './chat/userChoice';
export { resolveToolStepFromEnvelope } from './chat/resolveToolStepFromEnvelope';

export { AIBaseClient } from './sdk';

export type {
  AIChatConfig,
  AIChatDisplayMode,
  AIChatPromptItem,
  ResolvedAIChatConfig,
  AIBaseScope,
  AIBaseTool,
  OpenAIToolDefinition,
  AIBaseSkill,
  AIBaseModelInfo,
  AIBaseClientOptions,
  ToolInvokeResult,
  FunctionCallDef,
  SkillCompletionStrategy,
  PlanItem,
} from './types';
export type {
  ToolResponse,
  ToolResponseError,
  ToolResultKind,
} from './types/toolResponse';
export { isToolResponse } from './types/toolResponse';
export { normalizeToolResult, toToolResponseContextView } from './utils/normalizeToolResult';
export { executeToolWithEnvelope } from './utils/executeToolWithEnvelope';
export type {
  AIMutation,
  ToolMutationResult,
  AISurfaceDefinition,
  AISurfaceSnapshot,
} from './types/aiSurface';
