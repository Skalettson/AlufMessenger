import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link href="/auth" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Назад</span>
          </Link>
          <div className="ml-auto flex gap-4 text-sm">
            <Link href="/legal/terms" className="text-muted-foreground hover:text-primary transition-colors">
              Условия использования
            </Link>
            <Link href="/legal/privacy" className="text-muted-foreground hover:text-primary transition-colors">
              Политика конфиденциальности
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        {children}
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        &copy; 2026 Aluf Technologies LLC. Все права защищены.
      </footer>
    </div>
  );
}
