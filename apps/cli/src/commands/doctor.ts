import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { getDbPath, initDb, dbAll } from '../db';

export function doctorCommand(): Command {
  return new Command('doctor')
    .description('Check system health and configuration')
    .action(async () => {
      console.log(chalk.blue('Running system health check...\n'));

      try {
        console.log(`✅ Node.js version: ${process.version}`);
        console.log(`✅ Working directory: ${process.cwd()}`);

        const sqlitePath = getDbPath();
        console.log(`✅ DB path: ${sqlitePath}`);
        
        const dbDir = path.dirname(sqlitePath);
        if (fs.existsSync(dbDir)) {
          console.log(`✅ DB directory exists: ${dbDir}`);
        } else {
          console.log(`❌ DB directory missing: ${dbDir}`);
        }

        try {
          await initDb();
          console.log('✅ Database initialized');
          
          const profiles = dbAll<any>('SELECT id FROM benchmark_profiles');
          const sections = dbAll<any>('SELECT id FROM benchmark_sections');
          
          console.log(`✅ Database has ${profiles.length} profiles, ${sections.length} sections`);
        } catch (dbError) {
          console.log(`❌ Database error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
        }

        if (process.env.GITHUB_TOKEN) {
          console.log('✅ GITHUB_TOKEN is set');
        } else {
          console.log('ℹ️  GITHUB_TOKEN not set (will use unauthenticated GitHub API)');
        }

        console.log('\n🎉 System check complete!');

      } catch (error) {
        console.error(chalk.red('Health check failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
