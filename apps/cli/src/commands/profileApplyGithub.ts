import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ProfileReadmeManager } from '@ancso/adapters';
import { FactStoreService, QuestionnaireService } from '@ancso/core';
import ora from 'ora';

export function profileApplyGithubCommand(): Command {
  return new Command('apply:github')
    .description('Apply profile optimizations to GitHub profile README')
    .option('--dry-run', 'Show what would be updated without making changes', false)
    .option('--create-if-missing', 'Create profile repository if it does not exist', true)
    .option('--backup-existing', 'Backup existing README before updating', true)
    .option('--include-sections <sections>', 'Comma-separated list of sections to include', 'header,about,experience,skills,projects,contact')
    .option('--user-id <userId>', 'User ID for the fact store', 'default-user')
    .option('--create-pr', 'Create a pull request instead of direct commit (recommended)', true)
    .option('--pr-title <title>', 'Pull request title', 'Update profile README')
    .option('--pr-description <description>', 'Pull request description', 'Automated profile README update via Agentic Neural Career Optimizer')
    .action(async (options) => {
      try {
        console.log(chalk.blue('GitHub Profile README Optimization'));
        console.log('=====================================\n');

        // Initialize services
        const factStoreService = new FactStoreService();
        const questionnaireService = new QuestionnaireService(factStoreService);

        // Check if user has a fact store
        const spinner = ora('Checking fact store...').start();
        const factStore = await factStoreService.getFactStore(options.userId);

        if (!factStore) {
          spinner.fail('No fact store found');
          console.log('Please create a fact store first using: pnpm run facts:new');
          console.log('Or edit an existing one using: pnpm run facts:edit');
          process.exit(1);
        }

        // Validate fact store
        const validation = await factStoreService.validateFactStore(factStore);
        if (!validation.valid) {
          spinner.warn('Fact store has validation issues');
          console.log('\nPlease fix the following issues before proceeding:');
          validation.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
          });
          console.log('\nRun: pnpm run facts:edit');
          process.exit(1);
        }
        spinner.succeed('Fact store validated successfully!');

        // Check GitHub OAuth configuration
        const githubClientId = process.env.GITHUB_OAUTH_CLIENT_ID;
        const githubClientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

        if (!githubClientId || !githubClientSecret) {
          console.log(chalk.yellow('\n⚠️  GitHub OAuth not configured'));
          console.log('Please set the following environment variables:');
          console.log('  GITHUB_OAUTH_CLIENT_ID=your_client_id');
          console.log('  GITHUB_OAUTH_CLIENT_SECRET=your_client_secret');
          console.log('\nYou can get these from: https://github.com/settings/applications/new');
          process.exit(1);
        }

        // Initialize GitHub manager
        const readmeManager = new ProfileReadmeManager(options.userId);

        // Check current README status
        console.log('\n🔍 Checking current GitHub profile status...');
        const status = await readmeManager.checkReadmeStatus();

        if (status.hasProfileRepo) {
          console.log(chalk.green('✅ Profile repository found'));
          if (status.hasReadme) {
            console.log(chalk.green('✅ README exists'));
          } else {
            console.log(chalk.yellow('⚠️  No README found'));
          }
        } else {
          console.log(chalk.yellow('⚠️  No profile repository found'));
          console.log(chalk.gray('Will create a new one if --create-if-missing is enabled'));
        }

        // Show what will be included
        const includeSections = options.includeSections.split(',').map((s: string) => s.trim());
        console.log('\n📋 Sections to include:');
        includeSections.forEach(section => {
          console.log(`  • ${section}`);
        });

        // Show workflow mode
        if (options.createPR) {
          console.log(chalk.blue('\n🔄 Workflow mode: PR-First (Recommended)'));
          console.log('Changes will be submitted as a pull request for review.');
        } else {
          console.log(chalk.yellow('\n⚠️  Workflow mode: Direct Commit'));
          console.log('Changes will be committed directly to main branch.');
        }

        // Confirm action
        if (!options.dryRun) {
          const confirmAnswer = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: options.createPR 
              ? 'Proceed with creating a pull request for your GitHub profile README?' 
              : 'Proceed with updating your GitHub profile README directly?',
            default: true,
          }]);

          if (!confirmAnswer.proceed) {
            console.log(chalk.yellow('Operation cancelled by user'));
            return;
          }
        }

        // Generate and apply README
        console.log('\n🚀 Generating optimized profile README...');
        const result = await readmeManager.generateProfileReadme({
          dryRun: options.dryRun,
          createIfMissing: options.createIfMissing,
          backupExisting: options.backupExisting,
          includeSections,
          createPR: options.createPR,
          prTitle: options.prTitle,
          prDescription: options.prDescription,
        });

        // Display results
        if (result.success) {
          console.log(chalk.green('\n✅ Success!'));
          console.log(chalk.bold(`Message: ${result.message}`));
          
          if (result.actions.length > 0) {
            console.log('\n📝 Actions performed:');
            result.actions.forEach(action => {
              console.log(`  • ${action}`);
            });
          }

          if (result.backupPath) {
            console.log(chalk.gray(`\n💾 Backup saved to: ${result.backupPath}`));
          }

          if (result.pullRequestUrl) {
            console.log(chalk.blue(`\n🔗 Pull request created: ${result.pullRequestUrl}`));
            console.log('\n🎉 Next steps:');
            console.log('1. Review the pull request on GitHub');
            console.log('2. Make any necessary changes');
            console.log('3. Merge the pull request when ready');
            console.log('4. Your GitHub profile will update automatically');
          } else {
            console.log('\n🎉 Next steps:');
            console.log('1. Check your GitHub profile repository');
            console.log('2. Review the updated README');
            console.log('3. Your GitHub profile will update automatically');
          }

        } else {
          console.log(chalk.red('\n❌ Failed!'));
          console.log(chalk.bold(`Error: ${result.message}`));
        }

      } catch (error) {
        console.error(chalk.red('GitHub profile optimization failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}