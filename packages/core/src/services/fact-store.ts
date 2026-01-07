import { UserFactStore, UserFactStoreRepository, SQLiteUserFactStoreRepository } from '../storage/schema';
import { Logger } from '../storage/logger';
import { AppError } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class FactStoreService {
  private repository: UserFactStoreRepository;
  private logger: Logger;

  constructor(repository?: UserFactStoreRepository) {
    this.repository = repository || new SQLiteUserFactStoreRepository();
    this.logger = new Logger('FactStoreService');
  }

  async createFactStore(factStoreData: Omit<UserFactStore, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserFactStore> {
    try {
      this.logger.info(`Creating fact store for user: ${factStoreData.userId}`);

      // Validate required fields
      if (!factStoreData.userId) {
        throw new AppError('VALIDATION_ERROR', 'userId is required');
      }

      const now = new Date().toISOString();
      const factStore: UserFactStore = {
        id: uuidv4(),
        version: '1.0',
        createdAt: now,
        updatedAt: now,
        userId: factStoreData.userId,
        personal: factStoreData.personal || {
          name: '',
          email: '',
        },
        career: factStoreData.career || {
          currentRole: '',
          targetRole: '',
          industry: '',
          yearsExperience: 0,
          careerSummary: '',
        },
        projects: factStoreData.projects || [],
        skills: factStoreData.skills || [],
        education: factStoreData.education || [],
        experience: factStoreData.experience || [],
      };

      const result = await this.repository.create(factStore);
      this.logger.info(`Fact store created successfully for user: ${factStoreData.userId}`);
      return result;
    } catch (error) {
      this.logger.error(`Create fact store failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('FACT_STORE_ERROR', `Failed to create fact store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFactStore(userId: string): Promise<UserFactStore | null> {
    try {
      this.logger.info(`Retrieving fact store for user: ${userId}`);
      return await this.repository.findByUserId(userId);
    } catch (error) {
      this.logger.error(`Get fact store failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('FACT_STORE_ERROR', `Failed to retrieve fact store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateFactStore(userId: string, updates: Partial<UserFactStore>): Promise<UserFactStore> {
    try {
      this.logger.info(`Updating fact store for user: ${userId}`);

      const existing = await this.repository.findByUserId(userId);
      if (!existing) {
        throw new AppError('NOT_FOUND', `Fact store not found for user: ${userId}`);
      }

      const updatedFactStore: UserFactStore = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      const result = await this.repository.update(updatedFactStore);
      this.logger.info(`Fact store updated successfully for user: ${userId}`);
      return result;
    } catch (error) {
      this.logger.error(`Update fact store failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('FACT_STORE_ERROR', `Failed to update fact store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteFactStore(userId: string): Promise<void> {
    try {
      this.logger.info(`Deleting fact store for user: ${userId}`);
      await this.repository.delete(userId);
      this.logger.info(`Fact store deleted successfully for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Delete fact store failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('FACT_STORE_ERROR', `Failed to delete fact store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listFactStores(): Promise<UserFactStore[]> {
    try {
      this.logger.info('Listing all fact stores');
      return await this.repository.listAll();
    } catch (error) {
      this.logger.error(`List fact stores failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('FACT_STORE_ERROR', `Failed to list fact stores: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateFactStore(factStore: UserFactStore): Promise<{ valid: boolean; errors: string[] }> {
    try {
      this.logger.info(`Validating fact store for user: ${factStore.userId}`);

      const errors: string[] = [];

      // Validate personal information
      if (!factStore.personal.name || factStore.personal.name.length < 2) {
        errors.push('Name is required and must be at least 2 characters');
      }

      if (!factStore.personal.email || !factStore.personal.email.includes('@')) {
        errors.push('Valid email is required');
      }

      // Validate career information
      if (!factStore.career.currentRole || factStore.career.currentRole.length < 2) {
        errors.push('Current role is required');
      }

      if (!factStore.career.targetRole || factStore.career.targetRole.length < 2) {
        errors.push('Target role is required');
      }

      if (!factStore.career.industry || factStore.career.industry.length < 2) {
        errors.push('Industry is required');
      }

      if (factStore.career.yearsExperience < 0 || factStore.career.yearsExperience > 50) {
        errors.push('Years of experience must be between 0 and 50');
      }

      // Validate projects
      for (const project of factStore.projects) {
        if (!project.name || project.name.length < 2) {
          errors.push(`Project "${project.name}" has invalid name`);
        }
      }

      // Validate skills
      for (const skill of factStore.skills) {
        if (!skill.name || skill.name.length < 2) {
          errors.push(`Skill "${skill.name}" has invalid name`);
        }
      }

      // Validate education
      for (const education of factStore.education) {
        if (!education.degree || education.degree.length < 2) {
          errors.push(`Education entry has invalid degree`);
        }
        if (!education.institution || education.institution.length < 2) {
          errors.push(`Education entry has invalid institution`);
        }
      }

      // Validate experience
      for (const experience of factStore.experience) {
        if (!experience.title || experience.title.length < 2) {
          errors.push(`Experience entry has invalid title`);
        }
        if (!experience.company || experience.company.length < 2) {
          errors.push(`Experience entry has invalid company`);
        }
      }

      const valid = errors.length === 0;
      this.logger.info(`Fact store validation for user ${factStore.userId}: ${valid ? 'valid' : 'invalid'}`);

      return { valid, errors };
    } catch (error) {
      this.logger.error(`Validate fact store failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('FACT_STORE_ERROR', `Failed to validate fact store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFactStoreSummary(userId: string): Promise<FactStoreSummary | null> {
    try {
      this.logger.info(`Getting fact store summary for user: ${userId}`);

      const factStore = await this.repository.findByUserId(userId);
      if (!factStore) {
        return null;
      }

      return {
        userId: factStore.userId,
        name: factStore.personal.name,
        email: factStore.personal.email,
        currentRole: factStore.career.currentRole,
        targetRole: factStore.career.targetRole,
        industry: factStore.career.industry,
        yearsExperience: factStore.career.yearsExperience,
        projectCount: factStore.projects.length,
        skillCount: factStore.skills.length,
        educationCount: factStore.education.length,
        experienceCount: factStore.experience.length,
        createdAt: factStore.createdAt,
        updatedAt: factStore.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Get fact store summary failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new AppError('FACT_STORE_ERROR', `Failed to get fact store summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exportFactStore(userId: string): Promise<string> {
    try {
      this.logger.info(`Exporting fact store for user: ${userId}`);

      const factStore = await this.repository.findByUserId(userId);
      if (!factStore) {
        throw new AppError('NOT_FOUND', `Fact store not found for user: ${userId}`);
      }

      return JSON.stringify(factStore, null, 2);
    } catch (error) {
      this.logger.error(`Export fact store failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('FACT_STORE_ERROR', `Failed to export fact store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async importFactStore(jsonData: string): Promise<UserFactStore> {
    try {
      this.logger.info('Importing fact store from JSON');

      const factStore = JSON.parse(jsonData) as UserFactStore;

      // Validate the imported data
      const validation = await this.validateFactStore(factStore);
      if (!validation.valid) {
        throw new AppError('VALIDATION_ERROR', `Imported fact store is invalid: ${validation.errors.join(', ')}`);
      }

      // Check if fact store already exists for this user
      const existing = await this.repository.findByUserId(factStore.userId);
      
      if (existing) {
        // Update existing fact store
        return this.updateFactStore(factStore.userId, factStore);
      } else {
        // Create new fact store
        return this.createFactStore(factStore);
      }
    } catch (error) {
      this.logger.error(`Import fact store failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('FACT_STORE_ERROR', `Failed to import fact store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export interface FactStoreSummary {
  userId: string;
  name: string;
  email: string;
  currentRole: string;
  targetRole: string;
  industry: string;
  yearsExperience: number;
  projectCount: number;
  skillCount: number;
  educationCount: number;
  experienceCount: number;
  createdAt: string;
  updatedAt: string;
}