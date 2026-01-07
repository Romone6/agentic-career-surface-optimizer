import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { getConfig } from '@ancso/core';

export function doctorCommand(): Command {
  return new Command('doctor')
    .description('Check system health and configuration')
    .action(async () => {
      console.log(chalk.blue('Running system health check...\n'));

      try {
        // Check configuration
        const config = getConfig();
        console.log('✅ Configuration loaded successfully');

        // Check Node.js version
        const nodeVersion = process.version;
        console.log(`✅ Node.js version: ${nodeVersion}`);

        // Check dependencies
        try {
          execSync('pnpm --version', { stdio: 'pipe' });
          console.log('✅ pnpm is installed');
        } catch {
          console.log('⚠️  pnpm not found, using npm');
        }

        // Check required environment variables
        const requiredVars = [
          { name: 'OPENROUTER_API_KEY', value: config.OPENROUTER_API_KEY },
          { name: 'GITHUB_OAUTH_CLIENT_ID', value: config.GITHUB_OAUTH_CLIENT_ID },
          { name: 'GITHUB_OAUTH_CLIENT_SECRET', value: config.GITHUB_OAUTH_CLIENT_SECRET },
        ];

        let hasMissingVars = false;
        requiredVars.forEach((varInfo) => {
          if (!varInfo.value || varInfo.value === 'your_key_here') {
            console.log(`❌ Missing required variable: ${varInfo.name}`);
            hasMissingVars = true;
          } else {
            console.log(`✅ ${varInfo.name}: Configured`);
          }
        });

        if (hasMissingVars) {
          console.log('\n⚠️  Some required configuration variables are missing.');
          console.log('Please edit your .env file and set the missing values.');
        } else {
          console.log('\n🎉 All systems healthy! You can start using the CLI.');
        }

      } catch (error) {
        console.error(chalk.red('Health check failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}