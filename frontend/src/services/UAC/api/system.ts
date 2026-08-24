// @ts-ignore
import { request } from '@/utils/request';

const BASE = '/api/v1/system';

export async function getSystemFeatures() {
  return request<{
    code: number;
    message: string;
    data: API.SystemFeatures;
  }>(`${BASE}/features`, { method: 'GET' });
}

export async function putSystemFeatures(body: API.SystemFeatures) {
  return request<{
    code: number;
    message: string;
    data: API.SystemFeatures;
  }>(`${BASE}/features`, { method: 'PUT', data: body });
}

export async function getSystemBackups() {
  return request<{
    code: number;
    message: string;
    data: API.SystemBackupList;
  }>(`${BASE}/backups`, { method: 'GET' });
}

export async function postSystemBackupRun() {
  return request<{
    code: number;
    message: string;
    data: Record<string, unknown>;
  }>(`${BASE}/backups/run`, { method: 'POST' });
}

/** 上传 .dump 备份文件并恢复数据库（覆盖现有数据，高危操作，同步等待执行完成） */
export async function postSystemBackupRestore(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<{
    code: number;
    message: string;
    data: Record<string, unknown>;
  }>(`${BASE}/backups/restore`, {
    method: 'POST',
    data: formData,
    requestType: 'form',
    // 恢复同步执行（后端等待 pg_restore 完成），覆盖默认 10s 超时
    timeout: 30 * 60 * 1000,
  });
}
