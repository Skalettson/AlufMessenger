'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { getErrorMessage } from '@/lib/api';
import { MessageCircle, Lock, Zap, Mail } from 'lucide-react';
import Link from 'next/link';

export default function AuthPage() {
  const router = useRouter();
  const { login, register } = useAuthStore();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email);
      router.push(`/auth/verify?id=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({
        username,
        displayName,
        email,
      });
      router.push(`/auth/verify?id=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto overscroll-y-contain items-center justify-center bg-background px-4 py-8 safe-area-top safe-area-bottom">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="flex flex-col items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary shadow-lg shadow-primary/30"
          >
            <MessageCircle className="h-10 w-10 text-white" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <h1 className="text-2xl font-bold">Aluf Messenger</h1>
            <p className="text-muted-foreground text-sm mt-1">Быстрый. Безопасный. Ваш.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-4 text-xs text-muted"
          >
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> E2E шифрование</span>
            <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Мгновенная доставка</span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl h-11">
              <TabsTrigger value="login" className="rounded-lg font-medium">Вход</TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg font-medium">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="rounded-xl h-11 pl-10"
                  />
                </div>
                <AnimatePresence>
                  {error && tab === 'login' && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-sm text-destructive"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    type="submit"
                    className="w-full rounded-xl h-11 gradient-primary border-0 text-white shadow-md shadow-primary/25 font-medium"
                    disabled={loading || !email.trim()}
                  >
                    {loading ? 'Отправка...' : 'Получить код'}
                  </Button>
                </motion.div>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 pt-4">
                <Input
                  placeholder="Имя пользователя (username)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="rounded-xl h-11"
                />
                <Input
                  placeholder="Отображаемое имя"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="rounded-xl h-11"
                />
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="rounded-xl h-11 pl-10"
                  />
                </div>
                <AnimatePresence>
                  {error && tab === 'register' && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-sm text-destructive"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    type="submit"
                    className="w-full rounded-xl h-11 gradient-primary border-0 text-white shadow-md shadow-primary/25 font-medium"
                    disabled={loading || !username.trim() || !displayName.trim() || !email.trim()}
                  >
                    {loading ? 'Отправка...' : 'Зарегистрироваться'}
                  </Button>
                </motion.div>
              </form>
            </TabsContent>
          </Tabs>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center text-xs text-muted-foreground"
        >
          Регистрируясь, вы принимаете{' '}
          <Link href="/legal/terms" className="text-primary hover:underline">Условия использования</Link>{' '}
          и{' '}
          <Link href="/legal/privacy" className="text-primary hover:underline">Политику конфиденциальности</Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
