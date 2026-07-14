const { Op } = require('sequelize');
const {
  BizdataEntity,
  BizdataEntityField,
  BizdataEnum,
  BizdataRelation,
  BizdataSetting,
  BizdataMaterializationEntity,
  sequelize
} = require('../../models');
const { defaultTableNameFromCode, resolveEntityTableName } = require('./entityTableName');
const { cascadeEntityCodeChange } = require('./entityCodeCascadeService');
const {
  renameMaterializedPhysicalTables,
  rollbackMaterializedPhysicalRenames,
} = require('./materializedTableRenameService');

async function assertErTableNameUnique(tableName, excludeEntityId = null, transaction = null) {
  const where = {
    entity_kind: 'er_table',
    table_name: tableName,
  };
  if (excludeEntityId) {
    where.id = { [Op.ne]: excludeEntityId };
  }
  const existing = await BizdataEntity.findOne({ where, transaction });
  if (existing) {
    throw new Error(`表名「${tableName}」已被实体「${existing.label}」（${existing.code}）使用`);
  }
}

async function assertEntityCodeUnique(code, excludeEntityId = null, transaction = null) {
  const trimmed = String(code || '').trim();
  if (!trimmed) {
    throw new Error('code 不能为空');
  }
  if (!trimmed.includes(':')) {
    throw new Error('code 须包含 Scope 层级，如 sales:order:Order');
  }
  const where = { code: trimmed };
  if (excludeEntityId) {
    where.id = { [Op.ne]: excludeEntityId };
  }
  const existing = await BizdataEntity.findOne({ where, transaction });
  if (existing) {
    throw new Error(`code「${trimmed}」已被实体「${existing.label}」使用`);
  }
  return trimmed;
}

function formatField(field) {
  const d = field.toJSON ? field.toJSON() : field;
  return {
    id: d.id,
    entityId: d.entity_id,
    fieldKey: d.field_key,
    columnInfo: d.column_info || {},
    typeormConfig: d.typeorm_config || {},
    sortOrder: d.sort_order,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  };
}

/** 兼容 AI/前端多种字段写法，统一为 DB 列结构 */
function normalizeFieldInput(raw, index = 0) {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`fields[${index}] 必须是对象`);
  }

  const fieldKey = String(raw.fieldKey || raw.field_key || raw.name || raw.key || '').trim();
  if (!fieldKey) {
    throw new Error(`fields[${index}] 缺少 fieldKey（也支持 name/key 别名）`);
  }

  const columnInfo = { ...(raw.columnInfo || raw.column_info || {}) };
  if (raw.label && columnInfo.label == null) {
    columnInfo.label = raw.label;
  }

  const rawTypeorm = raw.typeormConfig || raw.typeorm_config || {};
  const typeormConfig = {
    ...rawTypeorm,
    type: rawTypeorm.type || raw.type || 'varchar'
  };
  if (raw.length != null && typeormConfig.length == null) {
    typeormConfig.length = raw.length;
  }
  if (raw.nullable != null && typeormConfig.nullable == null) {
    typeormConfig.nullable = raw.nullable;
  }
  if (raw.unique != null && typeormConfig.unique == null) {
    typeormConfig.unique = raw.unique;
  }
  if (raw.primary != null && typeormConfig.primary == null) {
    typeormConfig.primary = raw.primary;
  }
  if (typeormConfig.nullable === undefined) {
    typeormConfig.nullable = true;
  }

  return {
    field_key: fieldKey,
    column_info: columnInfo,
    typeorm_config: typeormConfig,
    sort_order: raw.sortOrder ?? raw.sort_order ?? index
  };
}

function formatEntitySummary(entity, fieldCount = 0) {
  const d = entity.toJSON ? entity.toJSON() : entity;
  return {
    id: d.id,
    code: d.code,
    label: d.label,
    entityKind: d.entity_kind,
    tableName: d.table_name,
    status: d.status,
    version: d.version,
    fieldCount: Number(fieldCount) || 0,
    modelValidated: d.entity_info?.modelValidated === true,
  };
}

function formatEntity(entity, includeFields = true) {
  const d = entity.toJSON ? entity.toJSON() : entity;
  const result = {
    id: d.id,
    code: d.code,
    label: d.label,
    entityKind: d.entity_kind,
    tableName: d.table_name,
    status: d.status,
    isLocked: d.is_locked,
    version: d.version,
    entityInfo: d.entity_info || {},
    jsonSchema: d.json_schema,
    layout: d.layout,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  };
  if (includeFields && d.fields) {
    result.fields = d.fields
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(formatField);
  }
  return result;
}

