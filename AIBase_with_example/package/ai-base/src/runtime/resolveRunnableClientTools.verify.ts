/**
 * resolveRunnableClientToolNames / assertRunnableClientTool 回归
 * node --import tsx src/runtime/resolveRunnableClientTools.verify.ts
 */
import assert from 'node:assert/strict';
import {
  registerFunctionCall,
  unregisterFunctionCall,
  clearFunctionCalls,
} from '../registry/functionRegistry';
import {
  ensureFunctionRegistryContractSource,
  resetFunctionRegistryContractSourceForTests,
} from '../registry/toolContractRegistry';
import {
  resolveRunnableClientToolNames,
  assertRunnableClientTool,
} from './resolveRunnableClientTools';
import { beginTurn } from '../registry/agentPlanState';

resetFunctionRegistryContractSourceForTests();
clearFunctionCalls();
ensureFunctionRegistryContractSource();

registerFunctionCall({
  name: 'bizdata_list_entity_summaries',
  description: 'list',
  parameters: { type: 'object', properties: { codePrefix: { type: 'string' } } },
  handler: async () => ({ items: [] }),
});

// 授权含 http_request（无 client handler）+ 业务 Tool → 名单不含 http_request
{
  const { toolNames } = resolveRunnableClientToolNames(
    new Set(['http_request', 'bizdata_list_entity_summaries']),
  );
  assert.deepEqual(toolNames, ['bizdata_list_entity_summaries']);
  assert.equal(toolNames.includes('http_request'), false);
}

// 空授权 → 回退全部已注册 client
{
  const { toolNames } = resolveRunnableClientToolNames(new Set());
  assert.ok(toolNames.includes('bizdata_list_entity_summaries'));
  assert.equal(toolNames.includes('http_request'), false);
}

// subagent 越权拦截
{
  const end = beginTurn({
    plan: [],
    toolOutcomes: [],
    invokedToolNames: new Set(),
    availableToolNames: new Set(['bizdata_list_entity_summaries']),
  });
  assert.doesNotThrow(() =>
    assertRunnableClientTool('bizdata_list_entity_summaries', new Set(['bizdata_list_entity_summaries'])),
  );
  assert.throws(
    () => assertRunnableClientTool('apiservice_list_services', new Set(['bizdata_list_entity_summaries'])),
    /未授权/,
  );
  end();
}

unregisterFunctionCall('bizdata_list_entity_summaries');
resetFunctionRegistryContractSourceForTests();
clearFunctionCalls();

console.log('resolveRunnableClientTools.verify.ts: all assertions passed');
