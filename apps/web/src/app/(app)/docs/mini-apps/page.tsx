import { DocPageShell } from '@/components/docs/doc-page-shell';

export default function MiniAppsDocumentationPage() {
  return (
    <DocPageShell title="Mini-Apps: документация разработчика">
      <p className="lead text-muted-foreground">
        Aluf Mini-Apps (Aluf-MA) — платформа веб-приложений внутри Aluf Messenger: CLI, SDK, UI-кит, мост с мессенджером,
        хранилище, аналитика, платежи и связка с ботами. Ниже — пошаговый гайд с примерами кода.
      </p>

      <h2>1. Что такое Mini-App</h2>
      <p>
        Это <strong>веб-приложение</strong> (обычно SPA на React/Vue/vanilla), которое открывается во встроенном окне
        мессенджера. Оно получает контекст пользователя и чата через SDK, может вызывать API платформы (хранилище, UI,
        аналитику) и интегрироваться с ботом Aluf для отправки сообщений и обработки данных с кнопок Web App.
      </p>
      <ul>
        <li>
          <strong>Панель разработчика (Dashboard)</strong> — создание приложений, аналитика, монетизация. В веб-клиенте
          Aluf: кнопка «Открыть Mini-Apps Dashboard» ведёт на <code>/ma-dashboard/</code> (отдельное приложение в
          инфраструктуре).
        </li>
        <li>
          <strong>Локальная разработка</strong> — через CLI <code>@aluf/ma-cli</code> и команду <code>ma dev</code>.
        </li>
        <li>
          <strong>Публикация</strong> — сборка <code>ma build</code>, деплой <code>ma deploy</code>, при необходимости{' '}
          <code>ma publish</code> в каталог.
        </li>
      </ul>

      <h2>2. Требования</h2>
      <ul>
        <li>Node.js ≥ 18</li>
        <li>pnpm ≥ 9 (рекомендуется для монорепозитория)</li>
        <li>Для доступа к Dashboard на сервере может быть настроен токен <code>MA_DASHBOARD_API_TOKEN</code> (см. документацию
        деплоя)</li>
      </ul>

      <h2>3. Установка CLI и создание проекта</h2>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`pnpm add -g @aluf/ma-cli

# новый проект
ma create my-awesome-app
# выберите шаблон: react-ts (рекомендуется), react, vue-ts, vanilla

cd my-awesome-app
pnpm install
ma dev`}</code>
      </pre>
      <p>
        По умолчанию dev-сервер поднимается на <code>http://localhost:3000</code> — откройте в браузере для проверки UI.
      </p>

      <h2>4. Структура проекта</h2>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`my-awesome-app/
├── src/
│   ├── App.tsx          # корневой UI
│   ├── main.tsx         # вход
│   └── index.css
├── public/
│   └── icon.png
├── ma.config.js         # метаданные приложения и права
├── package.json
└── tsconfig.json`}</code>
      </pre>

      <h2>5. Конфигурация ma.config.js</h2>
      <p>
        Файл описывает идентификатор приложения, отображаемое имя, иконку, категорию и{' '}
        <strong>запрашиваемые разрешения</strong> (storage, bot, notifications и т.д.).
      </p>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`// ma.config.js
export default {
  appId: 'my-awesome-app',
  name: 'My Awesome App',
  version: '1.0.0',
  description: 'Описание для каталога',
  icon: './public/icon.png',
  category: 'productivity',
  permissions: ['storage', 'bot', 'notifications'],
  build: {
    outDir: 'dist',
    minify: true,
    sourcemap: false,
  },
};`}</code>
      </pre>

      <h2>6. React + TypeScript: первое приложение</h2>
      <p>
        Пакеты SDK и UI: <code>@aluf/ma-sdk</code>, <code>@aluf/ma-ui</code> (имена взяты из репозитория документации
        платформы).
      </p>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`import { useAlufApp, useAlufUser } from '@aluf/ma-sdk/react';
import { Button, Cell, List } from '@aluf/ma-ui';

export default function App() {
  const { ready, platform } = useAlufApp({ appId: 'my-app' });
  const user = useAlufUser();

  if (!ready) {
    return <div className="p-4">Загрузка…</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold">Привет, {user?.displayName ?? 'гость'}!</h1>
      <p className="text-sm text-muted-foreground mt-1">Платформа: {platform}</p>

      <List className="mt-4">
        <Cell title="Профиль" subtitle="Ваша информация" onClick={() => console.log('profile')} />
        <Cell title="Настройки" subtitle="Конфигурация" onClick={() => console.log('settings')} />
      </List>

      <Button variant="primary" fullWidth className="mt-4" onClick={() => alert('Hello!')}>
        Нажми меня
      </Button>
    </div>
  );
}`}</code>
      </pre>

      <h2>7. Vanilla JS (без фреймворка)</h2>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>My App</title>
