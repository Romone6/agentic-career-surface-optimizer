import { UserFactStore } from '../storage/schema';
import { FactStoreService } from './fact-store';
import { Logger } from '../storage/logger';
import { AppError } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class QuestionnaireService {
  private factStoreService: FactStoreService;
  private logger: Logger;

  constructor(factStoreService?: FactStoreService) {
    this.factStoreService = factStoreService || new FactStoreService();
    this.logger = new Logger('QuestionnaireService');
  }

  async createNewFactStore(userId: string): Promise<UserFactStore> {
    try {
      this.logger.info(`Creating new fact store for user: ${userId}`);

      // Create minimal fact store
      const factStoreData = {
        userId,
        personal: {
          name: '',
          email: '',
          location: '',
          phone: '',
          websites: [],
        },
        career: {
          currentRole: '',
          targetRole: '',
          industry: '',
          yearsExperience: 0,
          careerSummary: '',
        },
        projects: [],
        skills: [],
        education: [],
        experience: [],
      };

      return await this.factStoreService.createFactStore(factStoreData);
    } catch (error) {
      this.logger.error(`Create new fact store failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('QUESTIONNAIRE_ERROR', `Failed to create new fact store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getQuestionnaireQuestions(factStore: UserFactStore): Promise<QuestionnaireQuestion[]> {
    try {
      this.logger.info(`Generating questionnaire questions for user: ${factStore.userId}`);

      const questions: QuestionnaireQuestion[] = [];

      // Personal information questions
      if (!factStore.personal.name) {
        questions.push({
          id: 'personal_name',
          section: 'personal',
          field: 'name',
          question: 'What is your full name?',
          type: 'text',
          required: true,
          placeholder: 'John Doe',
          validation: 'minLength:2',
        });
      }

      if (!factStore.personal.email) {
        questions.push({
          id: 'personal_email',
          section: 'personal',
          field: 'email',
          question: 'What is your email address?',
          type: 'email',
          required: true,
          placeholder: 'john@example.com',
          validation: 'email',
        });
      }

      if (!factStore.personal.location) {
        questions.push({
          id: 'personal_location',
          section: 'personal',
          field: 'location',
          question: 'Where are you located? (City, Country)',
          type: 'text',
          required: false,
          placeholder: 'San Francisco, USA',
        });
      }

      // Career information questions
      if (!factStore.career.currentRole) {
        questions.push({
          id: 'career_current_role',
          section: 'career',
          field: 'currentRole',
          question: 'What is your current job title/role?',
          type: 'text',
          required: true,
          placeholder: 'Senior Software Engineer',
          validation: 'minLength:2',
        });
      }

      if (!factStore.career.targetRole) {
        questions.push({
          id: 'career_target_role',
          section: 'career',
          field: 'targetRole',
          question: 'What is your target/desired job title/role?',
          type: 'text',
          required: true,
          placeholder: 'Staff Software Engineer',
          validation: 'minLength:2',
        });
      }

      if (!factStore.career.industry) {
        questions.push({
          id: 'career_industry',
          section: 'career',
          field: 'industry',
          question: 'What industry are you in?',
          type: 'text',
          required: true,
          placeholder: 'Software Development',
          validation: 'minLength:2',
        });
      }

      if (factStore.career.yearsExperience === 0) {
        questions.push({
          id: 'career_years_experience',
          section: 'career',
          field: 'yearsExperience',
          question: 'How many years of professional experience do you have?',
          type: 'number',
          required: true,
          placeholder: '5',
          validation: 'min:0,max:50',
        });
      }

      if (!factStore.career.careerSummary) {
        questions.push({
          id: 'career_summary',
          section: 'career',
          field: 'careerSummary',
          question: 'Provide a brief summary of your career (2-3 sentences)',
          type: 'textarea',
          required: true,
          placeholder: 'I am a software engineer with 5 years of experience building scalable web applications...',
          validation: 'minLength:50',
        });
      }

      // Project questions (if no projects exist)
      if (factStore.projects.length === 0) {
        questions.push({
          id: 'project_add',
          section: 'projects',
          field: 'projects',
          question: 'Would you like to add a project?',
          type: 'confirm',
          required: false,
        });
      }

      // Skill questions (if no skills exist)
      if (factStore.skills.length === 0) {
        questions.push({
          id: 'skill_add',
          section: 'skills',
          field: 'skills',
          question: 'Would you like to add skills?',
          type: 'confirm',
          required: false,
        });
      }

      // Education questions (if no education exists)
      if (factStore.education.length === 0) {
        questions.push({
          id: 'education_add',
          section: 'education',
          field: 'education',
          question: 'Would you like to add education?',
          type: 'confirm',
          required: false,
        });
      }

      // Experience questions (if no experience exists)
      if (factStore.experience.length === 0) {
        questions.push({
          id: 'experience_add',
          section: 'experience',
          field: 'experience',
          question: 'Would you like to add work experience?',
          type: 'confirm',
          required: false,
        });
      }

      return questions;
    } catch (error) {
      this.logger.error(`Get questionnaire questions failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('QUESTIONNAIRE_ERROR', `Failed to generate questionnaire questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateFactStoreFromAnswers(
    userId: string,
    answers: Record<string, any>
  ): Promise<UserFactStore> {
    try {
      this.logger.info(`Updating fact store from answers for user: ${userId}`);

      const factStore = await this.factStoreService.getFactStore(userId);
      if (!factStore) {
        throw new AppError('NOT_FOUND', `Fact store not found for user: ${userId}`);
      }

      // Update personal information
      if (answers.personal_name) {
        factStore.personal.name = answers.personal_name;
      }
      if (answers.personal_email) {
        factStore.personal.email = answers.personal_email;
      }
      if (answers.personal_location) {
        factStore.personal.location = answers.personal_location;
      }
      if (answers.personal_phone) {
        factStore.personal.phone = answers.personal_phone;
      }

      // Update career information
      if (answers.career_current_role) {
        factStore.career.currentRole = answers.career_current_role;
      }
      if (answers.career_target_role) {
        factStore.career.targetRole = answers.career_target_role;
      }
      if (answers.career_industry) {
        factStore.career.industry = answers.career_industry;
      }
      if (answers.career_years_experience) {
        factStore.career.yearsExperience = parseInt(answers.career_years_experience);
      }
      if (answers.career_summary) {
        factStore.career.careerSummary = answers.career_summary;
      }

      // Add projects if requested
      if (answers.project_add === true) {
        const project = {
          id: uuidv4(),
          name: answers.project_name || 'Untitled Project',
          description: answers.project_description || '',
          url: answers.project_url || '',
          technologies: answers.project_technologies ? answers.project_technologies.split(',') : [],
          achievements: answers.project_achievements ? [answers.project_achievements] : [],
          startDate: answers.project_start_date || '',
          endDate: answers.project_end_date || '',
        };
        factStore.projects.push(project);
      }

      // Add skills if requested
      if (answers.skill_add === true) {
        const skills = answers.skills ? answers.skills.split(',') : [];
        for (const skillName of skills) {
          const skill = {
            id: uuidv4(),
            name: skillName.trim(),
            category: answers.skill_category || 'technical',
            proficiency: answers.skill_proficiency || 'intermediate',
            yearsExperience: parseInt(answers.skill_years_experience) || 1,
          };
          factStore.skills.push(skill);
        }
      }

      // Add education if requested
      if (answers.education_add === true) {
        const education = {
          id: uuidv4(),
          degree: answers.education_degree || '',
          institution: answers.education_institution || '',
          fieldOfStudy: answers.education_field || '',
          startDate: answers.education_start_date || '',
          endDate: answers.education_end_date || '',
          gpa: answers.education_gpa || '',
        };
        factStore.education.push(education);
      }

      // Add experience if requested
      if (answers.experience_add === true) {
        const experience = {
          id: uuidv4(),
          title: answers.experience_title || '',
          company: answers.experience_company || '',
          location: answers.experience_location || '',
          startDate: answers.experience_start_date || '',
          endDate: answers.experience_end_date || '',
          achievements: answers.experience_achievements ? [answers.experience_achievements] : [],
          skillsUsed: answers.experience_skills ? answers.experience_skills.split(',') : [],
        };
        factStore.experience.push(experience);
      }

      // Update the fact store
      return await this.factStoreService.updateFactStore(userId, factStore);
    } catch (error) {
      this.logger.error(`Update fact store from answers failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('QUESTIONNAIRE_ERROR', `Failed to update fact store from answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isFactStoreComplete(userId: string): Promise<{ complete: boolean; missingSections: string[] }> {
    try {
      this.logger.info(`Checking fact store completeness for user: ${userId}`);

      const factStore = await this.factStoreService.getFactStore(userId);
      if (!factStore) {
        return { complete: false, missingSections: ['fact_store'] };
      }

      const missingSections: string[] = [];

      // Check personal information
      if (!factStore.personal.name || !factStore.personal.email) {
        missingSections.push('personal');
      }

      // Check career information
      if (!factStore.career.currentRole || !factStore.career.targetRole || !factStore.career.industry) {
        missingSections.push('career');
      }

      // Check if basic sections are populated
      if (factStore.projects.length === 0) {
        missingSections.push('projects');
      }

      if (factStore.skills.length === 0) {
        missingSections.push('skills');
      }

      if (factStore.education.length === 0) {
        missingSections.push('education');
      }

      if (factStore.experience.length === 0) {
        missingSections.push('experience');
      }

      const complete = missingSections.length === 0;
      this.logger.info(`Fact store completeness for user ${userId}: ${complete ? 'complete' : 'incomplete'}`);

      return { complete, missingSections };
    } catch (error) {
      this.logger.error(`Check fact store completeness failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('QUESTIONNAIRE_ERROR', `Failed to check fact store completeness: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getQuestionnaireProgress(userId: string): Promise<QuestionnaireProgress> {
    try {
      this.logger.info(`Getting questionnaire progress for user: ${userId}`);

      const factStore = await this.factStoreService.getFactStore(userId);
      if (!factStore) {
        return {
          userId,
          overallCompletion: 0,
          sectionCompletions: {
            personal: 0,
            career: 0,
            projects: 0,
            skills: 0,
            education: 0,
            experience: 0,
          },
        };
      }

      // Calculate personal completion
      const personalFields = ['name', 'email', 'location', 'phone'];
      const personalCompleted = personalFields.filter(field => 
        factStore.personal[field as keyof typeof factStore.personal] 
      ).length;
      const personalCompletion = Math.round((personalCompleted / personalFields.length) * 100);

      // Calculate career completion
      const careerFields = ['currentRole', 'targetRole', 'industry', 'yearsExperience', 'careerSummary'];
      const careerCompleted = careerFields.filter(field => 
        factStore.career[field as keyof typeof factStore.career] 
      ).length;
      const careerCompletion = Math.round((careerCompleted / careerFields.length) * 100);

      // Calculate other sections completion
      const projectsCompletion = factStore.projects.length > 0 ? 100 : 0;
      const skillsCompletion = factStore.skills.length > 0 ? 100 : 0;
      const educationCompletion = factStore.education.length > 0 ? 100 : 0;
      const experienceCompletion = factStore.experience.length > 0 ? 100 : 0;

      // Calculate overall completion
      const totalSections = 6;
      const completedSections = [
        personalCompletion > 0,
        careerCompletion > 0,
        projectsCompletion > 0,
        skillsCompletion > 0,
        educationCompletion > 0,
        experienceCompletion > 0,
      ].filter(Boolean).length;

      const overallCompletion = Math.round((completedSections / totalSections) * 100);

      return {
        userId,
        overallCompletion,
        sectionCompletions: {
          personal: personalCompletion,
          career: careerCompletion,
          projects: projectsCompletion,
          skills: skillsCompletion,
          education: educationCompletion,
          experience: experienceCompletion,
        },
      };
    } catch (error) {
      this.logger.error(`Get questionnaire progress failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('QUESTIONNAIRE_ERROR', `Failed to get questionnaire progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export interface QuestionnaireQuestion {
  id: string;
  section: string;
  field: string;
  question: string;
  type: 'text' | 'email' | 'number' | 'textarea' | 'confirm' | 'select' | 'multiselect';
  required: boolean;
  placeholder?: string;
  validation?: string;
  options?: string[];
  defaultValue?: any;
}

export interface QuestionnaireProgress {
  userId: string;
  overallCompletion: number;
  sectionCompletions: {
    personal: number;
    career: number;
    projects: number;
    skills: number;
    education: number;
    experience: number;
  };
}