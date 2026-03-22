# @aluf/ma-core

Ядро платформы **Aluf Mini-Apps** - революционная система мини-приложений нового поколения.

## 🚀 Преимущества перед Telegram Mini-Apps

- **Быстрее** - оптимизированный рантайм с WebAssembly ускорением
- **Функциональнее** - расширенное API с доступом к системным функциям
- **Удобнее** - встроенный UI-кит с анимациями 60fps
- **Гибче** - мощная система плагинов и расширений

## 📦 Установка

```bash
pnpm add @aluf/ma-core
```

## 📖 Документация

[Полная документация](../../docs/ma-core/README.md)

## 🎯 Быстрый старт

```typescript
import { MiniApp, createBridge } from '@aluf/ma-core';

const app = new MiniApp({
  id: 'my-awesome-app',
  name: 'My Awesome App',
  version: '1.0.0',
});

const bridge = createBridge({
  app,
  platform: 'web',
});

// Использование API платформы
await bridge.api.storage.set({ key: 'user偏好', value: { theme: 'dark' } });
```

## 🔧 API

### Core
- `MiniApp` - базовый класс мини-приложения
- `createBridge` - создание моста к платформе
- `PlatformContext` - контекст платформы

### Runtime
- `Sandbox` - изолированная среда выполнения
- `PluginSystem` - система плагинов
- `EventManager` - менеджер событий

### Bridge
- `BridgeAPI` - основное API моста
- `Transport` - транспортный слой
- `Protocol` - протокол обмена

## 📄 Лицензия

Proprietary. Все права защищены.
