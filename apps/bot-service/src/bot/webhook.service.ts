import { Injectable, Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import { REDIS_TOKEN } from '../providers/redis.provider';
import type Redis from 'ioredis';

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const SIGNATURE_HEADER = 'X-Aluf-Webhook-Signature';
const WEBHOOK_STATUS_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class WebhookService {
  constructor(@Inject(REDIS_TOKEN) private readonly redis: Redis) {}

  async deliverUpdate(
    botId: string,
    webhookUrl: string,
    update: Record<string, unknown>,
    webhookSecret?: string,
  ): Promise<boolean> {
    const body = JSON.stringify(update);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (webhookSecret) {
      const signature = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
      headers[SIGNATURE_HEADER] = `sha256=${signature}`;
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(10_000),
        });

        if (response.ok) {
          await this.setWebhookDeliveryStatus(botId, true, response.status);
          return true;
        }

        if (response.status >= 400 && response.status < 500) {
          console.error(
            `Webhook delivery to ${webhookUrl} failed with ${response.status} for bot ${botId}, not retrying`,
          );
          await this.setWebhookDeliveryStatus(botId, false, response.status, `HTTP ${response.status}`);
          return false;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `Webhook delivery attempt ${attempt + 1}/${MAX_RETRIES} to ${webhookUrl} for bot ${botId} failed:`,
          msg,
        );
        if (attempt === MAX_RETRIES - 1) {
          await this.setWebhookDeliveryStatus(botId, false, undefined, msg);
        }
      }

      if (attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    console.error(
      `Webhook delivery to ${webhookUrl} for bot ${botId} failed after ${MAX_RETRIES} attempts`,
    );
    return false;
  }

  private async setWebhookDeliveryStatus(
    botId: string,
    success: boolean,
    statusCode?: number,
    errorMessage?: string,
  ): Promise<void> {
    const key = `bot:webhook:status:${botId}`;
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      lastDeliveryAt: now,
      ...(success ? { lastSuccessAt: now } : {}),
      ...(errorMessage ? { lastError: errorMessage } : {}),
      ...(statusCode !== undefined ? { lastStatusCode: statusCode } : {}),
    };
    try {
      const existing = await this.redis.get(key);
      const data = existing ? { ...JSON.parse(existing), ...payload } : payload;
      await this.redis.set(key, JSON.stringify(data), 'EX', WEBHOOK_STATUS_TTL_SEC);
    } catch {
      // ignore Redis errors for status
    }
  }
}