</head>
<body>
  <h1 id="title">Загрузка…</h1>
  <button id="btn">Нажми меня</button>

  <script type="module">
    import { createApp } from '@aluf/ma-sdk';

    const app = await createApp({ id: 'my-app' }).readyAsync();

    document.getElementById('title').textContent =
      \`Привет, \${app.user?.displayName ?? 'гость'}!\`;

    document.getElementById('btn').onclick = () => {
      app.bridge.ui.showAlert({ message: 'Hello!' });
    };
  </script>
</body>
</html>`}</code>
      </pre>

      <h2>8. Мост (bridge): Storage</h2>
      <p>Ключ-значение в защищённом хранилище приложения (при разрешении <code>storage</code> в конфиге):</p>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`// после инициализации app / внутри React-компонента с доступом к bridge
await app.bridge.storage.set('userPrefs', { theme: 'dark' });

const prefs = await app.bridge.storage.get('userPrefs');

await app.bridge.storage.remove('userPrefs');

await app.bridge.storage.clear();`}</code>
      </pre>

      <h2>9. Мост: Bot API из Mini-App</h2>
      <p>
        Отправка сообщений от имени связанного бота (после настройки интеграции и прав) и чтение данных инициализации:
      </p>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`await app.bridge.bot.sendMessage(chatId, 'Hello from Mini-App!');

const initData = app.bridge.bot.getInitData();
console.log(initData?.user, initData?.chat);`}</code>
      </pre>
      <p>Отдельный модуль интеграции (см. раздел 11):</p>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`import { createBotIntegration } from '@aluf/ma-sdk/bot';

const bot = createBotIntegration();
const initData = bot.getInitData();

await bot.sendMessage(chatId, 'Текст', {
  parseMode: 'markdown',
  replyMarkup: {
    inlineKeyboard: [[
      { text: 'Кнопка', callbackData: 'action_1' },
      { text: 'Сайт', url: 'https://example.com' },
    ]],
  },
});`}</code>
      </pre>

      <h2>10. Мост: UI</h2>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`await app.bridge.ui.showAlert({
  title: 'Внимание',
  message: 'Что-то произошло!',
  buttons: [
    { id: 'ok', text: 'OK' },
    { id: 'cancel', text: 'Отмена' },
  ],
});

app.bridge.ui.setMainButton({
  text: 'Сохранить',
  color: '#3b82f6',
  visible: true,
});

app.bridge.ui.onMainButtonClick(() => {
  console.log('Main button clicked');
});`}</code>
      </pre>

      <h2>11. Интеграция с ботами (серверная схема)</h2>
      <p>
        Типичный сценарий: бот показывает кнопку <strong>Web App</strong> с URL вашего Mini-App; пользователь открывает
        приложение; при необходимости данные возвращаются боту через <code>web_app_data</code> (по аналогии с Telegram).
        На стороне Python с aiogram кнопка может выглядеть так:
      </p>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`# Псевдокод (aiogram / Telegram API совместимые типы)
from aiogram.types import WebAppInfo, KeyboardButton, ReplyKeyboardMarkup

keyboard = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text='Открыть App', web_app=WebAppInfo(url='https://your.cdn/my-app'))]],
    resize_keyboard=True,
)`}</code>
      </pre>
      <p>
        В Aluf убедитесь, что URL приложения разрешён в настройках приложения на платформе и совпадает с деплоем{' '}
        <code>ma deploy</code>.
      </p>

      <h2>12. REST API платформы (обзор)</h2>
      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm border border-border rounded-lg">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-2 font-medium">Endpoint</th>
              <th className="text-left p-2 font-medium">Метод</th>
              <th className="text-left p-2 font-medium">Назначение</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">/api/ma/apps</td>
              <td className="p-2">GET</td>
              <td className="p-2">Список приложений</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">/api/ma/apps/:id</td>
              <td className="p-2">GET/PUT/DELETE</td>
              <td className="p-2">Управление приложением</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">/api/ma/storage</td>
              <td className="p-2">GET/POST</td>
              <td className="p-2">Серверное хранилище (при поддержке)</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">/api/ma/bot/send</td>
              <td className="p-2">POST</td>
              <td className="p-2">Отправка через бота</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">/api/ma/analytics/track</td>
              <td className="p-2">POST</td>
              <td className="p-2">События аналитики</td>
            </tr>
            <tr>
              <td className="p-2 font-mono text-xs">/api/ma/payments/invoice</td>
              <td className="p-2">POST</td>
              <td className="p-2">Создание счёда / оплаты</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Точные URL и авторизация зависят от развёрнутого <code>ma-platform</code> и прокси в вашей инфраструктуре.
      </p>

      <h2>13. WebSocket и bridge на низком уровне</h2>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`import { createBridge } from '@aluf/ma-core';

const bridge = createBridge({
  appId: 'my-app',
  platform: 'aluf-messenger',
});

bridge.on('ready', ({ platform, user }) => {
  console.log('Ready', platform, user);
});

const data = await bridge.request('storage.get', { key: 'userPrefs' });`}</code>
      </pre>

      <h2>14. Analytics</h2>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`app.bridge.analytics.track('button_click', {
  buttonId: 'save',
  screen: 'settings',
});

app.bridge.analytics.setUserProperties({
  isPremium: true,
  plan: 'pro',
});`}</code>
      </pre>

      <h2>15. Сборка и деплой</h2>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`ma build

# привязка аккаунта к CLI (если предусмотрено)
ma login

ma deploy
# ma deploy --staging

# публикация в витрине (если включено)
ma publish`}</code>
      </pre>
      <p>
        Артефакты сборки по умолчанию попадают в каталог <code>dist/</code> — его раздавайте через CDN или статический
        хостинг с HTTPS.
      </p>

      <h2>16. Монорепозиторий Aluf и MA</h2>
      <p>
        В корне репозитория Aluf пакеты MA могут быть представлены как <code>@aluf/ma-core</code>,{' '}
        <code>@aluf/ma-sdk</code>, <code>@aluf/ma-ui</code>, <code>@aluf/ma-cli</code>; сервер —{' '}
        <code>ma-platform</code>, панель — <code>ma-dashboard</code>. Для локальной сборки БД и сервисов следуйте{' '}
        <code>docs/ALUF_MA_README.md</code> и разделам про Drizzle/миграции.
      </p>

      <h2>17. Безопасность и UX</h2>
      <ul>
        <li>Не храните секреты бота в клиентском коде Mini-App — вызывайте свой backend.</li>
        <li>Проверяйте подпись <code>initData</code> на сервере, если используете её для авторизации.</li>
        <li>Учитывайте ограничения WebView: размеры кликабельных зон, отсутствие всплывающих окон в некоторых режимах.</li>
      </ul>

      <hr className="my-8 border-border" />
      <p className="text-sm text-muted-foreground">
        Дополнительные материалы в репозитории: <code>docs/ALUF_MA_README.md</code>,{' '}
        <code>docs/ma-getting-started.md</code>, <code>docs/ma-bot-integration.md</code>.
      </p>
    </DocPageShell>
  );
}
