import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import type { Messaging } from 'firebase-admin/messaging';

export interface FcmNotification {
  title?: string;
  body?: string;
  imageUrl?: string;
}

export interface FcmData {
  [key: string]: string;
}

export interface FcmSendResult {
  success: boolean;
  invalidToken?: string;
  error?: string;
}

@Injectable()
export class FcmProvider {
  private messaging: Messaging | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const projectId = process.env.FCM_PROJECT_ID;
    const privateKey = process.env.FCM_PRIVATE_KEY;
    const clientEmail = process.env.FCM_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      console.warn(
        'FCM not configured: FCM_PROJECT_ID, FCM_PRIVATE_KEY, FCM_CLIENT_EMAIL required',
      );
      return;
    }

    const decodedKey = privateKey.replace(/\\n/g, '\n');

    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey: decodedKey,
            clientEmail,
          }),
        });
      }
      this.messaging = admin.messaging();
    } catch (err) {
      console.error('Failed to initialize Firebase Admin:', err);
    }
  }

  async send(
    token: string,
    notification: FcmNotification,
    data?: FcmData,
    options?: { badge?: number; sound?: string; silent?: boolean },
  ): Promise<FcmSendResult> {
    if (!this.messaging) {
      return { success: false, error: 'FCM not configured' };
    }

    const message: admin.messaging.Message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: data
        ? Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)]),
          )
        : undefined,
      android: {
        notification: {
          sound: options?.sound,
          defaultSound: !options?.silent,
          defaultVibrateTimings: true,
        },
        data: data,
      },
      apns: {
        payload: {
          aps: {
            badge: options?.badge,
            sound: options?.sound ?? (options?.silent ? undefined : 'default'),
            'content-available': options?.silent ? 1 : 0,
            mutableContent: true,
          },
        },
        fcmOptions: {
          imageUrl: notification.imageUrl,
        },
      },
      webpush: {
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.imageUrl,
        },
      },
    };

    try {
      await this.messaging.send(message);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const invalidToken =
        msg.includes('not a valid FCM registration token') ||
        msg.includes('registration token is not valid') ||
        msg.includes('Requested entity was not found') ||
        msg.includes('unregistered');

      if (invalidToken) {
        return { success: false, invalidToken: token, error: msg };
      }
      return { success: false, error: msg };
    }
  }

  isConfigured(): boolean {
    return this.messaging !== null;
  }
}
