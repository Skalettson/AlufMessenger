import { create } from 'zustand';
import { api } from '@/lib/api';
import { wsClient } from '@/lib/ws';

export type CallType = 'voice' | 'video';
export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'declined' | 'busy';

export interface CallParticipant {
  userId: string;
  identity: string;
  name: string;
  avatar?: string | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  joinedAt: Date;
}

export interface Call {
  id: string;
  roomName: string;
  chatId: string;
  initiatorId: string;
  type: CallType;
  isGroup: boolean;
  status: CallStatus;
  participants: CallParticipant[];
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

interface CallState {
  activeCall: Call | null;
  incomingCall: Call | null;
  outgoingCall: Call | null;

  /** Собеседник 1:1 (для сигналинга и hangup). */
  peerUserId: string | null;

  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;

  /** Камера до включения демонстрации экрана (восстанавливаем после) */
  savedCameraTrack: MediaStreamTrack | null;

  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  callDuration: number;
  error: string | null;

  /** DTLS установлен — медиа идёт в SRTP (ключи только у участников). */
  callMediaEncrypted: boolean;
  /** 4 эмодзи из отпечатков DTLS в SDP — для сверки с собеседником (как в Telegram). */
  callVerificationEmoji: string | null;

  setActiveCall: (call: Call | null) => void;
  setIncomingCall: (call: Call | null) => void;
  setOutgoingCall: (call: Call | null) => void;
  setPeerUserId: (userId: string | null) => void;

  setLocalStream: (stream: MediaStream | null) => void;
  addRemoteStream: (userId: string, stream: MediaStream) => void;
  removeRemoteStream: (userId: string) => void;
  clearRemoteStreams: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  setCallDuration: (duration: number) => void;
  setError: (error: string | null) => void;
  setCallMediaEncrypted: (v: boolean) => void;
  setCallVerificationEmoji: (emoji: string | null) => void;

  /** WebRTC-сигналинг через realtime WS (сервер пересылает адресату). */
  sendSignal: (data: {
    toUserId: string;
    type: string;
    payload?: unknown;
  }) => void;

  startCall: (chatId: string, type: CallType) => Promise<Call>;
  acceptCall: (callId: string) => Promise<void>;
  declineCall: (callId: string) => Promise<void>;
  joinCall: (callId: string) => Promise<void>;
  leaveCall: (callId?: string) => Promise<void>;
  endCall: (callId: string) => Promise<void>;

