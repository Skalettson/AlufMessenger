# E2E Тесты Aluf Messenger

## Структура

```
tests/e2e/
├── vitest.config.ts
├── setup.ts              # Глобальная настройка (beforeAll)
├── teardown.ts           # Очистка (afterAll)
├── utils/
│   ├── api-client.ts     # HTTP клиент для тестов
│   ├── ws-client.ts      # WebSocket клиент
│   └── fixtures.ts       # Тестовые данные
├── auth/
│   ├── register.e2e.test.ts
│   ├── login.e2e.test.ts
│   └── 2fa.e2e.test.ts
├── users/
│   ├── profile.e2e.test.ts
│   ├── contacts.e2e.test.ts
│   └── privacy.e2e.test.ts
├── chats/
│   ├── create.e2e.test.ts
│   ├── members.e2e.test.ts
│   └── invite.e2e.test.ts
├── messages/
│   ├── send.e2e.test.ts
│   ├── edit.e2e.test.ts
│   ├── delete.e2e.test.ts
│   ├── react.e2e.test.ts
│   └── forward.e2e.test.ts
├── media/
│   ├── upload.e2e.test.ts
│   └── download.e2e.test.ts
├── calls/
│   └── voice.e2e.test.ts
├── stories/
│   └── create.e2e.test.ts
├── search/
│   └── search.e2e.test.ts
└── bots/
    └── bots.e2e.test.ts
```

## Запуск

```bash
# Все E2E тесты
pnpm test:e2e

# Конкретный файл
pnpm vitest run tests/e2e/messages/send.e2e.test.ts

# С покрытием
pnpm test:e2e --coverage

# Watch mode
pnpm vitest tests/e2e --watch
```

## Пример теста

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApiClient } from '../utils/api-client';

describe('Messages E2E', () => {
  let client: ApiClient;
  let chatId: string;

  beforeAll(async () => {
    client = await ApiClient.createTestUser();
    const chat = await client.createChat({ type: 'private' });
    chatId = chat.id;
  });

  afterAll(async () => {
    await client.cleanup();
  });

  it('should send and receive message', async () => {
    const message = await client.sendMessage(chatId, { text: 'Hello' });
    
    expect(message.id).toBeDefined();
    expect(message.text).toBe('Hello');
    expect(message.senderId).toBe(client.userId);
  });

  it('should edit message', async () => {
    const message = await client.sendMessage(chatId, { text: 'Original' });
    const edited = await client.editMessage(chatId, message.id, { text: 'Edited' });
    
    expect(edited.text).toBe('Edited');
    expect(edited.isEdited).toBe(true);
  });
});
```
