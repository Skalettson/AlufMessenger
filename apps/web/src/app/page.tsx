'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadTokens, getAccessToken } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    loadTokens();
    const token = getAccessToken();
    router.replace(token ? '/chat' : '/auth');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary animate-pulse" />
        <span className="text-muted-foreground text-sm">Загрузка...</span>
      </div>
    </div>
  );
}