function formatEnum(item) {
  const d = item.toJSON ? item.toJSON() : item;
  return {
    id: d.id,
    code: d.code,
    enumInfo: d.enum_info || {},
    values: d.values || {},
    items: d.items || {},
    createdAt: d.created_at,
    updatedAt: d.updated_at
  };
}

function formatRelation(rel) {
  const d = rel.toJSON ? rel.toJSON() : rel;
  return {
    id: d.id,
    type: d.type,
    name: d.name,
    inverseName: d.inverse_name,
    fromEntityId: d.from_entity_id,
    toEntityId: d.to_entity_id,
    config: d.config || {},
    joinTable: d.join_table,
    metadata: d.metadata || {},
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    fromEntity: d.fromEntity ? { id: d.fromEntity.id, code: d.fromEntity.code, label: d.fromEntity.label } : undefined,
    toEntity: d.toEntity ? { id: d.toEntity.id, code: d.toEntity.code, label: d.toEntity.label } : undefined
  };
}

async function bumpEntityVersion(entityId, transaction) {
  await BizdataEntity.increment('version', { where: { id: entityId }, transaction });
}

async function bumpEntitiesVersion(entityIds, transaction) {
  const unique = [...new Set(entityIds.filter(Boolean))];
  if (!unique.length) return;
  await BizdataEntity.increment('version', { where: { id: unique }, transaction });
}

async function getFullSchema() {
  const [entities, enums, relations] = await Promise.all([
    BizdataEntity.findAll({
      include: [{ model: BizdataEntityField, as: 'fields', required: false }],
      order: [['code', 'ASC']]
    }),
    BizdataEnum.findAll({ order: [['code', 'ASC']] }),
    BizdataRelation.findAll({
      include: [
        { model: BizdataEntity, as: 'fromEntity', attributes: ['id', 'code', 'label'] },
        { model: BizdataEntity, as: 'toEntity', attributes: ['id', 'code', 'label'] }
      ],
      order: [['created_at', 'ASC']]
    })
  ]);

  return {
    entities: entities.map((e) => formatEntity(e)),
    enums: enums.map(formatEnum),
    relations: relations.map(formatRelation)
  };
}

async function listEntities({ codePrefix, entityKind, page = 1, size = 100 } = {}) {
  const where = {};
  if (codePrefix) {
    where.code = { [Op.like]: `${codePrefix}%` };
  }
  if (entityKind) {
    where.entity_kind = entityKind;
  }

  const limit = Math.min(Math.max(size, 1), 200);
  const { count, rows } = await BizdataEntity.findAndCountAll({
    where,
    include: [{ model: BizdataEntityField, as: 'fields', required: false }],
    limit,
    offset: (page - 1) * limit,
    order: [['code', 'ASC']]
  });

  return {
    total: count,
    items: rows.map((r) => formatEntity(r)),
    page,
    size: limit
  };
}

