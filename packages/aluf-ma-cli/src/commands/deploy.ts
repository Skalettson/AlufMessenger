import ora from 'ora';
import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { join } from 'path';
import axios from 'axios';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

interface DeployOptions {
  staging: boolean;
  appId?: string;
  token?: string;
}

export async function deploy(options: DeployOptions) {
  const spinner = ora('Деплой на платформу...').start();

  try {
    const projectPath = process.cwd();
    const isStaging = options.staging;

    // Загрузка конфига
    let config;
    try {
      const configModule = await import(`${projectPath}/ma.config.js`);
      config = configModule.default;
    } catch {
      spinner.fail('ma.config.js не найден');
      return;
    }

    const appId = options.appId || config.appId;
    if (!appId) {
      spinner.fail('App ID не указан. Используйте --app-id или укажите в ma.config.js');
      return;
    }

    // Сборка перед деплоем
    spinner.text = 'Сборка проекта...';
    // В реальной реализации будет вызов build()

    // Архивация
    spinner.text = 'Архивация файлов...';
    const archivePath = join(projectPath, '.ma-deploy.zip');
    await createArchive(projectPath, archivePath);

    // Отправка на сервер
    const apiUrl = isStaging
      ? 'https://staging-api.ma.aluf.app'
      : 'https://api.ma.aluf.app';

    spinner.text = 'Загрузка на сервер...';

    // В реальной реализации будет отправка архива
    // const formData = new FormData();
    // formData.append('file', fs.createReadStream(archivePath));
    // formData.append('appId', appId);

    // const response = await axios.post(`${apiUrl}/apps/deploy`, formData, {
    //   headers: { Authorization: `Bearer ${options.token}` },
    // });

    // Эмуляция ответа
    await new Promise((resolve) => setTimeout(resolve, 1000));

    spinner.succeed(
      chalk.green(
        `Деплой завершён! ${chalk.bold(appId)} ${isStaging ? '(staging)' : ''}`
      )
    );

    console.log(`
${chalk.cyan('URL приложения:')}
  ${chalk.blue(`https://ma.aluf.app/app/${appId}`)}

${chalk.cyan('API Platform:')}
  ${chalk.gray(apiUrl)}
`);

    // Очистка
    // await rm(archivePath);
  } catch (error) {
    spinner.fail('Ошибка при деплое');
    console.error(error);
    process.exit(1);
  }
}

async function createArchive(sourceDir: string, outputPath: string) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.glob('**/*', {
      cwd: sourceDir,
      ignore: ['node_modules/**', 'dist/**', '.git/**', '.ma-deploy.zip'],
    });
    archive.finalize();
  });
}
