import { DocPageShell } from '@/components/docs/doc-page-shell';

export default function BotsDocumentationPage() {
  return (
    <DocPageShell title="Разработка ботов (Bot API)">
      <p className="lead text-muted-foreground">
        Полное руководство по созданию и эксплуатации ботов в Aluf Messenger: токены, HTTP-методы, webhook, long polling,
        примеры на нескольких языках и рекомендации по безопасности.
      </p>

      <h2>1. Введение</h2>
      <p>
        <strong>Bot API</strong> — это HTTP API для управления ботом от имени вашего сервера. Вы создаёте бота в{' '}
        <strong>Настройки → Боты</strong>, получаете секретный <strong>токен</strong> и вызываете методы, подставляя токен в
        путь запроса. Модель похожа на Telegram Bot API: методы <code>getMe</code>, <code>sendMessage</code>,{' '}
        <code>getUpdates</code>, <code>setWebhook</code> и др.
      </p>

      <h2>2. Получение токена</h2>
      <ol>
        <li>Войдите в Aluf (веб или приложение).</li>
        <li>
          Откройте <strong>Настройки → Боты</strong>.
        </li>
        <li>
          Нажмите <strong>Создать бота</strong>, задайте username (латиница, цифры, подчёркивание), отображаемое имя и
          при необходимости описание и аватар.
        </li>
        <li>
          После создания <strong>один раз</strong> показывается токен — сохраните его в менеджере секретов или переменных
          окружения. При утечке используйте <strong>регенерацию токена</strong> в настройках бота; старый токен перестанет
          работать.
        </li>
      </ol>

      <h2>3. Базовый URL и формат запросов</h2>
      <ul>
        <li>
          <strong>Базовый URL</strong> задаётся средой, в которой развёрнут <code>bot-service</code> (в публичной
          документации используется нейтральный пример <code>https://example.com</code>).
        </li>
      </ul>
      <p>
        Токен передаётся <strong>в пути</strong>, сегмент имеет вид <code>bot:ВАШ_ТОКЕН</code> (с двоеточием). Пример для
        метода <code>getMe</code>:
      </p>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>POST https://example.com/bot:YOUR_TOKEN/getMe</code>
      </pre>
      <p>
        Тело запроса — JSON с заголовком <code>Content-Type: application/json</code> (если метод принимает тело). Ответы в
        стиле <code>{`{ "ok": true, "result": ... }`}</code> или с описанием ошибки.
      </p>

      <h2>4. Идентификаторы</h2>
      <ul>
        <li>
          <code>chat_id</code> — UUID чата в Aluf (не числовой id, как в Telegram).
        </li>
        <li>
          <code>message_id</code> — строковый идентификатор сообщения в этом чате.
        </li>
        <li>
          Чтобы узнать <code>chat_id</code> диалога с ботом, обработайте входящее обновление (webhook или{' '}
          <code>getUpdates</code>) и возьмите поле чата из объекта сообщения.
        </li>
      </ul>

      <h2>5. Основные методы (обзор)</h2>
      <div className="not-prose overflow-x-auto">
        <table className="w-full text-sm border border-border rounded-lg">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-2 font-medium">Метод</th>
              <th className="text-left p-2 font-medium">Назначение</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">getMe</td>
              <td className="p-2">Информация о боте (id, username, команды и т.д.)</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">sendMessage</td>
              <td className="p-2">Текстовое сообщение, опционально ответ в тред</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">sendPhoto / sendDocument</td>
              <td className="p-2">Медиа по URL или file_id</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">editMessageText</td>
              <td className="p-2">Редактирование текста сообщения бота</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">deleteMessage</td>
              <td className="p-2">Удаление сообщения (права как у отправителя/админа)</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">answerCallbackQuery</td>
              <td className="p-2">Ответ на нажатие inline-кнопки</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">getChat</td>
              <td className="p-2">Метаданные чата, если бот — участник</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">pinMessage / unpinMessage</td>
              <td className="p-2">Закрепление сообщений</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="p-2 font-mono text-xs">setWebhook / deleteWebhook</td>
              <td className="p-2">Push-обновления на ваш HTTPS URL</td>
            </tr>
            <tr>
              <td className="p-2 font-mono text-xs">getUpdates</td>
              <td className="p-2">Long polling: забрать очередь обновлений</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Машиночитаемая спецификация: OpenAPI{' '}
        <code className="text-xs">docs/api/bot-api.yaml</code> в репозитории Aluf.
      </p>

      <h2>6. Примеры curl</h2>

      <h3>6.1. getMe</h3>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`curl -X POST "https://example.com/bot:YOUR_TOKEN/getMe" \\
  -H "Content-Type: application/json"`}</code>
      </pre>

      <h3>6.2. sendMessage</h3>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`curl -X POST "https://example.com/bot:YOUR_TOKEN/sendMessage" \\
  -H "Content-Type: application/json" \\
  -d '{"chat_id":"UUID_ЧАТА","text":"Привет из бота!"}'`}</code>
      </pre>
      <p>Ответ на конкретное сообщение:</p>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`curl -X POST "https://example.com/bot:YOUR_TOKEN/sendMessage" \\
  -H "Content-Type: application/json" \\
  -d '{"chat_id":"UUID_ЧАТА","text":"Ответ","reply_to_message_id":"ID_СООБЩЕНИЯ"}'`}</code>
      </pre>

      <h3>6.3. setWebhook</h3>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`curl -X POST "https://example.com/bot:YOUR_TOKEN/setWebhook" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://your-server.com/aluf/webhook","secret":"my-secret-key"}'`}</code>
      </pre>
      <p>
        В production URL обычно должен быть <strong>HTTPS</strong>. Секрет опционален: если не передать, сервер может
        сгенерировать его сам — сохраните значение для проверки подписи.
      </p>

      <h3>6.4. getUpdates (long polling)</h3>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`curl -X POST "https://example.com/bot:YOUR_TOKEN/getUpdates" \\
  -H "Content-Type: application/json" \\
  -d '{"offset":0,"limit":100,"timeout":30}'`}</code>
      </pre>
      <p>
        Увеличивайте <code>offset</code> на основе <code>update_id</code> последнего обработанного обновления, чтобы не
        получать дубликаты.
      </p>

      <h3>6.5. deleteMessage и getChat</h3>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`curl -X POST "https://example.com/bot:YOUR_TOKEN/deleteMessage" \\
  -H "Content-Type: application/json" \\
  -d '{"chat_id":"UUID","message_id":"ID","delete_for_everyone":true}'

curl -X POST "https://example.com/bot:YOUR_TOKEN/getChat" \\
  -H "Content-Type: application/json" \\
  -d '{"chat_id":"UUID"}'`}</code>
      </pre>

      <h2>7. Webhook: формат и подпись</h2>
      <p>
        После <code>setWebhook</code> Aluf будет слать <strong>POST</strong> с JSON-телом на ваш URL. Каждый запрос
        содержит заголовок:
      </p>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>X-Aluf-Webhook-Signature: sha256=&lt;hex&gt;</code>
      </pre>
      <p>
        Здесь <code>hex</code> — это HMAC-SHA256 от <strong>сырого тела</strong> запроса (байты UTF-8) с ключом = ваш{' '}
        <code>secret</code>. Сравнивайте через constant-time (например, <code>crypto.timingSafeEqual</code> в Node.js).
      </p>

      <h3>7.1. Пример проверки (Node.js + Express)</h3>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`const crypto = require('crypto');
const express = require('express');
const app = express();

function verifySignature(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

app.post('/aluf/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-aluf-webhook-signature'];
  const secret = process.env.ALUF_WEBHOOK_SECRET;
  if (!verifySignature(req.body, sig, secret)) {
    return res.status(401).send('Invalid signature');
  }
  const update = JSON.parse(req.body.toString());
  // TODO: обработка update (message, callback_query, ...)
  res.sendStatus(200);
});`}</code>
      </pre>

      <h3>7.2. Пример (Python)</h3>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`import hmac
import hashlib

def verify_webhook_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature_header, expected)`}</code>
      </pre>

      <h2>8. Long polling на Node.js (минимальный цикл)</h2>
      <pre className="not-prose rounded-xl border border-border bg-muted p-4 text-xs overflow-x-auto">
        <code>{`const TOKEN = process.env.ALUF_BOT_TOKEN;
const BASE = 'https://example.com';
let offset = 0;

async function poll() {
  const r = await fetch(\`\${BASE}/bot:\${TOKEN}/getUpdates\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offset, limit: 100, timeout: 30 }),
  });
  const j = await r.json();
  if (!j.ok) return;
  for (const u of j.result || []) {
    offset = Math.max(offset, u.updateId + 1);
    const msg = u.message;
    const text = msg?.textContent;
    if (text && msg.chatId) {
      await fetch(\`\${BASE}/bot:\${TOKEN}/sendMessage\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: msg.chatId, text: \`Эхо: \${text}\` }),
      });
    }
  }
  setImmediate(poll);
}
poll();`}</code>
      </pre>
      <p>
        Замените поля чата/сообщения на актуальные имена из реального JSON ответа вашей версии API (см. спецификацию).
      </p>

      <h2>9. Клавиатуры и callback</h2>
      <p>
        Поле <code>reply_markup</code> в методах отправки часто передаётся как <strong>JSON-строка</strong>, описывающая
        inline- или reply-клавиатуру. После нажатия inline-кнопки приходит обновление с{' '}
        <code>callback_query</code> — ответьте методом <code>answerCallbackQuery</code>, чтобы убрать «часики» у
        клиента.
      </p>

      <h2>10. Ограничения и ошибки</h2>
      <ul>
        <li>
          <strong>Rate limit:</strong> на стороне сервера действует лимит запросов в минуту на токен (переменная вроде{' '}
          <code>BOT_API_RATE_LIMIT_PER_MIN</code>). При превышении — <code>429 Too Many Requests</code>.
        </li>
        <li>
          <strong>401</strong> — неверный или отозванный токен.
        </li>
        <li>
          Не публикуйте токен в клиентском фронтенде и в открытых репозиториях; используйте секреты CI/CD.
        </li>
      </ul>

      <h2>11. Отличия от Telegram Bot API</h2>
      <ul>
        <li>
          Путь: Aluf — <code>/bot:token/method</code>, Telegram — <code>/bot&lt;token&gt;/method</code> (без двоеточия).
        </li>
        <li>
          <code>chat_id</code> — UUID в Aluf, в Telegram часто числовой.
        </li>
        <li>
          Набор полей в объектах сообщений/чатов может отличаться; ориентируйтесь на OpenAPI и фактические ответы.
        </li>
      </ul>

      <h2>12. Настройки бота в приложении</h2>
      <p>
        В интерфейсе Aluf для каждого бота доступны: описание, поле «О боте», приветственное сообщение, команды, webhook
        URL, режим inline, работа в группах и др. Часть полей влияет на отображение профиля бота и подсказки при{' '}
        <code>@упоминании</code>.
      </p>

      <hr className="my-8 border-border" />
      <p className="text-sm text-muted-foreground">
        Дополнительные материалы в репозитории: <code>docs/development/bot-api-guide.md</code>,{' '}
        <code>docs/api/bot-api.yaml</code>.
      </p>
    </DocPageShell>
  );
}
