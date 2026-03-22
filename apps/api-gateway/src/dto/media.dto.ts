import { z } from 'zod';

const InitUploadDtoRaw = z.object({
  fileName: z
    .string()
    .max(255)
    .optional()
    .default('file')
    .transform((s) => (s && s.trim() ? s : 'file')),
  file_name: z.string().max(255).optional(),
  mimeType: z
    .string()
    .max(127)
    .optional()
    .transform((s) => (s && s.trim() ? s : 'application/octet-stream')),
  mime_type: z.string().max(127).optional(),
  fileSize: z.number().int().min(0).optional().default(0),
  file_size: z.number().int().min(0).optional(),
  chatId: z.string().optional(),
});

/** Нормализует snake_case из тела запроса и валидирует. */
export const InitUploadDto = InitUploadDtoRaw.transform((data) => ({
  fileName: (data.fileName && data.fileName.trim() ? data.fileName : data.file_name?.trim()) || 'file',
  mimeType: (data.mimeType && data.mimeType.trim() ? data.mimeType : data.mime_type?.trim()) || 'application/octet-stream',
  fileSize: typeof data.fileSize === 'number' ? data.fileSize : (typeof data.file_size === 'number' ? data.file_size : 0),
  chatId: data.chatId,
}));
export type InitUploadDto = z.infer<typeof InitUploadDto>;
