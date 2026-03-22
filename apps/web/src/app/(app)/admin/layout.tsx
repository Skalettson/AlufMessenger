'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Users, MessageCircle, ArrowLeft, Settings } from 'lucide-react';
import { useAuth, useIsAdmin } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const ADMIN_NAV = [
  { href: '/admin', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Пользователи', icon: Users },
  { href: '/admin/chats', label: 'Чаты', icon: MessageCircle },
  { href: '/admin/system', label: 'Система', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, isAuthenticated } = useAuth();
  const isAdmin = useIsAdmin();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth');
      return;
    }
    if (!isAdmin) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, isAdmin, router]);

  if (isLoading || !isAuthenticated || !isAdmin) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="w-full shrink-0 border-b border-border bg-sidebar/80 md:w-56 md:border-b-0 md:border-r md:py-4">
        <div className="flex flex-col gap-2 px-3 py-3 md:gap-1 md:px-2">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" /> <span className="truncate">Назад в приложение</span>
          </Link>
          <nav className="flex gap-1 overflow-x-auto pb-1 scrollbar-none md:flex-col md:gap-0 md:overflow-visible md:pb-0">
            {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors whitespace-nowrap md:whitespace-normal',
                  pathname === href || (href !== '/admin' && pathname.startsWith(href))
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-4 md:p-6">{children}</main>
    </div>
  );
}
