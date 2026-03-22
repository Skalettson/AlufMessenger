import { Injectable } from '@nestjs/common';
import webpush from 'web-push';

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
  expirationTime?: number | null;
}

export interface WebPushSendResult {
  success: boolean;
  invalidToken?: string;
  error?: string;
}

@Injectable()
export class WebPushProvider {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      console.warn(
        'Web Push not configured: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY required',
      );
      return;
    }

    try {
      webpush.setVapidDetails(
        process.env.VAPID_MAILTO || 'mailto:notifications@aluf.app',
        publicKey,
        privateKey,
      );
      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize Web Push:', err);
    }
  }

  async send(
    subscription: WebPushSubscription | string,
    payload: string | Record<string, unknown>,
    options?: { TTL?: number },
  ): Promise<WebPushSendResult> {
    if (!this.initialized) {
      return { success: false, error: 'Web Push not configured' };
    }

    let sub: WebPushSubscription;
    let tokenForCleanup: string | undefined;

    if (typeof subscription === 'string') {
      try {
        sub = JSON.parse(subscription) as WebPushSubscription;
        tokenForCleanup = subscription;
      } catch {
        return { success: false, error: 'Invalid subscription JSON' };
      }
    } else {
      sub = subscription;
      tokenForCleanup = JSON.stringify(subscription);
    }

    if (!sub.endpoint || !sub.keys?.auth || !sub.keys?.p256dh) {
      return {
        success: false,
        invalidToken: tokenForCleanup,
        error: 'Invalid subscription format',
      };
    }

    const payloadStr =
      typeof payload === 'string' ? payload : JSON.stringify(payload);

    const pushOptions: webpush.RequestOptions = {
      TTL: options?.TTL ?? 86400,
      urgency: 'high',
    };

    try {
      await webpush.sendNotification(sub, payloadStr, pushOptions);
      return { success: true };
    } catch (err) {
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err
          ? (err as { statusCode: number }).statusCode
          : 0;
      const msg = err instanceof Error ? err.message : String(err);

      const invalidToken =
        statusCode === 404 ||
        statusCode === 410 ||
        statusCode === 400 ||
        msg.includes('expired') ||
        msg.includes('invalid');

      if (invalidToken) {
        return {
          success: false,
          invalidToken: tokenForCleanup,
          error: msg,
        };
      }
      return { success: false, error: msg };
    }
  }

  isConfigured(): boolean {
    return this.initialized;
  }
}
