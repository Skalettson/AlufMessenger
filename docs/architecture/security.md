# Безопасность Aluf Messenger

Документация по мерам безопасности, применяемым в Aluf: шифрование, аутентификация, E2EE, управление ключами и защита данных.

## Содержание

- [Шифрование при хранении](#шифрование-при-хранении)
- [Шифрование при передаче](#шифрование-при-передаче)
- [E2EE для секретных чатов](#e2ee-для-секретных-чатов)
- [Управление ключами](#управление-ключами)
- [JWT-аутентификация](#jwt-аутентификация)
- [Rate limiting](#rate-limiting)
- [Security headers](#security-headers)
- [Certificate pinning](#certificate-pinning)
- [Хранение и удаление данных](#хранение-и-удаление-данных)

---

## Шифрование при хранении

### PostgreSQL

- Данные в БД хранятся на диске в незашифрованном виде по умолчанию.
- Рекомендуется включать **Transparent Data Encryption (TDE)** на уровне СУБД или диска в production.
- Для максимальной защиты чувствительных полей рассмотрите **SQLCipher** или шифрование на уровне приложения для колонок с персональными данными.

### Redis

- Redis не шифрует данные на диске по умолчанию.
- Рекомендуется использовать `redis.conf` с `appendonly yes` и защищать тома на уровне ОС.
- Для production: `requirepass` и ACL для ограничения доступа.

### MinIO (файлы)

- Файлы в MinIO хранятся в незашифрованном виде.
- Для compliance (GDPR, HIPAA) используйте server-side encryption (SSE-S3, SSE-KMS) или шифрование на клиенте для E2EE-медиа.

---

## Шифрование при передаче

### TLS 1.3

- Все внешние API работают через HTTPS (TLS 1.3).
- Ingress (nginx) завершает TLS и проксирует на сервисы внутри кластера.
- Минимальная поддерживаемая версия TLS — 1.2.

### gRPC

- Внутрикластерная связь по gRPC может идти без TLS, если сеть изолирована (например, Network Policy).
- Для связи между кластерами или по недоверенным сетям рекомендуется **gRPC TLS**:

```typescript
// Пример для NestJS gRPC
{
  transport: Transport.GRPC,
  options: {
    url: 'auth-service:50051',
    package: 'aluf.auth.v1',
    protoPath: 'auth.proto',
    credentials: grpc.credentials.createSsl(
      fs.readFileSync('ca.pem'),
      fs.readFileSync('client-key.pem'),
      fs.readFileSync('client-cert.pem')
    ),
  },
}
```

---

## E2EE для секретных чатов

Aluf использует адаптацию Signal Protocol в пакете `@aluf/crypto`.

### X3DH (Extended Triple Diffie-Hellman)

- Используется при первом контакте между двумя пользователями.
- Обеспечивает:
  - **Forward secrecy** — компрометация долгосрочных ключей не раскрывает прошлые сообщения.
  - **Аутентичность** — подпись signed prekey подтверждает принадлежность bundle.
- Реализация: `performX3DH`, `processX3DH` в `packages/crypto/src/x3dh.ts`.

### Double Ratchet

- Используется после установки сессии через X3DH.
- Каждое сообщение приводит к смене ключей (ratchet step).
- Обеспечивает:
  - **Forward secrecy** — при компрометации текущего состояния прошлые сообщения защищены.
  - **Break-in recovery** — периодическая смена DH-ключей.
- Реализация: `ratchetEncrypt`, `ratchetDecrypt` в `packages/crypto/src/ratchet.ts`.

### Хранение ключей E2EE

| Тип                 | Где хранится         | Описание                        |
|---------------------|----------------------|---------------------------------|
| Identity Key        | Локально (клиент)    | Долгосрочный ключ пользователя  |
| Signed PreKeys      | БД `encryption_keys` | Публичные, подписанные ключи    |
| One-Time PreKeys    | БД `encryption_keys` | Одноразовые ключи               |
| Session state       | Локально (клиент)    | Только на устройстве получателя |

---

## Управление ключами

### JWT (RS256)

- Асимметричный алгоритм: приватный ключ — только у Auth Service, публичный — у API Gateway.
- Размер ключа: **4096 бит** (RSA).
- Генерация:

```bash
openssl genpkey -algorithm RSA -out keys/private.pem -pkeyopt rsa_keygen_bits:4096
openssl rsa -pubout -in keys/private.pem -out keys/public.pem
```

### Ротация JWT-ключей

1. Создать новую пару ключей.
2. Добавить публичный ключ в trust store (поддержка нескольких ключей по `kid`).
3. Развернуть Auth Service с новым приватным ключом.
4. По истечении TTL старых токенов удалить старый ключ.

### Хранение ключей в Kubernetes

- JWT-ключи хранятся в Secret `aluf-jwt-keys`.
- Монтируются в поды `api-gateway` и `auth-service` read-only.
- В production рекомендуется использовать HashiCorp Vault или аналог.

---

## JWT-аутентификация

### Параметры токенов

| Токен        | TTL      | Использование                         |
|--------------|----------|----------------------------------------|
| Access Token | 15 мин   | Запросы к API, WebSocket auth          |
| Refresh Token| 30 дней  | Обновление Access Token                |

### Валидация

- API Gateway вызывает `Auth.ValidateToken` по gRPC перед проксированием.
- Проверяется подпись (RS256), `exp`, `iat`, опционально `jti` для блоклиста.
- WebSocket: клиент отправляет `accessToken` при подключении, Realtime Service валидирует через Auth.

### Защищённые маршруты

Все эндпоинты под `/v1/*`, кроме:
- `POST /v1/auth/login`
- `POST /v1/auth/verify`
- `GET /health`
- `GET /docs`
- Публичные WebSocket для анонимных событий (если есть)

требуют заголовок `Authorization: Bearer <accessToken>`.

---

## Rate limiting

### Глобальные лимиты

- **100 req/min** на IP для обычных эндпоинтов.
- **20 req/min** на IP для auth (`/v1/auth/*`).

### Реализация

- Redis используется для хранения счётчиков (sliding window или fixed window).
- При превышении: `429 Too Many Requests`.
- Настройки можно задать в конфигурации API Gateway.

### Пример конфигурации (NestJS Throttler)

```typescript
// app.module.ts
ThrottlerModule.forRoot([{
  ttl: 60000,   // 1 мин
  limit: 100,   // 100 запросов
}])
```

---

## Security headers

Рекомендуемые заголовки для API и веб-клиента:

| Заголовок | Значение | Описание |
|-----------|----------|----------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HSTS |
| `X-Content-Type-Options` | `nosniff` | Защита от MIME sniffing |
| `X-Frame-Options` | `DENY` или `SAMEORIGIN` | Защита от clickjacking |
| `Content-Security-Policy` | См. ниже | CSP |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Ограничение referrer |
| `Permissions-Policy` | `geolocation=(), microphone=(self)` | Ограничение API браузера |

### Content-Security-Policy (CSP)

Пример для веб-клиента:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';  # минимизировать в production
style-src 'self' 'unsafe-inline';
img-src 'self' data: https: blob:;
connect-src 'self' wss: https:;
frame-ancestors 'none';
```

---

## Certificate pinning

Для мобильных клиентов (Flutter) рекомендуется **certificate pinning**, чтобы предотвратить MITM при компрометации CA.

### Реализация (Flutter)

```dart
// Пин публичного ключа сертификата
final fingerprints = [
  'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
];

final client = HttpClient()
  ..badCertificateCallback = (cert, host, port) {
    return cert.sha256 == fingerprints[0];
  };
```

### Ротация пиннинга

- Держать несколько отпечатков (текущий + следующий).
- Обновлять приложение до истечения срока действия сертификата.

---

## Хранение и удаление данных

### Retention

- **Сообщения** — хранятся до явного удаления пользователем или при удалении аккаунта.
- **Истории** — автоматическое удаление через 24 часа.
- **Сессии** — истекают по TTL refresh token (30 дней) или при logout.
- **Логи** — рекомендуемый retention 15–30 дней (Prometheus, Loki).

### Удаление аккаунта (GDPR)

1. Пользователь запрашивает удаление.
2. Сервис помечает аккаунт как удаляемый (soft delete) или планирует фоновую задачу.
3. Удаление: `users`, `sessions`, `contacts`, `notification_tokens`, ассоциированные данные.
4. Сообщения в общих чатах могут оставаться анонимизированными (например, `sender_id` → `deleted_user`).
5. Файлы в MinIO — удаление по `user_id` или ссылкам из `messages`.
6. Поисковый индекс (search-service) — удаление документов по событиям NATS / `user_id`.

### Резервное копирование

- PostgreSQL: ежедневные backup (pg_dump или WAL archiving).
- MinIO: репликация или versioning для критичных бакетов.
- Ключи и секреты — отдельное защищённое хранилище.
