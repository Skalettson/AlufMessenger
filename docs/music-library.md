# Моя музыка (веб)

## Деплой

1. Применить миграцию БД: `packages/db/drizzle/0008_user_music_library.sql` (или `pnpm --filter @aluf/db db:migrate` при настроенном `DATABASE_URL`).
2. **user-service**: второй gRPC-порт `MUSIC_SERVICE_GRPC_PORT` (по умолчанию `50063`), переменная `MEDIA_SERVICE_GRPC_URL` для вызова media-service. Ответы MusicLibrary в **camelCase** (`audioMediaId`, `trackCount`, …), т.к. gRPC с `keepCase: false` не подхватывает snake_case из обычных объектов.
3. **api-gateway**: `MUSIC_SERVICE_GRPC_URL=user-service:50063` (см. [production-server.md](deployment/production-server.md)).

## Клиент (PWA / iOS)

- Аудио и обложки загружаются через **`useMediaUrl`** (`/api/media/:id/stream` + blob), не через presigned MinIO URL (в браузере часто «Некорректный URI» / CORS).
- Воспроизведение идёт через один элемент `<audio>` в корневом layout; панель управления закреплена сверху.
- **Media Session API** — метаданные и кнопки на экране блокировки (в т.ч. Android).
- На **iOS** для фона и экрана блокировки лучше установить приложение на домашний экран (PWA). Первый запуск воспроизведения — по действию пользователя (требование браузера).
- **Service Worker** (`public/sw.js`) для `/api/` использует только `fetch`, без кэша ответов — чтобы не ломать потоковое аудио и подписанные URL.
