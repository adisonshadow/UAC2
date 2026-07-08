import { registerUacTools } from '@/pages/MemberOrg/ai/registerUacTools';
import { registerAibaseAdminTools } from '@/pages/AIManagement/ai/registerAibaseAdminTools';
import { registerProviderModelTools } from '@/pages/AIManagement/ai/registerProviderModelTools';
import { registerApiServiceTools } from '@/pages/ApiServices/ai/registerApiServiceTools';
import { registerBizDataTools } from '@/pages/BusinessData/ai/registerBizDataTools';
import { registerCollectionPipelineTools } from '@/pages/BusinessData/ai/registerCollectionPipelineTools';
import { registerMetricsTools } from '@/pages/BusinessData/ai/registerMetricsTools';
import { registerMaterializationTools } from '@/pages/BusinessData/ai/registerMaterializationTools';
import { registerMetadataTools } from '@/pages/BusinessData/ai/registerMetadataTools';
import { useEffect } from 'react';

let clientToolHandlersRegistered = false;

/**
 * 应用启动时注册 client 类型 Tool 的执行实现（handler）。
 * 可用 Tool 由已加载 Skill 的关联 Tool 决定；此处仅提供 executionType=client 时的运行时代码。
 */
export default function AIChatClientToolsRegistrar() {
  useEffect(() => {
    if (clientToolHandlersRegistered) return;
    registerAibaseAdminTools();
    registerProviderModelTools();
    registerBizDataTools();
    registerMaterializationTools();
    registerMetadataTools();
    registerCollectionPipelineTools();
    registerMetricsTools();
    registerApiServiceTools();
    registerUacTools();
    clientToolHandlersRegistered = true;
  }, []);

  return null;
}
