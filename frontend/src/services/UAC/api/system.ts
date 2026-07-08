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
