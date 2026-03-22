'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Monitor, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useCallStore } from '@/stores/call-store';
import { useUiStore } from '@/stores/ui-store';
import { useWebRTC } from '@/hooks/use-webrtc';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

interface Props {
  callId: string;
  chatTitle: string;
  chatAvatar: string | null;
  callType: 'voice' | 'video';
  isIncoming: boolean;
  participantIds?: string[];
  onEnd: () => void;
}

export function CallOverlay({ callId, chatTitle, chatAvatar, callType, isIncoming, onEnd }: Props) {
  const authUser = useAuthStore((s) => s.user);
  const uiPeer = useUiStore((s) => s.activeCall?.peerUserId);

  const {
    localStream,
    remoteStreams,
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    callDuration,
    callMediaEncrypted,
    callVerificationEmoji,
    error,
    setError,
    setPeerUserId,
    acceptCall,
    declineCall,
    endCall: endCallAction,
    leaveCall,
    joinCall: joinCallApi,
    cleanup: storeCleanup,
  } = useCallStore();

  const { answerCall, sendHangup, cleanup: webrtcCleanup } = useWebRTC();

  const [phase, setPhase] = useState<'ringing' | 'connecting' | 'active' | 'ended'>(() =>
    isIncoming ? 'ringing' : 'connecting',
  );

  const webrtcStarted = useRef(false);

  const peerId = uiPeer ?? useCallStore.getState().peerUserId;

  useEffect(() => {
    if (peerId) setPeerUserId(peerId);
    return () => setPeerUserId(null);
  }, [peerId, setPeerUserId]);

  const remoteEntries = Array.from(remoteStreams.entries());

  useEffect(() => {
    if (phase === 'connecting' && remoteStreams.size > 0) {
      setPhase('active');
    }
  }, [phase, remoteStreams.size]);

  useEffect(() => {
    if (phase !== 'active' && phase !== 'connecting') return;
    const t = setInterval(() => {
      useCallStore.setState((s) => ({ callDuration: s.callDuration + 1 }));
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    webrtcStarted.current = false;
  }, [callId]);

  useEffect(() => {
    if (!authUser || !peerId || !callId) return;
    if (isIncoming && phase !== 'active') return;
    if (!isIncoming && phase === 'ringing') return;
    if (webrtcStarted.current) return;

    webrtcStarted.current = true;
    let cancelled = false;

    (async () => {
      try {
        if (!isIncoming) {
          await joinCallApi(callId);
          if (cancelled) return;
        }
        if (isIncoming) {
          await answerCall(callType, peerId);
        }
      } catch (e) {
        console.error(e);
        setError('Не удалось подключить медиа');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    phase,
    callId,
    authUser?.id,
    peerId,
    isIncoming,
    callType,
    joinCallApi,
    answerCall,
    setError,
  ]);

  useEffect(() => {
    return () => {
      webrtcCleanup();
    };
  }, [webrtcCleanup]);

  async function handleAnswer() {
    try {
      await acceptCall(callId);
      setPhase('active');
    } catch (err) {
      setError('Ошибка при принятии звонка');
    }
  }

  async function handleDecline() {
    try {
      await declineCall(callId);
      storeCleanup();
      onEnd();
    } catch (err) {
      setError('Ошибка при отклонении звонка');
    }
  }

  async function handleEndCall() {
    try {
      sendHangup();
      webrtcCleanup();
      await leaveCall(callId);
      await endCallAction(callId);
      setPhase('ended');
      setTimeout(() => {
        onEnd();
      }, 400);
    } catch (err) {
      setError('Ошибка при завершении звонка');
    }
  }

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const showRinging = phase === 'ringing';
  const showConnecting = phase === 'connecting' && !isIncoming;
  const showActive = phase === 'active' || (phase === 'connecting' && !isIncoming);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-gray-900 to-black"
    >
      <div className="absolute inset-0 flex flex-col">
        <div className="flex flex-1 items-center justify-center p-4">
          {callType === 'video' ? (
            <div
              className={cn(
                'grid h-full w-full gap-4',
                remoteEntries.length === 0 && 'grid-cols-1',
                remoteEntries.length >= 1 && 'grid-cols-2',
              )}
            >
              {remoteEntries.map(([uid, stream]) => (
                <div key={uid} className="relative overflow-hidden rounded-xl bg-gray-800">
                  <RemoteVideo stream={stream} />
                  <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-sm text-white">
                    Собеседник
                  </div>
                </div>
              ))}

              <div
                className={cn(
                  'relative overflow-hidden rounded-xl bg-gray-800',
                  remoteEntries.length === 0 && 'absolute right-4 top-4 z-10 h-36 w-48 shadow-lg',
                )}
              >
                {localStream?.getVideoTracks().some((t) => t.enabled && t.readyState === 'live') ? (
                  <LocalVideo stream={localStream} mirrored />
                ) : (
                  <div className="flex h-full min-h-[200px] w-full items-center justify-center">
                    <UserAvatar src={chatAvatar} name="Вы" size="xl" className="!size-40 text-4xl" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-sm text-white">
                  Вы{isMuted ? ' · выкл. микрофон' : ''}
                </div>
              </div>

              {remoteEntries.length === 0 && !localStream?.getVideoTracks().length && (
                <motion.div
                  animate={showRinging || showConnecting ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex flex-col items-center justify-center"
                >
                  <div className="relative flex flex-col items-center gap-2">
                    <UserAvatar
                      src={chatAvatar}
                      name={chatTitle}
                      size="xl"
                      className="!size-[160px] text-5xl shadow-2xl ring-4 ring-white/10"
                    />
                    {(showRinging || showConnecting) && (
                      <>
                        <motion.div
                          className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/35"
                          animate={{ scale: [1, 1.45], opacity: [0.55, 0] }}
                          transition={{ duration: 1.6, repeat: Infinity }}
                        />
                        <motion.div
                          className="pointer-events-none absolute inset-0 rounded-full border border-white/20"
                          animate={{ scale: [1, 1.75], opacity: [0.35, 0] }}
                          transition={{ duration: 1.6, repeat: Infinity, delay: 0.25 }}
                        />
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
            <motion.div
              className="flex flex-col items-center justify-center gap-6"
              animate={showRinging || showConnecting ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="relative flex flex-col items-center">
                <UserAvatar
                  src={chatAvatar}
                  name={chatTitle}
                  size="xl"
                  className="!size-[160px] text-5xl shadow-2xl ring-4 ring-white/10"
                />
                {(showRinging || showConnecting) && (
                  <>
                    <motion.div
                      className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/35"
                      animate={{ scale: [1, 1.45], opacity: [0.55, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                    />
                    <motion.div
                      className="pointer-events-none absolute inset-0 rounded-full border border-white/20"
                      animate={{ scale: [1, 1.75], opacity: [0.35, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, delay: 0.25 }}
                    />
                  </>
                )}
              </div>
            </motion.div>
          )}
        </div>

        <div className="pb-4 text-center">
          <h2 className="text-2xl font-bold text-white">{chatTitle}</h2>
          <p className="mt-1 text-sm text-white/50">
            {showRinging
              ? isIncoming
                ? 'Входящий звонок…'
                : 'Вызов…'
              : showConnecting
                ? 'Соединение…'
                : phase === 'ended'
                  ? 'Завершён'
                  : formatDuration(callDuration)}
          </p>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          {(callMediaEncrypted || callVerificationEmoji) && (showActive || phase === 'connecting') && (
            <div className="mx-auto mt-3 max-w-md rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-left backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-300/95">
                <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Сквозное шифрование (DTLS-SRTP)
              </div>
              <p className="mt-1 text-[11px] leading-snug text-white/45">
                Аудио и видео шифруются между устройствами. Сервер и TURN не могут расшифровать поток.
              </p>
              {callVerificationEmoji ? (
                <>
                  <p className="mt-2 text-center text-2xl tracking-[0.35em]">{callVerificationEmoji}</p>
                  <p className="mt-1 text-center text-[10px] text-white/35">
                    Совпадает с ключом у собеседника — как в защищённом чате
                  </p>
                </>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-4 pb-8">
          {showRinging && isIncoming ? (
            <>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-16 w-16 rounded-full shadow-lg"
                  onClick={handleDecline}
                >
                  <PhoneOff className="h-7 w-7" />
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  size="icon"
                  className="h-16 w-16 rounded-full bg-green-500 shadow-lg shadow-green-500/30 hover:bg-green-600"
                  onClick={handleAnswer}
                >
                  <Phone className="h-7 w-7" />
                </Button>
              </motion.div>
            </>
          ) : showActive || phase === 'connecting' ? (
            <>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-14 w-14 rounded-full transition-colors',
                    isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20',
                  )}
                  onClick={() => useCallStore.getState().toggleMute()}
                >
                  {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </Button>
              </motion.div>
              {callType === 'video' && (
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-14 w-14 rounded-full transition-colors',
                      !isVideoEnabled ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20',
                    )}
                    onClick={() => useCallStore.getState().toggleVideo()}
                  >
                    {!isVideoEnabled ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                  </Button>
                </motion.div>
              )}
              {callType === 'video' && (
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-14 w-14 rounded-full transition-colors',
                      isScreenSharing ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-white hover:bg-white/20',
                    )}
                    onClick={() => useCallStore.getState().toggleScreenShare()}
                  >
                    <Monitor className="h-6 w-6" />
                  </Button>
                </motion.div>
              )}
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-16 w-16 rounded-full shadow-lg shadow-red-500/30"
                  onClick={handleEndCall}
                >
                  <PhoneOff className="h-7 w-7" />
                </Button>
              </motion.div>
            </>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

function LocalVideo({ stream, mirrored }: { stream: MediaStream; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn('h-full w-full object-cover', mirrored && 'scale-x-[-1]')}
    />
  );
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {});
  }, [stream]);

  return <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />;
}
