import { Provider } from '@nestjs/common';
import { connect, NatsConnection, JetStreamClient, JetStreamManager } from 'nats';

export const NATS_TOKEN = 'NATS';
export const JETSTREAM_TOKEN = 'JETSTREAM';

export interface NatsClients {
  nc: NatsConnection;
  js: JetStreamClient;
}

export const NatsProvider: Provider = {
  provide: NATS_TOKEN,
  useFactory: async (): Promise<NatsClients> => {
    const url = process.env.NATS_URL || 'nats://localhost:4222';
    const nc = await connect({
      servers: url,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000,
    });
    console.log(`Connected to NATS at ${url}`);

    const jsm: JetStreamManager = await nc.jetstreamManager();

    const streams = ['MESSAGES', 'PRESENCE', 'CALLS'];
    for (const stream of streams) {
      try {
        await jsm.streams.info(stream);
      } catch {
        await jsm.streams.add({
          name: stream,
          subjects: [
            ...(stream === 'MESSAGES'
              ? [
                  'aluf.message.>',
                  'aluf.typing.>',
                  'aluf.notification.>',
                ]
              : []),
            ...(stream === 'PRESENCE' ? ['aluf.presence.>'] : []),
            ...(stream === 'CALLS' ? ['aluf.call.>'] : []),
          ],
        });
      }
    }

    const js = nc.jetstream();
    return { nc, js };
  },
};
