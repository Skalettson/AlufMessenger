import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, type Messaging } from 'firebase/messaging';

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  };
}

let app: FirebaseApp | undefined;
let messaging: Messaging | null = null;

export function getFirebaseApp(): FirebaseApp {
  const cfg = getFirebaseConfig();
  if (!cfg.apiKey) {
    throw new Error('Firebase is not configured: set NEXT_PUBLIC_FIREBASE_* environment variables.');
  }
  if (!app) {
    app = initializeApp(cfg);
  }
  return app;
}

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const cfg = getFirebaseConfig();
  if (!cfg.apiKey) {
    return null;
  }

  if (!messaging) {
    try {
      const firebaseApp = getFirebaseApp();
      messaging = getMessaging(firebaseApp);
    } catch (error) {
      console.error('Failed to initialize Firebase Messaging:', error);
      return null;
    }
  }
  return messaging;
}
