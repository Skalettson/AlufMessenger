import { z } from 'zod';

export const InitiateCallDto = z.object({
  chatId: z.string().min(1),
  type: z.enum(['voice', 'video']),
});
export type InitiateCallDto = z.infer<typeof InitiateCallDto>;

export const CallSignalDto = z.object({
  toUserId: z.string().uuid(),
  signalType: z.enum(['offer', 'answer', 'ice-candidate', 'hangup', 'mute', 'unmute', 'video-on', 'video-off', 'screen-share-start', 'screen-share-stop']),
  payload: z.record(z.unknown()),
});
export type CallSignalDto = z.infer<typeof CallSignalDto>;
