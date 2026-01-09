import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { getDbPath, initDb, dbExec } from '../db';

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize the application and database')
    .option('-f, --force', 'Overwrite existing configuration', false)
    .action(async (options) => {
      console.log(chalk.blue('Initializing Agentic Neural Career Surface Optimizer...\n'));

      try {
        const sqlitePath = getDbPath();
        const dbDir = path.dirname(sqlitePath);
        
        console.log(`DB path: ${sqlitePath}`);
        
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
          console.log(`✅ Created directory: ${dbDir}`);
        }
        
        await initDb();
        console.log('✅ Database initialized');
        
        const envPath = path.join(process.cwd(), '.env');
        if (!fs.existsSync(envPath) || options.force) {
          console.log('📝 Creating .env file...');
          const basicEnv = `# OpenRouter Configuration
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# GitHub Configuration
GITHUB_TOKEN=
`;
          fs.writeFileSync(envPath, basicEnv.trim());
          console.log('✅ Created .env file');
        } else {
          console.log('ℹ️  .env file already exists');
        }

        console.log('\n🎉 Initialization complete!');
        console.log('\nNext steps:');
        console.log('1. Edit .env file with your API keys (optional)');
        console.log('2. Run: ancso doctor');
        console.log('3. Run: ancso ranker:ingest --platform github --usernames torvalds');

      } catch (error) {
        console.error(chalk.red('Initialization failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
