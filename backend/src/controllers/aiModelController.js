const { v4: uuidv4 } = require('uuid');
const {
  AiModel,
  Provider,
  ModelCapability,
  ModelIoTag,
  sequelize
} = require('../models');
const {
  isValidSlug,
  resolveUniqueSlug,
  validateCapabilities,
  validateModalities
} = require('../constants/aiCapabilities');
const logger = require('../utils/logger');

function formatAiModel(model, includeProvider = false) {
  const data = model.toJSON ? model.toJSON() : model;
  const result = {
    id: data.id,
    providerId: data.provider_id,
    slug: data.slug,
    modelId: data.model_id,
    displayName: data.display_name,
    defaultParams: data.default_params || {},
    isActive: data.is_active,
    capabilities: (data.capabilities || []).map((item) => item.capability),
    inputTags: (data.ioTags || [])
      .filter((item) => item.direction === 'input')
      .map((item) => item.modality),
    outputTags: (data.ioTags || [])
      .filter((item) => item.direction === 'output')
      .map((item) => item.modality),
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };

  if (includeProvider && data.provider) {
    result.provider = {
      id: data.provider.id,
      name: data.provider.name,
      slug: data.provider.slug
    };
  }

  return result;
}

async function replaceTags(modelId, capabilities, inputTags, outputTags, transaction) {
  await ModelCapability.destroy({ where: { model_id: modelId }, transaction });
  await ModelIoTag.destroy({ where: { model_id: modelId }, transaction });

  if (capabilities?.length) {
    await ModelCapability.bulkCreate(
      capabilities.map((capability) => ({
        id: uuidv4(),
        model_id: modelId,
        capability
      })),
      { transaction }
    );
  }

  const ioTagRows = [];
  (inputTags || []).forEach((modality) => {
    ioTagRows.push({ id: uuidv4(), model_id: modelId, direction: 'input', modality });
  });
  (outputTags || []).forEach((modality) => {
    ioTagRows.push({ id: uuidv4(), model_id: modelId, direction: 'output', modality });
  });

  if (ioTagRows.length) {
    await ModelIoTag.bulkCreate(ioTagRows, { transaction });
  }
}

const modelInclude = [
  { model: ModelCapability, as: 'capabilities', attributes: ['capability'] },
  { model: ModelIoTag, as: 'ioTags', attributes: ['direction', 'modality'] },
  { model: Provider, as: 'provider', attributes: ['id', 'name', 'slug'] }
];

