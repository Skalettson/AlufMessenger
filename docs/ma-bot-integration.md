# Bot Integration Guide

Глубокая интеграция Mini-Apps с ботами Aluf Messenger.

## Обзор

Mini-Apps в Aluf Messenger могут тесно интегрироваться с ботами:

- **Бот как backend** - бизнес-логика на сервере бота
- **Двусторонняя связь** - Mini-App ↔ Бот ↔ Пользователь
- **Webhook события** - обновления в реальном времени
- **Inline режим** - запуск из любого чата

## Инициализация

### Получение initData

```typescript
import { createBotIntegration } from '@aluf/ma-sdk/bot';

const bot = createBotIntegration();
const initData = bot.getInitData();

if (initData) {
  console.log('User:', initData.user);
  console.log('Chat:', initData.chat);
  console.log('Auth hash:', initData.auth.hash);
}
```

### Структура initData

```typescript
interface AlufBotInitData {
  user: {
    id: string;
    username?: string;
    displayName: string;
    avatar?: string;
  };
  chat?: {
    id: string;
    type: 'private' | 'group' | 'channel';
    title?: string;
  };
  auth: {
    hash: string;
    timestamp: number;
  };
  raw?: string;
}
```

## Отправка сообщений

### Из Mini-App

```typescript
// Отправить сообщение через бота
await bot.sendMessage(chatId, 'Привет из Mini-App!');

// С опциями
await bot.sendMessage(chatId, 'Текст', {
  parseMode: 'markdown',
  replyMarkup: {
    inlineKeyboard: [[
      { text: 'Кнопка 1', callbackData: 'action_1' },
      { text: 'Кнопка 2', url: 'https://example.com' },
    ]],
  },
});
```

### Из бота (Python пример)

```python
from aiogram import Bot, Dispatcher, types
from aiogram.types import WebAppInfo

bot = Bot(token='YOUR_TOKEN')
dp = Dispatcher()

@dp.message_handler(commands=['start'])
async def cmd_start(message: types.Message):
    await message.answer(
        'Запустить Mini-App:',
        reply_markup=types.ReplyKeyboardMarkup(
            keyboard=[[
                types.KeyboardButton(
                    text='Открыть App',
                    web_app=WebAppInfo(url='https://app.aluf.app/my-app'),
                )
            ]]
        ),
    )

@dp.callback_query_handler()
async def handle_callback(callback: types.CallbackQuery):
    await callback.answer('Обработано!', show_alert=True)
```

## Webhook Integration

### Настройка webhook

```typescript
// В Mini-App
await bot.sendToBot({
  action: 'updateData',
  payload: { userId: '123', data: { score: 100 } },
});
```

### Обработка в боте

```python
@dp.message_handler(content_types=['web_app_data'])
async def handle_webapp_data(message: types.Message):
    data = json.loads(message.web_app_data.data)
    
    if data['action'] == 'updateData':
        # Обновить данные пользователя
        await update_user_data(
            message.from_user.id,
            data['payload'],
        )
        
        # Ответить пользователю
        await message.answer('Данные обновлены!')
```

## События

### Подписка на события в Mini-App

```typescript
// Новое сообщение от бота
bot.on('message', (message) => {
  console.log('New message:', message.text);
});

// Callback query
bot.on('callbackQuery', (query) => {
  console.log('Callback:', query.data);
});

// Кастомные события
bot.onBotEvent('gameOver', (data) => {
  console.log('Game over! Score:', data.score);
});
```

### Отправка событий из бота

```python
# Отправить событие в Mini-App
await bot.send_message(
  chat_id=user_id,
  text='Игра окончена!',
  reply_markup=types.InlineKeyboardMarkup(
    inline_keyboard=[[
      types.InlineKeyboardButton(
        text='Играть снова',
        callback_data='restart_game',
      )
    ]],
  ),
)
```

## Inline Mode

### Запуск Mini-App из inline

