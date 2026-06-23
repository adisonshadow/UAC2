import type {
  AIBaseClientOptions,
  AIBaseModelInfo,
  AIBaseScope,
  AIBaseSkill,
  AIBaseTool,
  ToolInvokeResult,
} from '../types';

function resolveBaseUrl(baseUrl?: string) {
  return (baseUrl || '/api').replace(/\/$/, '');
}

export class AIBaseClient {
  private baseUrl: string;
  private getToken: () => string | null;

  constructor(options: AIBaseClientOptions = {}) {
    this.baseUrl = resolveBaseUrl(options.baseUrl);
    this.getToken = options.getToken || (() => localStorage.getItem('token'));
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers as HeadersInit);
    headers.set('Content-Type', 'application/json');
    const token = this.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const json = await response.json();
    if (!response.ok || json.error) {
      throw new Error(json.error?.message || json.message || `Request failed: ${response.status}`);
    }
    return json as T;
  }

  async listModels(): Promise<AIBaseModelInfo[]> {
    const res = await this.request<{ data: AIBaseModelInfo[] }>('/v1/ai/models');
    return res.data || [];
  }

  async getCapabilities() {
    const res = await this.request<{ data: Record<string, unknown> }>('/v1/ai/capabilities');
    return res.data;
  }

  async getScopeTools(scopeSlug: string): Promise<{ scope: AIBaseScope; tools: AIBaseTool[] }> {
    const res = await this.request<{ data: { scope: AIBaseScope; tools: AIBaseTool[] } }>(
      `/v1/ai/scopes/${encodeURIComponent(scopeSlug)}/tools`,
    );
    return res.data;
  }

  async loadSkill(skillSlug: string): Promise<AIBaseSkill> {
    const res = await this.request<{ data: AIBaseSkill }>(
      `/v1/ai/skills/${encodeURIComponent(skillSlug)}`,
    );
    return res.data;
  }

  async invokeServerTool(functionName: string, args: Record<string, unknown>): Promise<ToolInvokeResult> {
    const res = await this.request<{ data: ToolInvokeResult }>('/v1/ai/tools/invoke', {
      method: 'POST',
      body: JSON.stringify({ functionName, arguments: args }),
    });
    return res.data;
  }
}
