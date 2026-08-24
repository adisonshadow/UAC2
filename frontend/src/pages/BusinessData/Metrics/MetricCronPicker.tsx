import React from 'react';
import { Cron } from 'react-js-cron';
import 'react-js-cron/dist/styles.css';

const CRON_LOCALE_ZH = {
  everyText: '每',
  emptyMonths: '每月',
  emptyMonthDays: '每日',
  emptyMonthDaysShort: '每日',
  emptyWeekDays: '每天',
  emptyWeekDaysShort: '每天',
  emptyHours: '每小时',
  emptyMinutes: '每分钟',
  emptyMinutesForHourPeriod: '每分钟',
  yearOption: '年',
  monthOption: '月',
  weekOption: '周',
  dayOption: '日',
  hourOption: '时',
  minuteOption: '分',
  rebootOption: '重启时',
  prefixPeriod: '每',
  prefixMonths: '在',
  prefixMonthDays: '每月第',
  prefixWeekDays: '每周',
  prefixWeekDaysForMonthAndYearPeriod: '每周',
  prefixHours: '在',
  prefixMinutes: '在',
  prefixMinutesForHourPeriod: '在',
  suffixMinutesForHourPeriod: '分',
  errorInvalidCron: 'Cron 表达式无效',
  clearButtonText: '清除（改为手动执行）',
  weekDays: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  months: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  altWeekDays: ['日', '一', '二', '三', '四', '五', '六'],
  altMonths: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
};

/** 将后端 hourly/daily 转为 cron 供编辑器展示 */
export function metricScheduleToCronExpression(metric?: Partial<API.BizdataMetric>): string {
  if (!metric) return '';
  if (metric.scheduleType === 'cron') {
    return metric.scheduleConfig?.expression || '';
  }
  if (metric.scheduleType === 'hourly') {
    return '0 * * * *';
  }
  if (metric.scheduleType === 'daily') {
    const hour = metric.scheduleConfig?.hour ?? 2;
    const minute = metric.scheduleConfig?.minute ?? 0;
    return `${minute} ${hour} * * *`;
  }
  return '';
}

export function isScheduledMetric(metric?: Partial<API.BizdataMetric>): boolean {
  if (!metric?.scheduleType) return false;
  return metric.scheduleType !== 'manual';
}

interface MetricCronPickerProps {
  value?: string;
  onChange?: (expression: string) => void;
  disabled?: boolean;
}

const MetricCronPicker: React.FC<MetricCronPickerProps> = ({ value = '', onChange, disabled }) => {
  return (
    <Cron
      value={value}
      setValue={(next: string | ((prev: string) => string)) => {
        const expression = typeof next === 'function' ? next(value) : next;
        onChange?.(expression);
      }}
      locale={CRON_LOCALE_ZH}
      allowEmpty="always"
      clearButton
      humanizeLabels
      disabled={disabled}
    />
  );
};

export default MetricCronPicker;
