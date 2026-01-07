import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { FactStoreService, QuestionnaireService } from '@ancso/core';
import { getConfig } from '@ancso/core';
import ora from 'ora';

export function factsCommands(): Command {
  const command = new Command('facts')
    .description('Manage user fact store')
    .addCommand(new Command('new')
      .description('Create a new fact store through interactive questionnaire')
      .action(async () => {
        try {
          console.log(chalk.blue('Starting fact store creation...\n'));
          
          // Load config to ensure everything is set up
          const config = getConfig();
          
          // Initialize services
          const factStoreService = new FactStoreService();
          const questionnaireService = new QuestionnaireService(factStoreService);
          
          // Use a default user ID for now (in production, this would come from auth)
          const userId = 'default-user';
          
          console.log('📋 Creating new fact store...\n');
          
          // Create new fact store
          const spinner = ora('Creating fact store...').start();
          const factStore = await questionnaireService.createNewFactStore(userId);
          spinner.succeed('Fact store created successfully!');
          
          console.log(`\n📝 Fact Store ID: ${factStore.id}`);
          console.log(`👤 User ID: ${factStore.userId}`);
          console.log(`📅 Created: ${new Date(factStore.createdAt).toLocaleString()}`);
          
          // Start interactive questionnaire
          await runInteractiveQuestionnaire(userId, questionnaireService);
          
        } catch (error) {
          console.error(chalk.red('Failed to create fact store:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      }))
    .addCommand(new Command('edit')
      .description('Edit existing fact store')
      .action(async () => {
        try {
          console.log(chalk.blue('Editing fact store...\n'));
          
          // Load config
          const config = getConfig();
          
          // Initialize services
          const factStoreService = new FactStoreService();
          const questionnaireService = new QuestionnaireService(factStoreService);
          
          // Use default user ID
          const userId = 'default-user';
          
          // Check if fact store exists
          const spinner = ora('Checking existing fact store...').start();
          const factStore = await factStoreService.getFactStore(userId);
          
          if (!factStore) {
            spinner.fail('No existing fact store found');
            console.log('Please create a new fact store first using: pnpm run facts:new');
            process.exit(1);
          }
          
          spinner.succeed('Fact store loaded successfully!');
          
          // Show current completion status
          const progress = await questionnaireService.getQuestionnaireProgress(userId);
          console.log(`\n📊 Current Completion: ${progress.overallCompletion}%`);
          console.log('Section Completion:');
          Object.entries(progress.sectionCompletions).forEach(([section, completion]) => {
            console.log(`  ${section.padEnd(12)}: ${completion}%`);
          });
          
          // Run interactive questionnaire to fill in missing information
          await runInteractiveQuestionnaire(userId, questionnaireService);
          
        } catch (error) {
          console.error(chalk.red('Failed to edit fact store:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      }))
    .addCommand(new Command('show')
      .description('Show current fact store')
      .action(async () => {
        try {
          console.log(chalk.blue('Displaying fact store...\n'));
          
          // Initialize services
          const factStoreService = new FactStoreService();
          
          // Use default user ID
          const userId = 'default-user';
          
          // Get fact store
          const spinner = ora('Loading fact store...').start();
          const factStore = await factStoreService.getFactStore(userId);
          
          if (!factStore) {
            spinner.fail('No fact store found');
            console.log('Please create a new fact store first using: pnpm run facts:new');
            process.exit(1);
          }
          
          spinner.succeed('Fact store loaded!');
          
          // Display fact store summary
          console.log('\n📋 FACT STORE SUMMARY');
          console.log('=====================');
          console.log(`ID: ${factStore.id}`);
          console.log(`User ID: ${factStore.userId}`);
          console.log(`Version: ${factStore.version}`);
          console.log(`Created: ${new Date(factStore.createdAt).toLocaleString()}`);
          console.log(`Updated: ${new Date(factStore.updatedAt).toLocaleString()}`);
          
          // Display personal information
          console.log('\n👤 PERSONAL INFORMATION');
          console.log('=======================');
          console.log(`Name: ${factStore.personal.name || 'Not provided'}`);
          console.log(`Email: ${factStore.personal.email || 'Not provided'}`);
          console.log(`Location: ${factStore.personal.location || 'Not provided'}`);
          console.log(`Phone: ${factStore.personal.phone || 'Not provided'}`);
          if (factStore.personal.websites && factStore.personal.websites.length > 0) {
            console.log(`Websites: ${factStore.personal.websites.join(', ')}`);
          }
          
          // Display career information
          console.log('\n💼 CAREER INFORMATION');
          console.log('======================');
          console.log(`Current Role: ${factStore.career.currentRole || 'Not provided'}`);
          console.log(`Target Role: ${factStore.career.targetRole || 'Not provided'}`);
          console.log(`Industry: ${factStore.career.industry || 'Not provided'}`);
          console.log(`Years Experience: ${factStore.career.yearsExperience || 'Not provided'}`);
          console.log(`Career Summary: ${factStore.career.careerSummary || 'Not provided'}`);
          
          // Display projects
          console.log(`\n🚀 PROJECTS (${factStore.projects.length})`);
          console.log('==========================');
          if (factStore.projects.length === 0) {
            console.log('No projects added yet');
          } else {
            factStore.projects.forEach((project, index) => {
              console.log(`${index + 1}. ${project.name}`);
              console.log(`   Description: ${project.description || 'No description'}`);
              console.log(`   URL: ${project.url || 'No URL'}`);
              console.log(`   Technologies: ${project.technologies.join(', ') || 'None'}`);
              console.log(`   Achievements: ${project.achievements.join(', ') || 'None'}`);
              console.log(`   Dates: ${project.startDate || '?'} - ${project.endDate || 'Present'}`);
            });
          }
          
          // Display skills
          console.log(`\n🛠️ SKILLS (${factStore.skills.length})`);
          console.log('============================');
          if (factStore.skills.length === 0) {
            console.log('No skills added yet');
          } else {
            factStore.skills.forEach((skill, index) => {
              console.log(`${index + 1}. ${skill.name} (${skill.proficiency})`);
              console.log(`   Category: ${skill.category}`);
              console.log(`   Years Experience: ${skill.yearsExperience}`);
            });
          }
          
          // Display education
          console.log(`\n🎓 EDUCATION (${factStore.education.length})`);
          console.log('================================');
          if (factStore.education.length === 0) {
            console.log('No education added yet');
          } else {
            factStore.education.forEach((education, index) => {
              console.log(`${index + 1}. ${education.degree} - ${education.institution}`);
              console.log(`   Field: ${education.fieldOfStudy || 'Not specified'}`);
              console.log(`   Dates: ${education.startDate} - ${education.endDate || 'Present'}`);
              console.log(`   GPA: ${education.gpa || 'Not specified'}`);
            });
          }
          
          // Display experience
          console.log(`\n💼 EXPERIENCE (${factStore.experience.length})`);
          console.log('====================================');
          if (factStore.experience.length === 0) {
            console.log('No experience added yet');
          } else {
            factStore.experience.forEach((exp, index) => {
              console.log(`${index + 1}. ${exp.title} at ${exp.company}`);
              console.log(`   Location: ${exp.location || 'Not specified'}`);
              console.log(`   Dates: ${exp.startDate} - ${exp.endDate || 'Present'}`);
              console.log(`   Achievements: ${exp.achievements.join(', ') || 'None'}`);
              console.log(`   Skills: ${exp.skillsUsed.join(', ') || 'None'}`);
            });
          }
          
        } catch (error) {
          console.error(chalk.red('Failed to display fact store:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      }))
    .addCommand(new Command('validate')
      .description('Validate fact store against requirements')
      .action(async () => {
        try {
          console.log(chalk.blue('Validating fact store...\n'));
          
          // Initialize services
          const factStoreService = new FactStoreService();
          
          // Use default user ID
          const userId = 'default-user';
          
          // Get fact store
          const spinner = ora('Loading and validating fact store...').start();
          const factStore = await factStoreService.getFactStore(userId);
          
          if (!factStore) {
            spinner.fail('No fact store found');
            console.log('Please create a new fact store first using: pnpm run facts:new');
            process.exit(1);
          }
          
          // Validate fact store
          const validation = await factStoreService.validateFactStore(factStore);
          
          if (validation.valid) {
            spinner.succeed('✅ Fact store is valid!');
            console.log('\n🎉 Your fact store meets all requirements.');
            console.log('You can now proceed with profile optimization.');
          } else {
            spinner.warn('⚠️  Fact store has validation issues');
            console.log('\n📋 Validation Errors:');
            validation.errors.forEach((error, index) => {
              console.log(`${index + 1}. ${error}`);
            });
            console.log('\nPlease update your fact store using: pnpm run facts:edit');
          }
          
        } catch (error) {
          console.error(chalk.red('Failed to validate fact store:'), error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      }));

  return command;
}

async function runInteractiveQuestionnaire(userId: string, questionnaireService: QuestionnaireService): Promise<void> {
  try {
    // Get current fact store
    const factStore = await questionnaireService.getFactStore(userId);
    if (!factStore) {
      throw new Error('Fact store not found');
    }

    // Check completion status
    const completion = await questionnaireService.isFactStoreComplete(userId);
    
    if (completion.complete) {
      console.log('\n🎉 Your fact store is already complete!');
      console.log('You can proceed with profile optimization.');
      return;
    }

    console.log('\n📋 QUESTIONNAIRE');
    console.log('================\n');
    console.log('This questionnaire will help build your career fact store.');
    console.log('Your answers will be used to optimize your profiles.\n');

    // Get questions based on current fact store state
    const questions = await questionnaireService.getQuestionnaireQuestions(factStore);
    
    if (questions.length === 0) {
      console.log('No additional questions needed at this time.');
      return;
    }

    console.log(`📝 ${questions.length} questions to complete your profile\n`);

    // Process questions by section
    const answers: Record<string, any> = {};
    
    for (const question of questions) {
      console.log(`\n${chalk.blue('➤')} ${question.question}`);
      
      let answer;
      switch (question.type) {
        case 'text':
          answer = await inquirer.prompt([{
            type: 'input',
            name: question.id,
            message: 'Your answer:',
            validate: (input) => {
              if (question.required && !input.trim()) {
                return 'This field is required';
              }
              return true;
            },
          }]);
          break;
        
        case 'email':
          answer = await inquirer.prompt([{
            type: 'input',
            name: question.id,
            message: 'Your email:',
            validate: (input) => {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(input)) {
                return 'Please enter a valid email address';
              }
              return true;
            },
          }]);
          break;
        
        case 'number':
          answer = await inquirer.prompt([{
            type: 'input',
            name: question.id,
            message: 'Your answer (number):',
            validate: (input) => {
              if (isNaN(parseFloat(input))) {
                return 'Please enter a valid number';
              }
              return true;
            },
            filter: (input) => parseFloat(input),
          }]);
          break;
        
        case 'textarea':
          answer = await inquirer.prompt([{
            type: 'editor',
            name: question.id,
            message: 'Your answer (press Enter to open editor, save and exit when done):',
            validate: (input) => {
              if (question.required && !input.trim()) {
                return 'This field is required';
              }
              if (question.validation && question.validation.includes('minLength')) {
                const minLength = parseInt(question.validation.split(':')[1]);
                if (input.length < minLength) {
                  return `Please enter at least ${minLength} characters`;
                }
              }
              return true;
            },
          }]);
          break;
        
        case 'confirm':
          answer = await inquirer.prompt([{
            type: 'confirm',
            name: question.id,
            message: 'Your choice:',
            default: false,
          }]);
          break;
        
        default:
          answer = await inquirer.prompt([{
            type: 'input',
            name: question.id,
            message: 'Your answer:',
          }]);
      }
      
      answers[question.id] = answer[question.id];
    }

    // Update fact store with answers
    const spinner = ora('Saving your answers...').start();
    await questionnaireService.updateFactStoreFromAnswers(userId, answers);
    spinner.succeed('Answers saved successfully!');

    // Show progress
    const progress = await questionnaireService.getQuestionnaireProgress(userId);
    console.log(`\n📊 Updated Completion: ${progress.overallCompletion}%`);
    
    if (progress.overallCompletion >= 100) {
      console.log('\n🎉 Congratulations! Your fact store is now complete!');
      console.log('You can now proceed with profile optimization.');
    } else {
      console.log('\n📝 You can continue adding more information later by running:');
      console.log('   pnpm run facts:edit');
    }
    
  } catch (error) {
    console.error(chalk.red('Questionnaire failed:'), error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}