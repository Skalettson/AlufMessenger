'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/components/motion/page-transition';

export function DocPageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <PageTransition>
      <div className="flex h-full w-full flex-col bg-background min-h-0">
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-border glass px-4 py-3 shadow-sm">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
            onClick={() => router.push('/settings')}
            aria-label="Назад к настройкам"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold flex-1 truncate">{title}</h1>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
          <article className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10 prose prose-sm md:prose-base dark:prose-invert prose-headings:scroll-mt-20 prose-pre:bg-muted prose-pre:border prose-pre:border-border">
            {children}
          </article>
        </div>
      </div>
    </PageTransition>
  );
}
