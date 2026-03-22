import { z } from 'zod';

export const CreateBotDto = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/),
  displayName: z.string().min(1).max(64),
  description: z.string().max(512).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});
export type CreateBotDto = z.infer<typeof CreateBotDto>;

const BotCommandSchema = z.object({
  command: z.string().min(1).max(32),
  description: z.string().max(256),
});

export const UpdateBotDto = z.object({
  description: z.string().max(512).nullable().optional(),
  commands: z.array(BotCommandSchema).optional(),
  webhookUrl: z.string().url().nullable().optional(),
  isInline: z.boolean().optional(),
});
export type UpdateBotDto = z.infer<typeof UpdateBotDto>;
