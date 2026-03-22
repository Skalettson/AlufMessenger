'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Lock, Zap, Shield } from 'lucide-react';
import { useUiStore } from '@/stores/ui-store';

const floatingItems = [
  { icon: Lock, x: -60, y: -40, delay: 0 },
  { icon: Zap, x: 70, y: -30, delay: 0.3 },
  { icon: Shield, x: -50, y: 50, delay: 0.6 },
];

export default function ChatIndexPage() {
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  useEffect(() => {
    setSidebarOpen(true);
  }, [setSidebarOpen]);

  return (
    <div className="chat-scroll-area flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden text-slate-600 dark:text-muted-foreground">
      <div className="relative mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="flex h-24 w-24 items-center justify-center rounded-3xl gradient-primary shadow-lg shadow-primary/25"
        >
          <MessageCircle className="h-12 w-12 text-white" />
        </motion.div>

        {floatingItems.map(({ icon: Icon, x, y, delay }, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
            transition={{
              opacity: { delay: 0.3 + delay, duration: 0.3 },
              scale: { delay: 0.3 + delay, type: 'spring', stiffness: 300, damping: 15 },
              y: { delay: 0.6 + delay, duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
            }}
            style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
            className="absolute h-10 w-10 flex items-center justify-center rounded-xl bg-card shadow-md border border-border"
          >
            <Icon className="h-5 w-5 text-primary" />
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="text-center"
      >
        <h2 className="text-xl font-bold text-slate-800 dark:text-foreground mb-2">Aluf Messenger</h2>
        <p className="text-sm max-w-xs text-slate-600 dark:text-muted-foreground">
          Выберите чат из списка или начните новый разговор
        </p>
        <div className="flex items-center justify-center gap-4 mt-6 text-xs text-slate-500 dark:text-muted">
          <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> E2E шифрование</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Быстрая доставка</span>
        </div>
      </motion.div>
    </div>
  );
}
