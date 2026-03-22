'use client';

import { useEffect, useState } from 'react';
import { Settings, Database, Server, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface ServiceHealth {
  name: string;
  status: string;
  statusCode?: number;
  latencyMs?: number;
  timestamp?: string;
  error?: string;
}

interface HealthResponse {
  services: ServiceHealth[];
}

interface SystemInfo {
  nodeEnv: string;
  uptimeSeconds: number;
}

export default function AdminSystemPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [healthRes, infoRes, statsRes] = await Promise.all([
        api.get<HealthResponse>('/admin/system/health'),
        api.get<SystemInfo>('/admin/system/info'),
        api.get<{ totalUsers?: number }>('/admin/stats').catch(() => null),
      ]);
      setHealth(healthRes);
      setInfo(infoRes);
      setDbOk(statsRes != null);
    } catch {
      setHealth(null);
      setInfo(null);
      setDbOk(false);
    } finally {
      setLoading(false);
    }
  };

  const refreshHealth = async () => {
    setHealthLoading(true);
    try {
      const healthRes = await api.get<HealthResponse>('/admin/system/health');
      setHealth(healthRes);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const healthyCount = health?.services?.filter((s) => s.status === 'ok').length ?? 0;
  const totalCount = health?.services?.length ?? 0;

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h} ч ${m} мин`;
    if (m > 0) return `${m} мин ${s} с`;
    return `${s} с`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Система</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Состояние сервисов, базы данных и окружения
        </p>
      </div>

      {/* Сводка */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Сервисы</p>
              <p className="text-2xl font-bold tabular-nums">
                {healthyCount}/{totalCount}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">работают</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${dbOk ? 'bg-green-500/15' : 'bg-destructive/15'}`}>
              <Database className={`h-5 w-5 ${dbOk ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">База данных</p>
              <p className="text-xl font-semibold">
                {dbOk === null ? '—' : dbOk ? 'Доступна' : 'Ошибка'}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {dbOk === true && 'Через user-service и chat-service'}
            {dbOk === false && 'Не удалось загрузить статистику'}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Settings className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Окружение</p>
              <p className="text-lg font-semibold capitalize">{info?.nodeEnv ?? '—'}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {info != null ? `Uptime шлюза: ${formatUptime(info.uptimeSeconds)}` : '—'}
          </p>
        </div>
      </div>

      {/* Таблица сервисов */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold">Состояние сервисов</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshHealth}
            disabled={healthLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${healthLoading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left font-medium p-3">Сервис</th>
                <th className="text-left font-medium p-3">Статус</th>
                <th className="text-left font-medium p-3">Задержка</th>
                <th className="text-left font-medium p-3">Время ответа сервера</th>
              </tr>
            </thead>
            <tbody>
              {health?.services?.length ? (
                health.services.map((s) => (
                  <tr key={s.name} className="border-t border-border">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">
                      {s.status === 'ok' ? (
                        <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" /> OK
                          {s.statusCode != null && s.statusCode !== 200 && (
                            <span className="text-muted-foreground">({s.statusCode})</span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-destructive">
                          <XCircle className="h-4 w-4" /> Ошибка
                          {s.error && (
                            <span className="text-muted-foreground text-xs truncate max-w-[200px]" title={s.error}>
                              {s.error}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground tabular-nums">
                      {s.latencyMs != null ? `${s.latencyMs} мс` : '—'}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {s.timestamp ? new Date(s.timestamp).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Нет данных. Проверьте, что переменные *_SERVICE_HTTP_URL заданы для окружения, где запущен gateway.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Окружение */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="font-semibold mb-4">Окружение API Gateway</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">NODE_ENV</dt>
            <dd className="font-mono">{info?.nodeEnv ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Uptime</dt>
            <dd>{info != null ? formatUptime(info.uptimeSeconds) : '—'}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground mt-4">
          Проверка здоровья сервисов выполняется по HTTP (порты 3010–3022, 3001–3002). В Docker задайте переменные AUTH_SERVICE_HTTP_URL=http://auth-service:3010 и аналогично для остальных сервисов.
        </p>
      </div>
    </div>
  );
}
