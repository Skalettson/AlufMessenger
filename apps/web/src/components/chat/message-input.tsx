'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, Smile, X, Mic, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMessages } from '@/hooks/use-messages';
import { useTyping } from '@/hooks/use-typing';
import { useMessageStore, type Message } from '@/stores/message-store';
import { EmojiStickerPicker } from '@/components/chat/emoji-sticker-picker';
import { FileUpload } from '@/components/media/file-upload';
import { uploadFile } from '@/lib/upload';
import { getErrorMessage } from '@/lib/api';
import {
  assertMediaRecorderAvailable,
  describeGetUserMediaError,
  getAudioStreamForRecording,
  getVideoNoteStream,
  getVideoOnlyStream,
} from '@/lib/media-devices';
import { useChatStore } from '@/stores/chat-store';
import { VoiceRecordingPanel } from './voice-recording-panel';
import { VoicePreviewPanel } from './voice-preview-panel';
import { VideoNoteRecordingPanel } from './video-note-recording-panel';
import { VideoNotePreviewPanel } from './video-note-preview-panel';
import { MessageInputField } from './message-input-field';
import { MessageTextWithEmoji } from '@/components/message/message-text-with-emoji';

const EMPTY_MESSAGES: Message[] = [];

export interface BotCommandItem {
  command: string;
  description: string;
}

/** Получение текста превью для ответа с учётом типа контента */
function getReplyPreviewText(message: Message): string {
  if (message.contentType === 'sticker') return 'Стикер';
  if (message.contentType === 'image') return 'Фото';
  if (message.contentType === 'video') return 'Видео';
  if (message.contentType === 'audio') return 'Аудио';
  if (message.contentType === 'voice') return 'Голосовое сообщение';
  if (message.contentType === 'video_note') return 'Видеосообщение';
  if (message.contentType === 'document') return 'Документ';
  if (message.contentType === 'gif') return 'GIF';
  if (message.contentType === 'location') return 'Геопозиция';
  if (message.contentType === 'contact') return 'Контакт';
  if (message.contentType === 'poll') return 'Опрос';
  if (message.textContent && message.textContent.trim()) {
    return message.textContent;
  }
  return 'Сообщение';
}

interface Props {
  chatId: string;
  botCommands?: BotCommandItem[];
}

