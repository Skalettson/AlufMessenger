'use client';

import { useEffect, useRef } from 'react';
import { useFirebaseMessaging } from '@/hooks/use-firebase-messaging';
import { useAuth } from '@/hooks/use-auth';

export function FcmProvider() {
  const { isAuthenticated } = useAuth();
  const { requestPermission, isSubscribed } = useFirebaseMessaging({
    enabled: isAuthenticated,
  });
  const hasRequestedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !isSubscribed && !hasRequestedRef.current) {
      hasRequestedRef.current = true;
      requestPermission();
    }
  }, [isAuthenticated, isSubscribed, requestPermission]);

  return null;
}
