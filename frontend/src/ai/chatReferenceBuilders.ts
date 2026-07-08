import type { AddReferenceParams } from '@EADAF/ai-base';

/** 通用：按 code 分层 Scope 节点引用 */
export function buildCodeScopeReference(code: string, name?: string): AddReferenceParams {
  return {
    type: 'scope',
    label: name || code || 'Scope',
    content: { code, name: name || code },
    unique: false,
  };
}

export function buildUserReference(user: {
  user_id?: string;
  username?: string;
  name?: string;
  email?: string;
  department_id?: string;
  status?: string;
}): AddReferenceParams {
  const label = user.name || user.username || user.user_id || '用户';
  return {
    type: 'user',
    label,
    content: {
      userId: user.user_id,
      username: user.username,
      name: user.name,
      email: user.email,
      departmentId: user.department_id,
      status: user.status,
    },
    unique: true,
  };
}

export function buildRoleReference(role: {
  role_id?: string;
  role_name?: string;
  code?: string;
  description?: string;
  status?: string;
}): AddReferenceParams {
  const label = role.role_name || role.code || role.role_id || '角色';
  return {
    type: 'role',
    label,
    content: {
      roleId: role.role_id,
      roleName: role.role_name,
      code: role.code,
      description: role.description,
      status: role.status,
    },
    unique: true,
  };
}

export function buildDepartmentReference(dept: {
  department_id?: string;
  name?: string;
  parent_id?: string;
}): AddReferenceParams {
  const label = dept.name || dept.department_id || '部门';
  return {
    type: 'department',
    label,
    content: {
      departmentId: dept.department_id,
      name: dept.name,
      parentId: dept.parent_id,
    },
    unique: true,
  };
}

export function buildPermissionReference(permission: {
  permission_id?: string;
  code?: string;
  description?: string;
  resource_type?: string;
  actions?: string[];
  status?: string;
}): AddReferenceParams {
  const label = permission.code || permission.description || permission.permission_id || '权限';
  return {
    type: 'permission',
    label,
    content: {
      permissionId: permission.permission_id,
      code: permission.code,
      description: permission.description,
      resourceType: permission.resource_type,
      actions: permission.actions,
      status: permission.status,
    },
    unique: true,
  };
}

export function buildApplicationReference(app: {
  application_id?: string;
  name?: string;
  code?: string;
  status?: string;
  api_enabled?: boolean;
  sso_enabled?: boolean;
}): AddReferenceParams {
  const label = app.name || app.code || app.application_id || '应用';
  return {
    type: 'application',
    label,
    content: {
      applicationId: app.application_id,
      name: app.name,
      code: app.code,
      status: app.status,
      apiEnabled: app.api_enabled,
      ssoEnabled: app.sso_enabled,
    },
    unique: true,
  };
}

export function buildApiServiceReference(service: {
  id?: string;
  code?: string;
  name?: string;
  routePath?: string;
  status?: string;
  entityCode?: string;
  tags?: string[];
}): AddReferenceParams {
  const label = service.name || service.code || service.id || 'API 服务';
  return {
    type: 'api-service',
    label,
    content: {
      id: service.id,
      code: service.code,
      name: service.name,
      routePath: service.routePath,
      status: service.status,
      entityCode: service.entityCode,
      tags: service.tags,
    },
    unique: true,
  };
}

export function buildStorageObjectReference(object: API.StorageObject): AddReferenceParams {
  const label = object.name || object.objectId || '文件';
  return {
    type: 'storage-object',
    label,
    content: {
      objectId: object.objectId,
      name: object.name,
      mimeType: object.mimeType,
      size: object.size,
      relativePath: object.relativePath,
      bucketId: object.bucketId,
      bucketCode: object.bucket?.code,
      bucketName: object.bucket?.name,
      applicationId: object.applicationId,
    },
    unique: true,
  };
}

