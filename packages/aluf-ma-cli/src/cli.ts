#!/usr/bin/env node

/**
 * Aluf Mini-Apps CLI
 * CLI для разработки и деплоя Mini-Apps
 */

import { Command } from 'commander';
import { create } from './commands/create.js';
import { dev } from './commands/dev.js';
import { build } from './commands/build.js';
import { deploy } from './commands/deploy.js';
import { publish } from './commands/publish.js';
import { init } from './commands/init.js';
import { login } from './commands/login.js';
import { info } from './commands/info.js';
import { VERSION } from './version.js';

const program = new Command();

program
  .name('aluf-ma')
  .description('CLI для разработки и деплоя Aluf Mini-Apps')
  .version(VERSION);

// ============================================
// Команды
// ============================================

program
  .command('create <name>')
  .description('Создать новый Mini-App проект')
  .option('-t, --template <template>', 'Шаблон (vanilla, react, react-ts, vue, vue-ts)', 'react-ts')
  .option('--force', 'Перезаписать существующую директорию', false)
  .action(create);

program
  .command('init')
  .description('Инициализировать MA в существующем проекте')
  .option('--appId <appId>', 'ID приложения')
  .option('--name <name>', 'Название приложения')
  .action(init);

program
  .command('dev')
  .description('Запустить dev-сервер')
  .option('-p, --port <port>', 'Порт', '3000')
  .option('--hot', 'Hot module replacement', true)
  .option('--open', 'Открыть в браузере', false)
  .action(dev);

program
  .command('build')
  .description('Собрать проект')
  .option('-o, --out-dir <dir>', 'Директория сборки', 'dist')
  .option('--minify', 'Минифицировать', true)
  .option('--sourcemap', 'Генерировать sourcemap', false)
  .option('--analyze', 'Анализировать bundle', false)
  .action(build);

program
  .command('deploy')
  .description('Задеплоить на платформу')
  .option('--staging', 'Deploy в staging', false)
  .option('--app-id <appId>', 'ID приложения')
  .option('--token <token>', 'Токен авторизации')
  .action(deploy);

program
  .command('publish')
  .description('Опубликовать в магазине приложений')
  .option('--bump <type>', 'Версия (major, minor, patch)', 'patch')
  .option('--beta', 'Beta версия', false)
  .option('--draft', 'Черновик', false)
  .action(publish);

program
  .command('login')
  .description('Войти в аккаунт Aluf Developer')
  .option('--token <token>', 'Токен авторизации')
  .action(login);

program
  .command('info')
  .description('Информация о проекте')
  .action(info);

program
  .command('lint')
  .description('Проверить код')
  .option('--fix', 'Исправить ошибки', false)
  .action(() => {
    console.log('Lint command - в разработке');
  });

program
  .command('test')
  .description('Запустить тесты')
  .option('--watch', 'Watch mode', false)
  .option('--coverage', 'Покрытие кода', false)
  .action(() => {
    console.log('Test command - в разработке');
  });

// ============================================
// Запуск
// ============================================

program.parse(process.argv);