```python
@dp.inline_handler()
async def inline_query(inline_query: types.InlineQuery):
    results = [
      types.InlineQueryResultArticle(
        id='1',
        title='Запустить игру',
        input_message_content=types.InputTextMessageContent(
          message_text='Давай играть!',
        ),
        reply_markup=types.InlineKeyboardMarkup(
          inline_keyboard=[[
            types.InlineKeyboardButton(
              text='🎮 Играть',
              switch_inline_query='',
              web_app=WebAppInfo(url='https://game.aluf.app'),
            )
          ]],
        ),
      ),
    ]
    
    await inline_query.answer(results)
```

## Авторизация

### Валидация initData на сервере

```python
import hmac
import hashlib
from urllib.parse import parse_qs

def validate_init_data(init_data: str, bot_token: str) -> bool:
    parsed = parse_qs(init_data)
    hash_value = parsed.pop('hash')[0]
    
    # Сортировка параметров
    data_check_string = '\n'.join(
      f'{k}={v[0]}' for k, v in sorted(parsed.items())
    )
    
    # Создание ключа
    secret_key = hmac.new(
      b'WebAppData',
      bot_token.encode(),
      hashlib.sha256,
    ).digest()
    
    # Вычисление hash
    computed_hash = hmac.new(
      secret_key,
      data_check_string.encode(),
      hashlib.sha256,
    ).hexdigest()
    
    return computed_hash == hash_value
```

### Использование в Mini-App

```typescript
// Отправить initData на сервер для валидации
const response = await fetch('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    initData: bot.getInitData()?.raw,
  }),
});

if (response.ok) {
  const { token } = await response.json();
  // Сохранить токен для авторизованных запросов
}
```

## Примеры использования

### Игра с лидербордом

```typescript
// Mini-App: отправка результата игры
async function submitScore(score: number) {
  await bot.sendToBot({
    action: 'submitScore',
    payload: { score, level: currentLevel },
  });
}

// Бот: обработка результата
@dp.message_handler(content_types=['web_app_data'])
async def handle_score(message: types.Message):
    data = json.loads(message.web_app_data.data)
    
    if data['action'] == 'submitScore':
        # Сохранить в БД
        await db.scores.insert({
          user_id: message.from_user.id,
          score: data['payload']['score'],
          level: data['payload']['level'],
        })
        
        # Отправить результат
        top_scores = await db.scores.get_top(10)
        
        await message.answer(
          f'Ваш счёт: {data["payload"]["score"]}\\n'
          f'Место в топ: {top_scores.rank}',
          parse_mode='Markdown',
        )
```

### E-commerce

```typescript
// Mini-App: оформление заказа
async function checkout(cart: CartItem[]) {
  const result = await bot.sendToBot({
    action: 'createOrder',
    payload: { items: cart, total: calculateTotal(cart) },
  });
  
  if (result.success) {
    // Показать подтверждение
    app.bridge.ui.showAlert({
      message: `Заказ #${result.orderId} создан!`,
    });
  }
}

// Бот: обработка заказа
@dp.message_handler(content_types=['web_app_data'])
async def handle_order(message: types.Message):
    data = json.loads(message.web_app_data.data)
    
    if data['action'] == 'createOrder':
        order = await create_order(
          user_id=message.from_user.id,
          items=data['payload']['items'],
        )
        
        # Отправить уведомление админу
        await bot.send_message(
          chat_id=ADMIN_CHAT,
          text=f'Новый заказ #{order.id} от @{message.from_user.username}',
        )
```

## Best Practices

1. **Всегда валидируйте initData** на сервере
2. **Используйте webhook** для real-time обновлений
3. **Кэшируйте данные** пользователя в Mini-App
4. **Обрабатывайте ошибки** сети gracefully
5. **Показывайте loading states** при запросах к боту

## Следующие шаги

- [API Reference](./api-reference.md) - Полная API документация
- [Payments](./payments.md) - Платежи в Mini-Apps
- [Analytics](./analytics.md) - Аналитика событий
