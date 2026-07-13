import { registerSkillCompletionPolicy } from '@EADAF/ai-base';

/**
 * EADAF 业务 Skill 的声明式 auto-continue 策略注册。
 *
 * 取代历史版本中 SDK 内部硬编码的 bizdata/apiservice 正则与工具名集合。
 * 仅声明「哪些 Tool 必须调用、什么文本算任务完成、什么文本禁止续调」，
 * 具体的「模型是否只说不做、是否需要续调」判定由 SDK 通用框架执行。
 *
 * 在 AIChatClientToolsRegistrar 启动时调用一次即可。
 */
export function registerEadafSkillCompletionPolicies(): void {
  // 业务建模：完成前必须跑过 bizdata_validate_model；Scope 调整须用 rename 而非 delete+create
  registerSkillCompletionPolicy('bizdata-model-design', {
    requiredTools: ['bizdata_validate_model'],
    completionKeywords: [
      '建模完成',
      '校验通过',
      '任务完成',
      '全部实体',
      '每个实体',
      '本阶段',
      '当前阶段',
    ],
    blockKeywords: [
      '删除重建',
      'delete + create',
      'delete+create',
      '接下来您可以',
      '建议您',
      '可选操作',
    ],
  });

  // 物化：完成前必须执行过 bizdata_execute_materialization
  registerSkillCompletionPolicy('bizdata-materialization', {
    requiredTools: ['bizdata_execute_materialization'],
    completionKeywords: [
      '物化完成',
      '物化成功',
      '执行成功',
      '已完成物化',
      '本阶段',
      '当前阶段',
    ],
  });

  // MOCK 数据：仅当这是主 Skill 时，"提到 MOCK 但未调用" 才续调。
  // 这里仅声明 requiredTools；是否触发续调由 SDK 在"模型只输出文本"时统一判定。
  registerSkillCompletionPolicy('bizdata-mock-data', {
    requiredTools: ['bizdata_insert_mock_data'],
  });

  // API 服务 - 创建：关键写操作必须真正调用过
  registerSkillCompletionPolicy('bizdata-api-service-create', {
    requiredTools: ['apiservice_create_service'],
    completionKeywords: ['已发布', '发布成功', '创建成功', '已成功创建'],
  });

  // API 服务 - 管理：测试/发布等关键操作须有调用证据
  registerSkillCompletionPolicy('bizdata-api-service-manage', {
    requiredTools: ['apiservice_run_test'],
    completionKeywords: ['测试通过', '测试成功', '发布成功'],
  });

  // API 服务 - test-fix 循环：连续执行型，不受「一次一事」限制
  registerSkillCompletionPolicy('bizdata-api-service-test-fix', {
    continuousExecution: true,
    blockKeywords: ['接下来您可以', '建议您', '可选操作', '如需继续'],
  });
}
