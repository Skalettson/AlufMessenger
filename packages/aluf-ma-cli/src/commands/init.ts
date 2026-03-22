import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';

interface InitOptions {
  appId?: string;
  name?: string;
}

export async function init(options: InitOptions) {
  const spinner = ora('Инициализация проекта...').start();
  const projectPath = process.cwd();

  try {
    // Проверка package.json
    let packageJson;
    try {
      const content = await readFile(join(projectPath, 'package.json'), 'utf-8');
      packageJson = JSON.parse(content);
    } catch {
      spinner.fail('package.json не найден. Запустите команду в корне проекта.');
      return;
    }

    // Получение данных
    const appId = options.appId || packageJson.name || await promptAppId();
    const name = options.name || packageJson.name || appId;

    // Создание ma.config.js
    const config = `export default {
  appId: '${appId}',
  name: '${name}',
  version: '${packageJson.version || '1.0.0'}',
  permissions: ['storage', 'bot'],
  build: {
    outDir: 'dist',
    minify: true,
  },
};
`;
    await writeFile(join(projectPath, 'ma.config.js'), config);

    // Добавление зависимостей
    spinner.info('Добавление зависимостей...');

    spinner.succeed(chalk.green('Проект инициализирован!'));

    console.log(`
${chalk.cyan('Следующие шаги:')}

  ${chalk.gray('pnpm add @aluf/ma-core @aluf/ma-sdk @aluf/ma-ui')}
  ${chalk.gray('ma dev')}

${chalk.gray('Документация: https://ma.aluf.app/docs')}
`);
  } catch (error) {
    spinner.fail('Ошибка при инициализации');
    console.error(error);
    process.exit(1);
  }
}

async function promptAppId(): Promise<string> {
  const { appId } = await inquirer.prompt([
    {
      type: 'input',
      name: 'appId',
      message: 'ID приложения:',
      default: 'my-app',
      validate: (input) => {
        if (!input.trim()) return 'ID не может быть пустым';
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'ID должен содержать только строчные буквы, цифры и дефисы';
        }
        return true;
      },
    },
  ]);
  return appId.trim();
}
