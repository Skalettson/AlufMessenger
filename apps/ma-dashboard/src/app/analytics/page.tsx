'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchDashboardSummary, type DashboardSummary } from '@/lib/ma-api';

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const s = await fetchDashboardSummary();
      setSummary(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Аналитика</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
        Агрегаты по таблице <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 rounded">ma_analytics_events</code>.
        События по отдельному приложению — через API{' '}
        <code className="text-xs">GET /api/ma/analytics/stats</code> с заголовком{' '}
        <code className="text-xs">X-Aluf-App-Id</code>.
      </p>

      {err && <p className="mt-4 text-red-600 dark:text-red-400">{err}</p>}
      {loading && <p className="mt-6 text-gray-500">Загрузка…</p>}

      {!loading && summary && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">События за 7 дней (все приложения)</p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {summary.eventsLast7Days}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">Уникальные пользователи (7 дней)</p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {summary.uniqueUsersLast7Days}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:col-span-2">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Приложения по статусам</p>
            <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-lg overflow-x-auto">
              {JSON.stringify(summary.appsByStatus, null, 2)}
            </pre>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Обновлено: {new Date(summary.generatedAt).toLocaleString('ru-RU')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
