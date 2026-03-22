'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getToken, onMessage, Unsubscribe, Messaging } from 'firebase/messaging';
import { useFcmStore } from '@/stores/fcm-store';
import { getFirebaseMessaging } from '@/lib/firebase';
import { api, getAccessToken } from '@/lib/api';

interface UseFirebaseMessagingOptions {
  vapidKey?: string;
  enabled?: boolean;
}

export function useFirebaseMessaging(options: UseFirebaseMessagingOptions = {}) {
  const { vapidKey, enabled = true } = options;
  const { token, setToken, unsubscribe: unsubscribeStore } = useFcmStore();
  const messagingRef = useRef<Messaging | null>(null);
  const isInitializedRef = useRef(false);

  const requestPermission = useCallback(async (): Promise<string | null> => {
    if (!enabled || typeof window === 'undefined') {
      return null;
    }

    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    const messaging = getFirebaseMessaging();
    if (!messaging) {
      console.warn('Firebase Messaging not available');
      return null;
    }

    messagingRef.current = messaging;

    try {
      const key = vapidKey || process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!key) {
        console.warn('FCM: set NEXT_PUBLIC_FIREBASE_VAPID_KEY (or pass vapidKey)');
        return null;
      }
      const currentToken = await getToken(messaging, { vapidKey: key });

      if (currentToken) {
        console.log('FCM Token:', currentToken);
        setToken(currentToken);
        if (getAccessToken()) {
          api.post('/notifications/token', { token: currentToken, platform: 'web' }).catch(() => {});
        }
        return currentToken;
      } else {
        console.warn('No registration token available');
        return null;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }, [enabled, vapidKey, setToken]);

  const subscribeToMessages = useCallback(() => {
    if (!messagingRef.current || !enabled) {
      return;
    }

    const unsubscribe = onMessage(messagingRef.current, (payload) => {
      console.log('FCM message received:', payload);
      
      const { title, body } = payload.notification || {};
      if (title && body && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-72.png',
          data: payload.data,
        });
      }
    });

    return unsubscribe;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || isInitializedRef.current) {
      return;
    }

    isInitializedRef.current = true;

    const initMessaging = async () => {
      const messaging = getFirebaseMessaging();
      if (!messaging) {
        return;
      }

      messagingRef.current = messaging;

      if (token) {
        subscribeToMessages();
      } else {
        await requestPermission();
      }
    };

    initMessaging();

    return () => {
      isInitializedRef.current = false;
    };
  }, [enabled, requestPermission, subscribeToMessages, token]);

  const unsubscribe = useCallback(() => {
    unsubscribeStore();
  }, [unsubscribeStore]);

  return {
    token,
    isSubscribed: token !== null,
    requestPermission,
    subscribeToMessages,
    unsubscribe,
  };
}
