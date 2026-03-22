'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useCallStore } from '@/stores/call-store';
import { useAuthStore } from '@/stores/auth-store';
import { wsClient } from '@/lib/ws';
import { getIceServers } from '@/lib/webrtc-ice';
import { deriveCallVerificationEmoji } from '@/lib/call-e2ee';

interface PeerConnection {
  peerConnection: RTCPeerConnection;
  userId: string;
}

function normalizePayload<T>(raw: unknown): T {
  if (raw == null) return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }
  return raw as T;
}

function currentCall() {
  const { activeCall, incomingCall } = useCallStore.getState();
  return activeCall ?? incomingCall;
}

export function useWebRTC() {
  const authUser = useAuthStore((s) => s.user);
  const peerUserId = useCallStore((s) => s.peerUserId);
  const activeCall = useCallStore((s) => s.activeCall);
  const incomingCall = useCallStore((s) => s.incomingCall);
  const localStream = useCallStore((s) => s.localStream);
  const remoteStreams = useCallStore((s) => s.remoteStreams);
  const {
    setLocalStream,
    addRemoteStream,
    removeRemoteStream,
    clearRemoteStreams,
    sendSignal,
    setError,
  } = useCallStore();

  const peerConnections = useRef<Map<string, PeerConnection>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const createdOffer = useRef<Set<string>>(new Set());
  const pendingOffer = useRef<{ fromUserId: string; sdp: RTCSessionDescriptionInit } | null>(null);
  const offerStarted = useRef(false);
  /** Чтобы один раз вычислить эмодзи-ключ верификации на peer. */
  const verificationDoneFor = useRef<Set<string>>(new Set());

  const createLocalStream = useCallback(
    async (type: 'voice' | 'video') => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video:
            type === 'video'
              ? {
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                  facingMode: 'user',
                }
              : false,
        });

        setLocalStream(stream);
        return stream;
      } catch (err) {
        console.error('Failed to get local stream:', err);
        setError('Не удалось получить доступ к микрофону' + (type === 'video' ? ' или камере' : ''));
        throw err;
      }
    },
    [setLocalStream, setError],
  );

  const createPeerConnection = useCallback(
    async (userId: string): Promise<RTCPeerConnection> => {
      const existing = peerConnections.current.get(userId)?.peerConnection;
      if (existing) return existing;

      const iceServers = await getIceServers();
      /** DTLS-SRTP включён по умолчанию в браузерах; явно требуем mux RTP/RTCP. */
      const pc = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });
      const ls = useCallStore.getState().localStream;

      if (ls) {
        ls.getTracks().forEach((track) => {
          pc.addTrack(track, ls);
        });
      }

      pc.onicecandidate = (event) => {
        const call = currentCall();
        if (event.candidate && call) {
          sendSignal({
            toUserId: userId,
            type: 'ice-candidate',
            payload: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        addRemoteStream(userId, stream);
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          setError('Потеряно соединение с собеседником');
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState !== 'connected') return;
        useCallStore.getState().setCallMediaEncrypted(true);
        if (verificationDoneFor.current.has(userId)) return;
        verificationDoneFor.current.add(userId);
        const ld = pc.localDescription?.sdp;
        const rd = pc.remoteDescription?.sdp;
        if (ld && rd) {
          void deriveCallVerificationEmoji(ld, rd).then((emoji) => {
            if (emoji) useCallStore.getState().setCallVerificationEmoji(emoji);
          });
        }
      };

      peerConnections.current.set(userId, { peerConnection: pc, userId });
      return pc;
    },
    [sendSignal, addRemoteStream, setError],
  );

  const createOffer = useCallback(
    async (userId: string) => {
      const call = currentCall();
      if (!call) return;

      let pc = peerConnections.current.get(userId)?.peerConnection;
      if (!pc) {
        pc = await createPeerConnection(userId);
      }

      if (createdOffer.current.has(userId)) {
        return;
      }
      createdOffer.current.add(userId);

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: call.type === 'video',
        });
        await pc.setLocalDescription(offer);

        sendSignal({
          toUserId: userId,
          type: 'offer',
          payload: { sdp: offer.sdp, type: offer.type },
        });
      } catch (err) {
        console.error('Failed to create offer:', err);
        setError('Ошибка при создании соединения');
      }
    },
    [createPeerConnection, sendSignal, setError],
  );

  const handleOffer = useCallback(
    async (fromUserId: string, sdp: RTCSessionDescriptionInit) => {
      const call = currentCall();
      if (!call) return;

      if (!useCallStore.getState().localStream) {
        pendingOffer.current = { fromUserId, sdp };
        return;
      }

      let pc = peerConnections.current.get(fromUserId)?.peerConnection;
      if (!pc) {
        pc = await createPeerConnection(fromUserId);
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendSignal({
          toUserId: fromUserId,
          type: 'answer',
          payload: { sdp: answer.sdp, type: answer.type },
        });

        const candidates = pendingCandidates.current.get(fromUserId);
        if (candidates) {
          for (const c of candidates) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingCandidates.current.delete(fromUserId);
        }
      } catch (err) {
        console.error('Failed to handle offer:', err);
        setError('Ошибка при обработке соединения');
      }
    },
    [createPeerConnection, sendSignal, setError],
  );

  const handleAnswer = useCallback(
    async (fromUserId: string, sdp: RTCSessionDescriptionInit) => {
      const pc = peerConnections.current.get(fromUserId)?.peerConnection;
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        const candidates = pendingCandidates.current.get(fromUserId);
        if (candidates) {
          for (const c of candidates) {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          }
          pendingCandidates.current.delete(fromUserId);
        }
      } catch (err) {
        console.error('Failed to handle answer:', err);
        setError('Ошибка при обработке ответа');
      }
    },
    [setError],
  );

  const handleIceCandidate = useCallback(async (fromUserId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current.get(fromUserId)?.peerConnection;
    if (!pc) {
      if (!pendingCandidates.current.has(fromUserId)) {
        pendingCandidates.current.set(fromUserId, []);
      }
      pendingCandidates.current.get(fromUserId)!.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Failed to add ICE candidate:', err);
    }
  }, []);

  const initCall = useCallback(
    async (type: 'voice' | 'video', participantIds: string[]) => {
      await createLocalStream(type);

      for (const userId of participantIds) {
        if (userId === authUser?.id) continue;
        await createPeerConnection(userId);
        setTimeout(() => {
          void createOffer(userId);
        }, 30);
      }
    },
    [authUser?.id, createLocalStream, createPeerConnection, createOffer],
  );

  /** Инициатор: старт WebRTC после того, как собеседник сделал join (сервер шлёт participant_joined). */
  const startOutgoingWebRtc = useCallback(
    async (type: 'voice' | 'video', peerId: string) => {
      if (offerStarted.current) return;
      offerStarted.current = true;
      await initCall(type, [peerId]);
    },
    [initCall],
  );

  const answerCall = useCallback(
    async (type: 'voice' | 'video', fromUserId: string) => {
      await createLocalStream(type);
      await createPeerConnection(fromUserId);

      const pending = pendingOffer.current;
      if (pending && pending.fromUserId === fromUserId) {
        pendingOffer.current = null;
        await handleOffer(pending.fromUserId, pending.sdp);
      }
    },
    [createLocalStream, createPeerConnection, handleOffer],
  );

  useEffect(() => {
    const unsub = wsClient.on('call.signal', (data: unknown) => {
      const signal = data as {
        callId: string;
        fromUserId: string;
        type: string;
        payload: unknown;
      };

      const call = currentCall();
      if (!call || signal.callId !== call.id) return;
      if (signal.fromUserId === authUser?.id) return;

      switch (signal.type) {
        case 'participant_joined': {
          if (!signal.fromUserId) return;
          if (call.initiatorId !== authUser?.id) return;
          if (peerUserId && signal.fromUserId !== peerUserId) return;
          void startOutgoingWebRtc(call.type, signal.fromUserId);
          break;
        }
        case 'offer': {
          const payload = normalizePayload<RTCSessionDescriptionInit>(signal.payload);
          void handleOffer(signal.fromUserId, payload);
          break;
        }
        case 'answer': {
          const payload = normalizePayload<RTCSessionDescriptionInit>(signal.payload);
          void handleAnswer(signal.fromUserId, payload);
          break;
        }
        case 'ice-candidate': {
          const payload = normalizePayload<RTCIceCandidateInit>(signal.payload);
          void handleIceCandidate(signal.fromUserId, payload);
          break;
        }
        case 'hangup': {
          removeRemoteStream(signal.fromUserId);
          const entry = peerConnections.current.get(signal.fromUserId);
          if (entry) {
            entry.peerConnection.close();
            peerConnections.current.delete(signal.fromUserId);
          }
          break;
        }
        default:
          break;
      }
    });

    return () => {
      unsub();
    };
  }, [
    authUser?.id,
    peerUserId,
    activeCall?.id,
    incomingCall?.id,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    removeRemoteStream,
    startOutgoingWebRtc,
  ]);

  const sendHangup = useCallback(() => {
    const call = currentCall();
    if (!call) return;

    const targets = new Set<string>();
    call.participants.forEach((p) => {
      if (p.userId !== authUser?.id) targets.add(p.userId);
    });
    remoteStreams.forEach((_, uid) => targets.add(uid));
    if (peerUserId && peerUserId !== authUser?.id) {
      targets.add(peerUserId);
    }

    targets.forEach((uid) => {
      sendSignal({
        toUserId: uid,
        type: 'hangup',
        payload: {},
      });
    });
  }, [authUser?.id, remoteStreams, peerUserId, sendSignal]);

  const cleanup = useCallback(() => {
    peerConnections.current.forEach((pc) => {
      pc.peerConnection.close();
    });
    peerConnections.current.clear();
    createdOffer.current.clear();
    pendingCandidates.current.clear();
    pendingOffer.current = null;
    offerStarted.current = false;
    verificationDoneFor.current.clear();
    useCallStore.getState().setCallMediaEncrypted(false);
    useCallStore.getState().setCallVerificationEmoji(null);
    clearRemoteStreams();
    setLocalStream(null);
  }, [clearRemoteStreams, setLocalStream]);

  useEffect(() => {
    if (!localStream) return;

    peerConnections.current.forEach((pc) => {
      const senders = pc.peerConnection.getSenders();
      const audioTrack = localStream.getAudioTracks()[0];
      const videoTrack = localStream.getVideoTracks()[0];

      const audioSender = senders.find((s) => s.track?.kind === 'audio');
      const videoSender = senders.find((s) => s.track?.kind === 'video');

      if (audioTrack) {
        if (audioSender) {
          void audioSender.replaceTrack(audioTrack);
        } else {
          pc.peerConnection.addTrack(audioTrack, localStream);
        }
      }

      if (videoTrack) {
        if (videoSender) {
          void videoSender.replaceTrack(videoTrack);
        } else {
          pc.peerConnection.addTrack(videoTrack, localStream);
        }
      }
    });
  }, [localStream]);

  return {
    initCall,
    answerCall,
    startOutgoingWebRtc,
    sendHangup,
    cleanup,
    createLocalStream,
  };
}
