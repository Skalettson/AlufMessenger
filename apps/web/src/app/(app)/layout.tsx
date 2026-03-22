'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 767px)');
    setIsMobile(m.matches);
    const on = () => setIsMobile(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return isMobile;
}
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/stores/auth-store';
import { useWebSocket } from '@/hooks/use-websocket';
import { Sidebar } from '@/components/sidebar/sidebar';
import { NewChatDialog } from '@/components/sidebar/new-chat-dialog';
import { StoryViewer } from '@/components/story/story-viewer';
import { StoryCreateDialog } from '@/components/story/story-create-dialog';
import { MediaViewer } from '@/components/media/media-viewer';
import { CallOverlay } from '@/components/call/call-overlay';
import { ProfileCard } from '@/components/chat/profile-card';
import { ChatInfoDialog } from '@/components/chat/chat-info-dialog';
import { ChatSearchDialog } from '@/components/chat/chat-search-dialog';
import { ProfileCardPanel } from '@/components/chat/profile-card-panel';
import { ChatInfoPanel } from '@/components/chat/chat-info-panel';
import { DeleteUndoToast } from '@/components/chat/delete-undo-toast';
import { MusicPlayer } from '@/components/music/music-player';
import { ForwardDialog, type ForwardModalData } from '@/components/chat/forward-dialog';
import { useUiStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import { MessageCircle } from 'lucide-react';
import type { Story } from '@/types';

interface StoryGroupData {
  user: { id: string; displayName: string; avatarUrl: string | null };
  stories: Story[];
  hasUnviewed: boolean;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const activeModal = useUiStore((s) => s.activeModal);
  const modalData = useUiStore((s) => s.modalData);
  const closeModal = useUiStore((s) => s.closeModal);
  const activeCall = useUiStore((s) => s.activeCall);
  const setActiveCall = useUiStore((s) => s.setActiveCall);
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  useWebSocket();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const openChat = (e: Event) => {
      const d = (e as CustomEvent<{ chatId?: string }>).detail;
      const cid = d?.chatId?.trim();
      if (!cid) return;
      closeModal();
      router.push(`/chat/${cid}`);
    };
    window.addEventListener('aluf-open-chat', openChat);
    return () => window.removeEventListener('aluf-open-chat', openChat);
  }, [router, closeModal]);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-background">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-lg shadow-primary/30"
        >
          <MessageCircle className="h-8 w-8 text-white" />
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const storyData = activeModal === ('story-viewer' as any) ? (modalData as StoryGroupData | null) : null;
  const mediaData = activeModal === 'media-viewer' ? (modalData as { url?: string; mediaId?: string; type?: 'image' | 'video' | 'video_note' } | null) : null;
  const profileCardData = activeModal === 'profile-card'
    ? (modalData as { userId: string; initialTitle?: string | null; initialAvatar?: string | null; initialIsBot?: boolean } | null)
    : null;
  const chatInfoData = activeModal === 'chat-info'
    ? (modalData as { chatId: string; title?: string } | null)
    : null;
  const chatSearchData = activeModal === 'chat-search'
    ? (modalData as { chatId: string; title?: string } | null)
    : null;
  const forwardData = activeModal === 'forward' ? (modalData as ForwardModalData | null) : null;

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-background">
      {/* На мобильном бэкдроп не показываем — список чатов полноэкранный и не сворачивается по тапу */}
      {!isMobile && (
        <AnimatePresence>
          {sidebarOpen && (
            <motion.button
              type="button"
              aria-label="Закрыть меню"
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={
                reduceMotion ? { duration: 0 } : { duration: 0.25, ease: [0.32, 0.72, 0, 1] }
              }
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
              onClick={() => useUiStore.getState().setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>
      )}
      {/* Сайдбар: на мобильном — на весь экран, не сворачиваемый; на десктопе — колонка 360px */}
      <motion.div
        className={cn(
          'h-full border-r border-border bg-sidebar flex-shrink-0 z-50',
          'fixed md:static inset-y-0 left-0',
          'w-full max-w-full md:max-w-none md:w-[360px]',
          'pl-[env(safe-area-inset-left)]',
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
        )}
        aria-hidden={!sidebarOpen}
        initial={false}
        animate={{
          x: isMobile ? (sidebarOpen ? 0 : '-100%') : 0,
        }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 400, damping: 35, mass: 0.8 }
        }
        style={{
          visibility: sidebarOpen || !isMobile ? 'visible' : 'hidden',
        }}
      >
        <Sidebar />
      </motion.div>
      {/* Основной контент */}
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
          'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          sidebarOpen ? 'hidden md:flex' : 'flex',
        )}
      >
        <MusicPlayer />
        <div className="min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden">{children}</div>
      </div>
      {!isMobile && profileCardData && (
        <ProfileCardPanel
          userId={profileCardData.userId}
          initialTitle={profileCardData.initialTitle}
          initialAvatar={profileCardData.initialAvatar}
          initialIsBot={profileCardData.initialIsBot}
          onClose={closeModal}
        />
      )}
      {!isMobile && !profileCardData && chatInfoData && (
        <ChatInfoPanel
          chatId={chatInfoData.chatId}
          initialTitle={chatInfoData.title ?? 'Чат'}
          onClose={closeModal}
        />
      )}

      <NewChatDialog />

      <AnimatePresence>
        {storyData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <StoryViewer
              stories={storyData.stories}
              user={storyData.user}
              isOwn={!!currentUserId && storyData.user.id === currentUserId}
              onClose={closeModal}
              onDelete={() => {
                window.dispatchEvent(new Event('story-updated'));
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {mediaData && (
        <MediaViewer
          items={[{ url: mediaData.url, mediaId: mediaData.mediaId, type: (mediaData.type === 'video_note' ? 'video' : mediaData.type) ?? 'image', isVideoNote: mediaData.type === 'video_note' }]}
          open={true}
          onClose={closeModal}
        />
      )}

      <StoryCreateDialog />

      <AnimatePresence>
        {isMobile && profileCardData && (
          <ProfileCard
            userId={profileCardData.userId}
            initialTitle={profileCardData.initialTitle}
            initialAvatar={profileCardData.initialAvatar}
            initialIsBot={profileCardData.initialIsBot}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>

      {isMobile && chatInfoData && (
        <ChatInfoDialog
          chatId={chatInfoData.chatId}
          initialTitle={chatInfoData.title ?? 'Чат'}
          open={true}
          onClose={closeModal}
        />
      )}

      {chatSearchData && (
        <ChatSearchDialog
          chatId={chatSearchData.chatId}
          title={chatSearchData.title ?? 'Чат'}
          open={true}
          onClose={closeModal}
        />
      )}

      <ForwardDialog
        open={activeModal === 'forward'}
        data={forwardData}
        onClose={closeModal}
      />

      <AnimatePresence>
        {activeCall && (
          <CallOverlay
            callId={activeCall.callId}
            chatTitle={activeCall.chatTitle}
            chatAvatar={activeCall.chatAvatar}
            callType={activeCall.callType}
            isIncoming={activeCall.isIncoming}
            participantIds={[]}
            onEnd={() => setActiveCall(null)}
          />
        )}
      </AnimatePresence>

      <DeleteUndoToast />
    </div>
  );
}
