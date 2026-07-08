export function buildMockDataPrompt(
  items: API.MaterializationStatusItem[],
  connectionId?: string,
): string {
  const conn = connectionId ? `connectionId: "${connectionId}"` : '（使用当前页面所选连接）';
  const list = items
    .map(
      (item, i) =>
        `${i + 1}. ${item.label} (${item.code}) — 表/集合: ${item.tableName || '-'}，entityId: ${item.entityId}`,
    )
    .join('\n');

  return `请为以下已物化实体批量生成并插入 MOCK 测试数据（开发/测试环境，可写入物化物理表）。

连接：${conn}

实体列表：
${list}

要求：
1. 对每个实体必须先调用 bizdata_browse_materialized_schema（connectionId + entityCode）获取物理表列名；rows 的 key 必须与 columns.name 完全一致（fieldKey = 列名）
2. 再调用 bizdata_get_entity（entityCode）了解枚举取值与业务含义
3. 有外键依赖时按依赖顺序插入（如先 Product 再 Plan/WorkOrder）；外键引用已插入记录的 id
4. 每个实体必须调用 bizdata_insert_mock_data（connectionId + entityCode + rows），每实体 5–10 条
5. 枚举字段使用 enum items 的 value；主键 id 可省略（自动生成）；created_at/updated_at 可省略
6. 禁止在未调用 bizdata_insert_mock_data 的情况下声称插入成功；汇总时只使用 Tool 返回的 inserted 数字
7. 全部完成后简要汇总每个实体实际 inserted 条数`;
}
