# @aluf/ma-sdk

SDK для разработки Mini-Apps в платформе **Aluf Messenger**.

## 🚀 Возможности

- **Простая интеграция** - несколько строк кода для запуска
- **Типизация** - полная TypeScript поддержка
- **React хуки** - готовые хуки для React приложений
- **Bot API** - глубокая интеграция с ботами Aluf Messenger
- **UI компоненты** - встроенные компоненты интерфейса

## 📦 Установка

```bash
pnpm add @aluf/ma-sdk
```

## 🎯 Быстрый старт

### Vanilla JS

```typescript
import { createApp } from '@aluf/ma-sdk';

const app = createApp({
  id: 'my-app',
  name: 'My Awesome App',
});

// Готово! App автоматически инициализируется
console.log('User:', app.user);
console.log('Platform:', app.platform);
```

### React

```typescript
import { useAlufApp, useAlufUser, useAlufTheme } from '@aluf/ma-sdk/react';

function MyApp() {
  const { platform, ready } = useAlufApp();
  const user = useAlufUser();
  const theme = useAlufTheme();

  if (!ready) return <Loading />;

  return (
    <div className={theme}>
      <h1>Hello, {user?.displayName}!</h1>
    </div>
  );
}
```

### Интеграция с ботом

```typescript
import { createBotIntegration } from '@aluf/ma-sdk/bot';

const bot = createBotIntegration();

// Отправить сообщение через бота
await bot.sendMessage('Hello from Mini-App!');

// Слушать события от бота
bot.on('message', (msg) => {
  console.log('New message:', msg);
});
```

## 📚 Документация

[Полная документация](../../docs/ma-sdk/README.md)

## 📄 Лицензия

Proprietary. Все права защищены.
