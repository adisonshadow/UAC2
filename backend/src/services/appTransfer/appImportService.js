/**
 * 应用导入服务(review 方案 §3/§5.3)。
 *
 * 依赖链:uac 最小结构 → uac 用户数据(可选)→ application → entities(结构)
 * → databaseConnections → 物化 → entityData → apiServices → collectionPipelines
 * → outboundWebhooks → metrics → hooks → skills → storageBuckets。
 * 硬终止节:uac / application / entities(后续外键依赖结构)。
 * 软失败节:uacUsers / databaseConnections / materialization / entityData / ai — 只标红本节约,继续后续元数据。
 *
 * 关键规则:
 * - idMap 只覆盖元数据表;物化表行数据保留源主键;
 * - database_connections 先匹配(is_default+db_type → (db_type,target_schema) → name);
 *   未命中则用目标同类型连接凭证创建本地连接(绝不写入源 host/密码);
 * - 第二唯一键(route_path / function_name)撞到另一条目标记录 → 该条 failed,不静默改;
 * - overwrite 行数据 = 目标表 DELETE 后按实际列集批量插入(连接内同事务);
 * - data_only 模式:不落结构,目标无同 code 实体或版本不符 → 跳过写数。
 */
const { Op } = require('sequelize');
const models = require('../../models');
const { encryptApiKey } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const { Client: PgClient } = require('pg');
const mysql = require('mysql2/promise');
const { buildRuntimeConfig } = require('../businessData/databaseConnectionService');
const { executeMaterialization } = require('../businessData/materializationService');
const connectionRunner = require('../businessData/materialization/connectionRunner');
const {
  loadAndValidateFile,
  matchTargetConnection,
  findCredentialTemplate,
  getFileConnectionHints,
} = require('./appPreviewService');
const { pickModelFields, readTableColumns } = require('./appExportService');

