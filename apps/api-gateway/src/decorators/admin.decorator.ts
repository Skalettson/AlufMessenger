import { SetMetadata } from '@nestjs/common';

export const IS_ADMIN_ONLY_KEY = 'isAdminOnly';

/** Маркирует эндпоинт или контроллер как доступный только для платформенного администратора. */
export const AdminOnly = () => SetMetadata(IS_ADMIN_ONLY_KEY, true);
