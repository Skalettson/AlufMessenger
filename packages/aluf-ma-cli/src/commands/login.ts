import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';

interface LoginOptions {
  token?: string;
}

export async function login(options: LoginOptions) {
  const spinner = ora('Вход в аккаунт...').start();

  try {
    let token = options.token;

    if (!token) {
      const { inputToken } = await inquirer.prompt([
        {
          type: 'password',
          name: 'inputToken',
          message: 'Введите токен разработчика:',
          validate: (input) => {
            if (!input.trim()) return 'Токен не может быть пустым';
            return true;
          },
        },
      ]);
      token = inputToken;
    }

    // В реальной реализации будет проверка токена
    // const response = await axios.get('https://dev.aluf.app/api/me', {
    //   headers: { Authorization: `Bearer ${token}` },
    // });

    // Сохранение токена
    const configDir = join(process.env.HOME || process.env.USERPROFILE || '', '.aluf-ma');
    await mkdir(configDir, { recursive: true });
    await writeFile(
      join(configDir, 'config.json'),
      JSON.stringify({ token })
    );

    spinner.succeed(chalk.green('Успешный вход!'));

    console.log(`
${chalk.cyan('Добро пожаловать в Aluf Developer Portal!')}

Теперь вы можете:
  • Деплоить приложения: ${chalk.gray('ma deploy')}
  • Публиковать в магазине: ${chalk.gray('ma publish')}
  • Управлять приложениями: ${chalk.gray('ma apps')}

${chalk.gray('Документация: https://dev.aluf.app/docs')}
`);
  } catch (error) {
    spinner.fail('Ошибка при входе');
    console.error(error);
    process.exit(1);
  }
}

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
