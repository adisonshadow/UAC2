import { getFunctionCallDef } from '../registry/functionRegistry';
import type { AIBaseTool } from '../types';

const FALLBACK_DISPLAY_NAMES: Record<string, string> = {
  aibase_read_surfaces: '读取页面 Surface',
  aibase_list_scopes: '列出 Scope',
  aibase_get_scope: '获取 Scope 详情',
  aibase_create_scope: '创建 Scope',
  aibase_update_scope: '更新 Scope',
  aibase_list_tools: '列出 Tool',
  aibase_get_tool: '获取 Tool 详情',
  aibase_create_tool: '创建 Tool',
  aibase_update_tool: '更新 Tool',
  aibase_list_skills: '列出 Skill',
  aibase_get_skill: '获取 Skill 详情',
  aibase_create_skill: '创建 Skill',
  aibase_update_skill: '更新 Skill',
  aibase_list_providers: '列出 AI 服务商',
  aibase_get_provider: '获取 AI 服务商',
  aibase_create_provider: '创建 AI 服务商',
  aibase_update_provider: '更新 AI 服务商',
  aibase_delete_provider: '停用 AI 服务商',
  aibase_list_models: '列出 AI 模型',
  aibase_get_model: '获取 AI 模型',
  aibase_create_model: '创建 AI 模型',
  aibase_update_model: '更新 AI 模型',
  aibase_delete_model: '停用 AI 模型',
  bizdata_list_entities: '列出实体',
  bizdata_get_entity: '获取实体详情',
  bizdata_create_entity: '创建实体',
  bizdata_update_entity: '更新实体',
  bizdata_delete_entity: '删除实体',
  bizdata_create_enum: '创建枚举',
  bizdata_list_relations: '列出实体关系',
  bizdata_add_relation: '添加实体关系',
  bizdata_delete_relation: '删除实体关系',
  bizdata_upsert_entity_indexes: '更新实体索引',
  bizdata_validate_model: '校验模型',
  bizdata_preview_materialization: '物化预览',
  bizdata_execute_materialization: '执行物化',
  bizdata_list_materialization_runs: '物化历史',
  bizdata_get_materialization_status: '物化状态',
  bizdata_browse_materialized_schema: '浏览物化表结构',
  bizdata_browse_materialized_rows: '浏览物化表数据',
  bizdata_insert_mock_data: '插入MOCK数据',
  bizdata_list_data_standards: '列出数据标准',
  bizdata_create_data_standard: '创建数据标准',
  bizdata_update_data_standard: '更新数据标准',
  bizdata_delete_data_standard: '删除数据标准',
  bizdata_list_metadata_tables: '列出元数据表',
  bizdata_get_metadata_table: '获取元数据表',
  bizdata_get_metadata_by_target: '按 target 获取元数据',
  bizdata_upsert_metadata_table: '保存元数据表',
  bizdata_update_metadata_table: '更新元数据表',
  bizdata_upsert_metadata_field: '保存元数据字段',
  bizdata_update_metadata_fields: '批量更新元数据字段',
  bizdata_sync_metadata_from_schema: '同步元数据骨架',
  apiservice_create_service: '创建 API 服务',
  apiservice_create_services_batch: '批量创建 API 服务',
  apiservice_list_services: '列出 API 服务',
  apiservice_get_service: '获取 API 服务',
  apiservice_publish_service: '发布 API 服务',
  apiservice_run_test: '测试 API 服务',
  apiservice_update_service: '更新 API 服务',
  apiservice_delete_service: '删除 API 服务',
};

/** 将 functionName 解析为界面展示用中文名称 */
export function resolveToolDisplayName(functionName: string, tools: AIBaseTool[]): string {
  const meta = tools.find((tool) => tool.functionName === functionName);
  if (meta?.name?.trim()) return meta.name.trim();

  const fallback = FALLBACK_DISPLAY_NAMES[functionName];
  if (fallback) return fallback;

  const localDef = getFunctionCallDef(functionName);
  if (localDef?.description?.trim()) {
    const text = localDef.description.trim();
    return text.length > 24 ? `${text.slice(0, 24)}…` : text;
  }

  return functionName;
}