export function buildStorageBucketReference(bucket: {
  bucketId?: string;
  code?: string;
  name?: string;
  accessMode?: string;
  status?: string;
  applicationId?: string;
}): AddReferenceParams {
  const label = bucket.name || bucket.code || bucket.bucketId || 'Bucket';
  return {
    type: 'storage-bucket',
    label,
    content: {
      bucketId: bucket.bucketId,
      code: bucket.code,
      name: bucket.name,
      accessMode: bucket.accessMode,
      status: bucket.status,
      applicationId: bucket.applicationId,
    },
    unique: true,
  };
}

export function buildAIScopeReference(scope: {
  id?: string;
  slug?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}): AddReferenceParams {
  const label = scope.name || scope.slug || scope.id || 'AI Scope';
  return {
    type: 'ai-scope',
    label,
    content: {
      id: scope.id,
      slug: scope.slug,
      name: scope.name,
      description: scope.description,
      isActive: scope.isActive,
    },
    unique: true,
  };
}

export function buildAISkillListReference(skill: {
  id?: string;
  slug?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}): AddReferenceParams {
  const label = skill.name || skill.slug || skill.id || 'Skill';
  return {
    type: 'ai-skill',
    label,
    content: {
      id: skill.id,
      slug: skill.slug,
      name: skill.name,
      description: skill.description,
      isActive: skill.isActive,
    },
    unique: true,
  };
}

export function buildAIToolReference(tool: {
  id?: string;
  slug?: string;
  name?: string;
  functionName?: string;
  executionType?: string;
  isActive?: boolean;
}): AddReferenceParams {
  const label = tool.name || tool.functionName || tool.slug || tool.id || 'Tool';
  return {
    type: 'ai-tool',
    label,
    content: {
      id: tool.id,
      slug: tool.slug,
      name: tool.name,
      functionName: tool.functionName,
      executionType: tool.executionType,
      isActive: tool.isActive,
    },
    unique: true,
  };
}

export function buildAIProviderReference(provider: {
  id?: string;
  name?: string;
  slug?: string;
  providerType?: string;
  isActive?: boolean;
}): AddReferenceParams {
  const label = provider.name || provider.slug || provider.id || 'AI 服务商';
  return {
    type: 'ai-provider',
    label,
    content: {
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      providerType: provider.providerType,
      isActive: provider.isActive,
    },
    unique: true,
  };
}

export function buildAIModelReference(model: {
  id?: string;
  name?: string;
  displayName?: string;
  modelId?: string;
  slug?: string;
  providerId?: string;
  isActive?: boolean;
}): AddReferenceParams {
  const label = model.displayName || model.name || model.slug || model.modelId || model.id || 'AI 模型';
  return {
    type: 'ai-model',
    label,
    content: {
      id: model.id,
      name: model.name,
      displayName: model.displayName,
      slug: model.slug,
      modelId: model.modelId,
      providerId: model.providerId,
      isActive: model.isActive,
    },
    unique: true,
  };
}

export function buildDataStandardReference(standard: API.BizdataDataStandard): AddReferenceParams {
  const label = standard.name || standard.code || standard.id || '数据标准';
  return {
    type: 'data-standard',
    label,
    content: {
      id: standard.id,
      name: standard.name,
      code: standard.code,
      version: standard.version,
      description: standard.description,
      status: standard.status,
    },
    unique: true,
  };
}

export function buildMetricReference(metric: API.BizdataMetric): AddReferenceParams {
  const label = metric.label || metric.code || metric.id || '指标';
  return {
    type: 'metric',
    label,
    content: {
      id: metric.id,
      code: metric.code,
      label: metric.label,
      metricType: metric.metricType,
      computeMode: metric.computeMode,
      scheduleType: metric.scheduleType,
      status: metric.status,
      lastValue: metric.lastValue,
    },
    unique: true,
  };
}

export function buildMetadataTableReference(table: API.BizdataMetadataTable): AddReferenceParams {
  const label = table.code || table.metadataCode || table.id || '元数据';
  return {
    type: 'metadata-table',
    label,
    content: {
      id: table.id,
      code: table.code,
      targetType: table.targetType,
      targetId: table.targetId,
      metadataCode: table.metadataCode,
      standardId: table.standardId,
      businessMeaning: table.businessMeaning,
      status: table.status,
    },
    unique: true,
  };
}
