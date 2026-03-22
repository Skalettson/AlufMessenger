import type { Provider } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@aluf/db';

export const DATABASE_TOKEN = 'DATABASE';

export type DrizzleDB = ReturnType<typeof createDrizzle>;

function createDrizzle(connectionString: string) {
  const queryClient = postgres(connectionString, {
    max: Number(process.env.DATABASE_POOL_SIZE) || 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(queryClient, { schema });
}

export const DatabaseProvider: Provider = {
  provide: DATABASE_TOKEN,
  useFactory: () => {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is required for ma-platform');
    }
    return createDrizzle(url);
  },
};
