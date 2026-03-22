# @aluf/ma-cli

CLI для разработки и деплоя **Aluf Mini-Apps**.

## 🚀 Установка

```bash
pnpm add -g @aluf/ma-cli
```

## 📖 Команды

### Создание проекта

```bash
# Создать новый Mini-App проект
ma create my-app

# Создать с шаблоном
ma create my-app --template react
ma create my-app --template vanilla
ma create my-app --template react-ts
```

### Разработка

```bash
# Запустить dev-сервер
ma dev

# Запустить с конкретным портом
ma dev --port 3000

# Запустить с hot-reload
ma dev --hot
```

### Сборка

```bash
# Собрать проект
ma build

# Собрать с минификацией
ma build --minify

# Собрать с анализом.bundle
ma build --analyze
```

### Деплой

```bash
# Задеплоить на платформу
ma deploy

# Задеплоить в staging
ma deploy --staging

# Задеплоить с конкретным appId
ma deploy --app-id my-app
```

### Публикация

```bash
# Опубликовать в магазине приложений
ma publish

# Опубликовать с обновлением версии
ma publish --bump minor

# Опубликовать beta версию
ma publish --beta
```

### Прочее

```bash
# Проверка проекта
ma lint

# Запустить тесты
ma test

# Открыть документацию
ma docs

# Проверить обновления
ma update
```

## 🎯 Шаблоны

### React + TypeScript
```bash
ma create my-app --template react-ts
```

### Vanilla JS
```bash
ma create my-app --template vanilla
```

### Vue + TypeScript
```bash
ma create my-app --template vue-ts
```

### Svelte + TypeScript
```bash
ma create my-app --template svelte-ts
```

## 🔧 Конфигурация

Создайте файл `ma.config.js` или `ma.config.ts`:

```javascript
export default {
  appId: 'my-awesome-app',
  name: 'My Awesome App',
  version: '1.0.0',
  description: 'Описание приложения',
  icon: './assets/icon.png',
  category: 'productivity',
  permissions: ['storage', 'bot', 'notifications'],
  build: {
    outDir: 'dist',
    minify: true,
    sourcemap: false,
  },
  deploy: {
    platform: 'aluf-messenger',
    region: 'eu-west',
  },
};
```

## 📄 Лицензия

Proprietary. Все права защищены.
