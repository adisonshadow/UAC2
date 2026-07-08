import { readAllAISurfaces } from './aiSurfaceRegistry';
import { registerFunctionCall, unregisterFunctionCall } from './functionRegistry';

const BUILTIN_TOOL_NAME = 'aibase_read_surfaces';

export function registerBuiltinTools(): void {
  registerFunctionCall({
    name: BUILTIN_TOOL_NAME,
    description: '读取当前页面已注册的 AI Surface 快照（选中实体、表单状态等页面上下文）',
    parameters: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: '可选，按 domain 过滤，如 bizdata、aibase',
        },
        surfaceId: {
          type: 'string',
          description: '可选，指定 Surface id',
        },
      },
    },
    handler: async (args) => {
      let snapshots = await readAllAISurfaces();
      const domain = args.domain as string | undefined;
      const surfaceId = args.surfaceId as string | undefined;
      if (domain) {
        snapshots = snapshots.filter((item) => item.domain === domain);
      }
      if (surfaceId) {
        snapshots = snapshots.filter((item) => item.id === surfaceId);
      }
      return { surfaces: snapshots, count: snapshots.length };
    },
  });
}

export function unregisterBuiltinTools(): void {
  unregisterFunctionCall(BUILTIN_TOOL_NAME);
}
