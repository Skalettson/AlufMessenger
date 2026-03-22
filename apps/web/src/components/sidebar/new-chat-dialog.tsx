'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Bot, Users, Megaphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUiStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { api, getErrorMessage } from '@/lib/api';
import { apiChatToPreview, type ApiChat } from '@/lib/chat-mappers';
import type { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';

const SEARCH_DEBOUNCE_MS = 300;

/** Извлекает id пользователя из ответа API (camelCase или snake_case). */
function getUserId(user: User | { id?: string; user_id?: string }): string {
  const id = user?.id ?? (user as { user_id?: string })?.user_id ?? '';
  return typeof id === 'string' ? id.trim() : '';
}

export function NewChatDialog() {
  const router = useRouter();
  const activeModal = useUiStore((s) => s.activeModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const addChat = useChatStore((s) => s.addChat);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const open = activeModal === 'new-chat';

  const [activeTab, setActiveTab] = useState<'private' | 'group' | 'channel'>('private');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  
  // Для группы/канала
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [channelUsername, setChannelUsername] = useState('');
  const [isChannelPublic, setIsChannelPublic] = useState(true);
  
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (query: string) => {
    const q = query.trim().replace(/^@+/, '');
    if (!q) {
      setUsers([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get<{ users: User[] }>(`/users/search?q=${encodeURIComponent(q)}&limit=20&offset=0`);
      const list = res?.users ?? [];
      const filtered = list.filter((u) => getUserId(u) !== currentUserId);
      setUsers(filtered);
    } catch {
      setUsers([]);
    } finally {
      setSearching(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchQuery.trim()) {
      setUsers([]);
      setSearching(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => runSearch(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, runSearch]);

  async function startPrivateChat(user: User | { id?: string; user_id?: string }) {
    const userId = getUserId(user);
    if (!userId) {
      setError('Не удалось определить пользователя');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await api.post<ApiChat>('/chats', { type: 'private', memberIds: [userId] });
      addChat(apiChatToPreview(res));
      closeModal();
      router.push(`/chat/${res.id}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Не удалось создать чат');
    } finally {
      setCreating(false);
    }
  }

  async function createGroup() {
    if (!groupTitle.trim()) {
      setError('Введите название группы');
      return;
    }
    if (selectedUsers.length === 0) {
      setError('Выберите хотя бы одного участника');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await api.post<ApiChat>('/chats', {
        type: 'group',
        title: groupTitle.trim(),
        description: groupDescription.trim() || undefined,
        memberIds: selectedUsers,
      });
      addChat(apiChatToPreview(res));
      closeModal();
      router.push(`/chat/${res.id}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Не удалось создать группу');
    } finally {
      setCreating(false);
    }
  }

  async function createChannel() {
    if (!groupTitle.trim()) {
      setError('Введите название канала');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await api.post<ApiChat>('/chats', {
        type: 'channel',
        title: groupTitle.trim(),
        description: groupDescription.trim() || undefined,
      });
      const username = channelUsername.trim().replace(/^@/, '').toLowerCase();
      if (isChannelPublic && username) {
        await api.patch(`/chats/${res.id}`, { username });
      } else if (!isChannelPublic) {
        await api.patch(`/chats/${res.id}`, { username: null });
      }
      addChat(apiChatToPreview(res));
      closeModal();
      router.push(`/chat/${res.id}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Не удалось создать канал');
    } finally {
      setCreating(false);
    }
  }

  function toggleUserSelection(userId: string) {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  const handleClose = () => {
    closeModal();
    setError('');
    setGroupTitle('');
    setGroupDescription('');
    setSelectedUsers([]);
    setChannelUsername('');
    setIsChannelPublic(true);
    setSearchQuery('');
    setUsers([]);
    setActiveTab('private');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Новый чат</DialogTitle>
          <DialogDescription>Создайте личный чат, группу или канал</DialogDescription>
        </DialogHeader>
        
        {error && <p className="text-sm text-destructive">{error}</p>}
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="private">Личный</TabsTrigger>
            <TabsTrigger value="group">Группа</TabsTrigger>
            <TabsTrigger value="channel">Канал</TabsTrigger>
          </TabsList>
          
          <TabsContent value="private" className="space-y-3 pt-3">
            <Input placeholder="Поиск по имени или @username" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="rounded-xl" />
            {searching && <p className="text-xs text-muted-foreground">Поиск...</p>}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {users.map((u, idx) => (
                <button key={getUserId(u) || u.username || `u-${idx}`} onClick={() => startPrivateChat(u)} disabled={creating} className="flex items-center gap-3 w-full rounded-lg p-2 hover:bg-secondary text-left">
                  <UserAvatar src={u.avatarUrl} name={u.displayName} size="sm" />
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate flex items-center gap-1.5">{u.displayName}{u.isBot && (
                    <span title="Бот" className="inline-flex flex-shrink-0">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  )}</p><p className="text-xs text-muted-foreground">@{u.username}</p></div>
                </button>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="group" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label>Название группы</Label>
              <Input value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="Введите название" maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label>Описание (необязательно)</Label>
              <Textarea value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="Опишите тему группы" maxLength={255} rows={3} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Участники ({selectedUsers.length})</Label>
                <Input placeholder="Поиск по имени или @username" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-48" />
              </div>
              {searching && <p className="text-xs text-muted-foreground">Поиск...</p>}
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                {users.map((u) => {
                  const uid = getUserId(u);
                  const isSelected = selectedUsers.includes(uid);
                  return (
                    <button key={uid} onClick={() => toggleUserSelection(uid)} className="flex items-center gap-3 w-full rounded-lg p-2 hover:bg-secondary text-left">
                      <UserAvatar src={u.avatarUrl} name={u.displayName} size="sm" />
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{u.displayName}</p><p className="text-xs text-muted-foreground">@{u.username}</p></div>
                      <input type="checkbox" checked={isSelected} readOnly className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button onClick={createGroup} disabled={creating || selectedUsers.length === 0} className="w-full">
                {creating ? 'Создание...' : `Создать группу (${selectedUsers.length} уч.)`}
              </Button>
            </motion.div>
          </TabsContent>
          
          <TabsContent value="channel" className="space-y-4 pt-3">
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
              <Megaphone className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Каналы</p>
                <p>Каналы — это инструмент для односторонней трансляции сообщений вашей аудитории. Только администраторы могут публиковать сообщения.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Название канала</Label>
              <Input value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="Введите название" maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label>Описание (необязательно)</Label>
              <Textarea value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="Опишите тему канала" maxLength={255} rows={3} />
            </div>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Публичный канал</Label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isChannelPublic}
                  onClick={() => setIsChannelPublic((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isChannelPublic ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isChannelPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <AnimatePresence initial={false}>
                {isChannelPublic && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1 overflow-hidden"
                  >
                    <Label>Username канала</Label>
                    <Input
                      value={channelUsername}
                      onChange={(e) => setChannelUsername(e.target.value)}
                      placeholder="my_channel"
                      maxLength={32}
                    />
                    <p className="text-xs text-muted-foreground">Ссылка будет вида `/c/username`</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button onClick={createChannel} disabled={creating || !groupTitle.trim()} className="w-full">
                {creating ? 'Создание...' : 'Создать канал'}
              </Button>
            </motion.div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
