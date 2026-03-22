'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  createMiniApp,
  fetchDashboardSummary,
  fetchMiniApps,
  type DashboardSummary,
  type MiniAppDto,
} from '@/lib/ma-api';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    archived: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };

  const labels: Record<string, string> = {
    active: 'Активно',
    draft: 'Черновик',
    review: 'На проверке',
    archived: 'Архив',
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium ${
        styles[status] ?? styles.draft
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export default function DashboardPage() {
  const [apps, setApps] = useState<MiniAppDto[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    url: 'https://',
    category: 'general',
    description: '',
    status: 'draft' as string,
  });

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([fetchMiniApps(), fetchDashboardSummary()]);
      setApps(list);
      setSummary(sum);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitCreate = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      alert('Укажите название и URL');
      return;
    }
    setCreating(true);
    try {
      await createMiniApp({
        name: form.name.trim(),
        url: form.url.trim(),
        category: form.category.trim() || 'general',
        description: form.description.trim() || undefined,
        status: form.status,
      });
      setCreateOpen(false);
      setForm({ name: '', url: 'https://', category: 'general', description: '', status: 'draft' });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось создать');
    } finally {
      setCreating(false);
    }
  };

  const deleteApp = async (id: string, name: string) => {
    if (!confirm(`Удалить приложение «${name}»?`)) return;
    try {
      const res = await fetch(`/ma-dashboard/api/ma/apps/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message || String(res.status));
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка удаления');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Обзор</h1>
        <button
          type="button"
          className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          onClick={() => setCreateOpen(true)}
        >
          + Новое приложение
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Загрузка…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Всего приложений</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {summary?.totalApps ?? 0}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Активных</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {summary?.appsByStatus?.active ?? 0}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">События (7 дней)</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {summary?.eventsLast7Days ?? 0}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Уникальные пользователи (7 дней)</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {summary?.uniqueUsersLast7Days ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Приложения</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Данные из Aluf MA Platform (PostgreSQL). SDK и рантайм шлют аналитику в{' '}
                <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 rounded">ma_analytics_events</code>.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-3">Название</th>
                    <th className="px-6 py-3">Категория</th>
                    <th className="px-6 py-3">Версия</th>
                    <th className="px-6 py-3">Статус</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app) => (
                    <tr
                      key={app.id}
                      className="border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                            {app.name[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{app.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{app.category}</td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white">{app.version}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Link
                          href={`/apps/${app.id}`}
                          className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          Управление
                        </Link>
                        <button
                          type="button"
                          className="text-red-600 hover:text-red-700 text-sm ml-2"
                          onClick={() => void deleteApp(app.id, app.name)}
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!apps.length && (
                <p className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                  Нет приложений. Создайте первое или подключите Mini-App через SDK — события аналитики попадут в БД.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Новое Mini-приложение
            </h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="app-name" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Название
                </label>
                <input
                  id="app-name"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Моё приложение"
                />
              </div>
              <div>
                <label htmlFor="app-url" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  URL (WebApp)
                </label>
                <input
                  id="app-url"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label htmlFor="app-cat" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Категория
                </label>
                <input
                  id="app-cat"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="app-desc" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Описание
                </label>
                <input
                  id="app-desc"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="app-st" className="block text-sm text-gray-600 dark:text-gray-300 mb-1">
                  Статус
                </label>
                <select
                  id="app-st"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="draft">Черновик</option>
                  <option value="review">На проверке</option>
                  <option value="active">Активно</option>
                  <option value="archived">Архив</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                onClick={() => setCreateOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={() => void submitCreate()}
                disabled={creating}
              >
                {creating ? 'Создание…' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