const STRATEGIES = ['overwrite', 'skip', 'abort'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** materialization_runs.created_by 是 UUID,非 UUID 占位串会整节失败 */
function normalizeCreatedBy(value) {
  const s = String(value || '').trim();
  return UUID_RE.test(s) ? s : null;
}

function quotePgIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function quoteMysqlIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function normalizeValue(v) {
  return v === undefined ? null : v;
}

/** hooks 的 action_config.auth.secret(明文)→ secretEnc(目标实例密钥重加密) */
function importHookSecret(hook) {
  const cfg = hook.action_config;
  if (
    hook.action_type === 'http_request' &&
    cfg && typeof cfg === 'object' && cfg.auth && typeof cfg.auth === 'object' &&
    typeof cfg.auth.secret === 'string' && cfg.auth.secret.length
  ) {
    const nextAuth = { ...cfg.auth };
    delete nextAuth.secret;
    nextAuth.secretEnc = encryptApiKey(cfg.auth.secret);
    return { ...hook, action_config: { ...cfg, auth: nextAuth } };
  }
  if (
    hook.action_type === 'http_request' &&
    cfg && typeof cfg === 'object' && cfg.auth && typeof cfg.auth === 'object'
  ) {
    const nextAuth = { ...cfg.auth };
    delete nextAuth.secret;
    return { ...hook, action_config: { ...cfg, auth: nextAuth } };
  }
  return hook;
}

class ImportContext {
  constructor(file, strategy, options = {}) {
    this.file = file;
    this.strategy = strategy;
    this.createdBy = normalizeCreatedBy(options.createdBy);
    this.dataMode = file.options?.dataMode === 'data_only' ? 'data_only' : 'structure_and_data';
    this.includeUac = file.options?.includeUac === true;
    this.sourceAppId = file.options?.sourceApplicationId || file.application?.application_id || null;
    this.targetAppId = null;
    this.currentSection = null;
    this.idMap = {
      applications: new Map(),
      entities: new Map(),
      enums: new Map(),
      relations: new Map(),
      apiServices: new Map(),
      pipelines: new Map(),
      webhooks: new Map(),
      metrics: new Map(),
      metricCards: new Map(),
      skills: new Map(),
      tools: new Map(),
      scopes: new Map(),
      providers: new Map(),
      aiModels: new Map(),
      roles: new Map(),
      permissions: new Map(),
      users: new Map(),
      departments: new Map(),
      buckets: new Map(),
      metadataTables: new Map(),
    };
    this.targetConnections = null;
    this.connectionMatchCache = new Map();
  }

  // ---------- 节结果与链控制 ----------

  beginSection(name) {
    this.currentSection = name;
    const section = {
      status: 'ok',
      counts: { created: 0, updated: 0, skipped: 0, failed: 0 },
      errors: [],
      notes: [],
    };
    this.result.sections[name] = section;
    return section;
  }

  /** 预期跳过:写入 notes,不进 errors,避免前端当成失败 */
  skipSection(section, message) {
    section.status = 'skipped';
    section.notes.push(message);
    return section;
  }

  markFailed(section, message) {
    section.status = 'failed';
    section.errors.push(message);
    logger.warn(`[appTransfer] 导入节「${this.currentSection}」失败: ${message}`);
  }

  /** 通用条目错误记录 */
  itemFailed(section, label, error) {
    section.counts.failed += 1;
    const message = `${label}: ${error instanceof Error ? error.message : String(error)}`;
    section.errors.push(message);
    return message;
  }

  // ---------- 连接匹配 / 按目标凭证创建 ----------

  async getTargetConnections({ force = false } = {}) {
    if (force || !this.targetConnections) {
      this.targetConnections = await models.BizdataDatabaseConnection.findAll({ raw: true });
    }
    return this.targetConnections;
  }

  getConnectionHint(sourceConnId) {
    return getFileConnectionHints(this.file).find((h) => h.sourceId === sourceConnId) || null;
  }

  /**
   * 用目标同类型连接作凭证模板,创建指向目标物化库的本地连接(不用源 host/密码)。
   * @returns {Promise<object|null>} 新建连接的 raw 行
   */
  async createLocalConnectionFromTemplate(hint, section) {
    const targets = await this.getTargetConnections();
    const template = findCredentialTemplate(hint, targets);
    if (!template) {
      if (section) {
        this.itemFailed(
          section,
          hint.name || hint.sourceId,
          new Error(`目标无 ${hint.dbType || '未知'} 类型连接作凭证模板,请先在「数据库连接」页建好本地连接`),
        );
      }
      return null;
    }
    const hasDefaultOfType = targets.some((c) => c.is_default && c.db_type === hint.dbType);
    const created = await models.BizdataDatabaseConnection.create({
      name: hint.name || `${hint.dbType}-${hint.targetSchema || 'mat'}`,
      db_type: hint.dbType || template.db_type,
      host: template.host,
      port: template.port,
      username: template.username,
      password_enc: template.password_enc,
      database_name: template.database_name,
      target_schema: hint.targetSchema || template.target_schema || 'bizdata_mat',
      is_default: !hasDefaultOfType,
    });
    const row = created.toJSON ? created.toJSON() : created.get({ plain: true });
    this.targetConnections = null; // 下次强制刷新
    if (section) {
      section.counts.created += 1;
      section.notes.push(
        `已用目标连接「${template.name}」的凭证创建「${row.name}」(schema=${row.target_schema}),未使用源库 host/密码`,
      );
    }
    return row;
  }

  async resolveConnection(sourceConnId, { section = null, allowCreate = true } = {}) {
    if (!sourceConnId) return null;
    if (this.connectionMatchCache.has(sourceConnId)) {
      return this.connectionMatchCache.get(sourceConnId);
    }
    const hint = this.getConnectionHint(sourceConnId);
    let connection = null;
    if (hint) {
      const targets = await this.getTargetConnections();
      connection = matchTargetConnection(hint, targets).connection;
      if (!connection && allowCreate) {
        connection = await this.createLocalConnectionFromTemplate(hint, section);
      } else if (!connection && section) {
        this.itemFailed(section, hint.name || sourceConnId, new Error('目标未匹配到连接且未允许创建'));
      } else if (connection && section) {
        section.counts.matched = (section.counts.matched || 0) + 1;
      }
    } else if (section) {
      this.itemFailed(section, sourceConnId, new Error('导出文件中无对应连接提示'));
    }
    this.connectionMatchCache.set(sourceConnId, connection);
    return connection;
  }

  /** 预解析/创建文件中全部连接提示,写入 databaseConnections 节结果 */
  async ensureDatabaseConnections() {
    const section = this.beginSection('databaseConnections');
    // counts 扩展 matched(匹配到已有),created/failed 沿用通用字段
    section.counts.matched = 0;
    const hints = getFileConnectionHints(this.file);
    if (!hints.length) {
      return this.skipSection(section, '文件无 databaseConnections / connectionsHint');
    }
    for (const hint of hints) {
      if (!hint.sourceId) {
        this.itemFailed(section, hint.name || '(无 sourceId)', new Error('缺少 sourceId'));
        continue;
      }
      if (this.connectionMatchCache.has(hint.sourceId)) continue;
      const targets = await this.getTargetConnections();
      const matched = matchTargetConnection(hint, targets).connection;
      if (matched) {
        this.connectionMatchCache.set(hint.sourceId, matched);
        section.counts.matched += 1;
        continue;
      }
      const created = await this.createLocalConnectionFromTemplate(hint, section);
      this.connectionMatchCache.set(hint.sourceId, created);
    }
    if (section.counts.failed > 0 && section.counts.matched === 0 && section.counts.created === 0) {
      section.status = 'failed';
    } else if (section.counts.failed > 0) {
      section.status = 'failed';
    }
    return section;
  }

  // ---------- 通用 upsert ----------

  /**
   * 按业务键 upsert;返回 { row, created }。找不到/软删冲突返回 null 并由调用方记录。
   * @param {Model} model
   * @param {object} sourceRow 导出文件里的原始行
   * @param {string} uniqueKey 业务唯一键字段
   * @param {Map<string,string>} map idMap
   * @param {object} overrides 覆盖字段(如重映射后的外键)
   * @param {object} section 节结果
   * @param {object} options { transaction, secondKey: {field, model}, label }
   */
  async upsertMeta(model, sourceRow, uniqueKey, map, overrides, section, opts = {}) {
    const { transaction, secondKey = null, label = sourceRow[uniqueKey] } = opts;
    const payload = { ...pickModelFields(model, sourceRow), ...(overrides || {}) };
    const pk = model.primaryKeyAttribute;
    delete payload[pk];

    const existing = await model.findOne({ where: { [uniqueKey]: sourceRow[uniqueKey] }, transaction, paranoid: false });
    if (existing) {
      if (existing.deleted_at) {
        this.itemFailed(section, `${label}`, new Error('目标存在同键软删记录,请先恢复或物理删除后再导入'));
        return null;
      }
      if (this.strategy === 'overwrite') {
        // 第二唯一键守卫:撞到另一条目标记录 → failed,不静默改别人的键
        if (secondKey && sourceRow[secondKey.field]) {
          const conflict = await secondKey.model.findOne({
            where: { [secondKey.field]: sourceRow[secondKey.field], [uniqueKey]: { [Op.ne]: sourceRow[uniqueKey] } },
            transaction,
          });
          if (conflict) {
            this.itemFailed(section, `${label}`, new Error(`第二唯一键 ${secondKey.field}「${sourceRow[secondKey.field]}」已被 ${conflict[uniqueKey]} 占用`));
            return null;
          }
        }
        await existing.update(payload, { transaction });
        section.counts.updated += 1;
      } else {
        section.counts.skipped += 1;
      }
      map.set(sourceRow[pk], existing.get(pk));
      return { row: existing, created: false };
    }

    // 新建:第二唯一键同样需要守卫
    if (secondKey && sourceRow[secondKey.field]) {
      const conflict = await secondKey.model.findOne({
        where: { [secondKey.field]: sourceRow[secondKey.field] },
        transaction,
      });
      if (conflict) {
        this.itemFailed(section, `${label}`, new Error(`第二唯一键 ${secondKey.field}「${sourceRow[secondKey.field]}」已被 ${conflict[uniqueKey]} 占用`));
        return null;
      }
    }
    const created = await model.create(payload, { transaction });
    section.counts.created += 1;
    map.set(sourceRow[pk], created.get(pk));
    return { row: created, created: true };
  }

  /** 关联表(复合键)upsert;payload 中不覆盖 where 复合键 */
  async upsertJoin(model, whereClause, payload, section, { transaction, updateOnOverwrite = true } = {}) {
    const existing = await model.findOne({ where: whereClause, transaction });
    const extraPayload = { ...payload };
    for (const key of Object.keys(whereClause)) delete extraPayload[key];
    if (existing) {
      if (this.strategy === 'overwrite' && updateOnOverwrite && Object.keys(extraPayload).length) {
        await existing.update(extraPayload, { transaction });
        section.counts.updated += 1;
      } else {
        section.counts.skipped += 1;
      }
      return existing;
    }
    const created = await model.create({ ...whereClause, ...extraPayload }, { transaction });
    section.counts.created += 1;
    return created;
  }

  /** 在 Sequelize 事务中执行节内写入 */
  async withSectionTransaction(fn) {
    const transaction = await models.sequelize.transaction();
    try {
      const out = await fn(transaction);
      await transaction.commit();
      return out;
    } catch (e) {
      await transaction.rollback();
      throw e;
    }
  }

  // ---------- 各节实现 ----------

  /** uac 最小结构:roles / permissions / rolePermissions */
  async importUacCore() {
    const section = this.beginSection('uac');
    const uac = this.file.uac || {};
    const roles = Array.isArray(uac.roles) ? uac.roles : [];
    const permissions = Array.isArray(uac.permissions) ? uac.permissions : [];
    const rolePermissions = Array.isArray(uac.rolePermissions) ? uac.rolePermissions : [];
    if (!roles.length && !permissions.length) {
      section.status = 'ok';
      return section;
    }
    await this.withSectionTransaction(async (transaction) => {
      for (const role of roles) {
         
        await this.upsertMeta(models.Role, role, 'code', this.idMap.roles, {}, section, { transaction });
      }
      for (const perm of permissions) {
         
        await this.upsertMeta(models.Permission, perm, 'code', this.idMap.permissions, {}, section, { transaction });
      }
      for (const rp of rolePermissions) {
        const roleId = this.idMap.roles.get(rp.role_id);
        const permId = this.idMap.permissions.get(rp.permission_id);
        if (!roleId || !permId) {
          section.counts.skipped += 1;
          continue;
        }
         
        await this.upsertJoin(models.RolePermission, { role_id: roleId, permission_id: permId }, {}, section, { transaction });
      }
    });
    return section;
  }

  /** uac 用户数据(可选节):departments + closure / users / userRoles / dataPermissionRules */
  async importUacUsers() {
    const section = this.beginSection('uacUsers');
    if (!this.includeUac) {
      return this.skipSection(section, '未勾选 includeUac,跳过用户/部门数据');
    }
    const uac = this.file.uac || {};
    const departments = Array.isArray(uac.departments) ? uac.departments : [];
    const users = Array.isArray(uac.users) ? uac.users : [];
    const userRoles = Array.isArray(uac.userRoles) ? uac.userRoles : [];
    const rules = Array.isArray(uac.dataPermissionRules) ? uac.dataPermissionRules : [];

    try {
      await this.withSectionTransaction(async (transaction) => {
        // 部门按「name + 父链」匹配:父先于子处理
        const resolved = new Map(); // sourceId -> targetId
        const pending = [...departments];
        let guard = 0;
        while (pending.length && guard <= departments.length + 1) {
          guard += 1;
          for (let i = pending.length - 1; i >= 0; i -= 1) {
            const dept = pending[i];
            const parentSourceId = dept.parent_id || null;
            const parentReady = !parentSourceId || resolved.has(parentSourceId);
            if (!parentReady) continue;
            const parentTargetId = parentSourceId ? resolved.get(parentSourceId) : null;
             
            const existing = await models.Department.findOne({
              where: { name: dept.name, parent_id: parentTargetId || null },
              transaction,
              paranoid: false,
            });
            if (existing) {
              if (existing.deleted_at) {
                this.itemFailed(section, `部门「${dept.name}」`, new Error('目标存在同名软删部门'));
              } else {
                if (this.strategy === 'overwrite') {
                  await existing.update({
                    name: dept.name,
                    status: dept.status ?? existing.status,
                    description: dept.description ?? existing.description,
                  }, { transaction });
                  section.counts.updated += 1;
                } else {
                  section.counts.skipped += 1;
                }
                resolved.set(dept.department_id, existing.department_id);
              }
            } else {
              const created = await models.Department.create({
                name: dept.name,
                parent_id: parentTargetId || null,
                status: dept.status ?? 'ACTIVE',
                description: dept.description ?? null,
              }, { transaction });
              section.counts.created += 1;
              resolved.set(dept.department_id, created.department_id);
            }
            pending.splice(i, 1);
          }
        }
        // 无法定位父链的部门(悬空引用)
        for (const dept of pending) {
          this.itemFailed(section, `部门「${dept.name}」`, new Error('父部门无法定位(父链缺失)'));
        }
        for (const [sourceId, targetId] of resolved) {
          this.idMap.departments.set(sourceId, targetId);
        }

        // 重建导入部门的 department_closure
        const importedDeptIds = [...resolved.values()];
        if (importedDeptIds.length) {
          await models.DepartmentClosure.destroy({
            where: { descendant_id: { [Op.in]: importedDeptIds } },
            transaction,
          });
          const deptRows = await models.Department.findAll({
            where: { department_id: { [Op.in]: importedDeptIds } },
            raw: true,
            transaction,
          });
          const parentCache = new Map();
          const closureRows = [];
          for (const dept of deptRows) {
            let ancestorId = dept.parent_id || null;
            let depth = 1;
            while (ancestorId) {
              closureRows.push({ ancestor_id: ancestorId, descendant_id: dept.department_id, depth });
              if (!parentCache.has(ancestorId)) {
                 
                const parent = await models.Department.findByPk(ancestorId, { raw: true, transaction });
                parentCache.set(ancestorId, parent ? parent.parent_id : null);
              }
              ancestorId = parentCache.get(ancestorId);
              depth += 1;
              if (depth > 50) break; // 防环
            }
          }
          if (closureRows.length) {
            await models.DepartmentClosure.bulkCreate(closureRows, { transaction });
          }
        }

        // 用户:按 username upsert(password_hash 为 bcrypt 哈希,与实例密钥无关,可原样)
        for (const user of users) {
           
          await this.upsertMeta(models.User, user, 'username', this.idMap.users, {
            department_id: this.idMap.departments.get(user.department_id) || null,
          }, section, { transaction });
        }
        for (const ur of userRoles) {
          const userId = this.idMap.users.get(ur.user_id);
          const roleId = this.idMap.roles.get(ur.role_id);
          if (!userId || !roleId) {
            section.counts.skipped += 1;
            continue;
          }
           
          await this.upsertJoin(models.UserRole, { user_id: userId, role_id: roleId }, {}, section, { transaction });
        }
        for (const rule of rules) {
          const roleId = rule.role_id ? this.idMap.roles.get(rule.role_id) : null;
          if (rule.role_id && !roleId) {
            section.counts.skipped += 1;
            continue;
          }
           
          const existingRule = await models.DataPermissionRule.findOne({
            where: {
              role_id: roleId || null,
              resource_type: rule.resource_type,
            },
            transaction,
          });
          if (existingRule) {
            section.counts.skipped += 1;
            continue;
          }
          const payload = pickModelFields(models.DataPermissionRule, rule);
          delete payload.rule_id;
          payload.role_id = roleId || null;
           
          await models.DataPermissionRule.create(payload, { transaction });
          section.counts.created += 1;
        }
      });
    } catch (e) {
      this.markFailed(section, e.message);
    }
    return section;
  }

  /** 应用本体:按 code upsert */
  async importApplication() {
    const section = this.beginSection('application');
    const appRow = this.file.application;
    try {
      await this.withSectionTransaction(async (transaction) => {
        const existing = await models.Application.findOne({
          where: { code: appRow.code }, transaction, paranoid: false,
        });
        if (existing) {
          if (existing.deleted_at) {
            throw new Error('目标存在同 code 软删应用,请先恢复或物理删除后再导入');
          }
          this.targetAppId = existing.application_id;
          if (this.strategy === 'overwrite') {
            const payload = pickModelFields(models.Application, appRow);
            delete payload.application_id;
            delete payload.builtin_api_scope; // builtin API 授权属目标实例策略,不随导入覆盖
            await existing.update(payload, { transaction });
            section.counts.updated += 1;
          } else {
            section.counts.skipped += 1;
          }
        } else {
          const payload = pickModelFields(models.Application, appRow);
          delete payload.application_id;
          const created = await models.Application.create(payload, { transaction });
          this.targetAppId = created.application_id;
          section.counts.created += 1;
        }
        if (this.sourceAppId) {
          this.idMap.applications.set(this.sourceAppId, this.targetAppId);
        }
      });
    } catch (e) {
      this.markFailed(section, e.message);
    }
    return section;
  }

  /** 实体结构节:items / fields / enums / relations / scopeDocs(data_only 跳过) */
  async importEntities() {
    const section = this.beginSection('entities');
    if (this.dataMode === 'data_only') {
      return this.skipSection(section, 'data_only 模式不落结构,实体仅作版本指纹校验');
    }
    const entities = this.file.entities || {};
    const items = Array.isArray(entities.items) ? entities.items : [];
    const fields = Array.isArray(entities.fields) ? entities.fields : [];
    const enums = Array.isArray(entities.enums) ? entities.enums : [];
    const relations = Array.isArray(entities.relations) ? entities.relations : [];
    const scopeDocs = Array.isArray(entities.scopeDocs) ? entities.scopeDocs : [];

    try {
      await this.withSectionTransaction(async (transaction) => {
        for (const item of items) {
           
          await this.upsertMeta(models.BizdataEntity, item, 'code', this.idMap.entities, {}, section, { transaction });
        }
        for (const field of fields) {
          const entityId = this.idMap.entities.get(field.entity_id);
          if (!entityId) {
            section.counts.skipped += 1;
            continue;
          }
           
          const existing = await models.BizdataEntityField.findOne({
            where: { entity_id: entityId, field_key: field.field_key },
            transaction,
          });
          if (existing) {
            if (this.strategy === 'overwrite') {
              const payload = pickModelFields(models.BizdataEntityField, field);
              delete payload.id;
              payload.entity_id = entityId;
              await existing.update(payload, { transaction });
              section.counts.updated += 1;
            } else {
              section.counts.skipped += 1;
            }
          } else {
            const payload = pickModelFields(models.BizdataEntityField, field);
            delete payload.id;
            payload.entity_id = entityId;
            await models.BizdataEntityField.create(payload, { transaction });
            section.counts.created += 1;
          }
        }
        for (const en of enums) {
           
          await this.upsertMeta(models.BizdataEnum, en, 'code', this.idMap.enums, {}, section, { transaction });
        }
        for (const rel of relations) {
          const fromId = this.idMap.entities.get(rel.from_entity_id);
          const toId = this.idMap.entities.get(rel.to_entity_id);
          if (!fromId || !toId) {
            section.counts.skipped += 1;
            section.errors.push(`实体关系「${rel.name || rel.id}」端点实体缺失,已跳过`);
            continue;
          }
           
          const existing = await models.BizdataRelation.findOne({
            where: { type: rel.type, name: rel.name, from_entity_id: fromId, to_entity_id: toId },
            transaction,
          });
          if (existing) {
            if (this.strategy === 'overwrite') {
              const payload = pickModelFields(models.BizdataRelation, rel);
              delete payload.id;
              payload.from_entity_id = fromId;
              payload.to_entity_id = toId;
              await existing.update(payload, { transaction });
              section.counts.updated += 1;
            } else {
              section.counts.skipped += 1;
            }
            this.idMap.relations.set(rel.id, existing.id);
          } else {
            const payload = pickModelFields(models.BizdataRelation, rel);
            delete payload.id;
            payload.from_entity_id = fromId;
            payload.to_entity_id = toId;
            const created = await models.BizdataRelation.create(payload, { transaction });
            section.counts.created += 1;
            this.idMap.relations.set(rel.id, created.id);
          }
        }
        for (const doc of scopeDocs) {
          // scope_docs 以 code 为主键
           
          const existing = await models.BizdataScopeDoc.findByPk(doc.code, { transaction });
          if (existing) {
            if (this.strategy === 'overwrite') {
              await existing.update({ content_markdown: doc.content_markdown ?? null }, { transaction });
              section.counts.updated += 1;
            } else {
              section.counts.skipped += 1;
            }
          } else {
            await models.BizdataScopeDoc.create({
              code: doc.code,
              content_markdown: doc.content_markdown ?? null,
            }, { transaction });
            section.counts.created += 1;
          }
        }
      });
    } catch (e) {
      this.markFailed(section, e.message);
    }
    return section;
  }

  /** 物化:结构导入后按匹配连接分组执行 executeMaterialization(覆盖本次全部源自源物化实体的实体) */
  async materializeEntities() {
    const section = this.beginSection('materialization');
    if (this.dataMode === 'data_only') {
      return this.skipSection(section, 'data_only 模式在写数阶段按目标现结构物化');
    }
    const entityData = Array.isArray(this.file.entityData) ? this.file.entityData : [];
    // 所有带连接信息的实体(无论是否带行数据)都参与物化,保证目标端物理表就绪
    const byConnection = new Map(); // targetConnId -> [{entityId, version, entityCode}]
    const skippedEntities = [];
    for (const item of entityData) {
      if (!item.connectionSourceId) {
        skippedEntities.push(item.entityCode);
        continue;
      }
       
      const conn = await this.resolveConnection(item.connectionSourceId);
      if (!conn) {
        skippedEntities.push(item.entityCode);
        continue;
      }
      const entityId = this.idMap.entities.get(
        (this.file.entities?.items || []).find((e) => e.code === item.entityCode)?.id,
      );
      if (!entityId) continue;
      if (!byConnection.has(conn.id)) byConnection.set(conn.id, []);
      byConnection.get(conn.id).push({ entityId, version: item.entityVersion, entityCode: item.entityCode });
    }
    if (skippedEntities.length) {
      section.errors.push(`以下实体因连接未匹配/无法创建未安排物化(其行数据也将失败): ${skippedEntities.join(', ')}`);
    }
    try {
      for (const [connId, entries] of byConnection) {
        const expectedVersions = {};
        for (const entry of entries) expectedVersions[entry.entityId] = entry.version;
         
        await executeMaterialization({
          entityIds: entries.map((e) => e.entityId),
          connectionId: connId,
          expectedVersions,
          createTargetIfMissing: true,
          createdBy: this.createdBy,
        });
        section.counts.created += entries.length;
      }
    } catch (e) {
      this.markFailed(section, e.message);
    }
    return section;
  }

  /**
   * 行数据(外部连接,失败不回滚主库,已写入的行数据保留并在结果中说明)。
   * 保留源主键;overwrite = DELETE 后按实际列集批量插入,同连接事务。
   */
  async importEntityData() {
    const section = this.beginSection('entityData');
    const entityData = Array.isArray(this.file.entityData) ? this.file.entityData : [];
    if (!entityData.length) {
      return this.skipSection(section, '文件不含行数据');
    }
    for (const item of entityData) {
      const label = `实体「${item.entityCode}」`;
      try {
        if (item.rowsOmitted) {
          section.counts.skipped += 1;
          section.errors.push(`${label}: ${item.omitReason || '导出时已跳过行数据'}`);
          continue;
        }
        const rows = Array.isArray(item.rows) ? item.rows : [];
        // 目标实体定位与版本校验
        let targetEntity = null;
        if (this.dataMode === 'data_only') {
           
          targetEntity = await models.BizdataEntity.findOne({ where: { code: item.entityCode }, raw: true });
          if (!targetEntity) {
            section.counts.skipped += 1;
            section.errors.push(`${label}: 目标无同 code 实体,data_only 模式跳过写数`);
            continue;
          }
        } else {
          const sourceEntity = (this.file.entities?.items || []).find((e) => e.code === item.entityCode);
          const targetId = sourceEntity ? this.idMap.entities.get(sourceEntity.id) : null;
          if (!targetId) {
            section.counts.skipped += 1;
            section.errors.push(`${label}: 结构导入后未找到目标实体`);
            continue;
          }
           
          targetEntity = await models.BizdataEntity.findByPk(targetId, { raw: true });
        }
        if (!targetEntity) {
          section.counts.failed += 1;
          section.errors.push(`${label}: 目标实体不存在`);
          continue;
        }
        if (Number(targetEntity.version) !== Number(item.entityVersion)) {
          section.counts.failed += 1;
          section.errors.push(`${label}: 版本不一致(目标 v${targetEntity.version},文件 v${item.entityVersion}),不写数`);
          continue;
        }

        // 连接匹配
        const conn = await this.resolveConnection(item.connectionSourceId);
        if (!conn) {
          section.counts.failed += 1;
          section.errors.push(`${label}: 源连接在目标实例未匹配到,禁止兜底写入`);
          continue;
        }
        const runtime = buildRuntimeConfig(conn);
        if (!['postgresql', 'mysql'].includes(runtime.dbType)) {
          section.counts.failed += 1;
          section.errors.push(`${label}: 行数据暂仅支持 postgresql/mysql,目标连接为 ${runtime.dbType}`);
          continue;
        }

        if (this.dataMode === 'data_only') {
          // data_only:按目标实体自身现结构做幂等物化(CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS),
          // 保证物理表存在;不使用文件结构落库
          try {
             
            await executeMaterialization({
              entityIds: [targetEntity.id],
              connectionId: conn.id,
              createTargetIfMissing: true,
              createdBy: this.createdBy,
            });
          } catch (e) {
            section.counts.failed += 1;
            section.errors.push(`${label}: 物化失败(按目标现结构): ${e.message}`);
            continue;
          }
        }

        // 列集校验:文件物理列可能比 entity_fields 多,先按导出列补 DDL 再校验
         
        let actualColumns = await readTableColumns(runtime, item.targetSchema, item.tableName);
        const fileCols = (item.columns || []).map((c) => c.name);
        await ensureFileColumnsOnTarget(runtime, item.targetSchema, item.tableName, item.columns || [], actualColumns);
        actualColumns = await readTableColumns(runtime, item.targetSchema, item.tableName);
        const actualNames = new Set(actualColumns.map((c) => c.name));
        const missingInTarget = fileCols.filter((c) => !actualNames.has(c));
        if (missingInTarget.length) {
          section.counts.failed += 1;
          section.errors.push(`${label}: 目标表缺少列 [${missingInTarget.join(', ')}](补列后仍缺失)`);
          continue;
        }
        const requiredMissing = actualColumns
          .filter((c) => c.required && !fileCols.includes(c.name))
          .map((c) => c.name);
        if (requiredMissing.length) {
          section.counts.failed += 1;
          section.errors.push(`${label}: 目标必填列 [${requiredMissing.join(', ')}] 文件未提供(DDL 差异)`);
          continue;
        }
        const cols = fileCols.filter((c) => actualNames.has(c));
        if (!cols.length) {
          section.counts.failed += 1;
          section.errors.push(`${label}: 无可写入列`);
          continue;
        }

         
        const writeResult = await writeEntityRows(runtime, item.targetSchema, item.tableName, cols, rows, this.strategy);
        section.counts[writeResult] = (section.counts[writeResult] || 0) + 1;
      } catch (e) {
        this.itemFailed(section, label, e);
      }
    }
    return section;
  }

  /** API 服务:items + operations + permissions */
  async importApiServices() {
    const section = this.beginSection('apiServices');
    const api = this.file.apiServices || {};
    const items = Array.isArray(api.items) ? api.items : [];
    const operations = Array.isArray(api.operations) ? api.operations : [];
    const permissions = Array.isArray(api.permissions) ? api.permissions : [];
    try {
      await this.withSectionTransaction(async (transaction) => {
        for (const svc of items) {
          const conn = await this.resolveConnection(svc.connection_id);
          if (!conn) {
            this.itemFailed(section, `API 服务「${svc.code}」`, new Error('源连接在目标实例未匹配到,服务未导入'));
            continue;
          }
          const overrides = {
            connection_id: conn.id,
            entity_id: svc.entity_id ? (this.idMap.entities.get(svc.entity_id) || null) : null,
            version: svc.version ?? 0,
          };
           
          const result = await this.upsertMeta(models.BizdataApiService, svc, 'code', this.idMap.apiServices, overrides, section, {
            transaction,
            secondKey: { field: 'route_path', model: models.BizdataApiService },
          });
          if (!result) continue;
          // 已发布服务被覆盖更新后回退 draft,避免目标端路由与实现不一致
          if (this.strategy === 'overwrite' && result.row.status === 'published') {
            await result.row.update({ status: 'draft', published_at: null }, { transaction });
          }
        }
        for (const op of operations) {
          const serviceId = this.idMap.apiServices.get(op.api_service_id);
          if (!serviceId) {
            section.counts.skipped += 1;
            continue;
          }
           
          await this.upsertJoin(
            models.BizdataApiServiceOperation,
            { api_service_id: serviceId, operation: op.operation },
            pickModelFields(models.BizdataApiServiceOperation, op),
            section,
            { transaction },
          );
        }
        for (const perm of permissions) {
          const serviceId = this.idMap.apiServices.get(perm.api_service_id);
          if (!serviceId) {
            section.counts.skipped += 1;
            continue;
          }
          let grantId = null;
          if (perm.grant_type === 'application') {
            if (perm.grant_id !== this.sourceAppId) {
              section.counts.skipped += 1;
              section.errors.push(`API 授权(application)指向未导出的其他应用,已跳过`);
              continue;
            }
            grantId = this.targetAppId;
          } else if (perm.grant_type === 'role') {
            grantId = this.idMap.roles.get(perm.grant_id) || null;
            if (!grantId) {
              section.counts.skipped += 1;
              section.errors.push(`API 授权(role)指向未导入的角色,已跳过`);
              continue;
            }
          } else if (perm.grant_type === 'department') {
            grantId = this.idMap.departments.get(perm.grant_id) || null;
            if (!grantId) {
              section.counts.skipped += 1;
              section.errors.push(`API 授权(department)指向未导入的部门,已跳过`);
              continue;
            }
          } else {
            section.counts.skipped += 1;
            continue;
          }
           
          await this.upsertJoin(
            models.BizdataApiServicePermission,
            { api_service_id: serviceId, grant_type: perm.grant_type, grant_id: grantId },
            { actions: perm.actions ?? [] },
            section,
            { transaction },
          );
        }
      });
    } catch (e) {
      this.markFailed(section, e.message);
    }
    return section;
  }

  /** 采集管道:items + applications(仅本应用行) */
  async importCollectionPipelines() {
    const section = this.beginSection('collectionPipelines');
    const cp = this.file.collectionPipelines || {};
    const items = Array.isArray(cp.items) ? cp.items : [];
    const applications = Array.isArray(cp.applications) ? cp.applications : [];
    try {
      await this.withSectionTransaction(async (transaction) => {
        for (const pipeline of items) {
          const conn = await this.resolveConnection(pipeline.connection_id);
          if (!conn) {
            this.itemFailed(section, `采集管道「${pipeline.code}」`, new Error('源连接在目标实例未匹配到,管道未导入'));
            continue;
          }
          const overrides = {
            connection_id: conn.id,
            entity_id: pipeline.entity_id ? (this.idMap.entities.get(pipeline.entity_id) || null) : null,
          };
           
          const result = await this.upsertMeta(models.BizdataCollectionPipeline, pipeline, 'code', this.idMap.pipelines, overrides, section, {
            transaction,
            secondKey: { field: 'route_path', model: models.BizdataCollectionPipeline },
          });
          if (!result) continue;
          if (this.strategy === 'overwrite' && result.row.status === 'published') {
            await result.row.update({ status: 'draft', published_at: null }, { transaction });
          }
        }
        for (const link of applications) {
          const pipelineId = this.idMap.pipelines.get(link.pipeline_id);
          if (!pipelineId || link.application_id !== this.sourceAppId) {
            section.counts.skipped += 1;
            continue;
          }
           
          await this.upsertJoin(
            models.BizdataCollectionPipelineApplication,
            { pipeline_id: pipelineId, application_id: this.targetAppId },
            {},
            section,
            { transaction, updateOnOverwrite: false },
          );
        }
      });
    } catch (e) {
      this.markFailed(section, e.message);
    }
    return section;
  }

  /** Outbound Webhooks(auth_secret 明文 → 目标实例重加密) */
  async importOutboundWebhooks() {
    const section = this.beginSection('outboundWebhooks');
    const webhooks = Array.isArray(this.file.outboundWebhooks) ? this.file.outboundWebhooks : [];
    try {
      await this.withSectionTransaction(async (transaction) => {
        for (const webhook of webhooks) {
          const payload = pickModelFields(models.OutboundWebhook, webhook);
          delete payload.auth_secret_enc;
          payload.auth_secret_enc = webhook.auth_secret ? encryptApiKey(webhook.auth_secret) : null;
          payload.trigger_api_service_id = webhook.trigger_api_service_id
            ? (this.idMap.apiServices.get(webhook.trigger_api_service_id) || null)
            : null;
          delete payload.auth_secret;
           
          const result = await this.upsertMetaRaw(
            models.OutboundWebhook, webhook, 'code', this.idMap.webhooks, payload, section, { transaction },
          );
          if (!result) continue;
          if (this.strategy === 'overwrite' && result.row.status === 'published') {
            await result.row.update({ status: 'draft', published_at: null }, { transaction });
          }
        }
      });
    } catch (e) {
      this.markFailed(section, e.message);
    }
    return section;
  }

  /** 与 upsertMeta 相同,但 payload 由调用方给足(用于密文重加密后的整体覆盖) */
  async upsertMetaRaw(model, sourceRow, uniqueKey, map, payload, section, opts = {}) {
    const { transaction } = opts;
    const pk = model.primaryKeyAttribute;
    const cleanPayload = { ...payload };
    delete cleanPayload[pk];
    const existing = await model.findOne({ where: { [uniqueKey]: sourceRow[uniqueKey] }, transaction, paranoid: false });
    if (existing) {
      if (existing.deleted_at) {
        this.itemFailed(section, String(sourceRow[uniqueKey]), new Error('目标存在同键软删记录'));
        return null;
      }
      if (this.strategy === 'overwrite') {
        await existing.update(cleanPayload, { transaction });
        section.counts.updated += 1;
      } else {
        section.counts.skipped += 1;
      }
      map.set(sourceRow[pk], existing.get(pk));
      return { row: existing, created: false };
    }
    const created = await model.create(cleanPayload, { transaction });
    section.counts.created += 1;
    map.set(sourceRow[pk], created.get(pk));
    return { row: created, created: true };
  }

  /** 指标:items + cards */
  async importMetrics() {
    const section = this.beginSection('metrics');
    const metrics = this.file.metrics || {};
    const items = Array.isArray(metrics.items) ? metrics.items : [];
    const cards = Array.isArray(metrics.cards) ? metrics.cards : [];
    try {
      await this.withSectionTransaction(async (transaction) => {
        for (const metric of items) {
          const conn = metric.connection_id ? await this.resolveConnection(metric.connection_id) : null;
          if (metric.connection_id && !conn) {
            section.errors.push(`指标「${metric.code}」的源连接未匹配到,connection_id 置空`);
          }
           
          await this.upsertMeta(models.BizdataMetric, metric, 'code', this.idMap.metrics, {
            connection_id: conn ? conn.id : null,
            last_computed_at: null,
            last_value: null,
          }, section, { transaction });
        }
        for (const card of cards) {
          const metricId = this.idMap.metrics.get(card.metric_id);
          if (!metricId) {
            section.counts.skipped += 1;
            section.errors.push(`指标卡片「${card.code}」引用的指标未导入,已跳过`);
            continue;
          }
           
          await this.upsertMeta(models.BizdataMetricCard, card, 'code', this.idMap.metricCards, {
            metric_id: metricId,
          }, section, { transaction });
        }
      });
    } catch (e) {
      this.markFailed(section, e.message);
    }
    return section;
  }

  /** 钩子:按 (name, event_type) 匹配;多条命中 → failed 要求人工改名 */
  async importHooks() {
    const section = this.beginSection('hooks');
    const hooks = Array.isArray(this.file.hooks) ? this.file.hooks : [];
    try {
      await this.withSectionTransaction(async (transaction) => {
        for (const raw of hooks) {
          const hook = importHookSecret(raw);
           
          const matches = await models.AutomationHook.findAll({
            where: { name: hook.name, event_type: hook.event_type },
            transaction,
          });
          if (matches.length > 1) {
            this.itemFailed(section, `钩子「${hook.name}」`, new Error(`目标存在 ${matches.length} 条同名同事件钩子,请人工改名后再导入`));
            continue;
          }
          const payload = pickModelFields(models.AutomationHook, hook);
          delete payload.id;
          delete payload.deleted_at;
          payload.consecutive_failures = 0;
          if (matches.length === 1) {
            if (this.strategy === 'overwrite') {
              await matches[0].update(payload, { transaction });
              section.counts.updated += 1;
            } else {
              section.counts.skipped += 1;
            }
          } else {
            await models.AutomationHook.create(payload, { transaction });
            section.counts.created += 1;
          }
        }
      });
    } catch (e) {
      this.markFailed(section, e.message);
    }
    return section;
  }

  /** Skills:scopes → tools → skills → skillTools → skillApplications */
  async importSkills() {
    const section = this.beginSection('skills');
    const skills = this.file.skills || {};
    const scopes = Array.isArray(skills.scopes) ? skills.scopes : [];
    const tools = Array.isArray(skills.tools) ? skills.tools : [];
    const items = Array.isArray(skills.items) ? skills.items : [];
    const skillTools = Array.isArray(skills.skillTools) ? skills.skillTools : [];
    const appLinks = Array.isArray(skills.applications) ? skills.applications : [];
    try {
      await this.withSectionTransaction(async (transaction) => {
        for (const scope of scopes) {
           
          await this.upsertMeta(models.Scope, scope, 'slug', this.idMap.scopes, {}, section, { transaction });
        }
        for (const tool of tools) {
          const overrides = {
            scope_id: tool.scope_id ? (this.idMap.scopes.get(tool.scope_id) || null) : null,
          };
           
          await this.upsertMeta(models.Tool, tool, 'slug', this.idMap.tools, overrides, section, {
            transaction,
            secondKey: { field: 'function_name', model: models.Tool },
          });
        }
        for (const skill of items) {
          const overrides = {
            scope_id: skill.scope_id ? (this.idMap.scopes.get(skill.scope_id) || null) : null,
          };
           
          await this.upsertMeta(models.Skill, skill, 'slug', this.idMap.skills, overrides, section, { transaction });
        }
        for (const st of skillTools) {
          const skillId = this.idMap.skills.get(st.skill_id);
          const toolId = this.idMap.tools.get(st.tool_id);
          if (!skillId || !toolId) {
            section.counts.skipped += 1;
            continue;
          }
           
          await this.upsertJoin(models.SkillTool, { skill_id: skillId, tool_id: toolId }, {
            sort_order: st.sort_order ?? 0,
          }, section, { transaction });
        }
        for (const link of appLinks) {
          const skillId = this.idMap.skills.get(link.skill_id);
          if (!skillId || link.application_id !== this.sourceAppId) {
            section.counts.skipped += 1;
            continue;
          }
          // 应用绑定关系无论策略都补齐(否则目标端 capabilities 看不到该专用 Skill)
           
          const existing = await models.SkillApplication.findOne({
            where: { skill_id: skillId, application_id: this.targetAppId },
            transaction,
          });
          if (!existing) {
            await models.SkillApplication.create({ skill_id: skillId, application_id: this.targetAppId }, { transaction });
            section.counts.created += 1;
          } else {
            section.counts.skipped += 1;
          }
        }
      });
    } catch (e) {
      this.markFailed(section, e.message);
    }
    return section;
  }

  remapMetadataTargetId(table) {
    if (table.target_type === 'entity') return this.idMap.entities.get(table.target_id) || null;
    if (table.target_type === 'metric') return this.idMap.metrics.get(table.target_id) || null;
    if (table.target_type === 'enum') return this.idMap.enums.get(table.target_id) || null;
    return null;
  }

  async resolveStandardId(row, section, transaction) {
    if (row.standard_code && row.standard_version) {
      const std = await models.BizdataDataStandard.findOne({
        where: { code: row.standard_code, version: row.standard_version },
        transaction,
      });
      if (std) return std.id;
      section.notes.push(`数据标准 ${row.standard_code} v${row.standard_version} 在目标不存在,已置空(请先导入 EADAF 平台包)`);
      return null;
    }
    return null;
  }

  /** 实体绑定的逻辑元数据;standard_id 按目标库 code+version 重映射 */
  async importMetadata() {
    const section = this.beginSection('metadata');
    const meta = this.file.metadata || {};
    const tables = Array.isArray(meta.tables) ? meta.tables : [];
    const fields = Array.isArray(meta.fields) ? meta.fields : [];
    if (!tables.length && !fields.length) {
      return this.skipSection(section, '文件无逻辑元数据节');
    }
    try {
      await this.withSectionTransaction(async (transaction) => {
        for (const table of tables) {
          const targetId = this.remapMetadataTargetId(table);
          if (!targetId) {
            section.notes.push(`元数据表「${table.code || table.id}」的目标 ${table.target_type} 未在本次导入中落库,已跳过`);
            section.counts.skipped += 1;
            continue;
          }
          const payload = pickModelFields(models.BizdataMetadataTable, table);
          delete payload.id;
          payload.target_id = targetId;
          payload.standard_id = await this.resolveStandardId(table, section, transaction);

          if (table.metadata_code) {
            const conflict = await models.BizdataMetadataTable.findOne({
              where: { metadata_code: table.metadata_code },
              transaction,
            });
            if (conflict && (conflict.target_type !== table.target_type || conflict.target_id !== targetId)) {
              this.itemFailed(section, `元数据表「${table.code}」`, new Error(`metadata_code「${table.metadata_code}」已被占用`));
              continue;
            }
          }

          const existing = await models.BizdataMetadataTable.findOne({
            where: { target_type: table.target_type, target_id: targetId },
            transaction,
          });
          if (existing) {
            if (this.strategy === 'overwrite') {
              await existing.update(payload, { transaction });
              section.counts.updated += 1;
            } else {
              section.counts.skipped += 1;
            }
            this.idMap.metadataTables.set(table.id, existing.id);
          } else {
            const created = await models.BizdataMetadataTable.create(payload, { transaction });
            section.counts.created += 1;
            this.idMap.metadataTables.set(table.id, created.id);
          }
        }

        for (const field of fields) {
          const tableId = this.idMap.metadataTables.get(field.metadata_table_id);
          if (!tableId) {
            section.counts.skipped += 1;
            continue;
          }
          const payload = pickModelFields(models.BizdataMetadataField, field);
          delete payload.id;
          payload.metadata_table_id = tableId;
          payload.standard_id = await this.resolveStandardId(field, section, transaction);

          if (field.metadata_code) {
            const conflict = await models.BizdataMetadataField.findOne({
              where: { metadata_code: field.metadata_code },
              transaction,
            });
            if (conflict && (conflict.metadata_table_id !== tableId || conflict.field_key !== field.field_key)) {
              this.itemFailed(section, `元数据字段「${field.field_key}」`, new Error(`metadata_code「${field.metadata_code}」已被占用`));
              continue;
            }
          }

          const existing = await models.BizdataMetadataField.findOne({
            where: { metadata_table_id: tableId, field_key: field.field_key },
            transaction,
          });
          if (existing) {
            if (this.strategy === 'overwrite') {
              await existing.update(payload, { transaction });
              section.counts.updated += 1;
            } else {
              section.counts.skipped += 1;
            }
          } else {
            await models.BizdataMetadataField.create(payload, { transaction });
            section.counts.created += 1;
          }
        }
      });
    } catch (e) {
      this.markFailed(section, e.message);
    }
    return section;
  }

  /** 存储桶(仅元数据,不含对象文件) */
  async importStorageBuckets() {
    const section = this.beginSection('storageBuckets');
    const buckets = Array.isArray(this.file.storageBuckets) ? this.file.storageBuckets : [];
    try {
      await this.withSectionTransaction(async (transaction) => {
        for (const bucket of buckets) {
          const overrides = { application_id: this.targetAppId };
          if (bucket.access_restrictions?.role_ids?.length) {
            section.errors.push(`存储桶「${bucket.code}」的 access_restrictions.role_ids 指向目标实例角色,请导入后人工核对`);
          }
           
          await this.upsertMeta(models.StorageBucket, bucket, 'code', this.idMap.buckets, overrides, section, { transaction });
        }
      });
    } catch (e) {
      this.markFailed(section, e.message);
    }
    return section;
  }
}

function mapPgImportColumnType(dataType) {
  const t = String(dataType || '').toLowerCase();
  if (t === 'uuid') return 'UUID';
  if (t === 'text') return 'TEXT';
  if (t.includes('character') || t === 'varchar') return 'TEXT';
  if (t === 'integer' || t === 'int' || t === 'int4') return 'INTEGER';
  if (t === 'bigint' || t === 'int8') return 'BIGINT';
  if (t === 'smallint') return 'SMALLINT';
  if (t === 'boolean') return 'BOOLEAN';
  if (t === 'jsonb') return 'JSONB';
  if (t === 'json') return 'JSON';
  if (t === 'date') return 'DATE';
  if (t.includes('timestamp with time zone') || t === 'timestamptz') return 'TIMESTAMPTZ';
  if (t.includes('timestamp')) return 'TIMESTAMP';
  if (t === 'numeric' || t === 'decimal') return 'NUMERIC';
  if (t === 'double precision' || t === 'float8') return 'DOUBLE PRECISION';
  if (t === 'real' || t === 'float4') return 'REAL';
  if (t.includes('time')) return 'TIMESTAMPTZ';
  return 'TEXT';
}

function mapMysqlImportColumnType(dataType) {
  const t = String(dataType || '').toLowerCase();
  if (t === 'varchar' || t === 'char' || t === 'text' || t.includes('text')) return 'TEXT';
  if (t === 'int' || t === 'integer') return 'INT';
  if (t === 'bigint') return 'BIGINT';
  if (t === 'tinyint') return 'TINYINT';
  if (t === 'datetime' || t === 'timestamp') return 'DATETIME';
  if (t === 'date') return 'DATE';
  if (t === 'json') return 'JSON';
  if (t === 'decimal' || t === 'numeric') return 'DECIMAL(20,6)';
  if (t === 'double' || t === 'float') return 'DOUBLE';
  if (t === 'boolean' || t === 'bool') return 'TINYINT(1)';
  return 'TEXT';
}

/** 物化只按 entity_fields 建表;导出列来自源物理表,缺列时按文件类型补上以便写数 */
async function ensureFileColumnsOnTarget(runtime, schemaName, tableName, fileColumns, actualColumns) {
  const actualNames = new Set((actualColumns || []).map((c) => c.name));
  const missing = (fileColumns || []).filter((c) => c && c.name && !actualNames.has(c.name));
  if (!missing.length) return;
  if (runtime.dbType === 'postgresql') {
    await connectionRunner.withPgClient(runtime, async (client) => {
      for (const col of missing) {
        const typeSql = mapPgImportColumnType(col.dataType);
        await client.query(
          `ALTER TABLE ${quotePgIdentifier(schemaName)}.${quotePgIdentifier(tableName)} ADD COLUMN IF NOT EXISTS ${quotePgIdentifier(col.name)} ${typeSql}`,
        );
      }
    });
    return;
  }
  if (runtime.dbType === 'mysql') {
    await connectionRunner.withMysqlClient(runtime, async (conn) => {
      for (const col of missing) {
        const typeSql = mapMysqlImportColumnType(col.dataType);
        try {
          await conn.query(
            `ALTER TABLE ${quoteMysqlIdentifier(schemaName || runtime.databaseName)}.${quoteMysqlIdentifier(tableName)} ADD COLUMN ${quoteMysqlIdentifier(col.name)} ${typeSql} NULL`,
          );
        } catch (e) {
          const msg = String(e.message || e);
          if (!/duplicate column/i.test(msg)) throw e;
        }
      }
    }, { database: schemaName || runtime.databaseName });
  }
}

function buildPgValuesPlaceholders(rowCount, colCount) {
  const parts = [];
  let n = 1;
  for (let r = 0; r < rowCount; r += 1) {
    const cells = [];
    for (let c = 0; c < colCount; c += 1) {
      cells.push(`$${n}`);
      n += 1;
    }
    parts.push(`(${cells.join(', ')})`);
  }
  return parts.join(', ');
}

/** 行数据写入:overwrite = DELETE + 批量 INSERT(连接内同事务);skip = 非空即跳过 */
async function writeEntityRows(runtime, schemaName, tableName, cols, rows, strategy) {
  if (!rows.length) return 'skipped';
  if (runtime.dbType === 'postgresql') {
    const client = new PgClient({
      host: runtime.host, port: runtime.port, user: runtime.username,
      password: runtime.password, database: runtime.databaseName,
    });
    await client.connect();
    try {
      await client.query('BEGIN');
      try {
        if (strategy === 'overwrite') {
          await client.query(`DELETE FROM ${quotePgIdentifier(schemaName)}.${quotePgIdentifier(tableName)}`);
        } else {
          const cnt = await client.query(`SELECT COUNT(*)::int AS count FROM ${quotePgIdentifier(schemaName)}.${quotePgIdentifier(tableName)}`);
          if (Number(cnt.rows[0]?.count || 0) > 0) {
            await client.query('ROLLBACK');
            return 'skipped';
          }
        }
        const colList = cols.map(quotePgIdentifier).join(', ');
        const chunkSize = Math.max(1, Math.floor(60000 / cols.length));
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valuesSql = buildPgValuesPlaceholders(chunk.length, cols.length);
          const params = chunk.flatMap((row) => cols.map((c) => normalizeValue(row[c])));
           
          await client.query(`INSERT INTO ${quotePgIdentifier(schemaName)}.${quotePgIdentifier(tableName)} (${colList}) VALUES ${valuesSql}`, params);
        }
        await client.query('COMMIT');
        return 'created';
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    } finally {
      await client.end().catch(() => {});
    }
  }
  if (runtime.dbType === 'mysql') {
    const conn = await mysql.createConnection({
      host: runtime.host, port: runtime.port || 3306, user: runtime.username,
      password: runtime.password || undefined, database: runtime.databaseName,
      multipleStatements: false,
    });
    try {
      await conn.beginTransaction();
      const fullName = `${quoteMysqlIdentifier(schemaName || runtime.databaseName)}.${quoteMysqlIdentifier(tableName)}`;
      if (strategy === 'overwrite') {
        await conn.query(`DELETE FROM ${fullName}`);
      } else {
        const [cntRows] = await conn.query(`SELECT COUNT(*) AS count FROM ${fullName}`);
        if (Number(cntRows[0]?.count || 0) > 0) {
          await conn.rollback();
          return 'skipped';
        }
      }
      const colList = cols.map(quoteMysqlIdentifier).join(', ');
      const chunkSize = Math.max(1, Math.min(500, Math.floor(60000 / cols.length)));
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const valuesSql = chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ');
        const params = chunk.flatMap((row) => cols.map((c) => normalizeValue(row[c])));
         
        await conn.query(`INSERT INTO ${fullName} (${colList}) VALUES ${valuesSql}`, params);
      }
      await conn.commit();
      return 'created';
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      await conn.end().catch(() => {});
    }
  }
  throw new Error(`不支持的行数据库类型: ${runtime.dbType}`);
}

