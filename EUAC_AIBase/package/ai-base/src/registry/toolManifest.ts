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

export function mergeOpenAITools(apiTools: OpenAIToolDefinition[] = [], clientTools: OpenAIToolDefinition[] = []) {
  const map = new Map<string, OpenAIToolDefinition>();
  apiTools.forEach((tool) => map.set(tool.function.name, tool));
  clientTools.forEach((tool) => map.set(tool.function.name, tool));
  return Array.from(map.values());
}
