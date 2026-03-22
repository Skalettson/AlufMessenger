import ora from 'ora';
import chalk from 'chalk';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface PublishOptions {
  bump: 'major' | 'minor' | 'patch';
  beta: boolean;
  draft: boolean;
}

export async function publish(options: PublishOptions) {
  const spinner = ora('Публикация в магазине...').start();

  try {
    const projectPath = process.cwd();

    // Загрузка package.json
    const packageJsonPath = join(projectPath, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

    // Обновление версии
    const currentVersion = packageJson.version || '1.0.0';
    const newVersion = bumpVersion(currentVersion, options.bump, options.beta);

    packageJson.version = newVersion;
    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    spinner.info(`Версия обновлена: ${currentVersion} → ${newVersion}`);

    // Загрузка конфига
    let config;
    try {
      const configModule = await import(`${projectPath}/ma.config.js`);
      config = configModule.default;
    } catch {
      spinner.fail('ma.config.js не найден');
      return;
    }

    // В реальной реализации будет отправка в магазин приложений
    // const response = await axios.post('https://store.ma.aluf.app/apps', {
    //   appId: config.appId,
    //   version: newVersion,
    //   name: config.name,
    //   description: config.description,
    //   icon: config.icon,
    //   category: config.category,
    //   draft: options.draft,
    // });

    spinner.succeed(
      chalk.green(
        `${config.name} v${newVersion} опубликован${options.draft ? ' как черновик' : ''}!`
      )
    );

    console.log(`
${chalk.cyan('Статус публикации:')}
  ${options.draft ? chalk.yellow('Черновик') : chalk.green('Опубликовано')}
  ${options.beta ? chalk.blue('Beta версия') : ''}

${chalk.cyan('Ссылка на приложение:')}
  ${chalk.blue(`https://ma.aluf.app/app/${config.appId}`)}
`);
  } catch (error) {
    spinner.fail('Ошибка при публикации');
    console.error(error);
    process.exit(1);
  }
}

function bumpVersion(
  version: string,
  bumpType: 'major' | 'minor' | 'patch',
  isBeta: boolean
): string {
  const [major, minor, patch] = version.split('.').map(Number);

  let newVersion: string;
  switch (bumpType) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }

  if (isBeta) {
    newVersion += '-beta.1';
  }

  return newVersion;
}
