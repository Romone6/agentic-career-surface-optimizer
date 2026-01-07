import { Command } from 'commander';
import chalk from 'chalk';
import { FactStoreService, QuestionnaireService } from '@ancso/core';
import { rankerAddPairCommand } from './rankerAddPair';
import { rankerExportCommand } from './rankerExport';
import { profileApplyGithubCommand } from './profileApplyGithub';
import { profileGenerateCommand } from './profileGenerate';
import ora from 'ora';

export function profileCommands(): Command {
  const command = new Command('profile')
    .description('Profile analysis and optimization commands')
    .addCommand(new Command('analyze')
      .description('Analyze current profiles and generate scores')
      .action(async () => {
        try {
          console.log(chalk.blue('Analyzing profiles...\n'));
          
          const factStoreService = new FactStoreService();
          const userId = 'default-user';
          
          const spinner = ora('Checking fact store...').start();
          const factStore = await factStoreService.getFactStore(userId);
          
          if (!factStore) {
            spinner.fail('No fact store found');
            console.log('Please create a fact store first using: pnpm run facts:new');
            process.exit(1);
          }
          
          const validation = await factStoreService.validateFactStore(factStore);
          
          if (!validation.valid) {
            spinner.warn('⚠️  Fact store has validation issues');
            console.log('\nPlease complete your fact store before analysis:');
            validation.errors.forEach((error, index) => {
              console.log(`${index + 1}. ${error}`);
            });
            console.log('\nRun: pnpm run facts:edit');
            process.exit(1);
          }
          
          spinner.succeed('Fact store validated successfully!');
          
          console.log('\n📊 PROFILE ANALYSIS');
          console.log('====================\n');
          
          const summary = await factStoreService.getFactStoreSummary(userId);
          if (summary) {
            console.log(`👤 ${summary.name}`);
            console.log(`📧 ${summary.email}`);
            console.log(`💼 ${summary.currentRole} → ${summary.targetRole}`);
            console.log(`🏢 ${summary.industry}`);
            console.log(`📅 ${summary.yearsExperience} years experience`);
            console.log(`🚀 ${summary.projectCount} projects, ${summary.skillCount} skills`);
            console.log(`🎓 ${summary.educationCount} education entries, ${summary.experienceCount} experience entries`);
          }
          
          console.log('\n⚠️  Profile analysis will be fully implemented in the next phase.');
          console.log('This will include:');
          console.log('  - LinkedIn profile analysis');
          console.log('  - GitHub profile analysis');
          console.log('  - Effectiveness scoring');
          console.log('  - Gap identification');
          
        } catch (error) {
          console.error(chalk.red('Profile analysis failed:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      }))
    .addCommand(new Command('plan')
      .description('Generate optimization plan')
      .option('--mode <mode>', 'Planning mode: rubric (rules-based) or data-driven (benchmark-based)', 'rubric')
      .option('--platform <platform>', 'Platform to plan for (linkedin|github)', 'linkedin')
      .action(async (options) => {
        try {
          console.log(chalk.blue(`Generating optimization plan (${options.mode} mode)...\n`));
          
          const factStoreService = new FactStoreService();
          const userId = 'default-user';
          
          const spinner = ora('Checking fact store...').start();
          const factStore = await factStoreService.getFactStore(userId);
          
          if (!factStore) {
            spinner.fail('No fact store found');
            console.log('Please create a fact store first using: pnpm run facts:new');
            process.exit(1);
          }
          
          const validation = await factStoreService.validateFactStore(factStore);
          
          if (!validation.valid) {
            spinner.warn('⚠️  Fact store has validation issues');
            console.log('\nPlease complete your fact store before generating a plan:');
            validation.errors.forEach((error, index) => {
              console.log(`${index + 1}. ${error}`);
            });
            console.log('\nRun: pnpm run facts:edit');
            process.exit(1);
          }
          
          spinner.succeed('Fact store validated successfully!');

          if (options.mode === 'data-driven') {
            const { BenchmarkService } = await import('@ancso/core');
            const benchmarkService = new BenchmarkService();

            console.log(chalk.blue('\n📊 DATA-DRIVEN OPTIMIZATION PLAN'));
            console.log('===================================\n');

            const persona = 'engineer';
            const platform = options.platform as 'linkedin' | 'github';

            console.log(`Persona: ${persona} | Platform: ${platform}\n`);

            const sections = platform === 'linkedin' 
              ? ['headline', 'about'] 
              : ['readme', 'summary'];

            for (const section of sections) {
              console.log(chalk.green(`\n📝 ${section.toUpperCase()} Section`));
              console.log('─'.repeat(40));

              const currentContent = section === 'headline' 
                ? `${factStore.career.currentRole} at ${factStore.career.industry}`
                : factStore.career.careerSummary;

              const plan = await benchmarkService.generateDataDrivenPlan(
                currentContent,
                persona,
                section,
                platform
              );

              if (plan.benchmarkPatterns.length > 0) {
                console.log('\n🔍 Common Patterns in Elite Profiles:');
                plan.benchmarkPatterns.slice(0, 3).forEach((pattern, i) => {
                  console.log(`  ${i + 1}. ${pattern.pattern} (${pattern.frequency} profiles)`);
                });
              }

              if (plan.suggestedEdits.length > 0) {
                console.log('\n💡 Suggested Edits:');
                plan.suggestedEdits.forEach((edit, i) => {
                  console.log(`  ${i + 1}. [${edit.type.toUpperCase()}] ${edit.description}`);
                  console.log(`     Confidence: ${(edit.confidence * 100).toFixed(0)}%`);
                });
              }

              if (plan.personaAlignment.suggestions.length > 0) {
                console.log('\n🎯 Persona Alignment:');
                console.log(`  Score: ${(plan.personaAlignment.score * 100).toFixed(0)}%`);
                plan.personaAlignment.suggestions.forEach((s, i) => {
                  console.log(`  ${i + 1}. ${s}`);
                });
              }

              if (plan.benchmarkPatterns.length === 0 && plan.suggestedEdits.length === 0) {
                console.log(chalk.yellow('\n⚠️  No benchmark data available for comparison'));
                console.log('   Run: pnpm cli benchmarks:seed:github --n 50');
                console.log('   Run: pnpm cli benchmarks:add:linkedin --urls "your-urls"');
              }
            }

            console.log('\n📋 Edit Plan Summary');
            console.log('====================');
            console.log('1. Review suggested edits above');
            console.log('2. Run: pnpm cli profile generate profile');
            console.log('3. Run: pnpm cli profile apply:' + platform);

          } else {
            console.log(chalk.blue('\n📋 RUBRIC-BASED OPTIMIZATION PLAN'));
            console.log('===================================\n');

            console.log('Based on your fact store:\n');

            console.log(`👤 Current Role: ${factStore.career.currentRole}`);
            console.log(`🎯 Target Role: ${factStore.career.targetRole}`);
            console.log(`🏢 Industry: ${factStore.career.industry}`);
            console.log(`📅 Experience: ${factStore.career.yearsExperience} years`);

            console.log('\n📝 Recommended Actions:');
            console.log('1. Update headline to include target role and key skills');
            console.log('2. Expand about section with specific achievements');
            console.log('3. Highlight top 3 projects with metrics');
            console.log('4. Ensure skills match target role requirements');

            console.log('\n💡 Tips:');
            console.log('- Use action verbs (built, led, achieved)');
            console.log('- Include specific metrics where possible');
            console.log('- Tailor content to target role');
            console.log('- Keep LinkedIn under 2000 characters');
          }
          
        } catch (error) {
          console.error(chalk.red('Optimization plan generation failed:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      }))
    .addCommand(new Command('apply')
      .description('Apply profile optimizations')
      .addCommand(new Command('github')
        .description('Apply GitHub profile optimizations')
        .action(async () => {
          try {
            console.log(chalk.blue('Applying GitHub optimizations...\n'));
            
            const factStoreService = new FactStoreService();
            const userId = 'default-user';
            
            const spinner = ora('Checking fact store...').start();
            const factStore = await factStoreService.getFactStore(userId);
            
            if (!factStore) {
              spinner.fail('No fact store found');
              console.log('Please create a fact store first using: pnpm run facts:new');
              process.exit(1);
            }
            
            const validation = await factStoreService.validateFactStore(factStore);
            
            if (!validation.valid) {
              spinner.warn('⚠️  Fact store has validation issues');
              console.log('\nPlease complete your fact store before applying optimizations:');
              validation.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
              });
              console.log('\nRun: pnpm run facts:edit');
              process.exit(1);
            }
            
            spinner.succeed('Fact store validated successfully!');
            
            console.log('\n🚀 GITHUB OPTIMIZATION');
            console.log('=======================\n');
            
            console.log('⚠️  GitHub optimization will be fully implemented in the next phase.');
            console.log('This will include:');
            console.log('  - Profile README generation');
            console.log('  - Repository optimization');
            console.log('  - Pinned repository recommendations');
            console.log('  - GitHub OAuth integration');
            
          } catch (error) {
            console.error(chalk.red('GitHub optimization failed:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
          }
        }))
      .addCommand(new Command('linkedin')
        .description('Apply LinkedIn profile optimizations')
        .action(async () => {
          try {
            console.log(chalk.blue('Applying LinkedIn optimizations...\n'));
            
            const factStoreService = new FactStoreService();
            const userId = 'default-user';
            
            const spinner = ora('Checking fact store...').start();
            const factStore = await factStoreService.getFactStore(userId);
            
            if (!factStore) {
              spinner.fail('No fact store found');
              console.log('Please create a fact store first using: pnpm run facts:new');
              process.exit(1);
            }
            
            const validation = await factStoreService.validateFactStore(factStore);
            
            if (!validation.valid) {
              spinner.warn('⚠️  Fact store has validation issues');
              console.log('\nPlease complete your fact store before applying optimizations:');
              validation.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
              });
              console.log('\nRun: pnpm run facts:edit');
              process.exit(1);
            }
            
            spinner.succeed('Fact store validated successfully!');
            
            console.log('\n🔗 LINKEDIN OPTIMIZATION');
            console.log('========================\n');
            
            console.log('⚠️  LinkedIn optimization will be fully implemented in the next phase.');
            console.log('This will include:');
            console.log('  - Headline optimization');
            console.log('  - About section generation');
            console.log('  - Experience bullet optimization');
            console.log('  - Skills section optimization');
            console.log('  - Browser automation with Playwright');
            
          } catch (error) {
            console.error(chalk.red('LinkedIn optimization failed:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
          }
        })))

    .addCommand(new Command('generate')
      .description('Generate profile content using AI')
      .addCommand(profileGenerateCommand()))

    .addCommand(new Command('ranker')
      .description('Ranker dataset management commands')
      .addCommand(rankerAddPairCommand())
      .addCommand(rankerExportCommand()))
    .addCommand(profileApplyGithubCommand());

  return command;
}
