import { Logger } from '@ancso/core';
import { AppError } from '@ancso/core';
import { GitHubAPI, RepositoryInfo, ReadmeContent } from './api';
import { FactStoreService, KeyFacts } from '@ancso/core';
import { ScoringService } from '@ancso/scoring';

export interface ProfileReadmeOptions {
  dryRun?: boolean;
  createIfMissing?: boolean;
  backupExisting?: boolean;
  includeSections?: string[];
  createPR?: boolean;
  prTitle?: string;
  prDescription?: string;
}

export interface ProfileReadmeResult {
  success: boolean;
  message: string;
  actions: string[];
  backupPath?: string;
  pullRequestUrl?: string;
}

export class ProfileReadmeManager {
  private api: GitHubAPI;
  private factStoreService: FactStoreService;
  private scoringService: ScoringService;
  private logger: Logger;
  private userId: string;

  constructor(userId: string = 'default-user') {
    this.userId = userId;
    this.api = new GitHubAPI();
    this.factStoreService = new FactStoreService();
    this.scoringService = new ScoringService();
    this.logger = new Logger('ProfileReadmeManager');
  }

  async generateProfileReadme(options: ProfileReadmeOptions = {}): Promise<ProfileReadmeResult> {
    try {
      this.logger.info('Generating profile README...');

      // Initialize API
      await this.api.initialize();

      // Get user information
      const user = await this.api.getAuthenticatedUser();
      this.logger.info(`Generating README for user: ${user.login}`);

      // Get fact store
      const factStore = await this.factStoreService.getFactStore(this.userId);
      if (!factStore) {
        throw new AppError('DATA_ERROR', 'No fact store found. Please create one first.');
      }

      // Generate content
      const content = await this.generateReadmeContent(user, factStore, options);

      // Determine target repository
      const targetRepo = await this.getOrCreateProfileRepo(user, options);
      
      if (!targetRepo) {
        return {
          success: false,
          message: 'Could not create or find profile repository',
          actions: [],
        };
      }

      // Get current README for comparison
      const currentReadme = await this.api.getRepositoryReadme(user.login, targetRepo.name);
      
      // Check if content has changed
      const contentChanged = !currentReadme || currentReadme.content !== content;
      
      if (!contentChanged && !options.dryRun) {
        return {
          success: true,
          message: 'README content is already up to date',
          actions: ['No changes needed'],
        };
      }

      const actions: string[] = [];

      if (options.dryRun) {
        // Dry run mode
        actions.push('DRY RUN: Would update README');
        actions.push(`Target repository: ${user.login}/${targetRepo.name}`);
        actions.push(`Content length: ${content.length} characters`);
        actions.push(`Changes detected: ${contentChanged ? 'Yes' : 'No'}`);
        
        if (currentReadme) {
          actions.push(`Current README length: ${currentReadme.content.length} characters`);
        }

        return {
          success: true,
          message: 'Dry run completed successfully',
          actions,
        };
      }

      // Real run mode
      let backupPath: string | undefined;
      let pullRequestUrl: string | undefined;

      if (options.createPR) {
        // PR-first workflow: Create a branch and PR instead of direct commit
        this.logger.info('Starting PR-first workflow...');
        actions.push('PR-FIRST WORKFLOW: Creating branch and pull request');

        const branchName = `update-profile-readme-${Date.now()}`;
        const timestamp = new Date().toISOString();

        // Log the write action
        this.logger.writeAction({
          type: 'BRANCH_CREATE',
          timestamp,
          repository: `${user.login}/${targetRepo.name}`,
          branch: branchName,
          user: user.login,
        });

        // Create branch with README update
        await this.api.createBranchWithReadmeUpdate(
          user.login,
          targetRepo.name,
          branchName,
          content,
          'Update profile README via Agentic Neural Career Optimizer',
          'main'
        );

        actions.push(`Created branch: ${branchName}`);

        // Log the write action
        this.logger.writeAction({
          type: 'README_UPDATE',
          timestamp,
          repository: `${user.login}/${targetRepo.name}`,
          branch: branchName,
          path: 'README.md',
          contentLength: content.length,
          user: user.login,
        });

        // Create pull request
        const prTitle = options.prTitle || 'Update profile README';
        const prDescription = options.prDescription || 'Automated profile README update via Agentic Neural Career Optimizer';

        pullRequestUrl = await this.api.createPullRequest(
          user.login,
          targetRepo.name,
          prTitle,
          prDescription,
          branchName,
          'main'
        );

        actions.push(`Created pull request: ${pullRequestUrl}`);

        // Log the write action
        this.logger.writeAction({
          type: 'PR_CREATE',
          timestamp,
          repository: `${user.login}/${targetRepo.name}`,
          pullRequestUrl,
          branch: branchName,
          title: prTitle,
          user: user.login,
        });

      } else {
        // Direct commit workflow (original behavior)
        actions.push(`Updating README in ${user.login}/${targetRepo.name}`);

        // Backup existing README if requested
        if (options.backupExisting && currentReadme) {
          backupPath = await this.backupExistingReadme(user.login, targetRepo.name, currentReadme);
          actions.push(`Backed up existing README to: ${backupPath}`);
        }

        // Update README
        await this.api.updateRepositoryReadme(
          user.login,
          targetRepo.name,
          content,
          'Update profile README via Agentic Neural Career Optimizer'
        );

        // Log the write action
        const timestamp = new Date().toISOString();
        this.logger.writeAction({
          type: 'README_UPDATE',
          timestamp,
          repository: `${user.login}/${targetRepo.name}`,
          path: 'README.md',
          contentLength: content.length,
          user: user.login,
        });

        actions.push('Successfully updated profile README');

        // Update repository topics
        const topics = this.generateTopics(factStore);
        await this.api.updateRepositoryTopics(user.login, targetRepo.name, topics);

        // Log the write action
        this.logger.writeAction({
          type: 'TOPICS_UPDATE',
          timestamp,
          repository: `${user.login}/${targetRepo.name}`,
          topics,
          user: user.login,
        });

        actions.push(`Updated repository topics: ${topics.join(', ')}`);
      }

      return {
        success: true,
        message: options.createPR ? 'Profile README update submitted as pull request' : 'Profile README updated successfully',
        actions,
        backupPath,
        pullRequestUrl,
      };

    } catch (error) {
      this.logger.error(`Failed to generate profile README: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        message: `Failed to generate profile README: ${error instanceof Error ? error.message : 'Unknown error'}`,
        actions: [],
      };
    }
  }

  private async generateReadmeContent(user: any, factStore: any, options: ProfileReadmeOptions): Promise<string> {
    const sections = options.includeSections || ['header', 'about', 'experience', 'skills', 'projects', 'contact'];
    
    const contentParts: string[] = [];

    // Header section
    if (sections.includes('header')) {
      contentParts.push(this.generateHeaderSection(user, factStore));
    }

    // About section
    if (sections.includes('about')) {
      contentParts.push(this.generateAboutSection(factStore));
    }

    // Experience section
    if (sections.includes('experience')) {
      contentParts.push(this.generateExperienceSection(factStore));
    }

    // Skills section
    if (sections.includes('skills')) {
      contentParts.push(this.generateSkillsSection(factStore));
    }

    // Projects section
    if (sections.includes('projects')) {
      contentParts.push(this.generateProjectsSection(factStore));
    }

    // Contact section
    if (sections.includes('contact')) {
      contentParts.push(this.generateContactSection(user, factStore));
    }

    // Footer section
    contentParts.push(this.generateFooterSection());

    return contentParts.join('\n\n---\n\n');
  }

  private generateHeaderSection(user: any, factStore: any): string {
    const name = factStore.personal.name || user.name || user.login;
    const title = factStore.career.currentRole || 'Software Developer';
    const location = factStore.personal.location || 'Remote';

    return `# ${name}

${title} 🚀 | ${location} 🌍

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?style=flat-square&logo=linkedin)](https://linkedin.com/in/${user.login})
[![Email](https://img.shields.io/badge/Email-Contact-red?style=flat-square&logo=gmail)](mailto:${factStore.personal.email})
[![Website](https://img.shields.io/badge/Website-Visit-green?style=flat-square&logo=firefox)](https://github.com/${user.login})

> ${factStore.career.careerSummary || 'Passionate developer with experience in modern technologies and frameworks.'}`;
  }

  private generateAboutSection(factStore: any): string {
    const skills = factStore.skills.slice(0, 8).map((s: any) => s.name);
    const technologies = factStore.projects.reduce((techs: string[], p: any) => {
      p.technologies.forEach((tech: string) => {
        if (!techs.includes(tech)) techs.push(tech);
      });
      return techs;
    }, []).slice(0, 10);

    return `## About Me

${factStore.career.careerSummary}

### Technical Skills

${skills.map(skill => `- ${skill}`).join('\n')}

### Technologies

${technologies.map(tech => `- ${tech}`).join('\n')}

### Professional Experience

${factStore.experience.length}+ years of professional experience in software development, specializing in ${factStore.career.industry}.`;
  }

  private generateExperienceSection(factStore: any): string {
    const experience = factStore.experience.slice(0, 5);

    if (experience.length === 0) {
      return '## Professional Experience\n\nCurrently seeking new opportunities. Open to connecting!';
    }

    const experienceList = experience.map((exp: any) => {
      const duration = this.calculateExperienceDuration(exp.startDate, exp.endDate);
      return `### ${exp.title} at ${exp.company}
**Duration:** ${duration}
**Achievements:**
${exp.achievements.map((ach: string) => `- ${ach}`).join('\n')}`;
    }).join('\n\n');

    return `## Professional Experience

${experienceList}`;
  }

  private generateSkillsSection(factStore: any): string {
    const skillCategories = this.groupSkillsByCategory(factStore.skills);

    const skillSections = Object.entries(skillCategories).map(([category, skills]) => {
      const skillList = skills.map((s: any) => `- **${s.name}** (${s.proficiency})`).join('\n');
      return `### ${category}
${skillList}`;
    }).join('\n\n');

    return `## Skills

${skillSections}`;
  }

  private generateProjectsSection(factStore: any): string {
    const projects = factStore.projects.slice(0, 6);

    if (projects.length === 0) {
      return '## Featured Projects\n\nCurrently working on exciting projects. Stay tuned!';
    }

    const projectList = projects.map((project: any) => {
      const techBadges = project.technologies.slice(0, 4).map((tech: string) => 
        `[${tech}](https://github.com/search?q=${encodeURIComponent(tech)})`
      ).join(' | ');

      return `### ${project.name}
${project.description}

**Technologies:** ${techBadges}

**Key Achievements:**
${project.achievements.map((ach: string) => `- ${ach}`).join('\n')}

[View Project](#)`;
    }).join('\n\n');

    return `## Featured Projects

${projectList}`;
  }

  private generateContactSection(user: any, factStore: any): string {
    return `## Let's Connect

I'm always interested in discussing new opportunities, collaborations, or just having a good tech chat!

- 📧 **Email:** [${factStore.personal.email}](mailto:${factStore.personal.email})
- 💼 **LinkedIn:** [Connect with me](https://linkedin.com/in/${user.login})
- 🌐 **Portfolio:** [Visit my website](https://github.com/${user.login})
- 🐦 **Twitter:** [@${user.login}](https://twitter.com/${user.login})

### Open to:

- ${factStore.career.targetRole} positions
- ${factStore.career.industry} opportunities
- Freelance and consulting projects
- Open source collaborations

---

*Built with ❤️ using [Agentic Neural Career Optimizer](https://github.com/your-repo/ancso)*`;
  }

  private generateFooterSection(): string {
    return `## Stats

![GitHub stats](https://github-readme-stats.vercel.app/api?username=${'default-user'}&show_icons=true&theme=radical)

![Top languages](https://github-readme-stats.vercel.app/api/top-langs/?username=${'default-user'}&layout=compact&theme=radical)`;
  }

  private groupSkillsByCategory(skills: any[]): Record<string, any[]> {
    const categories: Record<string, any[]> = {};

    skills.forEach(skill => {
      const category = skill.category || 'Other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(skill);
    });

    return categories;
  }

  private calculateExperienceDuration(startDate: string, endDate?: string): string {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    
    const years = end.getFullYear() - start.getFullYear();
    const months = end.getMonth() - start.getMonth();
    
    if (months < 0) {
      return `${years - 1} years ${12 + months} months`;
    }
    
    return `${years} years ${months} months`;
  }

  private generateTopics(factStore: any): string[] {
    const topics: string[] = [];

    // Add industry topics
    if (factStore.career.industry) {
      topics.push(...factStore.career.industry.toLowerCase().split(' ').slice(0, 3));
    }

    // Add skill topics
    factStore.skills.slice(0, 5).forEach((skill: any) => {
      topics.push(skill.name.toLowerCase().replace(/\s+/g, '-'));
    });

    // Add technology topics
    const technologies = factStore.projects.reduce((techs: string[], p: any) => {
      p.technologies.forEach((tech: string) => {
        const techSlug = tech.toLowerCase().replace(/\s+/g, '-');
        if (!techs.includes(techSlug) && techs.length < 10) {
          techs.push(techSlug);
        }
      });
      return techs;
    }, []);

    topics.push(...technologies);

    // Add career target
    if (factStore.career.targetRole) {
      topics.push(...factStore.career.targetRole.toLowerCase().split(' ').slice(0, 2));
    }

    return [...new Set(topics)].slice(0, 20); // Remove duplicates and limit to 20
  }

  private async getOrCreateProfileRepo(user: any, options: ProfileReadmeOptions): Promise<RepositoryInfo | null> {
    try {
      // Try to get existing profile repository
      const profileRepoName = user.login;
      const existingRepo = await this.api.getUserRepositories(user.login, 100);
      const profileRepo = existingRepo.find(repo => repo.name === profileRepoName);

      if (profileRepo) {
        this.logger.info(`Found existing profile repository: ${profileRepo.fullName}`);
        return profileRepo;
      }

      // Create new profile repository if not found
      if (options.createIfMissing) {
        this.logger.info(`Creating new profile repository: ${profileRepoName}`);
        const repo = await this.api.createRepository(
          profileRepoName,
          'Profile repository generated by Agentic Neural Career Optimizer',
          false,
          true
        );
        return repo;
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get or create profile repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  private async backupExistingReadme(owner: string, repo: string, readme: ReadmeContent): Promise<string> {
    const fs = require('fs');
    const path = require('path');
    
    const backupDir = './backups/github';
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${owner}-${repo}-${timestamp}.md`);
    
    fs.writeFileSync(backupPath, readme.content);
    return backupPath;
  }

  async checkReadmeStatus(): Promise<{
    hasProfileRepo: boolean;
    hasReadme: boolean;
    readmeContent?: string;
    lastUpdated?: Date;
  }> {
    try {
      await this.api.initialize();
      const user = await this.api.getAuthenticatedUser();
      const profileRepo = await this.getOrCreateProfileRepo(user, { createIfMissing: false });

      if (!profileRepo) {
        return { hasProfileRepo: false, hasReadme: false };
      }

      const readme = await this.api.getRepositoryReadme(user.login, profileRepo.name);

      return {
        hasProfileRepo: true,
        hasReadme: !!readme,
        readmeContent: readme?.content,
        lastUpdated: readme ? new Date() : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to check README status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { hasProfileRepo: false, hasReadme: false };
    }
  }
}