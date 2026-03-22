'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchPaymentsOverview, type PaymentsOverview } from '@/lib/ma-api';

function InvoiceStatus({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    refunded: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  const labels: Record<string, string> = {
    pending: 'Ожидает',
    paid: 'Оплачен',
    failed: 'Ошибка',
    refunded: 'Возврат',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? styles.pending}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export default function MonetizationPage() {
  const [data, setData] = useState<PaymentsOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const p = await fetchPaymentsOverview();
      setData(p);
    } catch (e) {
      setErr(
        e instanceof Error
          ? e.message
          : 'Не удалось загрузить счета. Проверьте MA_DASHBOARD_API_TOKEN и миграцию ma_payment_invoices.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const c = data?.counts;

  return (
    <div className="p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Монетизация</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
            Счета из PostgreSQL (<code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 rounded">ma_payment_invoices</code>
            ), создаются Mini-Apps через{' '}
            <code className="text-xs">POST /api/ma/payments/invoice</code> с заголовками{' '}
            <code className="text-xs">X-Aluf-App-Id</code> и <code className="text-xs">X-Aluf-User-Id</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Обновить
        </button>
      </div>

      {err && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      )}
      {loading && <p className="mt-6 text-gray-500">Загрузка…</p>}

      {!loading && data && c && (
        <>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Всего счетов</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{c.total}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Ожидают оплаты</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-400">{c.pending}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Оплачено (шт.)</p>
              <p className="mt-1 text-2xl font-semibold text-green-700 dark:text-green-400">{c.paid}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">Сумма оплаченных</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {data.paidAmountTotal.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="mt-10 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Статус
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Название
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    App / User
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    Сумма
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Создан
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                {data.recent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      Пока нет счетов. Создайте счёт из Mini-App через Payments API.
                    </td>
                  </tr>
                ) : (
                  data.recent.map((inv) => (
                    <tr key={inv.id}>
                      <td className="whitespace-nowrap px-4 py-3">
                        <InvoiceStatus status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        <div className="font-medium">{inv.title}</div>
                        {inv.description ? (
                          <div className="text-xs text-gray-500 line-clamp-1">{inv.description}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 font-mono">
                        <div className="truncate max-w-[140px]" title={inv.appId}>
                          {inv.appId}
                        </div>
                        <div className="truncate max-w-[140px]" title={inv.userId}>
                          {inv.userId}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        {inv.amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}{' '}
                        {inv.currency}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                        {new Date(inv.createdAt).toLocaleString('ru-RU')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Обновлено: {new Date(data.generatedAt).toLocaleString('ru-RU')}
          </p>
        </>
      )}
    </div>
  );
}
