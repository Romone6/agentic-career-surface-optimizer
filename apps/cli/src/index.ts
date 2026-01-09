#!/usr/bin/env node

import { Command } from 'commander';
import figlet from 'figlet';
import chalk from 'chalk';
import { setupCommands } from './commands';

const VERSION = process.env.npm_package_version ?? '0.1.0';

// Display banner
console.log(chalk.green(figlet.textSync('ANCSO', { horizontalLayout: 'full' })));
console.log(chalk.blue(`Agentic Neural Career Surface Optimizer v${VERSION}`));
console.log(chalk.gray('A personal-first, open-source, local-first agentic system\n'));

// Create CLI
const program = new Command();

program
  .name('ancso')
  .description('Agentic Neural Career Surface Optimizer CLI')
  .version(VERSION, '-v, --version', 'Output the current version')
  .option('-d, --debug', 'Output extra debugging', false)
  .option('--dry-run', 'Run in dry-run mode (no actual changes)', false);

// Setup commands
setupCommands(program);

// Handle errors
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str)),
  writeOut: (str) => process.stdout.write(str),
});

program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s\nSee --help for a list of available commands.'));
  process.exit(1);
});

// Parse and execute
program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}