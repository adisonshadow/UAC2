import type { ProColumns, ProFormColumnsType } from '@ant-design/pro-components';

const METRIC_TYPE_MAP: Record<string, string> = {
  sql: 'SQL 聚合',
  formula: '复合公式',
};

const COMPUTE_MODE_MAP: Record<string, string> = {
  scheduled: '定时',
  on_demand: '按需',
  both: '定时+按需',
};

const SCHEDULE_TYPE_MAP: Record<string, string> = {
  manual: '手动',
  hourly: '每小时',
  daily: '每天',
  cron: 'Cron',
};

function formatScheduleLabel(record: API.BizdataMetric): string {
  if (record.scheduleType === 'cron') {
    return record.scheduleConfig?.expression || 'Cron';
  }
  if (record.scheduleType === 'daily') {
    const h = record.scheduleConfig?.hour ?? 2;
    const m = record.scheduleConfig?.minute ?? 0;
    return `每天 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return SCHEDULE_TYPE_MAP[record.scheduleType || ''] || record.scheduleType || '-';
}

export const metricTableColumns: ProColumns<API.BizdataMetric>[] = [
  {
    title: '编码',
    dataIndex: 'code',
    copyable: true,
    width: 220,
    ellipsis: true,
    fieldProps: { placeholder: '编码 / 名称' },
    formItemProps: { label: '关键字' },
  },
  { title: '名称', dataIndex: 'label', width: 140, ellipsis: true, hideInSearch: true },
  {
    title: '类型',
    dataIndex: 'metricType',
    width: 100,
    valueType: 'select',
    valueEnum: {
      sql: { text: 'SQL 聚合' },
      formula: { text: '复合公式' },
    },
    render: (_, r) => METRIC_TYPE_MAP[r.metricType || ''] || r.metricType,
  },
  {
    title: '计算模式',
    dataIndex: 'computeMode',
    width: 110,
    valueType: 'select',
    valueEnum: {
      scheduled: { text: '定时' },
      on_demand: { text: '按需' },
      both: { text: '定时+按需' },
    },
    render: (_, r) => COMPUTE_MODE_MAP[r.computeMode || ''] || r.computeMode,
  },
  {
    title: '调度',
    dataIndex: 'scheduleType',
    width: 140,
    ellipsis: true,
    hideInSearch: true,
    render: (_, r) => formatScheduleLabel(r),
  },
  {
    title: '最新值',
    dataIndex: 'lastValue',
    width: 100,
    hideInSearch: true,
    render: (_, r) => (r.lastValue != null ? `${r.lastValue}${r.unit ? ` ${r.unit}` : ''}` : '-'),
  },
  {
    title: '最近计算',
    dataIndex: 'lastComputedAt',
    width: 170,
    valueType: 'dateTime',
    hideInSearch: true,
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 80,
    valueType: 'select',
    valueEnum: {
      enabled: { text: '启用', status: 'Success' },
      disabled: { text: '停用', status: 'Default' },
    },
  },
];

export const metricRunColumns: ProColumns<API.BizdataMetricRun>[] = [
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '触发', dataIndex: 'triggeredBy', width: 90 },
  { title: '开始', dataIndex: 'startedAt', valueType: 'dateTime', width: 170 },
  { title: '耗时(ms)', dataIndex: 'durationMs', width: 90 },
  { title: '行数', dataIndex: 'rowCount', width: 70 },
  { title: '错误', dataIndex: 'errorMessage', ellipsis: true },
];

export function buildMetricFormColumns(
  connectionOptions: { label: string; value: string }[],
  metricCodeOptions: { label: string; value: string }[],
  metricType?: string,
  formulaOp?: string,
): ProFormColumnsType<API.BizdataMetric>[] {
  const base: ProFormColumnsType<API.BizdataMetric>[] = [
    {
      title: '编码',
      dataIndex: 'code',
      colProps: { span: 24 },
      formItemProps: {
        rules: [{ required: true, message: '请输入编码' }],
        tooltip: '多级编码如 sales:order:daily_count，Scope 与分组由编码前缀自动推导',
      },
      fieldProps: { placeholder: 'sales:order:daily_count' },
    },
    {
      title: '名称',
      dataIndex: 'label',
      formItemProps: { rules: [{ required: true, message: '请输入名称' }] },
    },
    {
      title: '指标类型',
      dataIndex: 'metricType',
      valueType: 'select',
      fieldProps: {
        options: [
          { label: 'SQL 聚合', value: 'sql' },
          { label: '复合公式', value: 'formula' },
        ],
      },
      formItemProps: { rules: [{ required: true }] },
    },
    { title: '单位', dataIndex: 'unit', fieldProps: { placeholder: '单、元、%' } },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      fieldProps: {
        options: [
          { label: '启用', value: 'enabled' },
          { label: '停用', value: 'disabled' },
        ],
      },
    },
    {
      title: '计算模式',
      dataIndex: 'computeMode',
      valueType: 'select',
      fieldProps: {
        options: [
          { label: '定时', value: 'scheduled' },
          { label: '按需', value: 'on_demand' },
          { label: '定时+按需', value: 'both' },
        ],
      },
    },
    // { title: '描述', dataIndex: 'description', valueType: 'textarea' },
  ];

  if (metricType === 'sql') {
    base.splice(4, 0, {
      title: '数据库连接',
      dataIndex: 'connectionId',
      valueType: 'select',
      fieldProps: { options: connectionOptions, showSearch: true },
    });
    base.splice(5, 0, {
      title: 'SQL 脚本',
      dataIndex: 'queryScript',
      valueType: 'textarea',
      colProps: { span: 24 },
      fieldProps: { rows: 8, placeholder: 'SELECT COUNT(*)::numeric AS value FROM bizdata_mat.orders' },
      formItemProps: { rules: [{ required: true, message: '请输入 SQL' }] },
    });
  }

  if (metricType === 'formula') {
    base.splice(4, 0, {
      title: '公式类型',
      dataIndex: ['formulaConfig', 'op'],
      valueType: 'select',
      fieldProps: {
        options: [
          { label: '比率 (ratio)', value: 'ratio' },
          { label: '求和 (sum)', value: 'sum' },
          { label: '差值 (diff)', value: 'diff' },
        ],
      },
      formItemProps: { rules: [{ required: true }] },
    });

    if (formulaOp === 'ratio') {
      base.splice(5, 0, {
        title: '分子指标',
        dataIndex: ['formulaConfig', 'numerator_code'],
        valueType: 'select',
        fieldProps: { options: metricCodeOptions, showSearch: true },
        formItemProps: { rules: [{ required: true }] },
      });
      base.splice(6, 0, {
        title: '分母指标',
        dataIndex: ['formulaConfig', 'denominator_code'],
        valueType: 'select',
        fieldProps: { options: metricCodeOptions, showSearch: true },
        formItemProps: { rules: [{ required: true }] },
      });
    }

    if (formulaOp === 'sum') {
      base.splice(5, 0, {
        title: '求和指标',
        dataIndex: ['formulaConfig', 'codes'],
        valueType: 'select',
        fieldProps: { mode: 'multiple', options: metricCodeOptions },
        formItemProps: { rules: [{ required: true }] },
      });
    }

    if (formulaOp === 'diff') {
      base.splice(5, 0, {
        title: '左指标',
        dataIndex: ['formulaConfig', 'left_code'],
        valueType: 'select',
        fieldProps: { options: metricCodeOptions, showSearch: true },
        formItemProps: { rules: [{ required: true }] },
      });
      base.splice(6, 0, {
        title: '右指标',
        dataIndex: ['formulaConfig', 'right_code'],
        valueType: 'select',
        fieldProps: { options: metricCodeOptions, showSearch: true },
        formItemProps: { rules: [{ required: true }] },
      });
    }
  }

  return base;
}
