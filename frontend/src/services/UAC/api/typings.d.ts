declare namespace API {
  /** Per-model 限流配置（可留空，留空表示不限流） */
  type ModelRateLimit = {
    maxConcurrent?: number | null;
    requestsPerMinute?: number | null;
  };

  type AdminAiModel = {
    id?: string;
    providerId?: string;
    slug?: string;
    modelId?: string;
    displayName?: string;
    defaultParams?: Record<string, any>;
    rateLimit?: ModelRateLimit | null;
    capabilities?: string[];
    inputTags?: string[];
    outputTags?: string[];
    isActive?: boolean;
  };

  type AdminProvider = {
    id?: string;
    name?: string;
    slug?: string;
    baseUrl?: string;
    apiKeySet?: boolean;
    adapterType?: string;
    isActive?: boolean;
  };

  type AIBaseErrorResponse = {
    error?: { code?: string; message?: string; traceId?: string };
  };

  type APIConnectConfig = {
    /** 应用API私钥（由服务端生成） */
    app_secret?: string;
    /** 签名盐值（旧版兼容，新版统一密钥不再依赖） */
    salt?: string;
  };

  type APIDataScope = {
    /** 已授权 API 域 code（冒号分层前缀） */
    domainCodes?: string[];
    /** 已授权的具体 API 服务 code */
    serviceCodes?: string[];
  };

  type BuiltinApiScope = {
    /** 可访问内置 API 的清单 code（业务域:资源[:动作]） */
    permissionCodes?: string[];
  };

  type Application = {
    /** 应用ID */
    application_id?: string;
    /** 应用全称 */
    name?: string;
    /** 缩写简称 */
    code?: string;
    /** 应用 Logo URL */
    logo_url?: string;
    /** 应用状态 */
    status?: 'ACTIVE' | 'DISABLED';
    /** 是否启用SSO */
    sso_enabled?: boolean;
    sso_config?: SSOConfig;
    /** 是否启用API服务 */
    api_enabled?: boolean;
    api_connect_config?: APIConnectConfig;
    api_data_scope?: APIDataScope;
    /** 可访问内置 API 授权 */
    builtin_api_scope?: BuiltinApiScope;
    /** 业务数据 Scope 编码列表 */
    bizdata_scope_codes?: string[];
    /** 应用描述 */
    description?: string;
    /** 创建时间 */
    created_at?: string;
    /** 更新时间 */
    updated_at?: string;
    /** 删除时间 */
    deleted_at?: string;
  };

  type Captcha = {
    captcha_id?: string;
    target_position?: { x?: number; y?: number };
    image?: string;
    created_at?: string;
    expires_at?: string;
  };

  type deleteAdminModelsIdParams = {
    id: string;
  };

  type deleteAdminProvidersIdParams = {
    id: string;
  };

  type deleteApplicationsIdParams = {
    /** 应用ID */
    id: string;
  };

  type deleteDepartmentsDepartmentIdParams = {
    /** 部门ID */
    department_id: string;
  };

  type deletePermissionsPermissionIdParams = {
    /** 权限ID */
    permission_id: any;
  };

  type deleteRolesRoleIdParams = {
    /** 角色ID */
    role_id: any;
  };

  type deleteUploadsFileIdParams = {
    /** 文件ID */
    file_id: string;
  };

  type deleteUsersUserIdParams = {
    /** 用户ID */
    user_id: string;
  };

  type Department = {
    /** 部门ID */
    department_id?: string;
    /** 部门名称 */
    name?: string;
    /** 部门编码 */
    code?: string;
    /** 父部门ID */
    parent_id?: string;
    /** 部门状态 */
    status?: 'ACTIVE' | 'DISABLED';
    /** 部门描述 */
    description?: string;
    /** 创建时间 */
    created_at?: string;
    /** 更新时间 */
    updated_at?: string;
    /** 部门主管ID */
    manager_id?: string;
    /** 删除时间（软删除） */
    deleted_at?: string;
    manager?: User;
    parent?: Department;
    /** 子部门列表 */
    children?: Department[];
    /** 组织绑定的角色 */
    roles?: Role[];
    /** 组织绑定的角色ID */
    role_ids?: string[];
  };

  type DepartmentTreeItem = {
    /** 部门ID */
    department_id?: string;
    /** 部门名称 */
    name?: string;
    /** 部门描述 */
    description?: string;
    /** 父部门ID */
    parent_id?: string;
    /** 部门状态 */
    status?: 'ACTIVE' | 'DISABLED';
    /** 创建时间 */
    created_at?: string;
    /** 更新时间 */
    updated_at?: string;
    /** 子部门列表 */
    children?: DepartmentTreeItem[];
  };

  type Error = {
    code?: number;
    message?: string;
    data?: Record<string, any>;
  };

  type File = {
    id?: string;
    filename?: string;
    originalname?: string;
    mimetype?: string;
    size?: number;
    path?: string;
    created_at?: string;
    updated_at?: string;
  };

  type getAdminModelsIdParams = {
    id: string;
  };

  type getAdminModelsParams = {
    page?: number;
    size?: number;
    providerId?: string;
    isActive?: boolean;
  };

  type getAdminProvidersIdParams = {
    id: string;
  };

  type getAdminProvidersParams = {
    page?: number;
    size?: number;
    isActive?: boolean;
  };

  type getApplicationsIdParams = {
    /** 应用ID */
    id: string;
  };

  type getApplicationsParams = {
    /** 页码（当 size 不为 -1 时有效） */
    page?: number;
    /** 每页数量，设置为 -1 时返回所有记录不分页 */
    size?: number;
    /** 应用全称（支持模糊匹配） */
    name?: string;
    /** 应用编码（支持模糊匹配） */
    code?: string;
    /** 应用状态 */
    status?: 'ACTIVE' | 'DISABLED';
  };

  type getApplicationsSsoIdParams = {
    /** 应用ID */
    id: string;
  };

  type getAuthCheckParams = {
    /** 应用ID，用于SSO模式下的token验证

**使用场景**：
- 第三方系统需要验证特定应用的token
- 使用应用特定的salt进行JWT验证

**注意事项**：
- 应用必须已启用SSO功能
- 应用必须配置有效的salt
- 不传此参数时使用默认JWT密钥验证
 */
    app?: string;
  };

  type getDepartmentsDepartmentIdParams = {
    /** 部门ID */
    department_id: string;
  };

  type getDepartmentsDepartmentIdUsersParams = {
    /** 部门ID */
    department_id: string;
    /** 是否包含子部门的用户 */
    include_children?: boolean;
  };

  type getDepartmentsParams = {
    /** 页码（当 size 不为 -1 时有效） */
    page?: number;
    /** 每页数量，设置为 -1 时返回所有记录不分页 */
    size?: number;
    /** 部门名称（支持模糊匹配） */
    name?: string;
    /** 部门编码（支持模糊匹配） */
    code?: string;
    /** 部门状态 */
    status?: 'ACTIVE' | 'DISABLED';
  };

  type getPermissionsCheckParams = {
    /** 用户ID */
    user_id: any;
    /** 资源类型 */
    resource_type: any;
    /** 操作类型，多个操作类型用逗号分隔，例如：create,read,update */
    action: any;
  };

  type getPermissionsParams = {
    /** 页码（当 size 不为 -1 时有效） */
    page?: number;
    /** 每页数量，设置为 -1 时返回所有记录不分页 */
    size?: number;
    /** 权限名称（支持模糊匹配） */
    name?: string;
    /** 权限编码（支持模糊匹配） */
    code?: string;
    /** 权限类型 */
    type?: 'MENU' | 'BUTTON' | 'API';
    /** 权限状态 */
    status?: 'ACTIVE' | 'DISABLED';
  };

  type getPermissionsPermissionIdParams = {
    /** 权限ID */
    permission_id: string;
  };

  type getPermissionsUsersUserIdParams = {
    /** 用户ID */
    user_id: any;
  };

  type getRolesCheckPermissionParams = {
    /** 权限编码 */
    permission_code: any;
  };

  type getRolesParams = {
    /** 页码（当 size 不为 -1 时有效） */
    page?: number;
    /** 每页数量，设置为 -1 时返回所有记录不分页 */
    size?: number;
    /** 角色名称（支持模糊匹配） */
    name?: string;
    /** 角色编码（支持模糊匹配） */
    code?: string;
    /** 角色状态 */
    status?: 'ACTIVE' | 'DISABLED';
  };

  type getRolesRoleIdParams = {
    /** 角色ID */
    role_id: any;
  };

  type getUploadsFileIdParams = {
    /** 文件ID */
    file_id: string;
  };

  type getUploadsImagesFileIdParams = {
    /** 文件ID */
    file_id: string;
    /** 图片宽度 */
    width?: number;
    /** 图片高度 */
    height?: number;
    /** 图片质量（1-100） */
    quality?: number;
    /** 输出格式 */
    format?: 'jpeg' | 'jpg' | 'png' | 'webp' | 'gif';
  };

  type getUsersParams = {
    /** 页码 */
    page?: number;
    /** 每页数量 */
    size?: number;
    /** 用户名（支持模糊匹配） */
    username?: string;
    /** 姓名（支持模糊匹配） */
    name?: string;
    /** 邮箱（支持模糊匹配） */
    email?: string;
    /** 电话（支持模糊匹配） */
    phone?: string;
    /** 用户状态 */
    status?: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
    /** 性别 */
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    /** 部门ID */
    department_id?: string;
    /** 用户ID（精确匹配） */
    user_id?: string;
  };

  type getUsersUserIdParams = {
    /** 用户ID */
    user_id: string;
  };

  type ModelInfo = {
    slug?: string;
    displayName?: string;
    capabilities?: string[];
    inputTags?: string[];
    outputTags?: string[];
    defaultParams?: Record<string, any>;
  };

  type patchAdminModelsIdParams = {
    id: string;
  };

  type patchAdminProvidersIdParams = {
    id: string;
  };

  type Permission = {
    /** 权限ID */
    permission_id?: string;
    /** 权限名称 */
    name?: string;
    /** 权限编码 */
    code?: string;
    /** 权限描述 */
    description?: string;
    /** 资源类型 */
    resource_type?: 'MENU' | 'BUTTON' | 'API';
    /** 操作类型列表 */
    actions?: ('create' | 'read' | 'update' | 'delete')[];
    /** 父权限ID */
    parent_id?: string;
    /** 权限状态 */
    status?: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
    /** 创建时间 */
    created_at?: string;
    /** 更新时间 */
    updated_at?: string;
    /** 删除时间（软删除） */
    deleted_at?: string;
  };

  type postApplicationsIdGenerateSecretParams = {
    /** 应用ID */
    id: string;
  };

  type postPermissionsPermissionIdRolesParams = {
    /** 权限ID */
    permission_id: any;
  };

  type postRolesRoleIdPermissionsParams = {
    /** 角色ID */
    role_id: any;
  };

  type postUploadsParams = {
    /** 文件类型，默认为配置中的默认类型 */
    type?: 'image' | 'document' | 'video' | 'audio';
  };

  type postUsersUserIdAvatarParams = {
    /** 用户ID */
    user_id: any;
  };

  type postUsersUserIdChangePasswordParams = {
    /** 用户ID */
    user_id: string;
  };

  type postUsersUserIdRestoreParams = {
    /** 用户ID */
    user_id: any;
  };

  type putApplicationsIdParams = {
    /** 应用ID */
    id: string;
  };

  type putDepartmentsDepartmentIdParams = {
    /** 部门ID */
    department_id: string;
  };

  type putPermissionsPermissionIdParams = {
    /** 权限ID */
    permission_id: string;
  };

  type putRolesRoleIdParams = {
    /** 角色ID */
    role_id: any;
  };

  type putRolesRoleIdPermissionsParams = {
    /** 角色ID */
    role_id: any;
  };

  type putUsersUserIdParams = {
    /** 用户ID */
    user_id: string;
  };

  type putUsersUserIdRolesParams = {
    /** 用户ID */
    user_id: string;
  };

  type putUsersUserIdStatusParams = {
    /** 用户ID */
    user_id: any;
  };

  type Role = {
    /** 角色ID */
    role_id?: string;
    /** 角色名称 */
    role_name?: string;
    /** 角色编码 */
    code?: string;
    /** 角色描述 */
    description?: string;
    /** 角色状态 */
    status?: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
    /** 创建时间 */
    created_at?: string;
    /** 更新时间 */
    updated_at?: string;
    /** 删除时间 */
    deleted_at?: string;
    /** 角色权限列表 */
    permissions?: Permission[];
  };

  type RoleListResponse = {
    code?: number;
    message?: string;
    data?: { total?: number; items?: Role[]; page?: number; size?: number };
  };

  type RolePermission = {
    /** 权限ID */
    permission_id?: string;
    /** 权限名称 */
    name?: string;
    /** 权限编码 */
    code?: string;
    /** 资源类型 */
    resource_type?: 'MENU' | 'BUTTON' | 'API';
    /** 操作类型列表 */
    actions?: ('create' | 'read' | 'update' | 'delete')[];
  };

  type RoleResponse = {
    code?: number;
    message?: string;
    data?: Role;
  };

  type SSOConfig = {
    /** SSO使用的协议 */
    protocol: 'OIDC';
    /** SSO回调地址 */
    redirect_uri: string;
    /** SSO签名盐值，用于JWT签名（旧版兼容） */
    salt?: string;
    /** 基于currenttime、salt，使用 bcrypt 生成的Hash值 */
    secret?: string;
    /** 当前时间戳， 用于生成secret */
    currentTimestamp?: number;
    /** SSO跳转模式
- POST_REDIRECT: POST跳转（默认）
- HEADER_REDIRECT: 302重定向+URL参数
 */
    redirect_mode?: 'POST_REDIRECT' | 'HEADER_REDIRECT';
    /** SSO系统的基础URL */
    base_url?: string;
    /** OIDC客户端ID */
    client_id?: string;
    /** OIDC客户端密钥 */
    client_secret?: string;
    /** OIDC发行者URL */
    issuer?: string;
    /** 前端应用URL */
    frontend_url?: string;
    /** SSO 登录页展示的应用 Logo（上传图片 ID 或 URL） */
    logo?: string;
    /** 其他SSO协议特定的参数 */
    additional_params?: Record<string, any>;
  };

  type User = {
    /** 用户ID */
    user_id?: string;
    /** 用户名 */
    username?: string;
    /** 邮箱 */
    email?: string;
    /** 电话 */
    phone?: string;
    /** 用户状态 */
    status?: 'ACTIVE' | 'DISABLED' | 'ARCHIVED';
    /** 创建时间 */
    created_at?: string;
    /** 更新时间 */
    updated_at?: string;
    /** 密码（仅在创建时使用） */
    password?: string;
    /** 姓名 */
    name?: string;
    /** 性别 */
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    /** 头像URL */
    avatar?: string;
    /** 部门ID */
    department_id?: string;
    /** 最后登录时间 */
    last_login_at?: string;
    /** 删除时间（软删除） */
    deleted_at?: string;
    /** 用户角色列表 */
    roles?: Role[];
    /** 直接绑定的角色ID */
    role_ids?: string[];
    /** 组织继承的角色 */
    department_roles?: Role[];
    /** 有效角色（直接 + 组织继承） */
    effective_roles?: Role[];
  };

  type BusinessDataField = {
    id?: string;
    entityId?: string;
    fieldKey?: string;
    columnInfo?: Record<string, any>;
    typeormConfig?: Record<string, any>;
    sortOrder?: number;
  };

  type BusinessDataIndex = {
    id?: string;
    name: string;
    fields: string[];
    unique?: boolean;
    type?: 'btree' | 'hash' | 'gin' | 'gist' | string;
  };

  type BusinessDataEntity = {
    id?: string;
    code?: string;
    label?: string;
    entityKind?: 'er_table' | 'json_schema';
    tableName?: string;
    status?: 'enabled' | 'disabled' | 'archived';
    isLocked?: boolean;
    version?: number;
    entityInfo?: Record<string, any> & { modelValidated?: boolean };
    jsonSchema?: Record<string, any>;
    layout?: Record<string, any>;
    fields?: BusinessDataField[];
    createdAt?: string;
    updatedAt?: string;
  };

  type BusinessDataEntityList = {
    total?: number;
    items?: BusinessDataEntity[];
    page?: number;
    size?: number;
  };

  type BusinessDataEnum = {
    id?: string;
    code?: string;
    enumInfo?: Record<string, any>;
    values?: Record<string, any>;
    items?: Record<string, any>;
    createdAt?: string;
    updatedAt?: string;
  };

  type BusinessDataRelation = {
    id?: string;
    type?: string;
    name?: string;
    inverseName?: string;
    fromEntityId?: string;
    toEntityId?: string;
    config?: Record<string, any>;
    fromEntity?: { id?: string; code?: string; label?: string };
    toEntity?: { id?: string; code?: string; label?: string };
  };

  type BusinessDataSchema = {
    entities?: BusinessDataEntity[];
    enums?: BusinessDataEnum[];
    relations?: BusinessDataRelation[];
  };

  type BizdataScopeOption = {
    code: string;
    name: string;
    children?: BizdataScopeOption[];
  };

  type MaterializationPreview = {
    connectionId?: string;
    connectionName?: string;
    dbType?: string;
    targetSchema?: string;
    entities?: Array<{ id: string; code: string; version: number; tableName?: string }>;
    sql?: string;
    generatedCode?: Record<string, string>;
  };

  type MaterializationExecuteResult = {
    run?: MaterializationRun;
    preview?: MaterializationPreview;
    executed?: boolean;
  };

  type MaterializationStatusItem = {
    entityId?: string;
    code?: string;
    label?: string;
    tableName?: string;
    currentVersion?: number;
    materializedVersion?: number | null;
    isStale?: boolean;
    staleStatus?: 'not_materialized' | 'latest' | 'stale';
    lastMaterializedAt?: string | null;
    connectionId?: string | null;
    connectionName?: string | null;
    dbType?: string | null;
    targetSchema?: string | null;
  };

  type MaterializedTableColumn = {
    name?: string;
    type?: string;
    nullable?: boolean;
    default?: unknown;
    comment?: string;
    primary?: boolean;
    unique?: boolean;
  };

  type MaterializedTableSchema = {
    entityId?: string;
    entityCode?: string;
    entityLabel?: string;
    connectionId?: string;
    connectionName?: string;
    dbType?: string;
    targetSchema?: string;
    tableName?: string;
    columns?: MaterializedTableColumn[];
  };

  type MaterializedTableRowsResult = {
    items?: Record<string, unknown>[];
    total?: number;
    page?: number;
    size?: number;
    entityId?: string;
    entityCode?: string;
    entityLabel?: string;
    connectionId?: string;
    connectionName?: string;
    dbType?: string;
    targetSchema?: string;
    tableName?: string;
  };

  type MaterializedMockDataResult = MaterializedTableRowsResult & {
    inserted?: number;
    ids?: string[];
  };

  type MaterializationRun = {
    id?: string;
    connectionId?: string;
    connectionName?: string;
    dbType?: string;
    targetSchema?: string;
    status?: string;
    sqlPreview?: string;
    generatedCode?: Record<string, string>;
    executedAt?: string;
    errorMessage?: string;
    createdAt?: string;
    entities?: Array<{
      entityId?: string;
      entityVersion?: number;
      tableName?: string;
    }>;
  };

  type MaterializationRunList = {
    total?: number;
    items?: MaterializationRun[];
    page?: number;
    size?: number;
  };

  type DatabaseConnection = {
    id?: string;
    name?: string;
    dbType?: 'postgresql' | 'mongodb' | 'redis';
    host?: string;
    port?: number;
    username?: string;
    passwordSet?: boolean;
    databaseName?: string;
    targetSchema?: string;
    isDefault?: boolean;
    lastTestStatus?: string;
    lastTestedAt?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  type BizdataMetric = {
    id?: string;
    code?: string;
    label?: string;
    description?: string;
    metricType?: 'sql' | 'formula';
    connectionId?: string;
    queryScript?: string;
    formulaConfig?: Record<string, any>;
    computeMode?: 'scheduled' | 'on_demand' | 'both';
  scheduleType?: 'manual' | 'hourly' | 'daily' | 'cron';
  scheduleConfig?: { hour?: number; minute?: number; expression?: string; cron?: string };
    unit?: string;
    category?: string;
    scopeCode?: string;
    status?: 'enabled' | 'disabled';
    lastComputedAt?: string;
    lastValue?: number | null;
    createdAt?: string;
    updatedAt?: string;
  };

  type BizdataMetricList = {
    total?: number;
    items?: BizdataMetric[];
  };

  type BizdataMetricRun = {
    id?: string;
    metricId?: string;
    status?: string;
    triggeredBy?: string;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
    errorMessage?: string;
    rowCount?: number;
    createdAt?: string;
  };

  type BizdataMetricValue = {
    id?: string;
    metricId?: string;
    runId?: string;
    value?: number | null;
    dimensionKey?: string;
    computedAt?: string;
  };

  type BizdataMetricDashboard = {
    categories?: Array<{
      name?: string;
      metrics?: BizdataMetric[];
    }>;
  };

  type CollectionPipelineProtocolType = 'serial' | 'modbus_rtu' | 'modbus_tcp';

  type CollectionPipeline = {
    id?: string;
    code?: string;
    routePath?: string;
    name?: string;
    description?: string;
    status?: 'draft' | 'published' | 'disabled';
    protocolType?: CollectionPipelineProtocolType;
    restrictSources?: boolean;
    sampleData?: string;
    targetStructure?: string;
    parseScript?: string;
    storeScript?: string;
    entityId?: string;
    entityCode?: string;
    connectionId?: string;
    tableName?: string;
    targetSchema?: string;
    basePath?: string;
    scopeCode?: string;
    pipelineSlug?: string;
    applicationIds?: string[];
    version?: number;
    publishedAt?: string;
    createdAt?: string;
    updatedAt?: string;
    entity?: { id?: string; code?: string; label?: string };
    connection?: { id?: string; name?: string; dbType?: string };
  };

  type CollectionPipelineList = {
    total?: number;
    items?: CollectionPipeline[];
    page?: number;
    size?: number;
  };

  type CollectionPipelineTestProfile = {
    pipelineId?: string;
    code?: string;
    name?: string;
    routePath?: string;
    basePath?: string;
    ingestUrl?: string;
    ingestMethod?: string;
    protocolType?: CollectionPipelineProtocolType;
    status?: string;
    sampleData?: string;
    targetStructure?: string;
    parseScript?: string;
    storeScript?: string;
    entityCode?: string;
    entityId?: string;
    tableName?: string;
    targetSchema?: string;
    restrictSources?: boolean;
    applicationIds?: string[];
    authHint?: string;
    bodyHint?: string;
    entity?: { id?: string; code?: string; label?: string };
  };

  type CollectionPipelineTestResult = {
    runId?: string;
    pipelineId?: string;
    code?: string;
    runType?: string;
    inputRaw?: string;
    parseOutput?: Record<string, unknown>;
    storeOutput?: unknown;
    durationMs?: number;
    rolledBack?: boolean;
    status?: string;
  };

  type CollectionPipelineRun = {
    id?: string;
    pipelineId?: string;
    runType?: string;
    inputRaw?: string;
    parseOutput?: Record<string, unknown>;
    storeOutput?: unknown;
    status?: string;
    errorMessage?: string;
    durationMs?: number;
    executedBy?: string;
    sourceApplicationId?: string;
    createdAt?: string;
  };

  type CollectionPipelineRunList = {
    total?: number;
    items?: CollectionPipelineRun[];
    page?: number;
    size?: number;
  };

  type SystemFeatures = {
    metadataEnabled?: boolean;
    apiServiceAllowWriteOperations?: boolean;
    apiServiceTestAutoRollback?: boolean;
  };

  type SystemBackupItem = {
    name?: string;
    path?: string;
    size?: number;
    createdAt?: string;
  };

  type SystemBackupList = {
    backupDir?: string;
    items?: SystemBackupItem[];
  };

  type BizdataDataStandard = {
    id?: string;
    name?: string;
    code?: string;
    version?: string;
    description?: string;
    status?: 'enabled' | 'disabled';
    createdAt?: string;
    updatedAt?: string;
  };

  type BizdataDataStandardList = {
    total?: number;
    page?: number;
    size?: number;
    items?: BizdataDataStandard[];
  };

  type BizdataMetadataField = {
    id?: string;
    metadataTableId?: string;
    fieldKey?: string;
    metadataCode?: string;
    standardId?: string | null;
    businessMeaning?: string;
    sensitivityLevel?: string;
    alias?: string;
    dataType?: string;
    validationRule?: Record<string, unknown>;
    enumCode?: string;
    standard?: BizdataDataStandard | null;
    createdAt?: string;
    updatedAt?: string;
  };

  type BizdataMetadataTable = {
    id?: string;
    code?: string;
    targetType?: 'entity' | 'metric' | 'enum';
    targetId?: string;
    metadataCode?: string;
    standardId?: string | null;
    businessMeaning?: string;
    status?: 'enabled' | 'disabled';
    standard?: BizdataDataStandard | null;
    fields?: BizdataMetadataField[];
    createdAt?: string;
    updatedAt?: string;
  };

  type BizdataMetadataTableList = {
    total?: number;
    page?: number;
    size?: number;
    items?: BizdataMetadataTable[];
  };

  type BizdataMetadataByTarget = {
    table?: BizdataMetadataTable;
    field?: BizdataMetadataField | null;
  };

  type StorageAccessRestrictions = {
    same_application?: boolean;
    role_ids?: string[];
    scope_codes?: string[];
  };

  type StorageBucket = {
    bucketId?: string;
    code?: string;
    name?: string;
    description?: string;
    applicationId?: string;
    status?: 'ACTIVE' | 'DISABLED';
    accessMode?: 'public' | 'authenticated';
    accessRestrictions?: StorageAccessRestrictions;
    isSystem?: boolean;
    application?: { applicationId?: string; name?: string; code?: string };
    createdAt?: string;
    updatedAt?: string;
  };

  type StorageBucketList = {
    total?: number;
    items?: StorageBucket[];
    page?: number;
    size?: number;
  };

  type StorageObject = {
    objectId?: string;
    bucketId?: string;
    name?: string;
    mimeType?: string;
    size?: number;
    relativePath?: string;
    applicationId?: string;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
    bucket?: { bucketId?: string; code?: string; name?: string };
    application?: { applicationId?: string; name?: string; code?: string };
    creator?: { userId?: string; username?: string; name?: string };
  };

  type StorageObjectList = {
    total?: number;
    items?: StorageObject[];
    page?: number;
    size?: number;
  };

  type ApiServiceOperationMeta = {
    operation?: string;
    httpMethod?: string;
    routePattern?: string;
    category?: 'read' | 'create' | 'update' | 'delete' | 'aggregate';
    label?: string;
  };

  type ApiService = {
    id?: string;
    code?: string;
    routePath?: string;
    name?: string;
    description?: string;
    tags?: string[];
    status?: 'draft' | 'published' | 'disabled';
    entityId?: string;
    entityCode?: string;
    connectionId?: string;
    tableName?: string;
    scopeCode?: string;
    serviceSlug?: string;
    scriptMode?: 'sql' | 'typescript';
    handlerScript?: string;
    requestParameterInterface?: string;
    definitionScript?: string;
    targetSchema?: string;
    basePath?: string;
    transportProtocols?: Array<'http' | 'sse' | 'websocket'>;
    transportEndpoints?: Array<{
      protocol?: string;
      label?: string;
      url?: string;
      description?: string;
    }>;
    enabledOperations?: string[];
    securityConfig?: Record<string, unknown>;
    scriptOverrides?: Record<string, unknown>;
    accessRestriction?: ApiServiceAccessRestriction;
    version?: number;
    publishedAt?: string;
    createdAt?: string;
    updatedAt?: string;
    entity?: { id?: string; code?: string; label?: string };
    connection?: { id?: string; name?: string; dbType?: string };
    operations?: Array<{
      id?: string;
      operation?: string;
      httpMethod?: string;
      routePattern?: string;
      isEnabled?: boolean;
    }>;
  };

  type ApiServiceAccessRestriction = {
    mode?: 'none' | 'role' | 'department';
    roleIds?: string[];
    departmentIds?: string[];
  };

  type ApiServiceResolvedConnection = {
    connectionId?: string;
    connectionName?: string;
    dbType?: string;
    targetSchema?: string;
    reason?: string;
    matchedEntityCount?: number;
  };

  type ApiServiceListResult = {
    total?: number;
    items?: ApiService[];
  };

  type ApiServiceCreateInput = {
    code?: string;
    scopeCode?: string;
    serviceSlug?: string;
    name?: string;
    description?: string;
    tags?: string[];
    connectionId?: string;
    entityId?: string;
    definitionScript?: string;
    handlerScript?: string;
    scriptMode?: 'sql' | 'typescript';
    requestParameterInterface?: string;
    accessRestriction?: ApiServiceAccessRestriction;
    enabledOperations?: string[];
    transportProtocols?: Array<'http' | 'sse' | 'websocket'>;
    securityConfig?: Record<string, unknown>;
  };

  type ApiServiceDomainTreeItem = {
    code?: string;
    name?: string;
    isDomainNode?: boolean;
    serviceCount?: number;
    children?: ApiServiceDomainTreeItem[];
    service?: ApiService;
  };

  type ApiServiceTestResult = {
    serviceId?: string;
    code?: string;
    operation?: string;
    httpMethod?: string;
    url?: string;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    pathParams?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    requestPreview?: {
      method?: string;
      url?: string;
      pathParams?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    };
    durationMs?: number;
    executable?: boolean;
    executableReason?: string;
    rolledBack?: boolean;
    mockParametersSaved?: boolean;
    savedMockParameters?: Record<string, unknown>;
    validationErrors?: Array<{ path?: string; message?: string }>;
    preview?: unknown;
  };

  type ApiServiceTestOperationProfile = {
    operation?: string;
    httpMethod?: string;
    routePattern?: string;
    label?: string;
    category?: string;
    url?: string;
    parameterSchema?: Record<string, unknown>;
    mockParameters?: Record<string, unknown>;
    mockParametersSource?: 'saved' | 'generated';
    requestPreview?: {
      method?: string;
      url?: string;
      pathParams?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    };
    executable?: boolean;
    executableReason?: string;
  };

  type ApiServiceTestProfile = {
    serviceId?: string;
    code?: string;
    name?: string;
    basePath?: string;
    routePath?: string;
    entityCode?: string;
    entityId?: string;
    status?: string;
    scriptMode?: 'sql' | 'typescript';
    requestParameterInterface?: string;
    testAutoRollback?: boolean;
    transportProtocols?: Array<'http' | 'sse' | 'websocket'>;
    transportEndpoints?: Array<{
      protocol?: string;
      label?: string;
      url?: string;
      description?: string;
    }>;
    enabledOperations?: ApiServiceTestOperationProfile[];
    securityConfig?: Record<string, unknown>;
  };

  type ApiServiceSuggestTestParamsResult = {
    serviceId?: string;
    code?: string;
    operation?: string;
    mockParameters?: Record<string, unknown>;
    parameterSchema?: Record<string, unknown>;
    requestPreview?: ApiServiceTestOperationProfile['requestPreview'];
  };

  type ApiServiceSaveTestMockParamsResult = {
    serviceId?: string;
    operation?: string;
    mockParameters?: Record<string, unknown>;
    saved?: boolean;
  };

  // ===== 外部 API 提交（Outbound Webhook） =====
  type OutboundWebhook = {
    id?: string;
    code?: string;
    name?: string;
    description?: string;
    status?: 'draft' | 'published' | 'disabled' | 'deleted';
    triggerType?: string;
    triggerApiServiceId?: string;
    triggerApiServiceCode?: string;
    targetUrl?: string;
    requestStructure?: string;
    transformScript?: string;
    mockData?: string;
    version?: number;
    publishedAt?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  type OutboundWebhookTestProfile = OutboundWebhook & {
    hint?: string;
  };

  type OutboundWebhookTestResult = {
    runId: string;
    webhookId: string;
    runType: string;
    transformedBody: Record<string, unknown> | null;
    responseStatus: number;
    responseBody: string | null;
    status: 'success' | 'failed';
    errorMessage: string | null;
    durationMs: number;
  };

  type OutboundWebhookRun = {
    id: string;
    webhookId: string;
    runType: string;
    triggerData?: Record<string, unknown>;
    transformedBody?: Record<string, unknown>;
    responseStatus?: number;
    responseBody?: string;
    status: string;
    errorMessage?: string;
    durationMs?: number;
    createdAt: string;
  };
}
