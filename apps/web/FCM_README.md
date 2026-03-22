# Firebase Cloud Messaging (FCM)

The web app can use **Firebase Cloud Messaging** for browser push notifications.

## Configuration

1. Create a Firebase project in [Google Firebase Console](https://console.firebase.google.com/).
2. Add a web app and copy the **client configuration** (not service-account secrets for server-side push).
3. Set these environment variables in your **private** deployment (never commit real values to a public repository):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web Push certificate (VAPID) from Firebase Console → Cloud Messaging |

4. Align `apps/web/public/firebase-messaging-sw.js` with the same project credentials (often generated or injected at build time from the values above).

## Source layout

- `apps/web/src/lib/firebase.ts` — client SDK initialization
- `apps/web/src/hooks/use-firebase-messaging.ts` — token and foreground messages
- `apps/web/src/components/fcm/fcm-provider.tsx` — wires FCM after login

The service worker handles background notifications when the app is not focused.
