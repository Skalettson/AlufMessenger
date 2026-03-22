'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, UserPlus, Ban, Trash2, Users, MessageCircle, MoreVertical, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/shared/user-avatar';
import { DisplayNameWithBadge } from '@/components/shared/display-name-with-badge';
import { useUiStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { api, getErrorMessage } from '@/lib/api';
import { apiChatToPreview, type ApiChat } from '@/lib/chat-mappers';
import { formatLastSeen, cn } from '@/lib/utils';
import type { User } from '@/types';
import { PageTransition } from '@/components/motion/page-transition';

interface Contact {
  userId: string;
  contactUserId: string;
  customName: string | null;
  isBlocked: boolean;
  contactUser: User & { isOnline: boolean };
}

function groupLetter(displayName: string): string {
  const t = displayName.trim();
  if (!t) return '#';
  const ch = t[0].toUpperCase();
  if (/[A-ZА-ЯЁ]/.test(ch)) return ch;
  return '#';
}

export default function ContactsPage() {
  const router = useRouter();
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const addChat = useChatStore((s) => s.addChat);
  const updateChat = useChatStore((s) => s.updateChat);
  const chats = useChatStore((s) => s.chats);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [pendingAddUser, setPendingAddUser] = useState<User | null>(null);
  const [addFirstName, setAddFirstName] = useState('');
  const [addLastName, setAddLastName] = useState('');
  const [renameContact, setRenameContact] = useState<Contact | null>(null);
  const [renameNickname, setRenameNickname] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await api.get<{ contacts: Contact[] }>('/users/me/contacts?limit=100&offset=0');
      setContacts(res.contacts || []);
    } catch {
      setToast('Не удалось загрузить контакты');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const runSearch = useCallback(
    async (query: string) => {
      const q = query.trim().replace(/^@+/, '');
      if (!q) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await api.get<{ users: User[] }>(`/users/search?q=${encodeURIComponent(q)}&limit=20&offset=0`);
        const list = res?.users ?? [];
        const filtered = list.filter((u) => u.id !== currentUserId && !u.isBot);
        setSearchResults(filtered);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [currentUserId],
  );

  useEffect(() => {
    if (!addOpen) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => runSearch(searchQuery), 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [addOpen, searchQuery, runSearch]);

  function startAddContact(u: User) {
    setPendingAddUser(u);
    setAddFirstName('');
    setAddLastName('');
  }

  async function confirmAddContact() {
    if (!pendingAddUser) return;
    try {
      await api.post('/users/me/contacts', {
        userId: pendingAddUser.id,
        firstName: addFirstName.trim() || undefined,
        lastName: addLastName.trim() || undefined,
      });
      setPendingAddUser(null);
      setAddOpen(false);
      fetchContacts();
    } catch (err: unknown) {
      setToast(getErrorMessage(err) || 'Не удалось добавить контакт');
    }
  }

  function openRenameContact(c: Contact) {
    setRenameContact(c);
    setRenameNickname((c.customName || c.contactUser.displayName || '').trim());
  }

  async function saveRenameContact() {
    if (!renameContact) return;
    setRenameSaving(true);
    try {
      const trimmed = renameNickname.trim();
      await api.patch(`/users/me/contacts/${renameContact.contactUserId}`, {
        nickname: trimmed,
      });
      const newTitle = trimmed || renameContact.contactUser.displayName;
      for (const ch of chats) {
        if (ch.type === 'private' && ch.otherUserId === renameContact.contactUserId) {
          updateChat(ch.id, { title: newTitle });
        }
      }
      setRenameContact(null);
      await fetchContacts();
      setToast('');
    } catch (err: unknown) {
      setToast(getErrorMessage(err) || 'Не удалось сохранить имя');
    } finally {
      setRenameSaving(false);
    }
  }

  async function removeContact(userId: string) {
    try {
      await api.delete(`/users/me/contacts/${userId}`);
      setContacts((c) => c.filter((x) => x.contactUserId !== userId));
    } catch (err: unknown) {
      setToast(getErrorMessage(err) || 'Не удалось удалить');
    }
  }

  async function blockUser(userId: string) {
    try {
      await api.post(`/users/me/block/${userId}`);
      fetchContacts();
    } catch (err: unknown) {
      setToast(getErrorMessage(err) || 'Не удалось заблокировать');
    }
  }

  async function openPrivateChat(userId: string) {
    setOpeningChatId(userId);
    setToast('');
    try {
      const res = await api.post<ApiChat>('/chats', { type: 'private', memberIds: [userId] });
      addChat(apiChatToPreview(res));
      router.push(`/chat/${res.id}`);
    } catch (err: unknown) {
      setToast(getErrorMessage(err) || 'Не удалось открыть чат');
    } finally {
      setOpeningChatId(null);
    }
  }

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = c.customName || c.contactUser.displayName;
    return name.toLowerCase().includes(q) || c.contactUser.username.toLowerCase().includes(q);
  });

  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => {
      const na = (a.customName || a.contactUser.displayName || '').toLowerCase();
      const nb = (b.customName || b.contactUser.displayName || '').toLowerCase();
      return na.localeCompare(nb, 'ru');
    });
    const m = new Map<string, Contact[]>();
    for (const c of sorted) {
      const name = c.customName || c.contactUser.displayName || c.contactUser.username;
      const L = groupLetter(name);
      if (!m.has(L)) m.set(L, []);
      m.get(L)!.push(c);
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'ru', { sensitivity: 'base' }))
      .map(([letter, items]) => ({ letter, items }));
  }, [filtered]);

  return (
    <PageTransition>
      <div className="flex h-full w-full min-h-0 flex-col bg-background">
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-border glass px-4 py-3 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
            onClick={() => {
              setSidebarOpen(true);
              router.push('/chat');
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">Контакты</h1>
            <p className="text-[11px] text-muted-foreground">{filtered.length} контактов</p>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
              onClick={() => setAddOpen(true)}
            >
              <UserPlus className="h-5 w-5" />
            </Button>
          </motion.div>
        </div>

        {toast ? (
          <div className="mx-4 mt-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {toast}
          </div>
        ) : null}

        <div className="flex-shrink-0 px-4 py-2">
          <div
            className={cn(
              'relative rounded-xl transition-all duration-200',
              searchFocused ? 'bg-background ring-2 ring-primary/30' : 'bg-secondary',
            )}
          >
            <Search
              className={cn(
                'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors',
                searchFocused ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <Input
              placeholder="Поиск по имени или @username"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-2">
                  <div className="h-10 w-10 flex-shrink-0 rounded-full shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 rounded-md shimmer" />
                    <div className="h-3 w-16 rounded-md shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 text-muted-foreground"
            >
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/80">
                <Users className="h-8 w-8 text-muted" />
              </div>
              <p className="text-sm font-medium">{search ? 'Ничего не найдено' : 'Нет контактов'}</p>
              <p className="text-muted mt-1 text-xs">{search ? 'Попробуйте другой запрос' : 'Добавьте людей по имени пользователя'}</p>
            </motion.div>
          ) : (
            <div className="p-2 pb-6">
              {grouped.map(({ letter, items }) => (
                <div key={letter} className="mb-4">
                  <div className="text-primary/90 sticky top-0 z-[1] bg-background/95 px-3 py-1.5 text-xs font-bold uppercase tracking-wide backdrop-blur-sm">
                    {letter}
                  </div>
                  <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
                    className="space-y-0.5"
                  >
                    {items.map((c) => (
                      <motion.div
                        key={c.contactUserId}
                        variants={{ hidden: { opacity: 0, x: -6 }, show: { opacity: 1, x: 0 } }}
                        className="flex min-h-[56px] items-center gap-2 rounded-xl py-1.5 pl-2 pr-1 transition-colors hover:bg-secondary/50 md:min-h-0"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left"
                          disabled={openingChatId === c.contactUserId}
                          onClick={() => openPrivateChat(c.contactUserId)}
                        >
                          <UserAvatar
                            src={c.contactUser.avatarUrl}
                            name={c.contactUser.displayName}
                            isOnline={c.contactUser.isOnline}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              <DisplayNameWithBadge
                                name={c.customName || c.contactUser.displayName}
                                isPremium={c.contactUser.isPremium}
                                badgeEmoji={c.contactUser.premiumBadgeEmoji}
                                size="sm"
                              />
                            </p>
                            <p className="text-xs text-muted-foreground">
                              @{c.contactUser.username}
                              {c.contactUser.isOnline ? (
                                <>
                                  {' '}
                                  · <span className="text-success">в сети</span>
                                </>
                              ) : (
                                <> · {formatLastSeen(c.contactUser.lastSeenAt ?? null)}</>
                              )}
                            </p>
                          </div>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 shrink-0 rounded-full md:hidden"
                          disabled={openingChatId === c.contactUserId}
                          onClick={() => openPrivateChat(c.contactUserId)}
                        >
                          <MessageCircle className="h-5 w-5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 rounded-full"
                              aria-label="Действия"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => openPrivateChat(c.contactUserId)}>
                              <MessageCircle className="mr-2 h-4 w-4" />
                              Написать
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openRenameContact(c)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Переименовать
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => blockUser(c.contactUserId)}>
                              <Ban className="mr-2 h-4 w-4" />
                              Заблокировать
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => removeContact(c.contactUserId)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Удалить из контактов
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden rounded-2xl pb-[env(safe-area-inset-bottom)]">
            <DialogHeader>
              <DialogTitle className="font-bold">Добавить контакт</DialogTitle>
              <DialogDescription className="sr-only">Поиск по имени пользователя (без номера телефона)</DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Имя или @username"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl"
            />
            {searching && <p className="text-xs text-muted-foreground">Поиск...</p>}
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {searchResults.map((u) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-secondary/50"
                >
                  <UserAvatar src={u.avatarUrl} name={u.displayName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button size="sm" className="rounded-lg" onClick={() => startAddContact(u)}>
                      Добавить
                    </Button>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!renameContact} onOpenChange={(o) => !o && setRenameContact(null)}>
          <DialogContent className="rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Имя в контактах</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Так имя будет в списке чатов и в переписке. Оставьте пустым, чтобы снова показывать имя из профиля.
              </DialogDescription>
            </DialogHeader>
            {renameContact && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {renameContact.contactUser.displayName}{' '}
                  <span className="text-muted-foreground/80">@{renameContact.contactUser.username}</span>
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="rename-nick">Как отображать</Label>
                  <Input
                    id="rename-nick"
                    value={renameNickname}
                    onChange={(e) => setRenameNickname(e.target.value)}
                    placeholder="Имя у вас в контактах"
                    className="rounded-xl"
                    maxLength={64}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-xl"
                    disabled={renameSaving}
                    onClick={() => setRenameNickname('')}
                  >
                    Сбросить
                  </Button>
                  <Button type="button" className="flex-1 rounded-xl" disabled={renameSaving} onClick={saveRenameContact}>
                    {renameSaving ? 'Сохранение…' : 'Сохранить'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!pendingAddUser} onOpenChange={(o) => !o && setPendingAddUser(null)}>
          <DialogContent className="rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Новый контакт</DialogTitle>
              <DialogDescription className="sr-only">Имя для отображения в списке</DialogDescription>
            </DialogHeader>
            {pendingAddUser && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {pendingAddUser.displayName} <span className="text-muted-foreground/80">@{pendingAddUser.username}</span>
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="c-first">Имя</Label>
                  <Input id="c-first" value={addFirstName} onChange={(e) => setAddFirstName(e.target.value)} placeholder="Имя" className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-last">Фамилия</Label>
                  <Input id="c-last" value={addLastName} onChange={(e) => setAddLastName(e.target.value)} placeholder="Фамилия" className="rounded-xl" />
                </div>
                <Button type="button" className="w-full rounded-xl" onClick={confirmAddContact}>
                  Добавить
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