export function MessageInput({ chatId, botCommands = [] }: Props) {
  const chat = useChatStore((s) => s.chats.find((c) => c.id === chatId));
  const messages = useMessageStore((s) => s.messagesByChat[chatId] ?? EMPTY_MESSAGES);
  const canPost = chat?.type !== 'channel' || chat?.canPostMessages !== false;
  const isBotChat = chat?.type === 'private' && chat?.isBot === true;
  const isBotChatEmpty = isBotChat && messages.length === 0;
  const [text, setText] = useState('');
  const [showEmojiStickerPicker, setShowEmojiStickerPicker] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [recordPhase, setRecordPhase] = useState<'recording' | 'preview' | null>(null);
  const [videoNotePhase, setVideoNotePhase] = useState<'recording' | 'preview' | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [videoNotePreviewBlob, setVideoNotePreviewBlob] = useState<Blob | null>(null);
  const [videoNotePreviewDuration, setVideoNotePreviewDuration] = useState(0);
  const [videoNoteStream, setVideoNoteStream] = useState<MediaStream | null>(null);
  const [videoNotePausedBlob, setVideoNotePausedBlob] = useState<Blob | null>(null);
  const [recordError, setRecordError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoNoteRecorderRef = useRef<MediaRecorder | null>(null);
  const videoNoteStreamRef = useRef<MediaStream | null>(null);
  const videoNoteChunksRef = useRef<Blob[]>([]);
  const videoNoteOnStopHandledRef = useRef(false);
  const videoNoteStopIntentRef = useRef<'send' | 'cancel'>('cancel');
  const videoNoteMimeRef = useRef<string>('video/webm');
  const videoNoteFacingRef = useRef<'user' | 'environment'>('user');
  const [videoNoteFacing, setVideoNoteFacing] = useState<'user' | 'environment'>('user');
  const onStopHandledRef = useRef(false);
  const stopIntentRef = useRef<'send' | 'cancel'>('cancel');
  const voiceWasPausedRef = useRef(false);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const { sendMessage, sendVoiceMessage, sendVideoNote, editMessage } = useMessages(chatId);
  const { startTyping, stopTyping } = useTyping(chatId);
  const replyingTo = useMessageStore((s) => s.replyingTo);
  const editingMessage = useMessageStore((s) => s.editingMessage);
  const setReplyingTo = useMessageStore((s) => s.setReplyingTo);
  const setEditingMessage = useMessageStore((s) => s.setEditingMessage);

  useEffect(() => {
    if (editingMessage?.textContent != null) {
      setText(editingMessage.textContent);
      textareaRef.current?.focus();
    }
  }, [editingMessage?.id]);

  useEffect(() => {
    if (!showFileUpload) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFileUpload(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFileUpload]);

  const clearDurationInterval = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (editingMessage) {
      editMessage(editingMessage.id, trimmed);
      setText('');
      setEditingMessage(null);
    } else {
      sendMessage(trimmed, replyingTo?.id);
      setText('');
      setReplyingTo(null);
    }
    setEditingMessage(null);
    stopTyping();
    textareaRef.current?.focus();
  }, [text, sendMessage, editMessage, replyingTo, editingMessage, stopTyping, setReplyingTo, setEditingMessage]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    startTyping();
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }

  function handleEmojiSelect(emoji: string) {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  }

  const closeFileUpload = useCallback(() => setShowFileUpload(false), []);

  function handleFileUploaded(
    mediaId: string,
    url: string,
    contentType: 'image' | 'video' | 'audio' | 'voice' | 'document',
    caption?: string,
  ) {
    sendMessage(caption?.trim() ?? '', replyingTo?.id, [mediaId], contentType, url);
    setShowFileUpload(false);
    setReplyingTo(null);
    stopTyping();
  }

  function handleStickerSelect(mediaId: string) {
    sendMessage('', replyingTo?.id, [mediaId], 'sticker');
    setShowEmojiStickerPicker(false);
    setReplyingTo(null);
    stopTyping();
  }

  const startRecording = useCallback(async () => {
    setRecordError('');
    onStopHandledRef.current = false;
    voiceWasPausedRef.current = false;
    let stream: MediaStream | null = null;
    try {
      stream = await getAudioStreamForRecording();
      assertMediaRecorderAvailable();
      const mediaStream = stream;
      streamRef.current = mediaStream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';
      const recorder = mime ? new MediaRecorder(mediaStream, { mimeType: mime }) : new MediaRecorder(mediaStream);
      chunksRef.current = [];
      startTimeRef.current = Date.now();
      setDurationSec(0);
      durationIntervalRef.current = setInterval(() => {
        setDurationSec((Date.now() - startTimeRef.current) / 1000);
      }, 100);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        if (onStopHandledRef.current) return;
        onStopHandledRef.current = true;
        clearDurationInterval();
        mediaStream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const intent = stopIntentRef.current;
        mediaRecorderRef.current = null;
        setIsPaused(false);

        if (intent === 'cancel') {
          setRecordPhase(null);
          return;
        }
        if (chunksRef.current.length === 0) {
          setRecordPhase(null);
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mime || undefined });
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const wasPaused = voiceWasPausedRef.current;
        if (intent === 'send' && !wasPaused) {
          try {
            const voiceExt = (blob.type || mime || '').includes('mp4') ? 'm4a' : 'webm';
            const file = new File([blob], `voice.${voiceExt}`, { type: blob.type });
            const media = await uploadFile(file, chatId);
            sendVoiceMessage(media.id, replyingTo?.id, media.url, elapsed);
            setReplyingTo(null);
          } catch (err) {
            setRecordError(getErrorMessage(err) || 'Ошибка отправки голосового');
          }
          setRecordPhase(null);
          return;
        }
        setPreviewBlob(blob);
        setPreviewDuration(elapsed);
        setRecordPhase('preview');
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setRecordPhase('recording');
      setIsPaused(false);
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setRecordError(describeGetUserMediaError(e));
    }
  }, [clearDurationInterval, chatId, sendVoiceMessage, replyingTo?.id, setReplyingTo]);

  const stopRecording = useCallback((intent: 'send' | 'cancel') => {
    stopIntentRef.current = intent;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      voiceWasPausedRef.current = true;
      mediaRecorderRef.current.pause();
      clearDurationInterval();
      setIsPaused(true);
    }
  }, [clearDurationInterval]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      startTimeRef.current = Date.now() - durationSec * 1000;
      durationIntervalRef.current = setInterval(() => {
        setDurationSec((Date.now() - startTimeRef.current) / 1000);
      }, 100);
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  }, [durationSec]);

  const handlePreviewSend = useCallback(
    async (blob: Blob) => {
      try {
        const voiceExt = (blob.type || '').includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `voice.${voiceExt}`, { type: blob.type });
        const media = await uploadFile(file, chatId);
        sendVoiceMessage(media.id, replyingTo?.id, media.url, previewDuration);
        setPreviewBlob(null);
        setPreviewDuration(0);
        setRecordPhase(null);
        setReplyingTo(null);
      } catch (err) {
        setRecordError(getErrorMessage(err) || 'Ошибка отправки голосового');
      }
    },
    [chatId, sendVoiceMessage, replyingTo?.id, setReplyingTo],
  );

  const handlePreviewCancel = useCallback(() => {
    setPreviewBlob(null);
    setPreviewDuration(0);
    setRecordPhase(null);
  }, []);

  const flipVideoNoteCamera = useCallback(async () => {
    const stream = videoNoteStreamRef.current;
    if (!stream) return;
    const next = videoNoteFacingRef.current === 'user' ? 'environment' : 'user';
    videoNoteFacingRef.current = next;
    setVideoNoteFacing(next);
    try {
      const newVid = await getVideoOnlyStream(next);
      const v = newVid.getVideoTracks()[0];
      stream.getVideoTracks().forEach((t) => {
        stream.removeTrack(t);
        t.stop();
      });
      stream.addTrack(v);
      setVideoNoteStream(stream);
    } catch (e) {
      setRecordError(describeGetUserMediaError(e));
    }
  }, []);

  const startVideoNoteRecording = useCallback(async () => {
    setRecordError('');
    videoNoteOnStopHandledRef.current = false;
    videoNoteFacingRef.current = 'user';
    setVideoNoteFacing('user');
    let stream: MediaStream | null = null;
    try {
      stream = await getVideoNoteStream('user');
      assertMediaRecorderAvailable();
      const mediaStream = stream;
      videoNoteStreamRef.current = mediaStream;
      setVideoNoteStream(mediaStream);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4';
      videoNoteMimeRef.current = mime;
      const recorder = mime ? new MediaRecorder(mediaStream, { mimeType: mime }) : new MediaRecorder(mediaStream);
      videoNoteChunksRef.current = [];
      startTimeRef.current = Date.now();
      setDurationSec(0);
      durationIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDurationSec(elapsed);
        if (elapsed >= 60) {
          videoNoteStopIntentRef.current = 'send';
          recorder.stop();
        }
      }, 100);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoNoteChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        if (videoNoteOnStopHandledRef.current) return;
        videoNoteOnStopHandledRef.current = true;
        clearDurationInterval();
        mediaStream.getTracks().forEach((t) => t.stop());
        videoNoteStreamRef.current = null;
        setVideoNoteStream(null);
        const intent = videoNoteStopIntentRef.current;
        videoNoteRecorderRef.current = null;
        setIsPaused(false);

        if (intent === 'cancel') {
          setVideoNotePausedBlob(null);
          setVideoNotePhase(null);
          return;
        }
        if (videoNoteChunksRef.current.length === 0) {
          setVideoNotePausedBlob(null);
          setVideoNotePhase(null);
          return;
        }

        setVideoNotePausedBlob(null);
        const blob = new Blob(videoNoteChunksRef.current, { type: mime });
        if (intent === 'send') {
          try {
            const ext = mime.includes('webm') ? 'webm' : 'mp4';
            const file = new File([blob], `video_note.${ext}`, { type: blob.type });
            const media = await uploadFile(file, chatId);
            sendVideoNote(media.id, replyingTo?.id, media.url, durationSec);
            setReplyingTo(null);
          } catch (err) {
            setRecordError(getErrorMessage(err) || 'Ошибка отправки видеосообщения');
          }
          setVideoNotePhase(null);
          return;
        }
      };

      videoNoteRecorderRef.current = recorder;
      recorder.start(100);
      setVideoNotePhase('recording');
      setIsPaused(false);
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      videoNoteStreamRef.current = null;
      setVideoNoteStream(null);
      setRecordError(describeGetUserMediaError(e));
    }
  }, [clearDurationInterval, chatId, sendVideoNote, replyingTo?.id, setReplyingTo]);

  const stopVideoNoteRecording = useCallback((intent: 'send' | 'cancel') => {
    videoNoteStopIntentRef.current = intent;
    if (videoNoteRecorderRef.current && videoNoteRecorderRef.current.state !== 'inactive') {
      videoNoteRecorderRef.current.stop();
    }
  }, []);

  const pauseVideoNoteRecording = useCallback(() => {
    const recorder = videoNoteRecorderRef.current;
    if (recorder?.state === 'recording') {
      recorder.requestData();
      recorder.pause();
      clearDurationInterval();
      setIsPaused(true);
      setTimeout(() => {
        if (videoNoteChunksRef.current.length > 0) {
          const blob = new Blob([...videoNoteChunksRef.current], { type: videoNoteMimeRef.current });
          setVideoNotePausedBlob(blob);
        }
      }, 80);
    }
  }, [clearDurationInterval]);

  const resumeVideoNoteRecording = useCallback(() => {
    if (videoNoteRecorderRef.current?.state === 'paused') {
      setVideoNotePausedBlob(null);
      startTimeRef.current = Date.now() - durationSec * 1000;
      durationIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setDurationSec(elapsed);
        if (elapsed >= 60) {
          videoNoteStopIntentRef.current = 'send';
          videoNoteRecorderRef.current?.stop();
        }
      }, 100);
      videoNoteRecorderRef.current.resume();
      setIsPaused(false);
    }
  }, [durationSec]);

  const handleVideoNotePreviewSend = useCallback(
    async (blob: Blob) => {
      try {
        const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
        const file = new File([blob], `video_note.${ext}`, { type: blob.type });
        const media = await uploadFile(file, chatId);
        sendVideoNote(media.id, replyingTo?.id, media.url, videoNotePreviewDuration);
        setVideoNotePreviewBlob(null);
        setVideoNotePreviewDuration(0);
        setVideoNotePhase(null);
        setReplyingTo(null);
      } catch (err) {
        setRecordError(getErrorMessage(err) || 'Ошибка отправки видеосообщения');
      }
    },
    [chatId, sendVideoNote, replyingTo?.id, setReplyingTo],
  );

  const handleVideoNotePreviewCancel = useCallback(() => {
    setVideoNotePreviewBlob(null);
    setVideoNotePreviewDuration(0);
    setVideoNotePhase(null);
  }, []);

  const handleMicClick = useCallback(() => {
    if (recordPhase === 'recording') {
      stopRecording('send');
    } else {
      startRecording();
    }
  }, [recordPhase, startRecording, stopRecording]);

  const handleSendCommand = useCallback(
    (cmd: string) => {
      const textToSend = cmd.startsWith('/') ? cmd : `/${cmd}`;
      sendMessage(textToSend, undefined);
    },
    [sendMessage],
  );

  if (canPost && isBotChatEmpty) {
    return (
      <div className="relative z-20 shrink-0 border-t border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <div className="flex justify-center items-center py-6 px-4">
          <Button
            type="button"
            onClick={() => handleSendCommand('start')}
            className="rounded-xl px-8 py-6 text-base font-semibold gradient-primary border-0 text-white shadow-lg shadow-primary/25 hover:opacity-95"
          >
            Запустить
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-20 shrink-0 border-t border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
      {!canPost && (
        <div className="px-4 py-3 text-center text-sm text-muted-foreground">
          Только администраторы канала могут публиковать сообщения
        </div>
      )}
      {canPost && (
      <>
      <AnimatePresence>
        {(replyingTo || editingMessage) && !recordPhase && !videoNotePhase && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-2 bg-secondary/30">
              <div className="flex-1 min-w-0 border-l-2 border-primary pl-3">
                <p className="text-xs font-medium text-primary">
                  {editingMessage ? 'Редактирование' : `Ответ для ${replyingTo?.senderName}`}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {editingMessage ? (
                    <MessageTextWithEmoji text={editingMessage.textContent ?? ''} emojiSize={16} />
                  ) : replyingTo ? (
                    <MessageTextWithEmoji text={getReplyPreviewText(replyingTo)} emojiSize={16} />
                  ) : null}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (editingMessage) setText(''); setReplyingTo(null); setEditingMessage(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recordPhase === 'recording' && (
          <VoiceRecordingPanel
            isPaused={isPaused}
            isRecording={true}
            durationSec={durationSec}
            mediaStream={streamRef.current}
            onPause={pauseRecording}
            onResume={resumeRecording}
            onCancel={() => stopRecording('cancel')}
            onSend={() => stopRecording('send')}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recordPhase === 'preview' && previewBlob && (
          <VoicePreviewPanel
            blob={previewBlob}
            durationSec={previewDuration}
            onSend={handlePreviewSend}
            onCancel={handlePreviewCancel}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {videoNotePhase === 'recording' && (
          <VideoNoteRecordingPanel
            stream={videoNoteStream}
            recordedPreviewBlob={videoNotePausedBlob}
            isPaused={isPaused}
            durationSec={durationSec}
            onPause={pauseVideoNoteRecording}
            onResume={resumeVideoNoteRecording}
            onCancel={() => stopVideoNoteRecording('cancel')}
            onSend={() => stopVideoNoteRecording('send')}
            onFlipCamera={flipVideoNoteCamera}
            facingMode={videoNoteFacing}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {videoNotePhase === 'preview' && videoNotePreviewBlob && (
          <VideoNotePreviewPanel
            blob={videoNotePreviewBlob}
            durationSec={videoNotePreviewDuration}
            onSend={handleVideoNotePreviewSend}
            onCancel={handleVideoNotePreviewCancel}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEmojiStickerPicker && !recordPhase && !videoNotePhase && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-4 mb-2 z-10"
          >
            <EmojiStickerPicker
              onSelectEmoji={handleEmojiSelect}
              onSelectSticker={handleStickerSelect}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showFileUpload && !recordPhase && !videoNotePhase && typeof document !== 'undefined' && (() => {
        const chatRoot = document.querySelector('[data-chat-root]');
        if (!chatRoot) return null;
        return createPortal(
          <motion.div
            key="file-upload-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/30"
            onClick={closeFileUpload}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="w-[320px] max-w-[calc(100%-2rem)] bg-card border border-border rounded-xl shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Загрузка файла"
            >
              <FileUpload chatId={chatId} onUploaded={handleFileUploaded} onClose={closeFileUpload} />
            </motion.div>
          </motion.div>,
          chatRoot
        );
      })()}

      {recordError && (
        <p className="text-xs text-destructive px-4 pb-1">{recordError}</p>
      )}
      <div className="flex items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] touch-manipulation">
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground flex-shrink-0 h-9 w-9 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
            onClick={() => { setShowFileUpload(!showFileUpload); setShowEmojiStickerPicker(false); }}
            disabled={!!recordPhase || !!videoNotePhase}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </motion.div>

        {!recordPhase && !videoNotePhase && (
          <div className="flex-1 rounded-xl bg-secondary/50 px-3 py-1 focus-within:ring-2 focus-within:ring-primary/20 transition-all min-h-0">
            <MessageInputField
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={(e) => {
                setShowEmojiStickerPicker(false);
                setShowFileUpload(false);
                /* scrollIntoView на iOS с клавиатурой уводит панель вверх — только на десктопе */
                if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
                  requestAnimationFrame(() => {
                    e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
                  });
                }
              }}
              placeholder="Сообщение… **жирный** __курсив__ ~~зачёрк~~ `код` ||спойлер||"
              disabled={false}
            />
          </div>
        )}

        {(recordPhase || videoNotePhase) && <div className="flex-1" />}

        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground flex-shrink-0 h-9 w-9 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
            onClick={() => { setShowEmojiStickerPicker(!showEmojiStickerPicker); setShowFileUpload(false); }}
            disabled={!!recordPhase || !!videoNotePhase}
            title="Эмодзи и стикеры"
          >
            <Smile className="h-5 w-5" />
          </Button>
        </motion.div>

        <AnimatePresence mode="wait">
          {text.trim() && !recordPhase && !videoNotePhase ? (
            <motion.div
              key="send"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              <Button
                type="button"
                size="icon"
                onClick={handleSend}
                className="flex-shrink-0 h-9 w-9 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 gradient-primary border-0 text-white shadow-md shadow-primary/25"
              >
                <Send className="h-4 w-4" />
              </Button>
            </motion.div>
          ) : !recordPhase && !videoNotePhase ? (
            !isBotChat ? (
              <motion.div
                key="actions"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="flex items-center gap-1"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground flex-shrink-0 h-9 w-9"
                  onClick={handleMicClick}
                  title="Голосовое сообщение"
                >
                  <Mic className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground flex-shrink-0 h-9 w-9"
                  onClick={() =>
                    videoNotePhase === 'recording'
                      ? stopVideoNoteRecording('send')
                      : startVideoNoteRecording()
                  }
                  title="Видеосообщение"
                >
                  <Video className="h-5 w-5" />
                </Button>
              </motion.div>
            ) : (
              <div key="bot-placeholder" className="flex-shrink-0 h-9 w-9" />
            )
          ) : (
            <div key="recording-placeholder" className="flex-shrink-0 h-9 w-9" />
          )}
        </AnimatePresence>
      </div>

      {isBotChat && botCommands.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {botCommands.map((c) => (
            <Button
              key={c.command}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full text-xs h-8"
              onClick={() => handleSendCommand(c.command)}
            >
              {c.description || (c.command.startsWith('/') ? c.command : `/${c.command}`)}
            </Button>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}
