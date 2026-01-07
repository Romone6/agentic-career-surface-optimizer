import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig } from '@ancso/core';
import fs from 'fs';
import path from 'path';

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize the application and set up configuration')
    .option('-f, --force', 'Overwrite existing configuration', false)
    .action(async (options) => {
      console.log(chalk.blue('Initializing Agentic Neural Career Surface Optimizer...\n'));

      try {
        const config = getConfig();
        
        // Check if .env file exists
        const envPath = path.join(process.cwd(), '.env');
        if (!fs.existsSync(envPath) || options.force) {
          console.log('📝 Creating .env file with default configuration...');
          
          // Copy from .env.example if it exists
          const examplePath = path.join(process.cwd(), '.env.example');
          if (fs.existsSync(examplePath)) {
            fs.copyFileSync(examplePath, envPath);
            console.log('✅ Created .env from .env.example');
          } else {
            // Create basic .env file
            const basicEnv = `
# OpenRouter Configuration
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DEFAULT_MODEL=free_model_here
OPENROUTER_FALLBACK_MODEL=free_model_alt_here

# GitHub Configuration
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
`;
            fs.writeFileSync(envPath, basicEnv.trim());
            console.log('✅ Created basic .env file');
          }
        } else {
          console.log('ℹ️  .env file already exists. Use --force to overwrite.');
        }

        // Create data directories
        console.log('📁 Creating data directories...');
        const directories = [
          config.APP_DATA_DIR,
          path.dirname(config.SQLITE_PATH),
          config.CACHE_DIR,
          config.LOG_DIR,
        ];

        directories.forEach((dir) => {
          const fullPath = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
          if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            console.log(`✅ Created directory: ${fullPath}`);
          }
        });

        console.log('\n🎉 Initialization complete!');
        console.log('\nNext steps:');
        console.log('1. Edit .env file with your API keys');
        console.log('2. Run: pnpm run doctor');
        console.log('3. Start using the CLI commands');

      } catch (error) {
        console.error(chalk.red('Initialization failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}