/**
 * 导入主入口。
 * @param {string} filePath 上传临时文件
 * @param {string} strategy overwrite | skip | abort
 * @param {{ createdBy?: string }} [options] createdBy 须为操作者 UUID,否则物化 run 记空
 */
async function importAppFile(filePath, strategy = 'overwrite', options = {}) {
  const effectiveStrategy = STRATEGIES.includes(strategy) ? strategy : 'overwrite';
  const file = await loadAndValidateFile(filePath);
  const ctx = new ImportContext(file, effectiveStrategy, options);
  const result = { strategy: effectiveStrategy, sections: {}, warnings: [], durationMs: 0 };
  ctx.result = result;
  const startedAt = Date.now();

  // abort:先全量预检,有冲突则不写任何数据
  if (effectiveStrategy === 'abort') {
    const { previewImportFile } = require('./appPreviewService');
    const preview = await previewImportFile(filePath);
    if (preview.conflicts.length || preview.hookMultiMatch.length) {
      result.aborted = true;
      result.sections = { aborted: { status: 'skipped', counts: {}, errors: ['abort 策略:存在冲突,未写入任何数据'], notes: [] } };
      result.conflicts = preview.conflicts;
      result.hookMultiMatch = preview.hookMultiMatch;
      result.durationMs = Date.now() - startedAt;
      return result;
    }
  }

  const chainSteps = [
    ['uac', () => ctx.importUacCore()],
    ['uacUsers', () => ctx.importUacUsers()],
    ['application', () => ctx.importApplication()],
    ['entities', () => ctx.importEntities()],
    ['databaseConnections', () => ctx.ensureDatabaseConnections()],
    ['materialization', () => ctx.materializeEntities()],
    ['entityData', () => ctx.importEntityData()],
    ['apiServices', () => ctx.importApiServices()],
    ['collectionPipelines', () => ctx.importCollectionPipelines()],
    ['outboundWebhooks', () => ctx.importOutboundWebhooks()],
    ['metrics', () => ctx.importMetrics()],
    ['metadata', () => ctx.importMetadata()],
    ['hooks', () => ctx.importHooks()],
    ['skills', () => ctx.importSkills()],
    ['storageBuckets', () => ctx.importStorageBuckets()],
  ];
  // 物化/行数据/连接创建失败不挡住 API 等元数据;uacUsers / metadata 本就可选
  const softFailSections = new Set(['uacUsers', 'databaseConnections', 'materialization', 'entityData', 'metadata']);

  for (const [name, step] of chainSteps) {
     
    const section = await step();
    if (section.status !== 'failed') continue;
    if (softFailSections.has(name)) {
      result.warnings.push(`「${name}」节失败,已继续导入后续元数据`);
      continue;
    }
    result.chainStoppedAt = name;
    result.chainError = section.errors[section.errors.length - 1] || `${name} 失败`;
    result.warnings.push('依赖链已终止;此前已提交的主库节与外部库行数据不会自动回滚');
    break;
  }

  if (file.options?.includeAi || (file.ai && Array.isArray(file.ai.providers) && file.ai.providers.length)) {
    result.warnings.push('文件含实例级 AI 目录,应用导入已忽略;请到「EADAF 平台导出/导入」页迁移平台能力');
  }

  result.includeUac = ctx.includeUac;
  result.dataMode = ctx.dataMode;
  if (!result.chainStoppedAt) {
    const failedSections = Object.entries(result.sections)
      .filter(([name, s]) => s.status === 'failed' && name !== 'uacUsers' && name !== 'metadata')
      .map(([name]) => name);
    if (failedSections.length) {
      result.warnings.push(`以下节存在失败条目,请查看各节 errors: ${failedSections.join(', ')}`);
    }
  }
  result.durationMs = Date.now() - startedAt;
  return result;
}

module.exports = {
  importAppFile,
  STRATEGIES,
};
