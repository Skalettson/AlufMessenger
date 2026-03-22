import { z } from 'zod';

function toMemberIdsArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (v == null) return '';
        if (typeof v === 'object' && 'id' in v) return String((v as { id?: string }).id ?? '').trim();
        if (typeof v === 'object' && 'user_id' in v) return String((v as { user_id?: string }).user_id ?? '').trim();
        return String(v).trim();
      })
      .filter((s) => s.length >= 1);
  }
  const s = (typeof value === 'string' || typeof value === 'number' ? String(value) : '').trim();
  return s ? [s] : [];
}

/** Нормализует входящее тело (camelCase/snake_case, массив или один id) перед валидацией. */
const CreateChatDtoRaw = z.object({
  type: z.enum(['private', 'group', 'channel', 'supergroup']).optional(),
  title: z.string().max(255).optional(),
  name: z.string().max(255).optional(),
  memberIds: z.unknown().optional(),
  member_ids: z.unknown().optional(),
  memberId: z.union([z.string(), z.number()]).optional(),
  member_id: z.union([z.string(), z.number()]).optional(),
  description: z.string().max(255).optional(),
  username: z.string().min(5).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
}).transform((data) => {
  const raw = data.memberIds ?? data.member_ids ?? data.memberId ?? data.member_id;
  const memberIds = toMemberIdsArray(raw);
  const type = data.type ?? 'private';
  const title = (data.title ?? data.name ?? '').trim();
  return {
    type,
    title,
    memberIds: memberIds.slice(0, 200),
    description: data.description,
    username: data.username?.trim().replace(/^@/, ''),
  };
});

export const CreateChatDto = CreateChatDtoRaw.refine(
  (data) => data.type !== 'private' || data.memberIds.length === 1,
  { message: 'Личный чат: укажите одного участника' },
).refine(
  (data) => data.type !== 'group' || data.memberIds.length >= 1,
  { message: 'Группа: выберите хотя бы одного участника' },
).refine(
  (data) => (data.type !== 'channel' && data.type !== 'supergroup') || (data.title && data.title.length >= 1),
  { message: 'Укажите название канала' },
);
export type CreateChatDto = z.infer<typeof CreateChatDto>;

export const UpdateChatDto = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(500).optional(),
  avatarFileId: z.string().optional(),
  username: z.string().min(5).max(32).regex(/^[a-zA-Z0-9_]+$/).optional().nullable(),
  slowModeSeconds: z.number().int().min(0).optional(),
});
export type UpdateChatDto = z.infer<typeof UpdateChatDto>;

export const AddMembersDto = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100),
});
export type AddMembersDto = z.infer<typeof AddMembersDto>;

export const UpdateMemberRoleDto = z.object({
  role: z.enum(['member', 'admin', 'moderator']),
});
export type UpdateMemberRoleDto = z.infer<typeof UpdateMemberRoleDto>;

export const CreateInviteLinkDto = z.object({
  expiresInHours: z.number().int().positive().optional(),
  maxUses: z.number().int().positive().optional(),
});
export type CreateInviteLinkDto = z.infer<typeof CreateInviteLinkDto>;

// === DTO для расширенных функций групп ===

export const BanMemberDto = z.object({
  userId: z.string().min(1),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
  deleteMessages: z.boolean().optional().default(false),
});
export type BanMemberDto = z.infer<typeof BanMemberDto>;

export const UnbanMemberDto = z.object({
  userId: z.string().min(1),
});
export type UnbanMemberDto = z.infer<typeof UnbanMemberDto>;

export const GetBannedMembersDto = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});
export type GetBannedMembersDto = z.infer<typeof GetBannedMembersDto>;

export const GetAuditLogDto = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
  actionFilter: z.string().optional(),
});
export type GetAuditLogDto = z.infer<typeof GetAuditLogDto>;

export const ModerationSettingsDto = z.object({
  forbiddenWords: z.array(z.string()).optional(),
  forbiddenWordsMode: z.enum(['warn', 'delete', 'ban']).optional(),
  antiSpamEnabled: z.boolean().optional(),
  antiSpamMessagesLimit: z.number().int().min(1).max(20).optional(),
  antiSpamTimeWindow: z.number().int().min(5).max(60).optional(),
  antiSpamAction: z.enum(['warn', 'mute', 'ban']).optional(),
  linksAllowed: z.boolean().optional(),
  linksRequireApproval: z.boolean().optional(),
  captchaEnabled: z.boolean().optional(),
  captchaTimeout: z.number().int().min(60).max(3600).optional(),
  mediaRequireApproval: z.boolean().optional(),
  autoDeleteSpam: z.boolean().optional(),
  autoBanRepeatOffenders: z.boolean().optional(),
});
export type ModerationSettingsDto = z.infer<typeof ModerationSettingsDto>;

export const CreateTopicDto = z.object({
  title: z.string().min(1).max(255),
  icon: z.string().optional(),
  color: z.number().int().min(0).max(0xFFFFFF).optional(),
});
export type CreateTopicDto = z.infer<typeof CreateTopicDto>;

export const UpdateTopicDto = z.object({
  topicId: z.string().min(1),
  title: z.string().min(1).max(255).optional(),
  icon: z.string().optional(),
  color: z.number().int().min(0).max(0xFFFFFF).optional(),
});
export type UpdateTopicDto = z.infer<typeof UpdateTopicDto>;

export const ToggleTopicDto = z.object({
  topicId: z.string().min(1),
  isClosed: z.boolean(),
});
export type ToggleTopicDto = z.infer<typeof ToggleTopicDto>;

export const GetTopicsDto = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});
export type GetTopicsDto = z.infer<typeof GetTopicsDto>;
