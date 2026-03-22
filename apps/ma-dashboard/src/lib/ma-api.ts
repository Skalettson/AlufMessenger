/**
 * Публичные GET к `/api/ma/*` идут на ma-platform через nginx.
 * POST/DELETE приложений — через Next route handlers под basePath: `/ma-dashboard/api/ma/...`.
 */

export type MiniAppDto = {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  category: string;
  url: string;
  settings: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardSummary = {
  totalApps: number;
  appsByStatus: Record<string, number>;
  eventsLast7Days: number;
  uniqueUsersLast7Days: number;
  generatedAt: string;
};

export type InvoiceRow = {
  id: string;
  appId: string;
  userId: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  payload?: string;
  url: string;
  createdAt: string;
  paidAt?: string;
};

export type PaymentsOverview = {
  counts: {
    total: number;
    pending: number;
    paid: number;
    failed: number;
    refunded: number;
  };
  paidAmountTotal: number;
  recent: InvoiceRow[];
  generatedAt: string;
};

export async function fetchMiniApps(): Promise<MiniAppDto[]> {
  const res = await fetch('/api/ma/apps', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`apps: ${res.status}`);
  }
  const data = (await res.json()) as MiniAppDto[];
  return Array.isArray(data) ? data : [];
}

export async function fetchMiniApp(id: string): Promise<MiniAppDto> {
  const res = await fetch(`/api/ma/apps/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`app ${id}: ${res.status}`);
  }
  return res.json() as Promise<MiniAppDto>;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const res = await fetch('/api/ma/dashboard/summary', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`summary: ${res.status}`);
  }
  return res.json() as Promise<DashboardSummary>;
}

export async function fetchPaymentsOverview(): Promise<PaymentsOverview> {
  const res = await fetch('/ma-dashboard/api/ma/dashboard/payments', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`payments: ${res.status}`);
  }
  return res.json() as Promise<PaymentsOverview>;
}

export async function createMiniApp(body: {
  name: string;
  url: string;
  version?: string;
  description?: string;
  category?: string;
  icon?: string;
  status?: string;
}): Promise<MiniAppDto> {
  const res = await fetch('/ma-dashboard/api/ma/apps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string })?.message || `create: ${res.status}`);
  }
  return data as MiniAppDto;
}
