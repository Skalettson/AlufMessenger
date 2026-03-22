'use client';

import { useMemo } from 'react';

export default function SettingsPage() {
  const origin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Настройки панели</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Параметры ниже описывают, как Dashboard подключается к API. Секреты задаются только на сервере
        (Docker / Next), не в <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 rounded">NEXT_PUBLIC_*</code>.
      </p>

      <ul className="mt-8 space-y-6 text-sm">
        <li className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Публичный API Mini-Apps</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Браузер ходит в <code className="text-xs">/api/ma/*</code> (через nginx на тот же домен) — например{' '}
            <code className="text-xs break-all">{origin}/api/ma/apps</code>.
          </p>
        </li>
        <li className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Серверные прокси Next</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Создание приложений, удаление и сводка по платежам идут через{' '}
            <code className="text-xs">/ma-dashboard/api/ma/...</code> с заголовком{' '}
            <code className="text-xs">X-Ma-Dashboard-Token</code> на стороне Node (переменная{' '}
            <code className="text-xs">MA_DASHBOARD_API_TOKEN</code>).
          </p>
        </li>
        <li className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">Счета Mini-Apps</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Базовый URL ссылки на оплату в счёте задаётся в ma-platform:{' '}
            <code className="text-xs">MA_PAYMENT_INVOICE_URL_BASE</code> (по умолчанию{' '}
            <code className="text-xs">https://pay.aluf.app/invoice</code>).
          </p>
        </li>
      </ul>
    </div>
  );
}
