import type { AIBaseTool, OpenAIToolDefinition } from '../types';

export function buildToolManifest(tools: AIBaseTool[] = []) {
  return tools.map((tool) => ({
    id: tool.id,
    functionName: tool.functionName,
    executionType: tool.executionType,
    openaiTool: tool.openaiTool || toOpenAIToolFromMeta(tool),
  }));
}

export function toOpenAIToolFromMeta(tool: AIBaseTool): OpenAIToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.functionName,
      description: tool.description || tool.name,
      parameters: tool.parametersSchema || { type: 'object', properties: {} },
    },
  };
}

export function mergeOpenAITools(
  skillTools: OpenAIToolDefinition[] = [],
  localTools: OpenAIToolDefinition[] = [],
) {
  const map = new Map<string, OpenAIToolDefinition>();
  skillTools.forEach((tool) => map.set(tool.function.name, tool));
  // 本地 client Tool 注册含完整 parameters，覆盖 DB 中可能过时的 schema
  localTools.forEach((tool) => {
    map.set(tool.function.name, tool);
  });
  return Array.from(map.values());
}