class AiModelController {
  static async list(ctx) {
    try {
      const page = Math.max(parseInt(ctx.query.page, 10) || 1, 1);
      const size = Math.min(Math.max(parseInt(ctx.query.size, 10) || 10, 1), 100);
      const where = {};

      if (ctx.query.providerId) {
        where.provider_id = ctx.query.providerId;
      }
      if (ctx.query.isActive !== undefined) {
        where.is_active = ctx.query.isActive === 'true';
      }

      // hasMany include 下 findAndCountAll 分页会错位，count 与 findAll 分开查询
      const count = await AiModel.count({ where });
      const rows = await AiModel.findAll({
        where,
        include: modelInclude,
        limit: size,
        offset: (page - 1) * size,
        order: [['created_at', 'DESC']]
      });

      ctx.body = {
        code: 200,
        message: '获取模型列表成功',
        data: {
          total: count,
          items: rows.map((item) => formatAiModel(item, true)),
          page,
          size
        }
      };
    } catch (error) {
      logger.error('获取模型列表失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '获取模型列表失败', data: null };
    }
  }

  static async create(ctx) {
    const {
      providerId,
      slug,
      modelId,
      displayName,
      defaultParams,
      capabilities,
      inputTags,
      outputTags
    } = ctx.request.body;

    if (!providerId || !modelId || !displayName) {
      ctx.status = 400;
      ctx.body = { code: 400, message: 'providerId、modelId、displayName 为必填项', data: null };
      return;
    }

    const trimmedSlug = typeof slug === 'string' ? slug.trim() : '';
    if (trimmedSlug && !isValidSlug(trimmedSlug)) {
      ctx.status = 400;
      ctx.body = { code: 400, message: 'slug 格式无效', data: null };
      return;
    }

    const capCheck = validateCapabilities(capabilities || []);
    if (!capCheck.valid) {
      ctx.status = 400;
      ctx.body = { code: 400, message: capCheck.message, data: null };
      return;
    }

    const inputCheck = validateModalities(inputTags || [], 'inputTags');
    if (!inputCheck.valid) {
      ctx.status = 400;
      ctx.body = { code: 400, message: inputCheck.message, data: null };
      return;
    }

    const outputCheck = validateModalities(outputTags || [], 'outputTags');
    if (!outputCheck.valid) {
      ctx.status = 400;
      ctx.body = { code: 400, message: outputCheck.message, data: null };
      return;
    }

    const transaction = await sequelize.transaction();

    try {
      const provider = await Provider.findByPk(providerId, { transaction });
      if (!provider) {
        await transaction.rollback();
        ctx.status = 404;
        ctx.body = { code: 404, message: '服务商不存在', data: null };
        return;
      }

      const finalSlug = trimmedSlug || await resolveUniqueSlug(AiModel, displayName || modelId, { transaction });
      if (trimmedSlug) {
        const existingSlug = await AiModel.findOne({ where: { slug: finalSlug }, transaction });
        if (existingSlug) {
          await transaction.rollback();
          ctx.status = 400;
          ctx.body = { code: 400, message: 'slug 已存在', data: null };
          return;
        }
      }

      const id = uuidv4();
      const model = await AiModel.create({
        id,
        provider_id: providerId,
        slug: finalSlug,
        model_id: modelId,
        display_name: displayName,
        default_params: defaultParams || null,
        is_active: true
      }, { transaction });

      await replaceTags(id, capabilities, inputTags, outputTags, transaction);
      await transaction.commit();

      const created = await AiModel.findByPk(id, { include: modelInclude });

      ctx.status = 200;
      ctx.body = {
        code: 201,
        message: '创建模型成功',
        data: formatAiModel(created, true)
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('创建模型失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '创建模型失败', data: null };
    }
  }

  static async getById(ctx) {
    try {
      const model = await AiModel.findByPk(ctx.params.id, { include: modelInclude });
      if (!model) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '模型不存在', data: null };
        return;
      }

      ctx.body = {
        code: 200,
        message: '获取模型详情成功',
        data: formatAiModel(model, true)
      };
    } catch (error) {
      logger.error('获取模型详情失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '获取模型详情失败', data: null };
    }
  }

  static async update(ctx) {
    const {
      providerId,
      slug,
      modelId,
      displayName,
      defaultParams,
      capabilities,
      inputTags,
      outputTags,
      isActive
    } = ctx.request.body;

    const transaction = await sequelize.transaction();

    try {
      const model = await AiModel.findByPk(ctx.params.id, { transaction });
      if (!model) {
        await transaction.rollback();
        ctx.status = 404;
        ctx.body = { code: 404, message: '模型不存在', data: null };
        return;
      }

      if (slug && slug !== model.slug) {
        if (!isValidSlug(slug)) {
          await transaction.rollback();
          ctx.status = 400;
          ctx.body = { code: 400, message: 'slug 格式无效', data: null };
          return;
        }
        const existingSlug = await AiModel.findOne({ where: { slug }, transaction });
        if (existingSlug) {
          await transaction.rollback();
          ctx.status = 400;
          ctx.body = { code: 400, message: 'slug 已存在', data: null };
          return;
        }
      }

      if (capabilities !== undefined) {
        const capCheck = validateCapabilities(capabilities);
        if (!capCheck.valid) {
          await transaction.rollback();
          ctx.status = 400;
          ctx.body = { code: 400, message: capCheck.message, data: null };
          return;
        }
      }

      if (providerId && providerId !== model.provider_id) {
        const provider = await Provider.findByPk(providerId, { transaction });
        if (!provider) {
          await transaction.rollback();
          ctx.status = 404;
          ctx.body = { code: 404, message: '服务商不存在', data: null };
          return;
        }
      }

      await model.update({
        ...(providerId !== undefined && { provider_id: providerId }),
        ...(slug !== undefined && { slug }),
        ...(modelId !== undefined && { model_id: modelId }),
        ...(displayName !== undefined && { display_name: displayName }),
        ...(defaultParams !== undefined && { default_params: defaultParams }),
        ...(isActive !== undefined && { is_active: isActive })
      }, { transaction });

      if (capabilities !== undefined || inputTags !== undefined || outputTags !== undefined) {
        const current = await AiModel.findByPk(model.id, {
          include: modelInclude,
          transaction
        });
        await replaceTags(
          model.id,
          capabilities ?? current.capabilities.map((item) => item.capability),
          inputTags ?? current.ioTags.filter((item) => item.direction === 'input').map((item) => item.modality),
          outputTags ?? current.ioTags.filter((item) => item.direction === 'output').map((item) => item.modality),
          transaction
        );
      }

      await transaction.commit();

      const updated = await AiModel.findByPk(model.id, { include: modelInclude });

      ctx.body = {
        code: 200,
        message: '更新模型成功',
        data: formatAiModel(updated, true)
      };
    } catch (error) {
      await transaction.rollback();
      logger.error('更新模型失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '更新模型失败', data: null };
    }
  }

  static async delete(ctx) {
    try {
      const model = await AiModel.findByPk(ctx.params.id, { include: modelInclude });
      if (!model) {
        ctx.status = 404;
        ctx.body = { code: 404, message: '模型不存在', data: null };
        return;
      }

      await model.update({ is_active: false });

      ctx.body = {
        code: 200,
        message: '删除模型成功',
        data: formatAiModel(model, true)
      };
    } catch (error) {
      logger.error('删除模型失败', { error: error.message });
      ctx.status = 500;
      ctx.body = { code: 500, message: '删除模型失败', data: null };
    }
  }
}

module.exports = AiModelController;