  cleanup: () => void;
}

const INITIAL_CALL_STATE = {
  activeCall: null,
  incomingCall: null,
  outgoingCall: null,
  peerUserId: null,
  localStream: null,
  remoteStreams: new Map(),
  savedCameraTrack: null,
  isMuted: false,
  isVideoEnabled: true,
  isScreenSharing: false,
  callDuration: 0,
  error: null,
  callMediaEncrypted: false,
  callVerificationEmoji: null,
};

export const useCallStore = create<CallState>((set, get) => ({
  ...INITIAL_CALL_STATE,

  setActiveCall: (call) => set({ activeCall: call }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setOutgoingCall: (call) => set({ outgoingCall: call }),
  setPeerUserId: (userId) => set({ peerUserId: userId }),

  setLocalStream: (stream) => set({ localStream: stream }),
  addRemoteStream: (userId, stream) => {
    const { remoteStreams } = get();
    set({ remoteStreams: new Map(remoteStreams).set(userId, stream) });
  },
  removeRemoteStream: (userId) => {
    const { remoteStreams } = get();
    const newMap = new Map(remoteStreams);
    newMap.delete(userId);
    set({ remoteStreams: newMap });
  },
  clearRemoteStreams: () => set({ remoteStreams: new Map() }),

  sendSignal: (data) => {
    const { activeCall, incomingCall } = get();
    const current = activeCall ?? incomingCall;
    if (!current || !data.toUserId) return;
    wsClient.send('call.signal', {
      callId: current.id,
      toUserId: data.toUserId,
      type: data.type,
      payload: data.payload,
    });
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    const audio = localStream?.getAudioTracks()[0];
    if (!audio) return;
    const nextMuted = !isMuted;
    audio.enabled = !nextMuted;
    set({ isMuted: nextMuted });
  },

  toggleVideo: () => {
    const { localStream, isVideoEnabled } = get();
    const video = localStream?.getVideoTracks().find((t) => t.kind === 'video');
    if (!video) return;
    const next = !isVideoEnabled;
    video.enabled = next;
    set({ isVideoEnabled: next });
  },

  toggleScreenShare: async () => {
    const { localStream, isScreenSharing, savedCameraTrack } = get();
    if (!localStream) return;

    try {
      if (!isScreenSharing) {
        const screen = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const screenTrack = screen.getVideoTracks()[0];
        if (!screenTrack) return;

        const cam = localStream.getVideoTracks().find((t) => t.kind === 'video' && t !== screenTrack);
        if (cam) {
          set({ savedCameraTrack: cam });
          localStream.removeTrack(cam);
          cam.stop();
        } else {
          set({ savedCameraTrack: null });
        }

        localStream.addTrack(screenTrack);
        screenTrack.onended = () => {
          void get().toggleScreenShare();
        };

        set({ isScreenSharing: true, isVideoEnabled: true, localStream });
      } else {
        const screen = localStream.getVideoTracks().find((t) => t.label && t.readyState === 'live');
        if (screen) {
          localStream.removeTrack(screen);
          screen.stop();
        }

        let cam = savedCameraTrack;
        if (!cam || cam.readyState === 'ended') {
          try {
            const camStream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            });
            cam = camStream.getVideoTracks()[0];
          } catch {
            cam = null;
          }
        }

        if (cam && cam.readyState === 'live') {
          localStream.addTrack(cam);
        }
        set({ isScreenSharing: false, savedCameraTrack: null, isVideoEnabled: true, localStream });
      }
    } catch (err) {
      console.error('Screen share error:', err);
      set({ error: 'Не удалось начать демонстрацию экрана' });
    }
  },

  setCallDuration: (duration) => set({ callDuration: duration }),
  setError: (error) => set({ error }),
  setCallMediaEncrypted: (v) => set({ callMediaEncrypted: v }),
  setCallVerificationEmoji: (emoji) => set({ callVerificationEmoji: emoji }),

  startCall: async (chatId: string, type: CallType) => {
    try {
      set({ error: null });

      const response = await api.post<{
        id: string;
        roomName?: string;
        room_name?: string;
        token: string;
        chatId: string;
        initiatorId?: string;
        callerId?: string;
        type: CallType;
        isGroup?: boolean;
        is_group?: boolean;
      }>('/calls', { chatId, type });

      const roomName = response.roomName ?? response.room_name ?? '';
      const initiatorId = response.initiatorId ?? response.callerId ?? '';
      const isGroup = response.isGroup ?? response.is_group ?? false;

      const call: Call = {
        id: response.id,
        roomName,
        chatId: response.chatId,
        initiatorId,
        type: response.type,
        isGroup,
        status: 'ringing',
        participants: [],
        startedAt: null,
        endedAt: null,
        createdAt: new Date(),
      };

      set({ outgoingCall: call, activeCall: call });
      return call;
    } catch (err: unknown) {
      const error = err as { message?: string };
      set({ error: error.message ?? 'Ошибка при начале звонка' });
      throw err;
    }
  },

  acceptCall: async (callId: string) => {
    try {
      set({ error: null });
      await api.post(`/calls/${callId}/join`);

      const call = get().incomingCall;
      if (call) {
        set({
          activeCall: { ...call, status: 'active', roomName: call.roomName },
          incomingCall: null,
          outgoingCall: null,
        });
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      set({ error: error.message ?? 'Ошибка при принятии звонка' });
      throw err;
    }
  },

  declineCall: async (callId: string) => {
    try {
      set({ error: null });
      await api.post(`/calls/${callId}/leave`);
      set({ incomingCall: null });
    } catch (err: unknown) {
      const error = err as { message?: string };
      set({ error: error.message ?? 'Ошибка при отклонении звонка' });
      throw err;
    }
  },

  joinCall: async (callId: string) => {
    try {
      set({ error: null });
      await api.post(`/calls/${callId}/join`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      set({ error: error.message ?? 'Ошибка при подключении к звонку' });
      throw err;
    }
  },

  leaveCall: async (callId?: string) => {
    try {
      set({ error: null });
      if (callId) {
        await api.post(`/calls/${callId}/leave`);
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      set({ error: error.message ?? 'Ошибка при выходе из звонка' });
      throw err;
    }
  },

  endCall: async (callId: string) => {
    try {
      set({ error: null });
      await api.post(`/calls/${callId}/end`);
      get().cleanup();
    } catch (err: unknown) {
      const error = err as { message?: string };
      set({ error: error.message ?? 'Ошибка при завершении звонка' });
      throw err;
    }
  },

  cleanup: () => {
    const { localStream } = get();
    localStream?.getTracks().forEach((t) => t.stop());

    set({
      ...INITIAL_CALL_STATE,
    });
  },
}));
