'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Camera, Shield, Eye, Smartphone, Palette, Lock, Bell,
  Edit3, Share2, QrCode, Users, MessageCircle, Hash, Sparkles, MessageCircleHeart, Check,
  Bot, Plus, Trash2, RefreshCw, Smile, Blocks, BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/shared/user-avatar';
import { DisplayNameWithBadge } from '@/components/shared/display-name-with-badge';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';
import { api, getErrorMessage } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import { dispatchAppearanceUpdate } from '@/components/theme/appearance-provider';
import { cn, getProxiedImageUrl } from '@/lib/utils';
import type { Session, PrivacySettings, Bot as BotType, BotCommand, User } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StickerManageModal } from '@/components/chat/sticker-manage-modal';
import { CustomEmojiManageModal } from '@/components/chat/custom-emoji-manage-modal';
import { EmojiStickerPicker } from '@/components/chat/emoji-sticker-picker';
import { CustomEmojiInline } from '@/components/shared/custom-emoji-inline';
import { AlufQrCode } from '@/components/shared/aluf-qr-code';
import { PageTransition } from '@/components/motion/page-transition';
import { ImageCropDialog } from '@/components/media/image-crop-dialog';
import { compressImageFileIfNeeded } from '@/lib/image-compress';
import { Label } from '@/components/ui/label';

function extractStorageKey(media: { storageKey?: string; url?: string; id?: string }): string {
  if (media.storageKey) return media.storageKey;
  if (media.url) {
    try {
      const parsed = new URL(media.url);
      const match = parsed.pathname.match(/\/aluf-media\/(.+)/);
      if (match) return match[1];
    } catch { /* not a valid URL, use as-is */ }
    return media.url;
  }
  return media.id || '';
}

type Section = 'profile' | 'privacy' | 'notifications' | 'sessions' | 'security' | 'appearance' | 'stickers_emoji' | 'bots' | 'miniapps';

const ACCENT_COLORS = [
  '#0088CC', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7',
];

const CHAT_BACKGROUNDS = [
  { id: 'default', label: 'По умолчанию', color: 'var(--color-chat-bg)' },
  { id: 'dark-blue', label: 'Тёмно-синий', color: '#0f1923' },
  { id: 'forest', label: 'Лесной', color: '#1a2e1a' },
  { id: 'wine', label: 'Бордо', color: '#2a1520' },
  { id: 'ocean', label: 'Океан', color: '#152535' },
  { id: 'charcoal', label: 'Уголь', color: '#1a1a1a' },
];

const FONT_SIZES = [
  { id: 'small', label: 'Мелкий', value: '13px' },
  { id: 'medium', label: 'Средний', value: '14px' },
  { id: 'large', label: 'Крупный', value: '16px' },
];

