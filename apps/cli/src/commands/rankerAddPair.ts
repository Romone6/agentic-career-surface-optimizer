import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { RankerDatasetService } from '@ancso/ml';
import { FactStoreService } from '@ancso/core';
import ora from 'ora';

export function rankerAddPairCommand(): Command {
  return new Command('add-pair')
    .description('Add a pairwise preference to the ranker dataset')
    .option('-u, --user-id <userId>', 'User ID for the dataset', 'default-user')
    .option('-t, --item-type <type>', 'Type of items being compared (e.g., profile, project)')
    .option('-a, --item-a <itemA>', 'First item reference ID')
    .option('-b, --item-b <itemB>', 'Second item reference ID')
    .option('-l, --label <label>', 'Preference label: -1 (B better), 0 (equal), 1 (A better)')
    .option('-r, --reason-tags <tags>', 'Comma-separated reason tags')
    .option('-i, --interactive', 'Interactive mode for adding pairs')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Adding pairwise preference to ranker dataset...\n'));

        // Initialize services
        const rankerService = new RankerDatasetService();
        const factStoreService = new FactStoreService();

        // Check if user has a fact store
        const spinner = ora('Checking fact store...').start();
        const factStore = await factStoreService.getFactStore(options.userId);

        if (!factStore) {
          spinner.fail('No fact store found');
          console.log('Please create a fact store first using: pnpm run facts:new');
          process.exit(1);
        }
        spinner.succeed('Fact store loaded!');

        let itemAId: string | undefined;
        let itemBId: string | undefined;
        let itemType: string | undefined;
        let label: number | undefined;
        let reasonTags: string[] | undefined;

        if (options.interactive) {
          // Interactive mode
          console.log('\n📋 INTERACTIVE PAIRWISE PREFERENCE COLLECTION');
          console.log('=============================================\n');

          // Get item type
          const typeAnswer = await inquirer.prompt([{
            type: 'list',
            name: 'itemType',
            message: 'What type of items are you comparing?',
            choices: [
              { name: 'Profile sections', value: 'profile_section' },
              { name: 'Projects', value: 'project' },
              { name: 'Skills', value: 'skill' },
              { name: 'Experience entries', value: 'experience' },
              { name: 'Education entries', value: 'education' },
              { name: 'Other (custom)', value: 'custom' }
            ]
          }]);

          itemType = typeAnswer.itemType;

          if (itemType === 'custom') {
            const customType = await inquirer.prompt([{
              type: 'input',
              name: 'type',
              message: 'Enter custom item type:'
            }]);
            itemType = customType.type;
          }

          // Get item references based on type
          let itemChoices: { name: string; value: string }[] = [];

          switch (itemType) {
            case 'profile_section':
              itemChoices = [
                { name: 'Headline', value: 'headline' },
                { name: 'About section', value: 'about' },
                { name: 'Experience', value: 'experience' },
                { name: 'Skills', value: 'skills' },
                { name: 'Education', value: 'education' }
              ];
              break;

            case 'project':
              itemChoices = factStore.projects.map(project => ({
                name: `${project.name} (${project.technologies.join(', ')})`,
                value: project.id
              }));
              break;

            case 'skill':
              itemChoices = factStore.skills.map(skill => ({
                name: `${skill.name} (${skill.proficiency}, ${skill.yearsExperience} years)`,
                value: skill.id
              }));
              break;

            case 'experience':
              itemChoices = factStore.experience.map(exp => ({
                name: `${exp.title} at ${exp.company}`,
                value: exp.id
              }));
              break;

            case 'education':
              itemChoices = factStore.education.map(edu => ({
                name: `${edu.degree} from ${edu.institution}`,
                value: edu.id
              }));
              break;

            default:
              // For custom types, ask for manual input
              const itemAInput = await inquirer.prompt([{
                type: 'input',
                name: 'itemA',
                message: 'Enter first item reference ID:'
              }]);
              
              const itemBInput = await inquirer.prompt([{
                type: 'input',
                name: 'itemB',
                message: 'Enter second item reference ID:'
              }]);
              
              itemAId = itemAInput.itemA;
              itemBId = itemBInput.itemB;
              break;
          }

          if (!itemAId || !itemBId) {
            // Select items from choices
            const itemsAnswer = await inquirer.prompt([
              {
                type: 'list',
                name: 'itemA',
                message: 'Select first item:',
                choices: itemChoices
              },
              {
                type: 'list',
                name: 'itemB',
                message: 'Select second item:',
                choices: itemChoices
              }
            ]);

            itemAId = itemsAnswer.itemA;
            itemBId = itemsAnswer.itemB;
          }

          // Get preference
          const preferenceAnswer = await inquirer.prompt([{
            type: 'list',
            name: 'preference',
            message: 'Which item do you prefer?',
            choices: [
              { name: 'First item is better', value: '1' },
              { name: 'Both are equal', value: '0' },
              { name: 'Second item is better', value: '-1' }
            ]
          }]);

          label = parseInt(preferenceAnswer.preference);

          // Get reason tags
          const reasonAnswer = await inquirer.prompt([{
            type: 'checkbox',
            name: 'reasons',
            message: 'Select reasons for this preference:',
            choices: [
              { name: 'More relevant to target role', value: 'relevance' },
              { name: 'Better metrics/achievements', value: 'metrics' },
              { name: 'More recent', value: 'recency' },
              { name: 'Better writing/presentation', value: 'presentation' },
              { name: 'More comprehensive', value: 'comprehensive' },
              { name: 'Other', value: 'other' }
            ]
          }]);

          if (reasonAnswer.reasons.includes('other')) {
            const customReason = await inquirer.prompt([{
              type: 'input',
              name: 'reason',
              message: 'Enter custom reason:'
            }]);
            reasonTags = [...reasonAnswer.reasons.filter((r: string) => r !== 'other'), customReason.reason];
          } else {
            reasonTags = reasonAnswer.reasons;
          }

        } else {
          // Command line mode - validate inputs
          if (!options.itemType) {
            console.log(chalk.red('Error: --item-type is required'));
            process.exit(1);
          }

          if (!options.itemA || !options.itemB) {
            console.log(chalk.red('Error: --item-a and --item-b are required'));
            process.exit(1);
          }

          if (!options.label) {
            console.log(chalk.red('Error: --label is required'));
            process.exit(1);
          }

          itemType = options.itemType;
          itemAId = options.itemA;
          itemBId = options.itemB;
          label = parseInt(options.label);
          
          if (options.reasonTags) {
            reasonTags = options.reasonTags.split(',').map(tag => tag.trim());
          }
        }

        // Validate label
        if (label !== -1 && label !== 0 && label !== 1) {
          console.log(chalk.red('Error: Label must be -1, 0, or 1'));
          process.exit(1);
        }

        // Add items to dataset if they don't exist
        spinner.text = 'Adding items to dataset...';
        spinner.start();

        // Check if items already exist
        let itemA = await rankerService.getRankItem(itemAId);
        let itemB = await rankerService.getRankItem(itemBId);

        if (!itemA) {
          // Create metrics based on item type and fact store
          const metrics = this.createMetricsForItem(itemType!, itemAId!, factStore);
          
          itemA = await rankerService.addRankItem({
            userId: options.userId,
            itemType: itemType!,
            itemReferenceId: itemAId!,
            metrics
          });
        }

        if (!itemB) {
          // Create metrics based on item type and fact store
          const metrics = this.createMetricsForItem(itemType!, itemBId!, factStore);
          
          itemB = await rankerService.addRankItem({
            userId: options.userId,
            itemType: itemType!,
            itemReferenceId: itemBId!,
            metrics
          });
        }

        spinner.succeed('Items added to dataset!');

        // Add the pairwise preference
        spinner.text = 'Adding pairwise preference...';
        spinner.start();

        const pair = await rankerService.addRankPair({
          userId: options.userId,
          itemAId: itemA.id,
          itemBId: itemB.id,
          label: label!,
          reasonTags
        });

        spinner.succeed('Pairwise preference added successfully!');

        console.log('\n🎉 PAIRWISE PREFERENCE ADDED');
        console.log('==============================');
        console.log(`Item A: ${itemA.itemReferenceId}`);
        console.log(`Item B: ${itemB.itemReferenceId}`);
        console.log(`Preference: ${label === 1 ? 'A > B' : label === -1 ? 'B > A' : 'A = B'}`);
        if (reasonTags && reasonTags.length > 0) {
          console.log(`Reasons: ${reasonTags.join(', ')}`);
        }
        console.log(`Pair ID: ${pair.id}`);

        // Show dataset statistics
        const stats = await rankerService.getDatasetStatistics(options.userId);
        console.log('\n📊 DATASET STATISTICS');
        console.log('=====================');
        console.log(`Total Items: ${stats.itemCount}`);
        console.log(`Total Pairs: ${stats.pairCount}`);
        console.log('Label Distribution:');
        Object.entries(stats.labelDistribution).forEach(([label, count]) => {
          const labelName = label === '1' ? 'A > B' : label === '-1' ? 'B > A' : 'A = B';
          console.log(`  ${labelName}: ${count}`);
        });

      } catch (error) {
        console.error(chalk.red('Failed to add pairwise preference:'), error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });

  private createMetricsForItem(itemType: string, itemReferenceId: string, factStore: any): Record<string, number> {
    // Create heuristic metrics based on item type
    const metrics: Record<string, number> = {};

    switch (itemType) {
      case 'profile_section':
        // For profile sections, use length and keyword density
        const section = factStore[itemReferenceId as keyof typeof factStore];
        if (typeof section === 'string') {
          metrics.length = section.length;
          metrics.keyword_density = this.calculateKeywordDensity(section);
        }
        break;

      case 'project':
        // For projects, use technology count and achievement count
        const project = factStore.projects.find((p: any) => p.id === itemReferenceId);
        if (project) {
          metrics.technology_count = project.technologies?.length || 0;
          metrics.achievement_count = project.achievements?.length || 0;
          metrics.description_length = project.description?.length || 0;
        }
        break;

      case 'skill':
        // For skills, use years of experience and map proficiency to score
        const skill = factStore.skills.find((s: any) => s.id === itemReferenceId);
        if (skill) {
          metrics.years_experience = skill.yearsExperience || 0;
          
          const proficiencyMap: Record<string, number> = {
            'beginner': 1,
            'intermediate': 2,
            'advanced': 3,
            'expert': 4
          };
          
          metrics.proficiency_score = proficiencyMap[skill.proficiency] || 1;
        }
        break;

      case 'experience':
        // For experience, use years and achievement count
        const experience = factStore.experience.find((e: any) => e.id === itemReferenceId);
        if (experience) {
          metrics.years = this.calculateYears(experience.startDate, experience.endDate);
          metrics.achievement_count = experience.achievements?.length || 0;
          metrics.skill_count = experience.skillsUsed?.length || 0;
        }
        break;

      case 'education':
        // For education, use GPA if available
        const education = factStore.education.find((e: any) => e.id === itemReferenceId);
        if (education) {
          metrics.years = this.calculateYears(education.startDate, education.endDate);
          if (education.gpa) {
            metrics.gpa = parseFloat(education.gpa);
          }
        }
        break;

      default:
        // For custom types, just add a basic score
        metrics.heuristic_score = 1.0;
        break;
    }

    return metrics;
  }

  private calculateKeywordDensity(text: string): number {
    // Simple keyword density calculation
    const keywords = ['experience', 'skill', 'project', 'achievement', 'result', 'impact'];
    const textLower = text.toLowerCase();
    
    let keywordCount = 0;
    keywords.forEach(keyword => {
      if (textLower.includes(keyword)) {
        keywordCount++;
      }
    });

    return keywordCount / text.length;
  }

  private calculateYears(startDate: string, endDate?: string): number {
    try {
      const startYear = new Date(startDate).getFullYear();
      const endYear = endDate ? new Date(endDate).getFullYear() : new Date().getFullYear();
      return endYear - startYear;
    } catch (error) {
      return 0;
    }
  }
}