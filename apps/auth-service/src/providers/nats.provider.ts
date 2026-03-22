import { Provider } from '@nestjs/common';
import { connect } from 'nats';
import type { NatsConnection } from 'nats';

export const NATS_TOKEN = 'NATS';
export type { NatsConnection };

export const NatsProvider: Provider = {
  provide: NATS_TOKEN,
  useFactory: async (): Promise<NatsConnection> => {
    const url = process.env.NATS_URL || 'nats://localhost:4222';
    const nc = await connect({
      servers: url,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000,
    });
    console.log(`Auth service connected to NATS at ${url}`);
    return nc;
  },
};