const BUBBLE_STYLES = [
  { id: 'rounded', label: 'Скруглённые', radius: '1rem' },
  { id: 'sharp', label: 'Прямые', radius: '0.375rem' },
];

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);
  const { theme, setTheme, setSidebarOpen } = useUiStore();
  const [section, setSection] = useState<Section>('profile');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [privacy, setPrivacy] = useState<PrivacySettings>({ lastSeen: 'everyone', profilePhoto: 'everyone', about: 'everyone', forwardedMessages: 'everyone', groups: 'everyone', calls: 'everyone', readReceipts: true });
  const [notifPrefs, setNotifPrefs] = useState({
    messagesEnabled: true, mentionsEnabled: true, reactionsEnabled: true,
    callsEnabled: true, groupInvitesEnabled: true, storiesEnabled: true,
    showPreview: true, defaultSound: 'default', vibrate: true,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [accentColor, setAccentColor] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('aluf-accent') || '#0088CC' : '#0088CC'
  );
  const [chatBg, setChatBg] = useState(() => {
    if (typeof window === 'undefined') return 'default';
    if (localStorage.getItem('aluf-chat-wallpaper-data')) return 'wallpaper';
    return localStorage.getItem('aluf-chat-bg') || 'default';
  });
  const [wallpaperDim, setWallpaperDim] = useState(() =>
    typeof window !== 'undefined' ? parseFloat(localStorage.getItem('aluf-chat-wallpaper-dim') || '0.38') : 0.38,
  );
  const [fontSize, setFontSize] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('aluf-font-size') || 'medium' : 'medium'
  );
  const [bubbleStyle, setBubbleStyle] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('aluf-bubble-style') || 'rounded' : 'rounded'
  );
  const [showQr, setShowQr] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [openingBot, setOpeningBot] = useState(false);
  // 2FA state
  const [twoFactorQrCodeUrl, setTwoFactorQrCodeUrl] = useState<string | null>(null);
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[]>([]);
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorVerifying, setTwoFactorVerifying] = useState(false);
  const [twoFactorDisabling, setTwoFactorDisabling] = useState(false);
  const [twoFactorDisableDialogOpen, setTwoFactorDisableDialogOpen] = useState(false);
  const [twoFactorDisableCode, setTwoFactorDisableCode] = useState('');
  const [bots, setBots] = useState<BotType[]>([]);
  const [botsLimit, setBotsLimit] = useState(20);
  const [botsLoading, setBotsLoading] = useState(false);
  const [createBotOpen, setCreateBotOpen] = useState(false);
  const [createBotUsername, setCreateBotUsername] = useState('');
  const [createBotDisplayName, setCreateBotDisplayName] = useState('');
  const [createBotDescription, setCreateBotDescription] = useState('');
  const [createBotAvatarUrl, setCreateBotAvatarUrl] = useState<string | null>(null);
  const [createBotToken, setCreateBotToken] = useState<string | null>(null);
  const [createBotSubmitting, setCreateBotSubmitting] = useState(false);
  const [createBotUploadingAvatar, setCreateBotUploadingAvatar] = useState(false);
  const [editBotOpen, setEditBotOpen] = useState(false);
  const [editBot, setEditBot] = useState<BotType | null>(null);
  const [editBotDescription, setEditBotDescription] = useState('');
  const [editBotCommands, setEditBotCommands] = useState<BotCommand[]>([]);
  const [editBotWebhookUrl, setEditBotWebhookUrl] = useState('');
  const [editBotIsInline, setEditBotIsInline] = useState(false);
  const [editBotInlinePlaceholder, setEditBotInlinePlaceholder] = useState('');
  const [editBotAbout, setEditBotAbout] = useState('');
  const [editBotWelcomeMessage, setEditBotWelcomeMessage] = useState('');
  const [editBotGroupMode, setEditBotGroupMode] = useState(false);
  const [editBotSubmitting, setEditBotSubmitting] = useState(false);
  const [regenerateBotId, setRegenerateBotId] = useState<string | null>(null);
  const [regenerateToken, setRegenerateToken] = useState<string | null>(null);
  const [deleteBotId, setDeleteBotId] = useState<string | null>(null);
  const [deleteBotSubmitting, setDeleteBotSubmitting] = useState(false);
  const [premiumBadgeEmoji, setPremiumBadgeEmoji] = useState(user?.premiumBadgeEmoji ?? '');
  const [badgePickerOpen, setBadgePickerOpen] = useState(false);
  const editFormRef = useRef<HTMLDivElement>(null);
  const profileScrollRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const [cropAvatarOpen, setCropAvatarOpen] = useState(false);
  const [cropCoverOpen, setCropCoverOpen] = useState(false);
  const [cropAvatarSrc, setCropAvatarSrc] = useState<string | null>(null);
  const [cropCoverSrc, setCropCoverSrc] = useState<string | null>(null);

  const coverDisplayUrl = user?.coverUrl ?? (typeof window !== 'undefined' ? localStorage.getItem('aluf-profile-cover') : null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setUsername(user.username || '');
      setBio(user.bio || '');
      setPremiumBadgeEmoji(user.premiumBadgeEmoji ?? '');
    }
  }, [user?.id, user?.displayName, user?.username, user?.bio, user?.premiumBadgeEmoji]);

  useEffect(() => {
    if (section === 'sessions') {
      api.get<{ sessions?: Record<string, unknown>[] }>('/auth/sessions').then((r) => {
        const raw = r.sessions || [];
        const mapped: Session[] = raw.map((s) => {
          const info = (s.deviceInfo ?? s.device_info) as Record<string, string> | undefined;
          const lastAt = s.lastActiveAt ?? s.last_active_at;
          let lastActiveAt = '';
          if (typeof lastAt === 'string') lastActiveAt = lastAt;
          else if (lastAt && typeof lastAt === 'object' && 'seconds' in (lastAt as object))
            lastActiveAt = new Date(Number((lastAt as { seconds?: number }).seconds) * 1000).toISOString();
          return {
            id: String(s.id ?? ''),
            deviceName: info?.deviceName ?? info?.device_name ?? 'Устройство',
            platform: info?.platform ?? '—',
            ip: String(s.ip ?? '—'),
            lastActiveAt: lastActiveAt || new Date().toISOString(),
            isCurrent: Boolean(s.isCurrent ?? s.is_current),
          };
        });
        setSessions(mapped);
      }).catch(() => {});
    }
    if (section === 'privacy') {
      api.get<Record<string, unknown>>('/users/me/privacy').then((r) => {
        if (!r) return;
        const mapLevel = (v: unknown): 'everyone' | 'contacts' | 'nobody' => {
          if (v === 'PRIVACY_LEVEL_CONTACTS' || v === 2) return 'contacts';
          if (v === 'PRIVACY_LEVEL_NOBODY' || v === 3) return 'nobody';
          if (typeof v === 'string' && ['everyone', 'contacts', 'nobody'].includes(v)) return v as 'everyone' | 'contacts' | 'nobody';
          return 'everyone';
        };
        setPrivacy({
          lastSeen: mapLevel(r.lastSeen ?? r.last_seen),
          profilePhoto: mapLevel(r.profilePhoto ?? r.profile_photo),
          about: mapLevel(r.about),
          forwardedMessages: mapLevel(r.forwardedMessages ?? r.forwarded_messages),
          groups: mapLevel(r.groups),
          calls: mapLevel(r.calls),
          readReceipts: r.readReceipts !== false && r.read_receipts !== false,
        });
      }).catch(() => {});
    }
    if (section === 'notifications') {
      api.get<Record<string, unknown>>('/notifications/preferences').then((r) => {
        if (!r) return;
        setNotifPrefs((prev) => ({
          messagesEnabled: r.messagesEnabled !== false && r.messages_enabled !== false,
          mentionsEnabled: r.mentionsEnabled !== false && r.mentions_enabled !== false,
          reactionsEnabled: r.reactionsEnabled !== false && r.reactions_enabled !== false,
          callsEnabled: r.callsEnabled !== false && r.calls_enabled !== false,
          groupInvitesEnabled: r.groupInvitesEnabled !== false && r.group_invites_enabled !== false,
          storiesEnabled: r.storiesEnabled !== false && r.stories_enabled !== false,
          showPreview: r.showPreview !== false && r.show_preview !== false,
          defaultSound: String(r.defaultSound ?? r.default_sound ?? prev.defaultSound),
          vibrate: r.vibrate !== false,
        }));
      }).catch(() => {});
    }
    if (section === 'bots') {
      setBotsLoading(true);
      api.get<{ bots: BotType[]; limit?: number }>('/bots').then((r) => { setBots(r.bots ?? []); setBotsLimit(r.limit ?? 20); }).catch(() => setBots([])).finally(() => setBotsLoading(false));
    }
  }, [section]);

  // Сразу применять оформление при смене настроек и при открытии раздела «Оформление»
  useEffect(() => {
    if (section !== 'appearance') return;
    localStorage.setItem('aluf-accent', accentColor);
    localStorage.setItem('aluf-chat-bg', chatBg);
    localStorage.setItem('aluf-font-size', fontSize);
    localStorage.setItem('aluf-bubble-style', bubbleStyle);
    localStorage.setItem('aluf-chat-wallpaper-dim', String(wallpaperDim));
    dispatchAppearanceUpdate();
  }, [section, accentColor, chatBg, fontSize, bubbleStyle, wallpaperDim]);

  function saveCustomization(key: string, value: string) {
    localStorage.setItem(`aluf-${key}`, value);
    if (key === 'chat-bg' && value !== 'wallpaper') {
      localStorage.removeItem('aluf-chat-wallpaper-data');
    }
    dispatchAppearanceUpdate();
  }

  async function handleWallpaperFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    try {
      let img = file;
      try {
        img = await compressImageFileIfNeeded(file, 1600, 0.82);
      } catch {
        img = file;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result ?? ''));
        r.onerror = () => reject(new Error('read failed'));
        r.readAsDataURL(img);
      });
      if (dataUrl.length > 4_500_000) {
        setMessage('Файл слишком большой после сжатия. Выберите другое изображение.');
        return;
      }
      localStorage.setItem('aluf-chat-wallpaper-data', dataUrl);
      localStorage.setItem('aluf-chat-bg', 'wallpaper');
      setChatBg('wallpaper');
      dispatchAppearanceUpdate();
      setMessage('Фон чата обновлён');
    } catch (err: unknown) {
      setMessage(getErrorMessage(err) || 'Не удалось загрузить фон');
    }
  }

  function clearWallpaper() {
    localStorage.removeItem('aluf-chat-wallpaper-data');
    localStorage.setItem('aluf-chat-bg', 'default');
    setChatBg('default');
    dispatchAppearanceUpdate();
    setMessage('Фон сброшен');
  }

  async function saveProfile() {
    setSaving(true);
    setMessage('');
    try {
      const payload: { displayName: string; username: string; bio: string; premiumBadgeEmoji?: string | null } = { displayName, username, bio };
      if (user?.isPremium) {
        payload.premiumBadgeEmoji = premiumBadgeEmoji.trim() || null;
      }
      await api.patch('/users/me', payload);
      await fetchCurrentUser();
      setMessage('Профиль сохранён');
    } catch (err: unknown) {
      setMessage(getErrorMessage(err) || 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  async function savePrivacy() {
    setSaving(true);
    try {
      await api.patch('/users/me/privacy', privacy);
      setMessage('Настройки сохранены');
    } catch (err: unknown) {
      setMessage(getErrorMessage(err) || 'Ошибка сохранения');
    }
    finally { setSaving(false); }
  }

  async function terminateSession(id: string) {
    await api.delete(`/auth/sessions/${id}`);
    setSessions((s) => s.filter((x) => x.id !== id));
  }

  async function setup2FA() {
    try {
      const res = await api.post<{ qrCodeUrl?: string; backupCodes?: string[] }>('/auth/2fa/setup');
      if (res?.qrCodeUrl) {
        setTwoFactorQrCodeUrl(res.qrCodeUrl);
        setTwoFactorBackupCodes(res.backupCodes || []);
        setTwoFactorCode('');
        setTwoFactorDialogOpen(true);
        setMessage('2FA: введите код из приложения аутентификатора');
      } else {
        setMessage('2FA настроена. Отсканируйте QR-код в приложении аутентификатора.');
      }
      if (res?.backupCodes?.length) setMessage((m) => m + ' Сохраните резервные коды.');
    } catch (err: unknown) { setMessage(getErrorMessage(err) || 'Ошибка'); }
  }

  async function verify2FA() {
    if (!twoFactorCode.trim()) {
      setMessage('Введите код из приложения аутентификатора');
      return;
    }
    try {
      setTwoFactorVerifying(true);
      await api.post('/auth/2fa/verify', { code: twoFactorCode.trim() });
      setTwoFactorDialogOpen(false);
      setTwoFactorQrCodeUrl(null);
      setTwoFactorBackupCodes([]);
      setMessage('2FA успешно включена!');
      await fetchCurrentUser();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err) || 'Неверный код 2FA');
    } finally {
      setTwoFactorVerifying(false);
    }
  }

  async function disable2FA() {
    if (!twoFactorDisableCode.trim() || twoFactorDisableCode.trim().length !== 6) {
      setMessage('Введите корректный 6-значный код');
      return;
    }
    try {
      setTwoFactorDisabling(true);
      await api.post('/auth/2fa/disable', { code: twoFactorDisableCode.trim() });
      setMessage('2FA отключена');
      setTwoFactorDisableDialogOpen(false);
      setTwoFactorDisableCode('');
      await fetchCurrentUser();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err) || 'Ошибка при отключении 2FA');
    } finally {
      setTwoFactorDisabling(false);
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const unsupported = ['image/heic', 'image/heif'];
    if (unsupported.includes((file.type || '').toLowerCase())) {
      setMessage('Формат HEIC/HEIF пока не поддерживается. Выберите JPG/PNG/WebP.');
      return;
    }
    if (cropAvatarSrc) URL.revokeObjectURL(cropAvatarSrc);
    setCropAvatarSrc(URL.createObjectURL(file));
    setCropAvatarOpen(true);
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const unsupported = ['image/heic', 'image/heif'];
    if (unsupported.includes((file.type || '').toLowerCase())) {
      setMessage('Формат HEIC/HEIF пока не поддерживается. Выберите JPG/PNG/WebP.');
      return;
    }
    if (cropCoverSrc) URL.revokeObjectURL(cropCoverSrc);
    setCropCoverSrc(URL.createObjectURL(file));
    setCropCoverOpen(true);
  }

  function handleShareProfile(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.id && !user?.username) {
      setMessage('Профиль ещё загружается');
      return;
    }
    const url = typeof window !== 'undefined' ? `${window.location.origin}/share/${user?.username || user?.id}` : '';
    const title = `Aluf — ${user?.displayName || user?.username || 'Профиль'}`;
    const text = `Профиль ${user?.displayName || user?.username} в Aluf`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title, url, text }).then(() => setMessage('Ссылка отправлена')).catch((shareErr: unknown) => {
        if ((shareErr as Error)?.name !== 'AbortError') copyProfileLink();
      });
    } else {
      copyProfileLink();
    }
  }

  function copyProfileLink() {
    if (!user?.id && !user?.username) {
      setMessage('Профиль ещё загружается');
      return;
    }
    const url = typeof window !== 'undefined' ? `${window.location.origin}/share/${user?.username || user?.id}` : '';
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => setMessage('Ссылка скопирована в буфер')).catch(() => setMessage('Скопируйте ссылку вручную: ' + url));
    } else {
      setMessage('Ссылка: ' + url);
    }
  }

  function scrollToEditForm(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = editFormRef.current;
    if (!el) return;
    const scrollParent = profileScrollRef.current;
    if (scrollParent) {
      const elTop = el.getBoundingClientRect().top;
      const parentTop = scrollParent.getBoundingClientRect().top;
      const targetScroll = scrollParent.scrollTop + (elTop - parentTop) - 16;
      scrollParent.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function openAlufBotChat() {
    setOpeningBot(true);
    setMessage('');
    try {
      const botUser = await api.get<User & { user_id?: string }>('/users/AlufBot').catch(() => null);
      const botId = botUser?.id ?? botUser?.user_id;
      if (!botId || typeof botId !== 'string') {
        setMessage('Бот Aluf Bot пока недоступен. Попробуйте позже.');
        return;
      }
      const memberIds = [String(botId).trim()].filter(Boolean);
      if (memberIds.length !== 1) {
        setMessage('Не удалось определить бота.');
        return;
      }
      const chat = await api.post<{ id: string; chat_id?: string }>('/chats', {
        type: 'private',
        memberIds,
      });
      const chatId = chat?.id ?? chat?.chat_id;
      if (!chatId) {
        setMessage('Ошибка создания чата.');
        return;
      }
      setSidebarOpen(true);
      router.push(`/chat/${chatId}`);
    } catch (err: unknown) {
      setMessage(getErrorMessage(err) || 'Не удалось открыть чат с ботом');
    } finally {
      setOpeningBot(false);
    }
  }

  async function openBotChat(botId: string) {
    setMessage('');
    try {
      const memberIds = [botId];
      const chat = await api.post<{ id: string; chat_id?: string }>('/chats', { type: 'private', memberIds });
      const chatId = chat?.id ?? chat?.chat_id;
      if (!chatId) {
        setMessage('Ошибка создания чата.');
        return;
      }
      setSidebarOpen(true);
      router.push(`/chat/${chatId}`);
    } catch (err: unknown) {
      setMessage(getErrorMessage(err) || 'Не удалось открыть чат');
    }
  }

  async function handleCreateBot() {
    setCreateBotSubmitting(true);
    setMessage('');
    try {
      const res = await api.post<{ id: string; username: string; displayName: string; token: string }>('/bots', {
        username: createBotUsername.trim(),
        displayName: createBotDisplayName.trim(),
        ...(createBotDescription.trim() && { description: createBotDescription.trim() }),
        ...(createBotAvatarUrl && { avatarUrl: createBotAvatarUrl }),
      });
      setCreateBotToken(res.token);
      setBots((prev) => [...prev, { id: res.id, username: res.username, displayName: res.displayName, avatarUrl: createBotAvatarUrl, description: createBotDescription.trim() || null, commands: [], webhookUrl: null, isInline: false, createdAt: new Date().toISOString() }]);
    } catch (err: unknown) {
      setMessage(getErrorMessage(err) || 'Ошибка создания бота');
    } finally {
      setCreateBotSubmitting(false);
    }
  }

  async function handleCreateBotAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCreateBotUploadingAvatar(true);
    setMessage('');
    try {
      const media = await uploadFile(file);
      const url = media?.url ?? (media as { url?: string })?.url ?? '';
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        setCreateBotAvatarUrl(url);
      }
    } catch {
      setMessage('Не удалось загрузить аватар');
    } finally {
      setCreateBotUploadingAvatar(false);
    }
  }

  function openEditBot(b: BotType) {
    setEditBot(b);
    setEditBotDescription(b.description ?? '');
    const bRaw = b as unknown as Record<string, unknown>;
    setEditBotAbout(bRaw.about as string ?? '');
    setEditBotWelcomeMessage(bRaw.welcomeMessage as string ?? bRaw.welcome_message as string ?? '');
    setEditBotGroupMode(Boolean(bRaw.groupMode ?? bRaw.group_mode));
    setEditBotInlinePlaceholder(bRaw.inlinePlaceholder as string ?? bRaw.inline_placeholder as string ?? '');
    setEditBotCommands(b.commands?.length ? [...b.commands] : [{ command: '', description: '' }]);
    setEditBotWebhookUrl(b.webhookUrl ?? '');
    setEditBotIsInline(b.isInline ?? false);
    setEditBotOpen(true);
  }

  async function handleSaveEditBot() {
    if (!editBot) return;
    setEditBotSubmitting(true);
    setMessage('');
    try {
      const payload: Record<string, unknown> = {};
      payload.description = editBotDescription.trim() || null;
      payload.about = editBotAbout.trim() || null;
      payload.welcomeMessage = editBotWelcomeMessage.trim() || null;
      payload.groupMode = editBotGroupMode;
      const cleanedCommands = editBotCommands.filter((c) => c.command.trim());
      payload.commands = cleanedCommands.length ? cleanedCommands : undefined;
      payload.webhookUrl = editBotWebhookUrl.trim() || null;
      payload.isInline = editBotIsInline;
      payload.inlinePlaceholder = editBotInlinePlaceholder.trim() || null;
      const updated = await api.patch<BotType>(`/bots/${editBot.id}`, payload);
      setBots((prev) => prev.map((x) => (x.id === editBot.id ? updated : x)));
      setEditBotOpen(false);
      setEditBot(null);
      setMessage('Бот обновлён');
    } catch (err: unknown) {
      setMessage(getErrorMessage(err) || 'Ошибка обновления');
    } finally {
      setEditBotSubmitting(false);
    }
  }

  async function handleRegenerateToken(botId: string) {
    setMessage('');
    try {
      const res = await api.post<{ token: string }>(`/bots/${botId}/regenerate-token`);
      setRegenerateToken(res.token);
      setRegenerateBotId(botId);
    } catch (err: unknown) {
      setMessage(getErrorMessage(err) || 'Ошибка регенерации токена');
    }
  }

  async function handleDeleteBot(botId: string) {
    setDeleteBotSubmitting(true);
    setMessage('');
    try {
      await api.delete(`/bots/${botId}`);
      setBots((prev) => prev.filter((x) => x.id !== botId));
      setDeleteBotId(null);
      setMessage('Бот удалён');
    } catch (err: unknown) {
      setMessage(getErrorMessage(err) || 'Ошибка удаления');
    } finally {
      setDeleteBotSubmitting(false);
    }
  }

  const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Профиль', icon: <Camera className="h-4 w-4" /> },
    { id: 'privacy', label: 'Конфиденциальность', icon: <Eye className="h-4 w-4" /> },
    { id: 'notifications', label: 'Уведомления', icon: <Bell className="h-4 w-4" /> },
    { id: 'sessions', label: 'Устройства', icon: <Smartphone className="h-4 w-4" /> },
    { id: 'security', label: 'Безопасность', icon: <Shield className="h-4 w-4" /> },
    { id: 'appearance', label: 'Оформление', icon: <Palette className="h-4 w-4" /> },
    { id: 'stickers_emoji', label: 'Стикеры и эмодзи', icon: <Smile className="h-4 w-4" /> },
    { id: 'bots', label: 'Боты', icon: <Bot className="h-4 w-4" /> },
    { id: 'miniapps', label: 'Mini-Apps', icon: <Blocks className="h-4 w-4" /> },
  ];

  const privacyOptions: { key: keyof PrivacySettings; label: string; type?: 'toggle' }[] = [
    { key: 'lastSeen', label: 'Последний визит' },
    { key: 'profilePhoto', label: 'Фото профиля' },
    { key: 'about', label: 'О себе' },
    { key: 'forwardedMessages', label: 'Пересланные сообщения' },
    { key: 'groups', label: 'Группы' },
    { key: 'calls', label: 'Звонки' },
    { key: 'readReceipts', label: 'Уведомления о прочтении', type: 'toggle' },
  ];

  return (
    <PageTransition>
    <div className="flex h-full w-full flex-col bg-background min-h-0">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-border glass px-4 py-3 shadow-sm">
        <Button variant="ghost" size="icon" className="h-10 w-10 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0" onClick={() => { setSidebarOpen(true); router.push('/chat'); }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1 truncate">Настройки</h1>
      </div>

      {/* На мобильных — горизонтальное меню разделов (на десктопе боковая панель ниже) */}
      <nav className="flex md:hidden flex-shrink-0 border-b border-border bg-sidebar overflow-x-auto scrollbar-none">
        <div className="flex gap-1 p-2 min-w-0">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setSection(s.id); setMessage(''); profileScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm whitespace-nowrap transition-all min-h-[44px]',
                section === s.id ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <nav className="w-56 border-r border-border p-2 space-y-0.5 flex-shrink-0 hidden md:block bg-sidebar">
          {SECTIONS.map((s) => (
            <motion.button
              key={s.id}
              onClick={() => { setSection(s.id); setMessage(''); }}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm transition-all',
                section === s.id ? 'bg-primary/10 text-primary font-medium shadow-sm' : 'hover:bg-secondary',
              )}
            >
              {s.icon} {s.label}
            </motion.button>
          ))}
        </nav>

        <div ref={profileScrollRef} className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mx-4 md:mx-6 mt-4 rounded-xl bg-primary/10 px-4 py-2.5 text-sm text-primary font-medium"
              >
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            key={section}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="p-4 md:p-6 max-w-2xl"
          >
            {section === 'profile' && (
              <div className="space-y-6">
                <div className="relative rounded-2xl overflow-hidden shadow-lg">
                  <div className="h-32 relative bg-gradient-to-br from-primary/80 to-primary">
                    {getProxiedImageUrl(coverDisplayUrl) ? (
                      <img src={getProxiedImageUrl(coverDisplayUrl)!} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
                    <button type="button" disabled={uploadingCover} onClick={() => coverInputRef.current?.click()} className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors disabled:opacity-70">
                      {uploadingCover ? <span className="text-white text-sm">Загрузка...</span> : <Camera className="h-8 w-8 text-white opacity-0 hover:opacity-100 transition-opacity drop-shadow-lg" />}
                    </button>
                    <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleCoverChange} />
                  </div>
                  <div className="bg-card px-6 pb-6 pt-0">
                    <div className="flex items-end gap-4 -mt-12">
                      <div className="relative group size-24 flex-shrink-0">
                        <div className="size-24 overflow-hidden rounded-full p-1 bg-card shadow-lg">
                          <UserAvatar src={user?.avatarUrl} name={user?.displayName || 'U'} size="xl" className="size-24 text-2xl" />
                        </div>
                        <button
                          type="button"
                          disabled={uploadingAvatar}
                          onClick={() => avatarInputRef.current?.click()}
                          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                        >
                          {uploadingAvatar ? <span className="text-white text-xs">...</span> : <Camera className="h-6 w-6 text-white" />}
                        </button>
                        <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarChange} />
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <h2 className="text-xl font-bold truncate flex items-center gap-2 flex-wrap">
                          <DisplayNameWithBadge name={user?.displayName ?? ''} isPremium={user?.isPremium} badgeEmoji={user?.premiumBadgeEmoji} />
                        </h2>
                        <p className="text-sm text-muted-foreground">@{user?.username}</p>
                      </div>
                    </div>
                    {user?.bio && (
                      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{user.bio}</p>
                    )}

                    <div className="grid grid-cols-3 gap-3 mt-5">
                      {[
                        { icon: Users, label: 'Контакты', value: '—' },
                        { icon: MessageCircle, label: 'Группы', value: '—' },
                        { icon: Hash, label: 'Каналы', value: '—' },
                      ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="rounded-xl bg-secondary/50 p-3 text-center">
                          <Icon className="h-5 w-5 mx-auto text-primary mb-1" />
                          <p className="text-lg font-bold">{value}</p>
                          <p className="text-[11px] text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 rounded-2xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-primary/5 to-transparent shadow-lg shadow-amber-500/5"
                    >
                      <div className="p-5">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/30">
                            <Sparkles className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-foreground">Aluf Premium</h3>
                            <p className="text-xs text-muted-foreground">Больше возможностей для общения</p>
                          </div>
                        </div>
                        {user?.isPremium ? (
                          <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-4">
                            Подписка активна
                          </p>
                        ) : (
                          <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                            <li className="flex items-center gap-2">
                              <span className="text-amber-500">✓</span> До 10 разных реакций на сообщение (без Premium — до 5)
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="text-amber-500">✓</span> Файлы до 8 ГБ и приоритетная очередь загрузки
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="text-amber-500">✓</span> Больше закреплённых сообщений, участников групп, ботов
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="text-amber-500">✓</span> Таймер самоуничтожения до 7 дней, истории до 7 дней
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="text-amber-500">✓</span> Кастомный эмодзи в бейдже Premium (виден всем)
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="text-amber-500">✓</span> Премиум-стикерпаки и расширенные настройки чатов
                            </li>
                          </ul>
                        )}
                        <Button
                          onClick={openAlufBotChat}
                          disabled={openingBot}
                          className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-0 shadow-md shadow-amber-500/25 gap-2"
                        >
                          <MessageCircleHeart className="h-4 w-4" />
                          {openingBot
                            ? 'Открываем чат...'
                            : user?.isPremium
                              ? 'Поддержка'
                              : 'Подключить подписку'}
                        </Button>
                        {!user?.isPremium && (
                          <p className="text-xs text-muted-foreground text-center mt-2">
                            Подписка оформляется через Aluf Bot в чате
                          </p>
                        )}
                      </div>
                    </motion.div>

                    <div className="flex gap-2 mt-4">
                      <Button type="button" variant="outline" size="sm" className="flex-1 gap-2 rounded-xl" onClick={scrollToEditForm}>
                        <Edit3 className="h-4 w-4" /> Редактировать
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleShareProfile}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => setShowQr(true)}>
                        <QrCode className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div ref={editFormRef} className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Редактировать профиль</h3>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Имя</label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-xl" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Username</label>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} className="rounded-xl" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">О себе</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  {user?.isPremium && (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Бейдж Premium</label>
                      <p className="text-xs text-muted-foreground mb-2">Выберите эмодзи или кастомный стикер для бейджа рядом с именем</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          {premiumBadgeEmoji.trim() ? (
                            /^[a-zA-Z0-9_]+$/.test(premiumBadgeEmoji.trim()) ? (
                              <CustomEmojiInline shortcode={premiumBadgeEmoji.trim()} size={18} />
                            ) : (
                              <span>{premiumBadgeEmoji.trim()}</span>
                            )
                          ) : (
                            <>По умолчанию (✨ Premium)</>
                          )}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1.5"
                          onClick={() => setBadgePickerOpen(true)}
                        >
                          <Smile className="h-4 w-4" /> Изменить
                        </Button>
                        {premiumBadgeEmoji.trim() && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-muted-foreground"
                            onClick={() => setPremiumBadgeEmoji('')}
                          >
                            Сбросить
                          </Button>
                        )}
                      </div>
                      <Dialog open={badgePickerOpen} onOpenChange={setBadgePickerOpen}>
                        <DialogContent className="rounded-2xl max-w-sm p-0 gap-0 overflow-hidden border-border">
                          <DialogHeader className="sr-only">
                            <DialogTitle>Выберите бейдж</DialogTitle>
                            <DialogDescription>Эмодзи или кастомный эмодзи для отображения рядом с именем</DialogDescription>
                          </DialogHeader>
                          <EmojiStickerPicker
                            onSelectEmoji={(emoji) => {
                              setPremiumBadgeEmoji(emoji);
                              setBadgePickerOpen(false);
                            }}
                            onSelectSticker={() => {}}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button onClick={saveProfile} disabled={saving} className="rounded-xl gradient-primary border-0 text-white shadow-md shadow-primary/20">
                      {saving ? 'Сохранение...' : 'Сохранить'}
                    </Button>
                  </motion.div>
                </div>
              </div>
            )}

            {section === 'privacy' && (
              <div className="space-y-4">
                <h2 className="font-bold text-lg">Конфиденциальность</h2>
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                  {privacyOptions.map((opt, i) => (
                    <div key={opt.key} className={cn(
                      'flex items-center justify-between px-4 py-3',
                      i < privacyOptions.length - 1 && 'border-b border-border',
                    )}>
                      <span className="text-sm">{opt.label}</span>
                      {opt.type === 'toggle' ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={privacy[opt.key] as boolean}
                          onClick={() => setPrivacy((p) => ({ ...p, [opt.key]: !p[opt.key] }))}
                          className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                            privacy[opt.key] ? 'bg-primary' : 'bg-muted',
                          )}
                        >
                          <span className={cn(
                            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
                            privacy[opt.key] ? 'translate-x-5' : 'translate-x-0',
                          )} />
                        </button>
                      ) : (
                        <select
                          value={privacy[opt.key] as string}
                          onChange={(e) => setPrivacy((p) => ({ ...p, [opt.key]: e.target.value }))}
                          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-base md:text-sm"
                        >
                          <option value="everyone">Все</option>
                          <option value="contacts">Контакты</option>
                          <option value="nobody">Никто</option>
                        </select>
                      )}
                    </div>
                  ))}
                </div>
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button onClick={savePrivacy} disabled={saving} className="rounded-xl gradient-primary border-0 text-white shadow-md shadow-primary/20">
                    {saving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </motion.div>
              </div>
            )}

            {section === 'notifications' && (
              <div className="space-y-4">
                <h2 className="font-bold text-lg">Уведомления</h2>
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                  {([
                    { key: 'messagesEnabled', label: 'Сообщения' },
                    { key: 'mentionsEnabled', label: 'Упоминания' },
                    { key: 'reactionsEnabled', label: 'Реакции' },
                    { key: 'callsEnabled', label: 'Звонки' },
                    { key: 'groupInvitesEnabled', label: 'Приглашения в группы' },
                    { key: 'storiesEnabled', label: 'Истории' },
                    { key: 'showPreview', label: 'Показывать текст' },
                    { key: 'vibrate', label: 'Вибрация' },
                  ] as { key: keyof typeof notifPrefs; label: string }[]).map((opt, i, arr) => (
                    <div key={opt.key} className={cn(
                      'flex items-center justify-between px-4 py-3',
                      i < arr.length - 1 && 'border-b border-border',
                    )}>
                      <span className="text-sm">{opt.label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(notifPrefs[opt.key])}
                        onClick={() => setNotifPrefs((p) => ({ ...p, [opt.key]: !p[opt.key] }))}
                        className={cn(
                          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                          notifPrefs[opt.key] ? 'bg-primary' : 'bg-muted',
                        )}
                      >
                        <span className={cn(
                          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
                          notifPrefs[opt.key] ? 'translate-x-5' : 'translate-x-0',
                        )} />
                      </button>
                    </div>
                  ))}
                </div>
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button
                    disabled={notifSaving}
                    className="rounded-xl gradient-primary border-0 text-white shadow-md shadow-primary/20"
                    onClick={async () => {
                      setNotifSaving(true);
                      try {
                        await api.patch('/notifications/preferences', notifPrefs);
                        setMessage('Настройки уведомлений сохранены');
                      } catch (err: unknown) {
                        setMessage(getErrorMessage(err) || 'Ошибка сохранения');
                      }
                      finally { setNotifSaving(false); }
                    }}
                  >
                    {notifSaving ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </motion.div>
              </div>
            )}

            {section === 'sessions' && (
              <div className="space-y-4">
                <h2 className="font-bold text-lg">Активные устройства</h2>
                {sessions.length === 0 && (
                  <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                    <Smartphone className="h-10 w-10 mx-auto text-muted mb-2" />
                    <p className="text-sm text-muted-foreground">Нет активных сессий</p>
                  </div>
                )}
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', s.isCurrent ? 'bg-primary/10' : 'bg-secondary')}>
                          <Smartphone className={cn('h-5 w-5', s.isCurrent ? 'text-primary' : 'text-muted-foreground')} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{s.deviceName || s.platform}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.ip} · {s.isCurrent ? 'Текущая сессия' : new Date(s.lastActiveAt).toLocaleDateString('ru')}
                          </p>
                        </div>
                      </div>
                      {!s.isCurrent && (
                        <Button variant="destructive" size="sm" className="rounded-lg" onClick={() => terminateSession(s.id)}>
                          Завершить
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {section === 'security' && (
              <div className="space-y-6">
                <h2 className="font-bold text-lg">Безопасность</h2>
                <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Lock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Двухфакторная аутентификация (2FA)</p>
                      <p className="text-xs text-muted-foreground">TOTP через приложение-аутентификатор (Google Authenticator, Authy и т.д.)</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <p className={cn('font-medium', user?.isTwoFactorEnabled ? 'text-green-600' : 'text-muted-foreground')}>
                        {user?.isTwoFactorEnabled ? 'Включена' : 'Выключена'}
                      </p>
                    </div>
                    <motion.div whileTap={{ scale: 0.98 }}>
                      {user?.isTwoFactorEnabled ? (
                        <Button variant="destructive" onClick={() => { setTwoFactorDisableCode(''); setTwoFactorDisableDialogOpen(true); }} className="rounded-xl">
                          Отключить 2FA
                        </Button>
                      ) : (
                        <Button onClick={setup2FA} className="rounded-xl">
                          Включить 2FA
                        </Button>
                      )}
                    </motion.div>
                  </div>
                </div>
              </div>
            )}

            {section === 'appearance' && (
              <div className="space-y-6">
                <h2 className="font-bold text-lg">Оформление</h2>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold">Тема</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { id: 'light' as const, label: 'Светлая', bg: '#ffffff', fg: '#0f172a' },
                      { id: 'dark' as const, label: 'Тёмная', bg: '#0e1621', fg: '#e4e6eb' },
                      { id: 'system' as const, label: 'Системная', bg: 'linear-gradient(135deg, #ffffff 50%, #0e1621 50%)', fg: '#666' },
                    ]).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={cn(
                          'relative rounded-xl border-2 p-1 transition-all',
                          theme === t.id ? 'border-primary shadow-md shadow-primary/20' : 'border-border hover:border-primary/40',
                        )}
                      >
                        <div
                          className="h-16 rounded-lg mb-2 flex items-end p-2"
                          style={{ background: t.bg }}
                        >
                          <div className="flex gap-1">
                            <div className="h-2 w-8 rounded-full" style={{ backgroundColor: t.fg, opacity: 0.3 }} />
                            <div className="h-2 w-4 rounded-full" style={{ backgroundColor: t.fg, opacity: 0.2 }} />
                          </div>
                        </div>
                        <p className="text-xs font-medium text-center pb-1">{t.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold">Акцентный цвет</h3>
                  <div className="flex flex-wrap gap-2">
                    {ACCENT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => { setAccentColor(color); saveCustomization('accent', color); }}
                        className={cn(
                          'h-8 w-8 rounded-full transition-all',
                          accentColor === color ? 'ring-2 ring-offset-2 ring-offset-background scale-110' : 'hover:scale-110',
                        )}
                        style={{ backgroundColor: color, ...(accentColor === color ? { boxShadow: `0 0 0 2px ${color}` } : {}) }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2 p-3 rounded-xl bg-secondary/50">
                    <div className="h-6 w-6 rounded-full" style={{ backgroundColor: accentColor }} />
                    <span className="text-xs text-muted-foreground">Предпросмотр акцентного цвета</span>
                    <div className="ml-auto rounded-full px-3 py-1 text-xs text-white" style={{ backgroundColor: accentColor }}>Кнопка</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold">Фон чата</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {CHAT_BACKGROUNDS.map((bg) => {
                      const isSelected = chatBg === bg.id;
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() => { setChatBg(bg.id); saveCustomization('chat-bg', bg.id); }}
                          className={cn(
                            'relative rounded-xl border-2 p-1 transition-all',
                            isSelected
                              ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md shadow-primary/30'
                              : 'border-border hover:border-primary/40',
                          )}
                        >
                          <div className="h-12 rounded-lg relative overflow-hidden" style={{ backgroundColor: bg.color }}>
                            {isSelected && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Check className="h-6 w-6 text-white drop-shadow-md" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <p className={cn('text-[10px] text-center mt-1', isSelected ? 'text-primary font-medium' : 'text-muted-foreground')}>
                            {bg.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm font-medium">Свой фон</Label>
                      {chatBg === 'wallpaper' ? (
                        <span className="text-[10px] text-primary font-medium">Активен</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Изображение хранится только на этом устройстве.
                    </p>
                    <input
                      ref={wallpaperInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleWallpaperFile}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => wallpaperInputRef.current?.click()}>
                        Загрузить фото
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={clearWallpaper}>
                        Сбросить свой фон
                      </Button>
                    </div>
                    {chatBg === 'wallpaper' && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Затемнение</Label>
                          <span className="text-xs tabular-nums">{Math.round(wallpaperDim * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={0.85}
                          step={0.01}
                          value={wallpaperDim}
                          onChange={(e) => setWallpaperDim(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold">Размер текста</h3>
                  <div className="flex gap-2">
                    {FONT_SIZES.map((fs) => (
                      <button
                        key={fs.id}
                        onClick={() => { setFontSize(fs.id); saveCustomization('font-size', fs.id); }}
                        className={cn(
                          'flex-1 rounded-xl border-2 p-3 text-center transition-all',
                          fontSize === fs.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                        )}
                      >
                        <span style={{ fontSize: fs.value }}>{fs.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-semibold">Форма пузырей</h3>
                  <div className="flex gap-3">
                    {BUBBLE_STYLES.map((bs) => (
                      <button
                        key={bs.id}
                        onClick={() => { setBubbleStyle(bs.id); saveCustomization('bubble-style', bs.id); }}
                        className={cn(
                          'flex-1 rounded-xl border-2 p-3 transition-all',
                          bubbleStyle === bs.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                        )}
                      >
                        <div className="flex flex-col gap-1 items-end">
                          <div className="bg-primary/20 px-3 py-1.5 text-xs" style={{ borderRadius: bs.radius }}>
                            Привет!
                          </div>
                          <div className="bg-secondary px-3 py-1.5 text-xs self-start" style={{ borderRadius: bs.radius }}>
                            Здравствуйте
                          </div>
                        </div>
                        <p className="text-xs text-center mt-2 text-muted-foreground">{bs.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {section === 'stickers_emoji' && (
              <div className="space-y-8">
                <p className="text-sm text-muted-foreground">
                  Создавайте паки стикеров и кастомные эмодзи. В чате они будут доступны в общем пикере.
                </p>
                <StickerManageModal embedded chatId={undefined} />
                <CustomEmojiManageModal embedded chatId={undefined} />
              </div>
            )}

            {section === 'bots' && (
              <div className="space-y-6">
                <h2 className="font-bold text-lg">Боты</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="rounded-xl gap-2" asChild>
                    <Link href="/docs/bots">
                      <BookOpen className="h-4 w-4 shrink-0" />
                      Документация
                    </Link>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Создавайте ботов и управляйте ими через Bot API. Токен выдаётся один раз при создании и при регенерации — сохраняйте его в безопасном месте.
                </p>
                <p className="text-xs text-muted-foreground">Использовано {bots.length} / {botsLimit} ботов</p>
                <div className="flex justify-end">
                  <Button onClick={() => { setCreateBotOpen(true); setCreateBotToken(null); setCreateBotUsername(''); setCreateBotDisplayName(''); setCreateBotDescription(''); setCreateBotAvatarUrl(null); setMessage(''); }} className="rounded-xl gap-2">
                    <Plus className="h-4 w-4" /> Создать бота
                  </Button>
                </div>
                {botsLoading ? (
                  <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">Загрузка...</div>
                ) : bots.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-8 text-center">
                    <Bot className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">У вас пока нет ботов</p>
                    <Button variant="outline" className="mt-3 rounded-xl" onClick={() => { setCreateBotOpen(true); setCreateBotToken(null); setCreateBotUsername(''); setCreateBotDisplayName(''); setCreateBotDescription(''); setCreateBotAvatarUrl(null); }}>Создать бота</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bots.map((b) => (
                      <motion.div
                        key={b.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar src={b.avatarUrl} name={b.displayName || b.username} size="md" className="h-10 w-10 rounded-xl" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{b.displayName || b.username}</p>
                            <p className="text-sm text-muted-foreground">@{b.username}</p>
                            {b.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{b.description}</p>}
                            {typeof b.chatCount === 'number' && <p className="text-xs text-muted-foreground mt-0.5">Чатов: {b.chatCount}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button variant="outline" size="sm" className="rounded-lg gap-1" onClick={() => openBotChat(b.id)}>
                            <MessageCircle className="h-3.5 w-3.5" /> Чат
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-lg gap-1" onClick={() => openEditBot(b)}>
                            <Edit3 className="h-3.5 w-3.5" /> Изменить
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-lg gap-1" onClick={() => handleRegenerateToken(b.id)} title="Регенерировать токен">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="destructive" size="sm" className="rounded-lg gap-1" onClick={() => setDeleteBotId(b.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {section === 'miniapps' && (
              <div className="space-y-6">
                <h2 className="font-bold text-lg">Mini-Apps</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" className="rounded-xl gap-2" asChild>
                    <Link href="/docs/mini-apps">
                      <BookOpen className="h-4 w-4 shrink-0" />
                      Документация
                    </Link>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Мини-приложения работают прямо внутри Aluf Messenger. Откройте платформу разработчиков для создания и управления вашими Mini-Apps.
                </p>
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                      <Blocks className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">Платформа разработчиков</p>
                      <p className="text-xs text-muted-foreground">Создавайте, тестируйте и публикуйте Mini-Apps</p>
                    </div>
                  </div>
                  <Button
                    className="w-full rounded-xl gradient-primary border-0 text-white"
                    onClick={() => window.open('/ma-dashboard/', '_blank')}
                  >
                    Открыть Mini-Apps Dashboard
                  </Button>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <h3 className="font-semibold text-sm">Что такое Mini-Apps?</h3>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Веб-приложения, встроенные в мессенджер</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Доступ к API мессенджера (профиль, контакты, платежи)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Работают на любом устройстве без установки</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>Монетизация через встроенные платежи</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent className="rounded-2xl max-w-xs">
          <DialogHeader>
            <DialogTitle>QR-код профиля</DialogTitle>
            <DialogDescription className="sr-only">Ссылка на ваш профиль для быстрого добавления в контакты</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="text-sm text-muted-foreground text-center">
              Ссылка на ваш профиль для быстрого добавления в контакты
            </p>
            {typeof window !== 'undefined' && user?.username && (
              <>
                <AlufQrCode
                  url={`${window.location.origin}/share/${user.username}`}
                  size={220}
                />
                <p className="text-xs text-muted-foreground break-all text-center font-mono">
                  {window.location.origin}/share/{user.username}
                </p>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={copyProfileLink}>
                  Копировать ссылку
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createBotOpen} onOpenChange={(open) => { setCreateBotOpen(open); if (!open) setCreateBotToken(null); setMessage(''); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>{createBotToken ? 'Токен бота' : 'Создать бота'}</DialogTitle>
            <DialogDescription>
              {createBotToken ? 'Сохраните токен — он больше не будет показан.' : 'Username: только латиница, цифры и подчёркивание (3–32 символа).'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createBotToken ? (
              <>
                <p className="text-sm text-amber-600 dark:text-amber-400">Скопируйте и сохраните токен в надёжном месте.</p>
                <div className="flex gap-2">
                  <Input readOnly value={createBotToken} className="font-mono text-sm rounded-xl" />
                  <Button variant="outline" size="sm" className="rounded-xl flex-shrink-0" onClick={() => navigator.clipboard?.writeText(createBotToken).then(() => setMessage('Скопировано')).catch(() => {})}>
                    Копировать
                  </Button>
                </div>
                <Button className="w-full rounded-xl" onClick={() => { setCreateBotOpen(false); setCreateBotToken(null); }}>Готово</Button>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Username</label>
                  <Input placeholder="my_bot" value={createBotUsername} onChange={(e) => setCreateBotUsername(e.target.value)} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Отображаемое имя</label>
                  <Input placeholder="My Bot" value={createBotDisplayName} onChange={(e) => setCreateBotDisplayName(e.target.value)} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Описание (необязательно)</label>
                  <textarea value={createBotDescription} onChange={(e) => setCreateBotDescription(e.target.value)} rows={2} className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" placeholder="Краткое описание бота" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Аватар (необязательно)</label>
                  <input type="file" accept="image/*" className="hidden" id="create-bot-avatar" onChange={handleCreateBotAvatarChange} />
                  <div className="flex items-center gap-2">
                    {createBotAvatarUrl && <UserAvatar src={createBotAvatarUrl} name={createBotDisplayName || createBotUsername} size="md" className="h-12 w-12 rounded-xl" />}
                    <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={createBotUploadingAvatar} onClick={() => document.getElementById('create-bot-avatar')?.click()}>
                      {createBotUploadingAvatar ? 'Загрузка...' : createBotAvatarUrl ? 'Сменить' : 'Загрузить'}
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" className="rounded-xl" onClick={() => setCreateBotOpen(false)}>Отмена</Button>
                  <Button className="rounded-xl" disabled={createBotSubmitting || !createBotUsername.trim() || !createBotDisplayName.trim()} onClick={handleCreateBot}>
                    {createBotSubmitting ? 'Создание...' : 'Создать'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editBotOpen} onOpenChange={(open) => { if (!open) setEditBot(null); setMessage(''); }}>
        <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать бота</DialogTitle>
            <DialogDescription>Описание, команды и настройки webhook.</DialogDescription>
          </DialogHeader>
          {editBot && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Описание</label>
                <textarea value={editBotDescription} onChange={(e) => setEditBotDescription(e.target.value)} rows={2} className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-base md:text-sm" placeholder="Краткое описание бота" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">О боте (About)</label>
                <textarea value={editBotAbout} onChange={(e) => setEditBotAbout(e.target.value)} rows={2} className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-base md:text-sm" placeholder="Информация о боте (видно в профиле)" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Приветственное сообщение</label>
                <textarea value={editBotWelcomeMessage} onChange={(e) => setEditBotWelcomeMessage(e.target.value)} rows={3} className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-base md:text-sm" placeholder="Сообщение при первом открытии чата с ботом" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Команды (command / description)</label>
                <div className="space-y-2">
                  {editBotCommands.map((cmd, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input placeholder="/start" value={cmd.command} onChange={(e) => setEditBotCommands((c) => c.map((x, j) => (j === i ? { ...x, command: e.target.value } : x)))} className="rounded-xl flex-1" />
                      <Input placeholder="Описание" value={cmd.description} onChange={(e) => setEditBotCommands((c) => c.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className="rounded-xl flex-1" />
                      {editBotCommands.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => setEditBotCommands((c) => c.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setEditBotCommands((c) => [...c, { command: '', description: '' }])}>Добавить команду</Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Webhook URL</label>
                <Input placeholder="https://..." value={editBotWebhookUrl} onChange={(e) => setEditBotWebhookUrl(e.target.value)} className="rounded-xl" />
                {editBot.webhookStatus && (
                  <div className="mt-2 rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1">
                    <p className="font-medium text-muted-foreground">Статус доставки</p>
                    {editBot.webhookUrl ? (
                      <>
                        {editBot.webhookStatus.lastSuccessAt && (
                          <p>Последняя успешная доставка: {new Date(editBot.webhookStatus.lastSuccessAt).toLocaleString()}</p>
                        )}
                        {editBot.webhookStatus.lastError && (
                          <p className="text-destructive">Ошибка: {editBot.webhookStatus.lastError}</p>
                        )}
                        {!editBot.webhookStatus.lastSuccessAt && !editBot.webhookStatus.lastError && editBot.webhookStatus.lastDeliveryAt && (
                          <p className="text-muted-foreground">Ожидание первой доставки</p>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground">Webhook выключен</p>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Режимы</p>
                <div className="flex items-center justify-between">
                  <label htmlFor="edit-inline" className="text-sm">Inline-режим</label>
                  <button
                    type="button"
                    role="switch"
                    id="edit-inline"
                    aria-checked={editBotIsInline}
                    onClick={() => setEditBotIsInline(!editBotIsInline)}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                      editBotIsInline ? 'bg-primary' : 'bg-muted',
                    )}
                  >
                    <span className={cn(
                      'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
                      editBotIsInline ? 'translate-x-5' : 'translate-x-0',
                    )} />
                  </button>
                </div>
                {editBotIsInline && (
                  <div>
                    <Input
                      placeholder="Введите запрос..."
                      value={editBotInlinePlaceholder}
                      onChange={(e) => setEditBotInlinePlaceholder(e.target.value)}
                      className="rounded-xl"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Текст-подсказка при вызове бота через @</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <label htmlFor="edit-group" className="text-sm">Работа в группах</label>
                  <button
                    type="button"
                    role="switch"
                    id="edit-group"
                    aria-checked={editBotGroupMode}
                    onClick={() => setEditBotGroupMode(!editBotGroupMode)}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                      editBotGroupMode ? 'bg-primary' : 'bg-muted',
                    )}
                  >
                    <span className={cn(
                      'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
                      editBotGroupMode ? 'translate-x-5' : 'translate-x-0',
                    )} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" className="rounded-xl" onClick={() => setEditBotOpen(false)}>Отмена</Button>
                <Button className="rounded-xl" disabled={editBotSubmitting} onClick={handleSaveEditBot}>{editBotSubmitting ? 'Сохранение...' : 'Сохранить'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!regenerateToken} onOpenChange={(open) => { if (!open) { setRegenerateToken(null); setRegenerateBotId(null); } setMessage(''); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Новый токен</DialogTitle>
            <DialogDescription>Сохраните токен — старый перестанет работать.</DialogDescription>
          </DialogHeader>
          {regenerateToken && (
            <div className="space-y-4 py-2">
              <div className="flex gap-2">
                <Input readOnly value={regenerateToken} className="font-mono text-sm rounded-xl" />
                <Button variant="outline" size="sm" className="rounded-xl flex-shrink-0" onClick={() => navigator.clipboard?.writeText(regenerateToken).then(() => setMessage('Скопировано')).catch(() => {})}>Копировать</Button>
              </div>
              <Button className="w-full rounded-xl" onClick={() => { setRegenerateToken(null); setRegenerateBotId(null); }}>Готово</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteBotId} onOpenChange={(open) => { if (!open) setDeleteBotId(null); setMessage(''); }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить бота?</DialogTitle>
            <DialogDescription>Это действие нельзя отменить. Бот и все связанные данные будут удалены.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteBotId(null)}>Отмена</Button>
            <Button variant="destructive" className="rounded-xl" disabled={deleteBotSubmitting} onClick={() => deleteBotId && handleDeleteBot(deleteBotId)}>
              {deleteBotSubmitting ? 'Удаление...' : 'Удалить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2FA Verification Dialog */}
      <Dialog open={twoFactorDialogOpen} onOpenChange={(open) => { if (!open) { setTwoFactorDialogOpen(false); setTwoFactorQrCodeUrl(null); setTwoFactorBackupCodes([]); } setMessage(''); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Включить 2FA</DialogTitle>
            <DialogDescription>Отсканируйте QR-код в приложении аутентификатора и введите код</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {twoFactorQrCodeUrl && (
              <div className="flex justify-center">
                <img src={twoFactorQrCodeUrl} alt="2FA QR Code" className="w-48 h-48 rounded-lg" />
              </div>
            )}
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="font-mono text-lg text-center rounded-xl"
                onKeyDown={(e) => { if (e.key === 'Enter' && twoFactorCode.length === 6) verify2FA(); }}
              />
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl flex-shrink-0"
                disabled={twoFactorCode.length !== 6 || twoFactorVerifying}
                onClick={verify2FA}
              >
                {twoFactorVerifying ? '...' : 'OK'}
              </Button>
            </div>
            {twoFactorBackupCodes.length > 0 && (
              <div className="space-y-2 p-3 rounded-xl bg-secondary/50">
                <p className="text-xs font-medium text-destructive">Сохраните резервные коды:</p>
                <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                  {twoFactorBackupCodes.map((code, i) => (
                    <div key={i} className="p-1 bg-background rounded">{code}</div>
                  ))}
                </div>
              </div>
            )}
            <Button className="w-full rounded-xl" onClick={verify2FA} disabled={twoFactorCode.length !== 6 || twoFactorVerifying}>
              {twoFactorVerifying ? 'Проверка...' : 'Включить 2FA'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2FA Disable Dialog */}
      <Dialog open={twoFactorDisableDialogOpen} onOpenChange={(open) => { setTwoFactorDisableDialogOpen(open); if (!open) { setTwoFactorDisableCode(''); setMessage(''); } }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Отключить 2FA</DialogTitle>
            <DialogDescription>Введите код из приложения аутентификатора для подтверждения</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={twoFactorDisableCode}
              onChange={(e) => setTwoFactorDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="font-mono text-lg text-center rounded-xl"
              onKeyDown={(e) => { if (e.key === 'Enter' && twoFactorDisableCode.length === 6) disable2FA(); }}
            />
            <Button
              variant="destructive"
              className="w-full rounded-xl"
              disabled={twoFactorDisableCode.length !== 6 || twoFactorDisabling}
              onClick={disable2FA}
            >
              {twoFactorDisabling ? 'Отключение...' : 'Отключить 2FA'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImageCropDialog
        open={cropAvatarOpen}
        imageSrc={cropAvatarSrc}
        aspect={1}
        title="Обрезка аватара"
        onClose={() => {
          setCropAvatarOpen(false);
          if (cropAvatarSrc) URL.revokeObjectURL(cropAvatarSrc);
          setCropAvatarSrc(null);
        }}
        onCropped={async (blob) => {
          setUploadingAvatar(true);
          setMessage('');
          try {
            const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
            const media = await uploadFile(file);
            const key = extractStorageKey(media);
            if (key) {
              await api.patch('/users/me', { avatarUrl: key });
            }
            await fetchCurrentUser();
            setMessage('Фото обновлено');
          } catch (err: unknown) {
            setMessage(getErrorMessage(err) || 'Ошибка загрузки');
          } finally {
            setUploadingAvatar(false);
          }
        }}
      />
      <ImageCropDialog
        open={cropCoverOpen}
        imageSrc={cropCoverSrc}
        aspect={16 / 9}
        title="Обложка профиля"
        onClose={() => {
          setCropCoverOpen(false);
          if (cropCoverSrc) URL.revokeObjectURL(cropCoverSrc);
          setCropCoverSrc(null);
        }}
        onCropped={async (blob) => {
          setUploadingCover(true);
          setMessage('');
          try {
            const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
            const media = await uploadFile(file);
            const key = extractStorageKey(media);
            if (key) {
              await api.patch('/users/me', { coverUrl: key });
            }
            await fetchCurrentUser();
            if (typeof window !== 'undefined') localStorage.removeItem('aluf-profile-cover');
            setMessage('Обложка обновлена');
          } catch (err: unknown) {
            setMessage(getErrorMessage(err) || 'Ошибка загрузки обложки');
          } finally {
            setUploadingCover(false);
          }
        }}
      />
    </div>
    </PageTransition>
  );
}
