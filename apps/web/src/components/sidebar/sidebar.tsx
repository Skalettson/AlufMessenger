'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Settings, LogOut, Moon, Sun, User, Users, MessageCircle, Folder, Archive, Shield, Music } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ChatList } from './chat-list';
import { StoryBar } from '@/components/story/story-bar';
import { useAuthStore } from '@/stores/auth-store';
import { useIsAdmin } from '@/hooks/use-auth';
import { useChatStore } from '@/stores/chat-store';
import { useUiStore } from '@/stores/ui-store';
import { UserAvatar } from '@/components/shared/user-avatar';
import { DisplayNameWithBadge } from '@/components/shared/display-name-with-badge';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const FOLDER_TABS = [
  { id: 'all', label: 'Все', icon: MessageCircle },
  { id: 'personal', label: 'Личное', icon: Folder },
  { id: 'archive', label: 'Архив', icon: Archive },
];

export function Sidebar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = useIsAdmin();
  const { searchQuery, setSearchQuery, activeFolder, setActiveFolder } = useChatStore();
  const { theme, setTheme, openModal, setSidebarOpen } = useUiStore();
  const [searchFocused, setSearchFocused] = useState(false);

  function goTo(path: string) {
    setSidebarOpen(false);
    router.push(path);
  }

  async function handleLogout() {
    await logout();
    router.replace('/auth');
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-3 mb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex-shrink-0 focus:outline-none group w-12 h-12 shrink-0">
                <div className="rounded-full p-[2px] bg-gradient-to-br from-primary to-blue-400 group-hover:shadow-md group-hover:shadow-primary/20 transition-shadow size-full aspect-square overflow-hidden flex items-center justify-center">
                  <div className="rounded-full bg-sidebar p-[2px] size-full max-w-full max-h-full aspect-square overflow-hidden flex items-center justify-center">
                    <UserAvatar src={user?.avatarUrl} name={user?.displayName || 'U'} size="md" />
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 p-2">
              <div className="flex items-center gap-3 px-2 py-2 mb-1">
                <UserAvatar src={user?.avatarUrl} name={user?.displayName || 'U'} size="lg" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    <DisplayNameWithBadge name={user?.displayName ?? ''} isPremium={user?.isPremium} badgeEmoji={user?.premiumBadgeEmoji} size="sm" />
                  </p>
                  <p className="text-xs text-muted-foreground">@{user?.username}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => goTo('/settings')} className="gap-3 py-2 cursor-pointer">
                <User className="h-4 w-4 text-muted-foreground" /> Профиль
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goTo('/contacts')} className="gap-3 py-2 cursor-pointer">
                <Users className="h-4 w-4 text-muted-foreground" /> Контакты
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goTo('/music')} className="gap-3 py-2 cursor-pointer">
                <Music className="h-4 w-4 text-muted-foreground" /> Моя музыка
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goTo('/settings')} className="gap-3 py-2 cursor-pointer">
                <Settings className="h-4 w-4 text-muted-foreground" /> Настройки
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => goTo('/admin')} className="gap-3 py-2 cursor-pointer">
                  <Shield className="h-4 w-4 text-muted-foreground" /> Админ-панель
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="gap-3 py-2 cursor-pointer">
                {theme === 'dark' ? <Sun className="h-4 w-4 text-muted-foreground" /> : <Moon className="h-4 w-4 text-muted-foreground" />}
                {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="gap-3 py-2 text-destructive cursor-pointer">
                <LogOut className="h-4 w-4" /> Выйти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-base truncate">
              <DisplayNameWithBadge
                name={user?.displayName || 'Aluf'}
                isPremium={user?.isPremium}
                badgeEmoji={user?.premiumBadgeEmoji}
                size="sm"
                className="min-w-0"
              />
            </h2>
            <p className="text-xs text-muted-foreground truncate">В сети</p>
          </div>
        </div>

        <div className={cn(
          'relative rounded-xl transition-all duration-200',
          searchFocused ? 'ring-2 ring-primary/30 bg-background' : 'bg-secondary',
        )}>
          <Search className={cn(
            'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors',
            searchFocused ? 'text-primary' : 'text-muted-foreground',
          )} />
          <Input
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="pl-9 h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="relative flex px-3 py-1">
        {FOLDER_TABS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveFolder(f.id)}
            className={cn(
              'touch-interactive relative flex-1 px-2 py-1.5 text-xs font-medium text-center transition-colors rounded-lg',
              activeFolder === f.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
            {activeFolder === f.id && (
              <motion.div
                layoutId="folder-indicator"
                className="absolute inset-0 bg-primary/10 rounded-lg -z-10"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      <StoryBar
        onView={(group) => openModal('story-viewer' as any, group)}
        onCreate={() => openModal('story-create' as any)}
      />

      <ScrollArea className="flex-1">
        <ChatList />
      </ScrollArea>

      <div className="p-3">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <Button
            type="button"
            onClick={() => openModal('new-chat')}
            className="touch-interactive w-full gap-2 gradient-primary border-0 text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
            size="sm"
          >
            <Plus className="h-4 w-4" /> Новый чат
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
