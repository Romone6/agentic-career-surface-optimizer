import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { LinkedInAutomation, LinkedInProfileData } from '@ancso/automation';
import { FactStoreService, QuestionnaireService } from '@ancso/core';
import ora from 'ora';

export function profileApplyLinkedinCommand(): Command {
  return new Command('apply:linkedin')
    .description('Apply profile optimizations to LinkedIn headline and about sections')
    .option('--dry-run', 'Read current profile data without making changes', false)
    .option('--headline-only', 'Only update headline, skip about section', false)
    .option('--about-only', 'Only update about section, skip headline', false)
    .option('--user-id <userId>', 'User ID for the fact store', 'default-user')
    .action(async (options) => {
      try {
        console.log(chalk.blue('LinkedIn Profile Optimization'));
        console.log('===================================\n');

        const runAllowed = process.env.LINKEDIN_RUN_ALLOW === 'true';
        if (!runAllowed) {
          console.log(chalk.yellow('\n⚠️  LinkedIn automation is not enabled'));
          console.log('To enable, set the following environment variable:');
          console.log('  LINKEDIN_RUN_ALLOW=true');
          console.log('\nNote: This will open a browser window for manual login.');
          process.exit(1);
        }

        console.log(chalk.green('✅ LinkedIn automation enabled via LINKEDIN_RUN_ALLOW'));
        console.log(chalk.gray('Browser will open in headed mode for manual interaction\n'));

        const factStoreService = new FactStoreService();
        const questionnaireService = new QuestionnaireService(factStoreService);

        const spinner = ora('Checking fact store...').start();
        const factStore = await factStoreService.getFactStore(options.userId);

        if (!factStore) {
          spinner.fail('No fact store found');
          console.log('Please create a fact store first using: pnpm run facts:new');
          console.log('Or edit an existing one using: pnpm run facts:edit');
          process.exit(1);
        }

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

        const automation = new LinkedInAutomation({
          headless: false,
          userDataDir: './data/linkedin',
          screenshotDir: './screenshots/linkedin',
        });

        console.log('\n🔗 Connecting to LinkedIn...');
        console.log(chalk.gray('A browser window will open. Please complete login if needed.\n'));

        await automation.initialize();
        await automation.login();

        console.log('\n📊 Reading current LinkedIn profile...');
        const currentData = await automation.getProfileData();

        console.log(chalk.green('\n✅ Current profile data retrieved:'));
        console.log(`  Headline: ${currentData.headline.substring(0, 50)}...`);
        console.log(`  About: ${currentData.about.substring(0, 50)}...`);

        const optimizedHeadline = `${factStore.career.currentRole || 'Professional'} | ${factStore.career.targetRole || 'Seeking opportunities'} | ${factStore.skills.slice(0, 3).map(s => s.name).join(' | ')}`;
        const optimizedAbout = generateOptimizedAbout(factStore);

        console.log('\n📋 Optimized content to apply:');
        console.log(`  Headline: ${optimizedHeadline.substring(0, 50)}...`);
        console.log(`  About: ${optimizedAbout.substring(0, 50)}...`);

        if (options.dryRun) {
          console.log(chalk.blue('\n🔍 DRY RUN MODE - No changes will be made'));
          console.log('\nTo apply changes, run without --dry-run flag');
          await automation.close();
          return;
        }

        const confirmAnswer = await inquirer.prompt([{
          type: 'confirm',
          name: 'proceed',
          message: 'Proceed with updating your LinkedIn profile?',
          default: true,
        }]);

        if (!confirmAnswer.proceed) {
          console.log(chalk.yellow('Operation cancelled by user'));
          await automation.close();
          return;
        }

        const results = await automation.applyProfileUpdates(
          optimizedHeadline,
          optimizedAbout,
          false
        );

        if (results.success) {
          console.log(chalk.green('\n✅ Success!'));
          console.log(chalk.bold(`Message: ${results.message}`));

          if (results.headline) {
            console.log('\n📝 Headline Update:');
            console.log(`  Original: ${results.headline.original.substring(0, 50)}...`);
            console.log(`  Updated:  ${results.headline.updated.substring(0, 50)}...`);
            console.log(`  Verified: ${results.headline.verified ? '✅' : '❌'}`);
          }

          if (results.about) {
            console.log('\n📝 About Section Update:');
            console.log(`  Original: ${results.about.original.substring(0, 50)}...`);
            console.log(`  Updated:  ${results.about.updated.substring(0, 50)}...`);
            console.log(`  Verified: ${results.about.verified ? '✅' : '❌'}`);
          }

          if (results.actions.length > 0) {
            console.log('\n📋 Actions performed:');
            results.actions.slice(0, 10).forEach(action => {
              console.log(`  • ${action}`);
            });
            if (results.actions.length > 10) {
              console.log(`  ... and ${results.actions.length - 10} more`);
            }
          }

          console.log('\n🎉 Next steps:');
          console.log('1. Review your LinkedIn profile');
          console.log('2. Make any manual adjustments if needed');
          console.log('3. Your profile is now optimized!');
        } else {
          console.log(chalk.red('\n❌ Failed!'));
          console.log(chalk.bold(`Message: ${results.message}`));

          if (results.error) {
            console.log('\n🔍 Error details:');
            console.log(`  Type: ${results.error.type}`);
            console.log(`  Message: ${results.error.message}`);
            if (results.error.screenshotPath) {
              console.log(`  Screenshot: ${results.error.screenshotPath}`);
            }
            if (results.error.htmlDumpPath) {
              console.log(`  HTML Dump: ${results.error.htmlDumpPath}`);
            }
          }

          console.log('\n💡 Troubleshooting:');
          console.log('1. Ensure you are logged into LinkedIn in the browser');
          console.log('2. Check that selectors may have changed');
          console.log('3. Review the screenshot and HTML dump for clues');
        }

      } catch (error) {
        console.error(chalk.red('LinkedIn profile optimization failed:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}

function generateOptimizedAbout(factStore: any): string {
  const parts: string[] = [];

  parts.push(`## About Me\n`);
  parts.push(`${factStore.career.careerSummary}\n\n`);

  parts.push(`## Professional Background\n`);
  if (factStore.experience && factStore.experience.length > 0) {
    const latestExp = factStore.experience[0];
    parts.push(`${latestExp.title} at ${latestExp.company}\n`);
    parts.push(`${latestExp.achievements.slice(0, 3).map((a: string) => `• ${a}`).join('\n')}\n\n`);
  }

  parts.push(`## Core Competencies\n`);
  if (factStore.skills && factStore.skills.length > 0) {
    const skillGroups = groupSkillsByCategory(factStore.skills);
    Object.entries(skillGroups).forEach(([category, skills]) => {
      parts.push(`**${category}:** ${(skills as any[]).map(s => s.name).join(', ')}\n`);
    });
    parts.push('\n');
  }

  parts.push(`## Looking For\n`);
  parts.push(`I am currently seeking ${factStore.career.targetRole || 'new opportunities'} `);
  parts.push(`in the ${factStore.career.industry || 'technology'} sector.\n`);

  parts.push(`## Let's Connect\n`);
  parts.push(`I am always open to discussing new opportunities, collaborations, or simply connecting with fellow professionals. Feel free to reach out!\n`);

  return parts.join('');
}

function groupSkillsByCategory(skills: any[]): Record<string, any[]> {
  const categories: Record<string, any[]> = {};

  skills.forEach(skill => {
    const category = skill.category || 'Other Skills';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(skill);
  });

  return categories;
}