async function listEntitySummaries({ codePrefix, entityKind, page = 1, size = 500 } = {}) {
  const where = {};
  if (codePrefix) {
    where.code = { [Op.like]: `${codePrefix}%` };
  }
  if (entityKind) {
    where.entity_kind = entityKind;
  }

  const limit = Math.min(Math.max(size, 1), 500);
  const { count, rows } = await BizdataEntity.findAndCountAll({
    where,
    attributes: ['id', 'code', 'label', 'entity_kind', 'table_name', 'status', 'version', 'entity_info'],
    limit,
    offset: (page - 1) * limit,
    order: [['code', 'ASC']],
  });

  const entityIds = rows.map((r) => r.id).filter(Boolean);
  const countMap = new Map();
  if (entityIds.length) {
    const fieldCounts = await BizdataEntityField.findAll({
      attributes: [
        'entity_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      where: { entity_id: entityIds },
      group: ['entity_id'],
      raw: true,
    });
    fieldCounts.forEach((row) => {
      countMap.set(row.entity_id, Number(row.count) || 0);
    });
  }

  return {
    total: count,
    items: rows.map((r) => formatEntitySummary(r, countMap.get(r.id) || 0)),
    page,
    size: limit,
  };
}

async function getEntityById(id) {
  const entity = await BizdataEntity.findByPk(id, {
    include: [{ model: BizdataEntityField, as: 'fields', required: false }]
  });
  if (!entity) return null;
  return formatEntity(entity);
}

async function createEntity(payload) {
  const { code, label, entityKind = 'er_table', tableName, status = 'enabled', entityInfo = {}, jsonSchema } = payload;
  if (!code || !label) {
    throw new Error('code 和 label 为必填项');
  }

  const trimmedCode = code.trim();
  await assertEntityCodeUnique(trimmedCode);
  let resolvedTableName = null;
  if (entityKind === 'er_table') {
    resolvedTableName = resolveEntityTableName(trimmedCode, tableName);
    await assertErTableNameUnique(resolvedTableName);
  }

  const entity = await BizdataEntity.create({
    code: trimmedCode,
    label: label.trim(),
    entity_kind: entityKind,
    table_name: resolvedTableName,
    status,
    entity_info: {
      ...entityInfo,
      code: trimmedCode,
      label: label.trim(),
      modelValidated: false,
    },
    json_schema: jsonSchema || null,
    version: 1
  });

  return getEntityById(entity.id);
}

function resolveNextTableName(entity, payload, nextCode, codeChanged) {
  const oldDefaultTable = defaultTableNameFromCode(entity.code);
  const tableWasDerivedFromCode = !entity.table_name || entity.table_name === oldDefaultTable;
  let nextTableName = entity.table_name;

  if (payload.tableName !== undefined) {
    if (entity.entity_kind === 'er_table') {
      nextTableName = resolveEntityTableName(nextCode, payload.tableName);
    } else {
      nextTableName = payload.tableName || null;
    }
  } else if (codeChanged && entity.entity_kind === 'er_table' && tableWasDerivedFromCode) {
    nextTableName = defaultTableNameFromCode(nextCode);
  }
  return nextTableName;
}

async function updateEntity(id, payload) {
  const previewEntity = await BizdataEntity.findByPk(id);
  if (!previewEntity) return null;

  const previewNextCode = payload.code !== undefined
    ? String(payload.code).trim()
    : previewEntity.code;
  const previewCodeChanged = payload.code !== undefined && previewNextCode !== previewEntity.code;
  const previewNextTableName = resolveNextTableName(
    previewEntity,
    payload,
    previewNextCode,
    previewCodeChanged,
  );
  const tableNameChanged = previewEntity.entity_kind === 'er_table'
    && previewNextTableName
    && previewEntity.table_name
    && previewNextTableName !== previewEntity.table_name;

  let physicalRenameResult = null;
  if (tableNameChanged) {
    physicalRenameResult = await renameMaterializedPhysicalTables({
      entityId: id,
      oldTableName: previewEntity.table_name,
      newTableName: previewNextTableName,
    });
  }

  try {
    return await sequelize.transaction(async (transaction) => {
      const entity = await BizdataEntity.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!entity) return null;
      if (entity.is_locked) {
        const definedKeys = Object.keys(payload).filter((k) => payload[k] !== undefined);
        const onlyLockToggle = definedKeys.length === 1 && definedKeys[0] === 'isLocked';
        if (!onlyLockToggle) {
          throw new Error('实体已锁定，无法修改');
        }
      }

      const updates = {};
      let nextCode = entity.code;
      let trimmedCode = entity.code;

      if (payload.code !== undefined) {
        trimmedCode = await assertEntityCodeUnique(payload.code, id, transaction);
        if (trimmedCode !== entity.code) {
          updates.code = trimmedCode;
          nextCode = trimmedCode;
          const currentInfo = entity.entity_info || {};
          updates.entity_info = {
            ...currentInfo,
            code: trimmedCode,
            modelValidated: false,
          };
        }
      }

      if (payload.label !== undefined) updates.label = payload.label;
      if (payload.entityKind !== undefined) updates.entity_kind = payload.entityKind;

      const codeChanged = updates.code !== undefined;
      let nextTableName = resolveNextTableName(entity, payload, nextCode, codeChanged);

      if (payload.tableName !== undefined) {
        if (entity.entity_kind === 'er_table') {
          await assertErTableNameUnique(nextTableName, id, transaction);
          updates.table_name = nextTableName;
        } else {
          updates.table_name = nextTableName;
        }
      } else if (codeChanged && entity.entity_kind === 'er_table') {
        const oldDefaultTable = defaultTableNameFromCode(entity.code);
        const tableWasDerivedFromCode = !entity.table_name || entity.table_name === oldDefaultTable;
        if (tableWasDerivedFromCode) {
          await assertErTableNameUnique(nextTableName, id, transaction);
          updates.table_name = nextTableName;
        }
      }

      if (payload.status !== undefined) updates.status = payload.status;
      if (payload.isLocked !== undefined) updates.is_locked = payload.isLocked;
      if (payload.entityInfo !== undefined) {
        updates.entity_info = {
          ...(updates.entity_info || entity.entity_info || {}),
          ...payload.entityInfo,
        };
      }
      if (payload.jsonSchema !== undefined) updates.json_schema = payload.jsonSchema;
      if (payload.layout !== undefined) updates.layout = payload.layout;

      const effectiveTableNameChanged = entity.entity_kind === 'er_table'
        && nextTableName
        && entity.table_name
        && nextTableName !== entity.table_name;

      if (codeChanged) {
        await cascadeEntityCodeChange({
          entityId: id,
          oldCode: entity.code,
          newCode: trimmedCode,
          oldTableName: entity.table_name,
          newTableName: nextTableName,
          transaction,
        });
      } else if (effectiveTableNameChanged) {
        await BizdataMaterializationEntity.update(
          { table_name: nextTableName },
          { where: { entity_id: id }, transaction },
        );
      }

      if (Object.keys(updates).length) {
        updates.version = entity.version + 1;
        await entity.update(updates, { transaction });
      }

      return getEntityById(id);
    });
  } catch (err) {
    if (physicalRenameResult?.renamed?.length) {
      await rollbackMaterializedPhysicalRenames(physicalRenameResult);
    }
    throw err;
  }
}

