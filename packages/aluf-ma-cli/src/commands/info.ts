import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { VERSION } from '../version.js';

export async function info() {
  const projectPath = process.cwd();

  console.log(`
${chalk.bold.cyan('Aluf Mini-Apps CLI')}
${chalk.gray(`Version: ${VERSION}`)}
`);

  // Информация о проекте
  try {
    const packageJson = JSON.parse(
      await readFile(join(projectPath, 'package.json'), 'utf-8')
    );

    console.log(chalk.bold('Проект:'));
    console.log(`  ${chalk.gray('Name:')} ${packageJson.name || 'N/A'}`);
    console.log(`  ${chalk.gray('Version:')} ${packageJson.version || 'N/A'}`);
  } catch {
    console.log(chalk.yellow('  package.json не найден'));
  }

  // Информация из ma.config.js
  try {
    const configModule = await import(`${projectPath}/ma.config.js`);
    const config = configModule.default;

    console.log(`\n${chalk.bold('Aluf Mini-App:')}`);
    console.log(`  ${chalk.gray('App ID:')} ${chalk.bold(config.appId || 'N/A')}`);
    console.log(`  ${chalk.gray('Name:')} ${config.name || 'N/A'}`);
    console.log(`  ${chalk.gray('Category:')} ${config.category || 'N/A'}`);
    console.log(`  ${chalk.gray('Permissions:')} ${config.permissions?.join(', ') || 'N/A'}`);
  } catch {
    console.log(`\n${chalk.yellow('ma.config.js не найден')}`);
    console.log(chalk.gray('  Запустите ${chalk.bold('ma init')} для инициализации'));
  }

  // Информация об окружении
  console.log(`\n${chalk.bold('Окружение:')}`);
  console.log(`  ${chalk.gray('Node:')} ${process.version}`);
  console.log(`  ${chalk.gray('Platform:')} ${process.platform} ${process.arch}`);
  console.log(`  ${chalk.gray('CWD:')} ${projectPath}`);

  console.log('');
}
