import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { FactStoreService, QuestionnaireService } from '@ancso/core';
import { 
  ProfileGenerationPipeline, 
  createGenerationPipeline, 
  PROFILE_SECTIONS,
  Persona,
  PERSONA_CONFIGS
} from '@ancso/llm';
import ora from 'ora';

export function profileGenerateCommand(): Command {
  const command = new Command('generate')
    .description('Generate optimized profile content using AI')
    .addCommand(new Command('profile')
      .description('Generate profile content for LinkedIn, GitHub, etc.')
      .option('--persona <persona>', 'Persona for generation', 'engineer')
      .option('--sections <sections>', 'Comma-separated sections to generate', 'linkedin_headline,linkedin_about')
      .option('--dry-run', 'Preview without saving to database', false)
      .option('--user-id <userId>', 'User ID for the fact store', 'default-user')
      .action(async (options) => {
        try {
          console.log(chalk.blue('Profile Content Generation'));
          console.log('=================================\n');

          const factStoreService = new FactStoreService();
          const questionnaireService = new QuestionnaireService(factStoreService);
          const pipeline = createGenerationPipeline();

          const spinner = ora('Checking fact store...').start();
          const factStore = await factStoreService.getFactStore(options.userId);

          if (!factStore) {
            spinner.fail('No fact store found');
            console.log('Please create a fact store first using: pnpm run facts:new');
            process.exit(1);
          }

          const validation = await factStoreService.validateFactStore(factStore);
          if (!validation.valid) {
            spinner.warn('Fact store has validation issues');
            console.log('\nPlease fix the following issues:');
            validation.errors.forEach((error, index) => {
              console.log(`${index + 1}. ${error}`);
            });
            process.exit(1);
          }
          spinner.succeed('Fact store validated successfully!');

          const persona = options.persona as Persona;
          const validPersonas = Object.keys(PERSONA_CONFIGS);
          if (!validPersonas.includes(persona)) {
            console.log(chalk.red(`Invalid persona: ${persona}`));
            console.log(`Valid personas: ${validPersonas.join(', ')}`);
            process.exit(1);
          }

          console.log(chalk.green(`\n✅ Persona: ${persona}`));
          console.log(`   Keywords: ${PERSONA_CONFIGS[persona].keywords.slice(0, 5).join(', ')}\n`);

          const sectionIds = options.sections.split(',').map((s: string) => s.trim());
          const validSections = Object.keys(PROFILE_SECTIONS);
          const selectedSections = sectionIds.filter(s => {
            if (!validSections.includes(s)) {
              console.log(chalk.yellow(`⚠️  Unknown section: ${s}, skipping`));
              return false;
            }
            return true;
          });

          if (selectedSections.length === 0) {
            console.log(chalk.red('No valid sections selected'));
            process.exit(1);
          }

          console.log(chalk.green(`\n📋 Sections to generate:`));
          selectedSections.forEach(sectionId => {
            const section = PROFILE_SECTIONS[sectionId];
            console.log(`   • ${section.name} (${sectionId})`);
          });

          if (options.dryRun) {
            console.log(chalk.blue('\n🔍 DRY RUN MODE'));
            console.log('Generation will be simulated without API calls or database saves.\n');
          }

          const confirmAnswer = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: 'Proceed with content generation?',
            default: true,
          }]);

          if (!confirmAnswer.proceed) {
            console.log(chalk.yellow('Operation cancelled by user'));
            return;
          }

          const generationSpinner = ora('Generating content...').start();

          const result = await pipeline.generate({
            userId: options.userId,
            persona,
            factStore,
            sections: selectedSections,
            options: {
              dryRun: options.dryRun,
              saveToDb: !options.dryRun,
            },
          });

          generationSpinner.stop();

          console.log(chalk.green('\n✅ Generation Complete!'));
          console.log(`\n⏱️  Total time: ${result.totalGenerationTimeMs}ms`);

          if (result.sections.length > 0) {
            console.log('\n📊 Results:');
            result.sections.forEach(section => {
              const status = section.success 
                ? (section.validationPassed ? '✅' : '⚠️') 
                : '❌';
              console.log(`   ${status} ${section.sectionName}`);
              if (section.success && section.content) {
                const preview = section.content.substring(0, 60).replace(/\n/g, ' ');
                console.log(`      └─ "${preview}..."`);
              }
              if (section.validationDetails?.unsupportedClaims?.length) {
                console.log(`      └─ ⚠️  ${section.validationDetails.unsupportedClaims.length} unsupported claims`);
              }
            });
          }

          if (result.followUpQuestions.length > 0) {
            console.log(chalk.yellow('\n❓ Follow-up Questions:'));
            result.followUpQuestions.forEach((q, index) => {
              console.log(`   ${index + 1}. ${q.substring(0, 80)}...`);
            });
          }

          if (result.errors.length > 0) {
            console.log(chalk.red('\n❌ Errors:'));
            result.errors.forEach((error, index) => {
              console.log(`   ${index + 1}. ${error}`);
            });
          }

          if (!options.dryRun && result.outputs && result.outputs.length > 0) {
            console.log(chalk.green('\n💾 Generation outputs saved to database'));
            console.log('Use "pnpm cli profile:apply:linkedin" or "pnpm cli profile:apply:github" to apply.\n');
          }

          if (options.dryRun) {
            console.log(chalk.blue('\n🔍 To generate for real, run without --dry-run flag'));
          }

        } catch (error) {
          console.error(chalk.red('Profile generation failed:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      }))
    .addCommand(new Command('personas')
      .description('List available personas for content generation')
      .action(async () => {
        console.log(chalk.blue('Available Personas'));
        console.log('=====================\n');

        Object.entries(PERSONA_CONFIGS).forEach(([name, config]) => {
          console.log(chalk.green(`• ${name}`));
          console.log(`  Keywords: ${config.keywords.slice(0, 5).join(', ')}`);
          console.log('');
        });
      }))
    .addCommand(new Command('history')
      .description('View generation history')
      .option('--user-id <userId>', 'User ID for the fact store', 'default-user')
      .option('--platform <platform>', 'Filter by platform (linkedin, github, resume)', 'all')
      .action(async (options) => {
        try {
          console.log(chalk.blue('Generation History'));
          console.log('==================\n');

          const pipeline = createGenerationPipeline();
          const history = await pipeline.getGenerationHistory(
            options.userId, 
            options.platform !== 'all' ? options.platform : undefined
          );

          if (history.length === 0) {
            console.log('No generation history found.');
            console.log('Run "pnpm cli profile generate profile" to generate content.');
            return;
          }

          console.log(`Found ${history.length} generation(s):\n`);
          history.forEach((output, index) => {
            console.log(`${index + 1}. ${output.platform}/${output.section}`);
            console.log(`   Persona: ${output.persona}`);
            console.log(`   Status: ${output.status}`);
            console.log(`   Created: ${new Date(output.createdAt).toLocaleString()}`);
            console.log(`   Validation: ${output.validationPassed ? '✅' : '❌'}`);
            console.log(`   Claims used: ${output.claimsUsed.length}`);
            console.log('');
          });

        } catch (error) {
          console.error(chalk.red('Failed to get history:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      }));

  return command;
}