async function deleteEntity(id) {
  const entity = await BizdataEntity.findByPk(id);
  if (!entity) return false;
  if (entity.is_locked) {
    throw new Error('实体已锁定，无法删除');
  }
  await entity.destroy();
  return true;
}

async function upsertEntityFields(entityId, fields = []) {
  const entity = await BizdataEntity.findByPk(entityId);
  if (!entity) return null;
  if (entity.is_locked) {
    throw new Error('实体已锁定，无法修改字段');
  }

  const transaction = await sequelize.transaction();
  try {
    const normalized = fields.map((f, index) => normalizeFieldInput(f, index));
    const fieldKeys = normalized.map((f) => f.field_key);
    const duplicated = fieldKeys.find((key, index) => fieldKeys.indexOf(key) !== index);
    if (duplicated) {
      throw new Error(`字段 key 重复: ${duplicated}`);
    }

    await BizdataEntityField.destroy({ where: { entity_id: entityId }, transaction });

    if (normalized.length) {
      await BizdataEntityField.bulkCreate(
        normalized.map((f) => ({
          entity_id: entityId,
          field_key: f.field_key,
          column_info: f.column_info,
          typeorm_config: f.typeorm_config,
          sort_order: f.sort_order
        })),
        { transaction }
      );
    }

    await entity.update({ version: entity.version + 1 }, { transaction });
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  return getEntityById(entityId);
}

async function listEnums({ page = 1, size = 100 } = {}) {
  const limit = Math.min(Math.max(size, 1), 200);
  const { count, rows } = await BizdataEnum.findAndCountAll({
    limit,
    offset: (page - 1) * limit,
    order: [['code', 'ASC']]
  });
  return { total: count, items: rows.map(formatEnum), page, size: limit };
}

async function createEnum(payload) {
  const { code, enumInfo = {}, values = {}, items = {} } = payload;
  if (!code) throw new Error('code 为必填项');
  const item = await BizdataEnum.create({
    code: code.trim(),
    enum_info: enumInfo,
    values,
    items
  });
  return formatEnum(item);
}

async function updateEnum(id, payload) {
  const item = await BizdataEnum.findByPk(id);
  if (!item) return null;
  const updates = {};
  if (payload.enumInfo !== undefined) updates.enum_info = payload.enumInfo;
  if (payload.values !== undefined) updates.values = payload.values;
  if (payload.items !== undefined) updates.items = payload.items;
  await item.update(updates);
  return formatEnum(item);
}

async function deleteEnum(id) {
  const item = await BizdataEnum.findByPk(id);
  if (!item) return false;
  await item.destroy();
  return true;
}

async function listRelations() {
  const rows = await BizdataRelation.findAll({
    include: [
      { model: BizdataEntity, as: 'fromEntity', attributes: ['id', 'code', 'label'] },
      { model: BizdataEntity, as: 'toEntity', attributes: ['id', 'code', 'label'] }
    ],
    order: [['created_at', 'ASC']]
  });
  return rows.map(formatRelation);
}

async function createRelation(payload) {
  const { type, name, inverseName, fromEntityId, toEntityId, config = {}, joinTable, metadata = {} } = payload;
  if (!type || !name || !fromEntityId || !toEntityId) {
    throw new Error('type, name, fromEntityId, toEntityId 为必填项');
  }

  const transaction = await sequelize.transaction();
  try {
    const rel = await BizdataRelation.create({
      type,
      name,
      inverse_name: inverseName,
      from_entity_id: fromEntityId,
      to_entity_id: toEntityId,
      config,
      join_table: joinTable,
      metadata
    }, { transaction });

    await bumpEntitiesVersion([fromEntityId, toEntityId], transaction);
    await transaction.commit();
    const full = await BizdataRelation.findByPk(rel.id, {
      include: [
        { model: BizdataEntity, as: 'fromEntity', attributes: ['id', 'code', 'label'] },
        { model: BizdataEntity, as: 'toEntity', attributes: ['id', 'code', 'label'] }
      ]
    });
    return formatRelation(full);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function updateRelation(id, payload) {
  const rel = await BizdataRelation.findByPk(id);
  if (!rel) return null;

  const transaction = await sequelize.transaction();
  try {
    const updates = {};
    if (payload.type !== undefined) updates.type = payload.type;
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.inverseName !== undefined) updates.inverse_name = payload.inverseName;
    if (payload.config !== undefined) updates.config = payload.config;
    if (payload.joinTable !== undefined) updates.join_table = payload.joinTable;
    if (payload.metadata !== undefined) updates.metadata = payload.metadata;

    const entityIds = [rel.from_entity_id, rel.to_entity_id];
    if (payload.fromEntityId !== undefined) {
      updates.from_entity_id = payload.fromEntityId;
      entityIds.push(payload.fromEntityId);
    }
    if (payload.toEntityId !== undefined) {
      updates.to_entity_id = payload.toEntityId;
      entityIds.push(payload.toEntityId);
    }

    await rel.update(updates, { transaction });
    await bumpEntitiesVersion(entityIds, transaction);
    await transaction.commit();

    const full = await BizdataRelation.findByPk(id, {
      include: [
        { model: BizdataEntity, as: 'fromEntity', attributes: ['id', 'code', 'label'] },
        { model: BizdataEntity, as: 'toEntity', attributes: ['id', 'code', 'label'] }
      ]
    });
    return formatRelation(full);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function deleteRelation(id) {
  const rel = await BizdataRelation.findByPk(id);
  if (!rel) return false;

  const transaction = await sequelize.transaction();
  try {
    const entityIds = [rel.from_entity_id, rel.to_entity_id];
    await rel.destroy({ transaction });
    await bumpEntitiesVersion(entityIds, transaction);
    await transaction.commit();
    return true;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function getDefaultMaterializationSchema() {
  const setting = await BizdataSetting.findOne({ where: { key: 'default_materialization_schema' } });
  if (!setting) return 'bizdata_mat';
  const val = setting.value;
  return typeof val === 'string' ? val : (val?.schema || 'bizdata_mat');
}

async function listScopes() {
  const { buildScopeTreeFromEntityCodes, flattenScopeTree } = require('./bizdataScopeUtils');
  const entities = await BizdataEntity.findAll({
    attributes: ['code', 'label'],
    order: [['code', 'ASC']],
  });
  const tree = buildScopeTreeFromEntityCodes(entities.map((e) => e.toJSON()));
  return {
    tree,
    items: flattenScopeTree(tree),
  };
}

module.exports = {
  formatEntity,
  formatField,
  formatEnum,
  formatRelation,
  getFullSchema,
  listEntities,
  listEntitySummaries,
  getEntityById,
  createEntity,
  updateEntity,
  deleteEntity,
  upsertEntityFields,
  listEnums,
  createEnum,
  updateEnum,
  deleteEnum,
  listRelations,
  createRelation,
  updateRelation,
  deleteRelation,
  getDefaultMaterializationSchema,
  listScopes,
};
