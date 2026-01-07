import { UserFactStore } from '@ancso/core';
import { KeyFacts, KeyFactsSchema } from '../schemas';
import { AppError } from '@ancso/core';

export class FactStoreExtractor {
  static extractKeyFacts(factStore: UserFactStore): KeyFacts {
    try {
      const keyFacts: KeyFacts = {
        personal: {
          name: factStore.personal.name || '',
          email: factStore.personal.email || '',
          location: factStore.personal.location || '',
        },
        career: {
          currentRole: factStore.career.currentRole,
          targetRole: factStore.career.targetRole,
          industry: factStore.career.industry,
          yearsExperience: factStore.career.yearsExperience,
          summary: factStore.career.careerSummary,
        },
        skills: factStore.skills.map(skill => ({
          name: skill.name,
          category: skill.category,
          proficiency: skill.proficiency,
          years: skill.yearsExperience,
        })),
        projects: factStore.projects.map(project => ({
          name: project.name,
          description: project.description || '',
          technologies: project.technologies,
          achievements: project.achievements,
        })),
        experience: factStore.experience.map(exp => ({
          title: exp.title,
          company: exp.company,
          years: this.calculateYears(exp.startDate, exp.endDate),
          achievements: exp.achievements,
          skills: exp.skillsUsed,
        })),
        education: factStore.education.map(edu => ({
          degree: edu.degree,
          institution: edu.institution,
          field: edu.fieldOfStudy || '',
          gpa: edu.gpa || '',
        })),
      };

      return KeyFactsSchema.parse(keyFacts);
    } catch (error) {
      throw new AppError('EXTRACTION_ERROR', `Failed to extract key facts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static calculateYears(startDate: string, endDate?: string): number {
    try {
      const startYear = new Date(startDate).getFullYear();
      const endYear = endDate ? new Date(endDate).getFullYear() : new Date().getFullYear();
      return endYear - startYear;
    } catch (error) {
      // If date parsing fails, return 0
      return 0;
    }
  }

  static extractSkillCategories(factStore: UserFactStore): Record<string, number> {
    const categories: Record<string, number> = {};

    for (const skill of factStore.skills) {
      if (skill.category) {
        categories[skill.category] = (categories[skill.category] || 0) + 1;
      }
    }

    return categories;
  }

  static extractTopSkills(factStore: UserFactStore, limit: number = 5): string[] {
    // Sort skills by years of experience and proficiency
    return factStore.skills
      .sort((a, b) => {
        // Sort by years first, then by proficiency level
        if (a.yearsExperience !== b.yearsExperience) {
          return b.yearsExperience - a.yearsExperience;
        }
        
        // Map proficiency to numerical value
        const proficiencyOrder: Record<string, number> = {
          'expert': 4,
          'advanced': 3,
          'intermediate': 2,
          'beginner': 1
        };
        
        return (proficiencyOrder[b.proficiency] || 0) - (proficiencyOrder[a.proficiency] || 0);
      })
      .slice(0, limit)
      .map(skill => skill.name);
  }

  static extractProjectTechnologies(factStore: UserFactStore): Record<string, number> {
    const technologies: Record<string, number> = {};

    for (const project of factStore.projects) {
      for (const tech of project.technologies) {
        technologies[tech] = (technologies[tech] || 0) + 1;
      }
    }

    return technologies;
  }

  static calculateExperienceYears(factStore: UserFactStore): number {
    return factStore.experience.reduce((total, exp) => {
      return total + this.calculateYears(exp.startDate, exp.endDate);
    }, 0);
  }

  static extractAchievements(factStore: UserFactStore): string[] {
    const achievements: string[] = [];

    // Add project achievements
    for (const project of factStore.projects) {
      achievements.push(...project.achievements);
    }

    // Add experience achievements
    for (const exp of factStore.experience) {
      achievements.push(...exp.achievements);
    }

    return achievements;
  }

  static createContentSnapshot(factStore: UserFactStore): string {
    // Create a textual snapshot of the fact store for content analysis
    const lines: string[] = [];

    // Personal info
    lines.push(`Name: ${factStore.personal.name}`);
    lines.push(`Email: ${factStore.personal.email}`);
    lines.push(`Location: ${factStore.personal.location || 'Not specified'}`);

    // Career info
    lines.push(`Current Role: ${factStore.career.currentRole}`);
    lines.push(`Target Role: ${factStore.career.targetRole}`);
    lines.push(`Industry: ${factStore.career.industry}`);
    lines.push(`Years Experience: ${factStore.career.yearsExperience}`);

    // Skills
    lines.push(`Top Skills: ${this.extractTopSkills(factStore).join(', ')}`);

    // Projects
    lines.push(`Projects: ${factStore.projects.length} total`);
    factStore.projects.slice(0, 3).forEach(project => {
      lines.push(`- ${project.name}: ${project.description}`);
    });

    // Experience
    lines.push(`Experience: ${factStore.experience.length} positions`);
    factStore.experience.slice(0, 3).forEach(exp => {
      lines.push(`- ${exp.title} at ${exp.company}`);
    });

    // Education
    lines.push(`Education: ${factStore.education.length} entries`);
    factStore.education.slice(0, 2).forEach(edu => {
      lines.push(`- ${edu.degree} from ${edu.institution}`);
    });

    return lines.join('\n');
  }
}