const { Op } = require('sequelize');
const {
  BizdataEntity,
  BizdataEntityField,
  BizdataEnum,
  BizdataMetric,
  BizdataMetadataTable,
  BizdataMetadataField,
  BizdataDataStandard,
} = require('../../models');
const { formatStandard } = require('../system/systemService');

function formatMetadataField(row, standard) {
  const d = row.toJSON ? row.toJSON() : row;
  const std = standard || row.standard;
  return {
    id: d.id,
    metadataTableId: d.metadata_table_id,
    fieldKey: d.field_key,
    metadataCode: d.metadata_code,
    standardId: d.standard_id,
    businessMeaning: d.business_meaning,
    sensitivityLevel: d.sensitivity_level,
    alias: d.alias,
    dataType: d.data_type,
    validationRule: d.validation_rule || {},
    enumCode: d.enum_code,
    standard: formatStandard(std),
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function formatMetadataTable(row, fields = []) {
  const d = row.toJSON ? row.toJSON() : row;
  const std = row.standard;
  return {
    id: d.id,
    code: d.code,
    targetType: d.target_type,
    targetId: d.target_id,
    metadataCode: d.metadata_code,
    standardId: d.standard_id,
    businessMeaning: d.business_meaning,
    status: d.status,
    standard: formatStandard(std),
    fields,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

async function loadTableWithFields(tableRow) {
  const fields = await BizdataMetadataField.findAll({
    where: { metadata_table_id: tableRow.id },
    include: [{ model: BizdataDataStandard, as: 'standard' }],
    order: [['field_key', 'ASC']],
  });
  return formatMetadataTable(tableRow, fields.map((f) => formatMetadataField(f)));
}

async function listMetadataTables({ keyword, targetType, page = 1, size = 50 }) {
  const where = {};
  if (targetType) where.target_type = targetType;
  if (keyword) {
    where[Op.or] = [
      { code: { [Op.iLike]: `%${keyword}%` } },
      { metadata_code: { [Op.iLike]: `%${keyword}%` } },
    ];
  }

  const offset = (page - 1) * size;
  const { count, rows } = await BizdataMetadataTable.findAndCountAll({
    where,
    include: [{ model: BizdataDataStandard, as: 'standard' }],
    order: [['code', 'ASC']],
    limit: size,
    offset,
  });

  return {
    total: count,
    page,
    size,
    items: rows.map((r) => formatMetadataTable(r)),
  };
}

async function getMetadataTableById(id) {
  const row = await BizdataMetadataTable.findByPk(id, {
    include: [{ model: BizdataDataStandard, as: 'standard' }],
  });
  if (!row) return null;
  return loadTableWithFields(row);
}

async function getMetadataByTarget(targetType, targetId, fieldKey) {
  const row = await BizdataMetadataTable.findOne({
    where: { target_type: targetType, target_id: targetId },
    include: [{ model: BizdataDataStandard, as: 'standard' }],
  });
  if (!row) return null;

  if (fieldKey) {
    const field = await BizdataMetadataField.findOne({
      where: { metadata_table_id: row.id, field_key: fieldKey },
      include: [{ model: BizdataDataStandard, as: 'standard' }],
    });
    return {
      table: formatMetadataTable(row),
      field: field ? formatMetadataField(field) : null,
    };
  }

  return { table: await loadTableWithFields(row) };
}

async function upsertMetadataTable(payload) {
  const targetType = payload.targetType || payload.target_type;
  const targetId = payload.targetId || payload.target_id;
  if (!targetType || !targetId) {
    const error = new Error('targetType 与 targetId 不能为空');
    error.status = 400;
    throw error;
  }

  let row = await BizdataMetadataTable.findOne({
    where: { target_type: targetType, target_id: targetId },
  });

  const data = {
    code: payload.code || row?.code,
    metadata_code: payload.metadataCode ?? payload.metadata_code ?? row?.metadata_code,
    standard_id: payload.standardId ?? payload.standard_id ?? row?.standard_id,
    business_meaning: payload.businessMeaning ?? payload.business_meaning ?? row?.business_meaning,
    status: payload.status ?? row?.status ?? 'enabled',
  };

  if (!data.code) {
    const error = new Error('code 不能为空');
    error.status = 400;
    throw error;
  }

  if (row) {
    await row.update(data);
  } else {
    row = await BizdataMetadataTable.create({
      ...data,
      target_type: targetType,
      target_id: targetId,
    });
  }

  return getMetadataTableById(row.id);
}

async function upsertMetadataField(metadataTableId, payload) {
  const fieldKey = payload.fieldKey || payload.field_key;
  if (!fieldKey) {
    const error = new Error('fieldKey 不能为空');
    error.status = 400;
    throw error;
  }

  let row = await BizdataMetadataField.findOne({
    where: { metadata_table_id: metadataTableId, field_key: fieldKey },
  });

  const data = {
    metadata_code: payload.metadataCode ?? payload.metadata_code ?? row?.metadata_code,
    standard_id: payload.standardId ?? payload.standard_id ?? row?.standard_id,
    business_meaning: payload.businessMeaning ?? payload.business_meaning ?? row?.business_meaning,
    sensitivity_level: payload.sensitivityLevel ?? payload.sensitivity_level ?? row?.sensitivity_level,
    alias: payload.alias ?? row?.alias,
    data_type: payload.dataType ?? payload.data_type ?? row?.data_type,
    validation_rule: payload.validationRule ?? payload.validation_rule ?? row?.validation_rule ?? {},
    enum_code: payload.enumCode ?? payload.enum_code ?? row?.enum_code,
  };

  if (row) {
    await row.update(data);
  } else {
    row = await BizdataMetadataField.create({
      ...data,
      metadata_table_id: metadataTableId,
      field_key: fieldKey,
    });
  }

  const withStd = await BizdataMetadataField.findByPk(row.id, {
    include: [{ model: BizdataDataStandard, as: 'standard' }],
  });
  return formatMetadataField(withStd);
}

async function updateMetadataTable(id, payload) {
  const row = await BizdataMetadataTable.findByPk(id);
  if (!row) return null;

  const updates = {};
  if (payload.code !== undefined) updates.code = payload.code;
  if (payload.metadataCode !== undefined || payload.metadata_code !== undefined) {
    updates.metadata_code = payload.metadataCode ?? payload.metadata_code;
  }
  if (payload.standardId !== undefined || payload.standard_id !== undefined) {
    updates.standard_id = payload.standardId ?? payload.standard_id;
  }
  if (payload.businessMeaning !== undefined || payload.business_meaning !== undefined) {
    updates.business_meaning = payload.businessMeaning ?? payload.business_meaning;
  }
  if (payload.status !== undefined) updates.status = payload.status;

  await row.update(updates);
  return getMetadataTableById(id);
}

async function bulkUpdateMetadataFields(metadataTableId, fields = []) {
  const results = [];
  for (const field of fields) {
    results.push(await upsertMetadataField(metadataTableId, field));
  }
  return results;
}

async function deleteMetadataTable(id) {
  const row = await BizdataMetadataTable.findByPk(id);
  if (!row) return false;
  await row.destroy();
  return true;
}

async function syncFromSchema() {
  const summary = { createdTables: 0, createdFields: 0, updatedFields: 0 };

  const entities = await BizdataEntity.findAll({
    include: [{ model: BizdataEntityField, as: 'fields' }],
  });

  for (const entity of entities) {
    let table = await BizdataMetadataTable.findOne({
      where: { target_type: 'entity', target_id: entity.id },
    });
    if (!table) {
      table = await BizdataMetadataTable.create({
        code: entity.code,
        target_type: 'entity',
        target_id: entity.id,
        status: 'enabled',
      });
      summary.createdTables += 1;
    } else if (table.code !== entity.code) {
      await table.update({ code: entity.code });
    }

    const entityFields = entity.fields || [];
    for (const ef of entityFields) {
      const existing = await BizdataMetadataField.findOne({
        where: { metadata_table_id: table.id, field_key: ef.field_key },
      });
      if (!existing) {
        await BizdataMetadataField.create({
          metadata_table_id: table.id,
          field_key: ef.field_key,
          data_type: ef.typeorm_config?.type || null,
          validation_rule: {},
        });
        summary.createdFields += 1;
      } else if (!existing.data_type && ef.typeorm_config?.type) {
        await existing.update({ data_type: ef.typeorm_config.type });
        summary.updatedFields += 1;
      }
    }
  }

  const metrics = await BizdataMetric.findAll();
  for (const metric of metrics) {
    let table = await BizdataMetadataTable.findOne({
      where: { target_type: 'metric', target_id: metric.id },
    });
    if (!table) {
      table = await BizdataMetadataTable.create({
        code: metric.code,
        target_type: 'metric',
        target_id: metric.id,
        status: 'enabled',
      });
      summary.createdTables += 1;
    } else if (table.code !== metric.code) {
      await table.update({ code: metric.code });
    }

    const existing = await BizdataMetadataField.findOne({
      where: { metadata_table_id: table.id, field_key: 'value' },
    });
    if (!existing) {
      await BizdataMetadataField.create({
        metadata_table_id: table.id,
        field_key: 'value',
        data_type: 'numeric',
        validation_rule: {},
      });
      summary.createdFields += 1;
    }
  }

  const enums = await BizdataEnum.findAll();
  for (const en of enums) {
    let table = await BizdataMetadataTable.findOne({
      where: { target_type: 'enum', target_id: en.id },
    });
    if (!table) {
      table = await BizdataMetadataTable.create({
        code: en.code,
        target_type: 'enum',
        target_id: en.id,
        status: 'enabled',
      });
      summary.createdTables += 1;
    } else if (table.code !== en.code) {
      await table.update({ code: en.code });
    }
  }

  return summary;
}

module.exports = {
  listMetadataTables,
  getMetadataTableById,
  getMetadataByTarget,
  upsertMetadataTable,
  upsertMetadataField,
  updateMetadataTable,
  bulkUpdateMetadataFields,
  deleteMetadataTable,
  syncFromSchema,
};
