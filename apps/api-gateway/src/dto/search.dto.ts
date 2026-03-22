import { z } from 'zod';

export const SearchQueryDto = z.object({
  q: z.string().min(1).max(256),
  type: z.enum(['messages', 'users', 'chats', 'all']).default('all'),
  chatId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type SearchQueryDto = z.infer<typeof SearchQueryDto>;
