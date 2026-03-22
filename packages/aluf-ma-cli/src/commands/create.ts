import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';

interface CreateOptions {
  template: string;
  force: boolean;
}

export async function create(name: string, options: CreateOptions) {
  const spinner = ora('Создание проекта...').start();

  try {
    const projectPath = join(process.cwd(), name);

    // Проверка существующей директории
    try {
      await readFile(join(projectPath, 'package.json'), 'utf-8');
      if (!options.force) {
        spinner.fail('Директория уже существует. Используйте --force для перезаписи.');
        return;
      }
    } catch {
      // Директории нет, продолжаем
    }

    // Создание директории
    await mkdir(projectPath, { recursive: true });

    // Выбор шаблона
    const template = options.template || await selectTemplate();

    // Создание файлов шаблона
    await createTemplateFiles(projectPath, template);

    spinner.succeed(chalk.green(`Проект ${chalk.bold(name)} создан!`));

    console.log(`
${chalk.cyan('Следующие шаги:')}

  ${chalk.gray('cd')} ${name}
  ${chalk.gray('pnpm install')}
  ${chalk.gray('ma dev')}

${chalk.gray('Документация: https://ma.aluf.app/docs')}
`);
  } catch (error) {
    spinner.fail('Ошибка при создании проекта');
    console.error(error);
    process.exit(1);
  }
}

async function selectTemplate(): Promise<string> {
  const { template } = await inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Выберите шаблон:',
      choices: [
        { name: 'React + TypeScript', value: 'react-ts' },
        { name: 'React + JavaScript', value: 'react' },
        { name: 'Vue + TypeScript', value: 'vue-ts' },
        { name: 'Vue + JavaScript', value: 'vue' },
        { name: 'Vanilla JavaScript', value: 'vanilla' },
        { name: 'Vanilla TypeScript', value: 'vanilla-ts' },
      ],
    },
  ]);
  return template;
}

async function createTemplateFiles(projectPath: string, template: string) {
  // package.json
  const packageJson = {
    name: path.basename(projectPath),
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'ma dev',
      build: 'ma build',
      deploy: 'ma deploy',
    },
    dependencies: {
      '@aluf/ma-core': 'workspace:*',
      '@aluf/ma-sdk': 'workspace:*',
      '@aluf/ma-ui': 'workspace:*',
    },
    devDependencies: {
      '@aluf/ma-cli': 'workspace:*',
      typescript: '^5.7.0',
    },
  };

  await writeFile(
    join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // ma.config.js
  const config = `export default {
  appId: '${path.basename(projectPath)}',
  name: '${path.basename(projectPath).replace(/-/g, ' ')}',
  version: '1.0.0',
  template: '${template}',
  permissions: ['storage', 'bot'],
};
`;
  await writeFile(join(projectPath, 'ma.config.js'), config);

  // tsconfig.json
  const tsconfig = {
    extends: '@aluf/ma-cli/tsconfig.base.json',
    compilerOptions: {
      outDir: 'dist',
      rootDir: 'src',
    },
    include: ['src/**/*'],
  };
  await writeFile(
    join(projectPath, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );

  // Создаём src директорию
  await mkdir(join(projectPath, 'src'), { recursive: true });

  // Создаём файлы в зависимости от шаблона
  if (template.includes('react')) {
    await createReactTemplate(projectPath, template.includes('ts'));
  } else if (template.includes('vue')) {
    await createVueTemplate(projectPath, template.includes('ts'));
  } else {
    await createVanillaTemplate(projectPath, template.includes('ts'));
  }
}

async function createReactTemplate(projectPath: string, typescript: boolean) {
  const ext = typescript ? 'tsx' : 'jsx';
  
  // index.html
  await writeFile(
    join(projectPath, 'index.html'),
    `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aluf Mini-App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${typescript ? 'tsx' : 'jsx'}"></script>
  </body>
</html>`
  );

  // src/main.tsx
  await writeFile(
    join(projectPath, `src/main.${ext}`),
    `import React from 'react';
import { createRoot } from 'react-dom/client';
import { AlufProvider } from '@aluf/ma-sdk/react';
import App from './App.${ext}';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <AlufProvider appId="my-app">
      <App />
    </AlufProvider>
  </React.StrictMode>
);
`
  );

  // src/App.tsx
  await writeFile(
    join(projectPath, `src/App.${ext}`),
    `import { useAlufApp, useAlufUser } from '@aluf/ma-sdk/react';
import { Button, Cell, List } from '@aluf/ma-ui';

export default function App() {
  const { ready, platform } = useAlufApp({ appId: 'my-app', autoInit: true });
  const user = useAlufUser();

  if (!ready) {
    return <div>Загрузка...</div>;
  }

  return (
    <div>
      <h1>Добро пожаловать{user ? `, ${user.displayName}` : ''}!</h1>
      <p>Платформа: {platform?.type}</p>
      
      <List>
        <Cell
          title="Настройки"
          subtitle="Управление приложением"
          onClick={() => console.log('Settings clicked')}
        />
        <Cell
          title="Профиль"
          subtitle="Ваша информация"
          onClick={() => console.log('Profile clicked')}
        />
      </List>
      
      <Button variant="primary" fullWidth onClick={() => alert('Hello!')}>
        Нажми меня
      </Button>
    </div>
  );
}
`
  );
}

async function createVueTemplate(projectPath: string, typescript: boolean) {
  const ext = typescript ? 'vue' : 'vue';
  
  await writeFile(
    join(projectPath, 'index.html'),
    `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aluf Mini-App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`
  );

  await writeFile(
    join(projectPath, 'src/App.vue'),
    `<template>
  <div>
    <h1>Добро пожаловать, {{ user?.displayName || 'Гость' }}!</h1>
    <p>Платформа: {{ platform?.type }}</p>
  </div>
</template>

<script setup lang="ts">
import { useAlufApp, useAlufUser } from '@aluf/ma-sdk/react';

const { platform } = useAlufApp({ appId: 'my-app', autoInit: true });
const user = useAlufUser();
</script>
`
  );
}

async function createVanillaTemplate(projectPath: string, typescript: boolean) {
  await writeFile(
    join(projectPath, 'index.html'),
    `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aluf Mini-App</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 20px;
        max-width: 600px;
        margin: 0 auto;
      }
      h1 { color: #3b82f6; }
      button {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 16px;
        cursor: pointer;
      }
      button:active { transform: scale(0.98); }
    </style>
  </head>
  <body>
    <h1>🚀 Aluf Mini-App</h1>
    <div id="app">Загрузка...</div>
    <button onclick="handleClick()">Нажми меня</button>
    
    <script type="module">
      import { createApp } from '@aluf/ma-sdk';
      
      const app = await createApp({ id: 'my-app', name: 'My App' }).readyAsync();
      
      document.getElementById('app').innerHTML = \`
        <p>Платформа: \${app.platform?.type}</p>
        <p>Пользователь: \${app.user?.displayName || 'Гость'}</p>
      \`;
      
      window.handleClick = () => {
        app.bridge.ui.showAlert({ message: 'Hello from Aluf Mini-App!' });
      };
    <\/script>
  </body>
</html>`
  );
}

import { basename } from 'path';
const path = { basename, join };
