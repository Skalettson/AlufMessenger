'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchMiniApp, type MiniAppDto } from '@/lib/ma-api';

export default function AppDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [app, setApp] = useState<MiniAppDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setErr(null);
    setLoading(true);
    try {
      const a = await fetchMiniApp(id);
      setApp(a);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
      setApp(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!id) {
    return <p className="p-6 text-gray-500">Некорректный id</p>;
  }

  if (loading) {
    return <p className="p-6 text-gray-500">Загрузка…</p>;
  }

  if (err || !app) {
    return (
      <div className="p-6">
        <p className="text-red-600 dark:text-red-400 mb-4">{err ?? 'Не найдено'}</p>
        <Link href="/" className="text-blue-600 dark:text-blue-400">
          ← К обзору
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 mb-4 inline-block">
        ← К обзору
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{app.name}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        id: <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 rounded">{app.id}</code> · v{app.version} ·{' '}
        {app.status}
      </p>
      {app.description ? (
        <p className="mt-4 text-gray-700 dark:text-gray-300">{app.description}</p>
      ) : null}
      <dl className="mt-6 space-y-2 text-sm">
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Категория</dt>
          <dd className="text-gray-900 dark:text-white">{app.category}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">URL</dt>
          <dd>
            <a
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 break-all"
            >
              {app.url}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Обновлено</dt>
          <dd className="text-gray-900 dark:text-white">
            {new Date(app.updatedAt).toLocaleString('ru-RU')}
          </dd>
        </div>
      </dl>
    </div>
  );
}
