# Aluf MA Platform (NestJS)

## Локальная разработка (монорепо)

Из **корня репозитория**:

```bash
pnpm install
pnpm --filter @aluf/db build
pnpm --filter @aluf/ma-platform run start:dev
```

Переменные: `DATABASE_URL`, при необходимости `MA_DASHBOARD_API_TOKEN` (для защищённых эндпоинтов панели в production).

### Ошибки TypeScript про `PgColumn` / `drizzle-orm`

Убедитесь, что в корне есть **`.npmrc`** с `public-hoist-pattern` для `drizzle-orm`, затем снова **`pnpm install`** и пересоберите **`@aluf/db`** перед **`ma-platform`**.

Подробнее: `docs/ALUF_MA_README.md` (раздел «Локальная сборка»).
