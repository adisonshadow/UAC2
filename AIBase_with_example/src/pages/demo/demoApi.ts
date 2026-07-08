const base = import.meta.env.VITE_API_BASE || '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || json.error?.message || '请求失败');
  }
  return json.data as T;
}

export interface DemoOrder {
  id: number;
  order_no: string;
  user_id: number;
  user_name?: string;
  status: string;
  total_amount: number;
  created_at: string;
  shipped_at?: string | null;
}

export interface DemoUser {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  level: string;
  created_at: string;
}

export interface DemoProduct {
  id: number;
  sku: string;
  name: string;
  category?: string;
  price: number;
  stock: number;
}

export interface DemoComplaint {
  id: number;
  order_id: number;
  order_no?: string;
  user_id: number;
  user_name?: string;
  type: string;
  content: string;
  status: string;
  created_at: string;
  resolved_at?: string | null;
}

export function fetchDemoOrders() {
  return request<{ items: DemoOrder[]; total: number }>('/v1/demo/sales/orders?pageSize=60');
}

export function fetchDemoUsers() {
  return request<DemoUser[]>('/v1/demo/sales/users');
}

export function fetchDemoProducts() {
  return request<DemoProduct[]>('/v1/demo/sales/products');
}

export function fetchDemoComplaints() {
  return request<{ items: DemoComplaint[]; total: number }>('/v1/demo/sales/complaints?pageSize=20');
}

export function fetchDemoOrderStats() {
  return request<{
    byStatus: { summary: Record<string, unknown>; byStatus: Array<Record<string, unknown>> };
    dashboard: Record<string, unknown>;
  }>('/v1/demo/sales/stats/orders');
}

export function fetchDemoComplaintStats() {
  return request<{
    byType: { byType: Array<Record<string, unknown>> };
    byStatus: { byStatus: Array<Record<string, unknown>> };
    dashboard: Record<string, unknown>;
  }>('/v1/demo/sales/stats/complaints');
}
