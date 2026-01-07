import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './logger';
import { OpenRouterClient } from './openrouter-client';
import { PromptTemplate, PROMPT_TEMPLATES } from './prompt-templates';
import { TruthfulnessValidator, Persona, PERSONA_CONFIGS } from './validate/truthfulness';
import { GenerationOutput, GenerationAuditLog } from '@ancso/core';
import { SQLiteGenerationOutputRepository, SQLiteGenerationAuditRepository } from '@ancso/core';

export interface ProfileSectionTemplate {
  id: string;
  name: string;
  template: PromptTemplate;
  personaSpecificInstructions?: Record<string, string>;
}

export const PROFILE_SECTIONS: Record<string, ProfileSectionTemplate> = {
  linkedin_headline: {
    id: 'linkedin_headline',
    name: 'LinkedIn Headline',
    template: PROMPT_TEMPLATES.linkedinHeadlineTemplate,
    personaSpecificInstructions: {
      founder: 'Emphasize leadership, vision, and business impact',
      engineer: 'Highlight technical expertise, languages, and system design',
      product_manager: 'Focus on product strategy, metrics, and stakeholder management',
      designer: 'Showcase creative process, tools, and user-centered design',
      data_scientist: 'Emphasize ML algorithms, statistical analysis, and insights',
    },
  },
  linkedin_about: {
    id: 'linkedin_about',
    name: 'LinkedIn About',
    template: PROMPT_TEMPLATES.linkedinAboutTemplate,
    personaSpecificInstructions: {
      founder: 'Tell the entrepreneurial journey and vision',
      engineer: 'Showcase technical problem-solving and impact',
      product_manager: 'Describe product lifecycle and user impact',
      designer: 'Express design philosophy and creative process',
      data_scientist: 'Explain analytical approach and business insights',
    },
  },
  github_readme: {
    id: 'github_readme',
    name: 'GitHub Profile README',
    template: PROMPT_TEMPLATES.githubProfileReadmeTemplate,
    personaSpecificInstructions: {
      founder: 'Highlight leadership and business-relevant projects',
      engineer: 'Focus on technical projects, contributions, and code quality',
      product_manager: 'Showcase documentation and collaborative projects',
      designer: 'Emphasize visual projects and design systems',
      data_scientist: 'Display notebooks, models, and data visualizations',
    },
  },
  resume_summary: {
    id: 'resume_summary',
    name: 'Resume Professional Summary',
    template: {
      id: 'resume_summary_v1',
      version: '1.0',
      name: 'Resume Summary Generator',
      description: 'Generates a professional summary for resumes',
      inputSchema: z.object({
        name: z.string(),
        currentRole: z.string(),
        yearsExperience: z.number(),
        keySkills: z.array(z.string()),
        topAchievements: z.array(z.string()),
        targetRole: z.string(),
      }),
      outputSchema: z.object({
        summary: z.string(),
        claimsUsed: z.array(z.string()),
      }),
      template: `
You are an expert resume writer creating compelling professional summaries.
Generate a concise, impactful summary that highlights the candidate's unique value.

Constraints:
- Maximum 150 characters for resume header
- Maximum 4 sentences for professional summary
- Use action verbs and quantify achievements
- Tailor to target role
- Professional yet engaging tone

User Context:
- Name: {{name}}
- Current Role: {{currentRole}}
- Years of Experience: {{yearsExperience}}
- Key Skills: {{keySkills.join(', ')}}
- Top Achievements: {{topAchievements.join('\\n')}}
- Target Role: {{targetRole}}

Output Format:
{
  "summary": "Generated professional summary",
  "claimsUsed": ["references", "to", "user", "facts"]
}
      `,
    },
    personaSpecificInstructions: {
      founder: 'Include entrepreneurial metrics and business impact',
      engineer: 'Mention technical achievements and efficiency gains',
      product_manager: 'Highlight product launches and KPI improvements',
      designer: 'Focus on user experience improvements and design awards',
      data_scientist: 'Emphasize model performance and actionable insights',
    },
  },
};

export interface ProfileGenerationInput {
  userId: string;
  persona: Persona;
  factStore: any;
  sections: string[];
  options?: {
    dryRun?: boolean;
    saveToDb?: boolean;
  };
}

export interface SectionGenerationResult {
  sectionId: string;
  sectionName: string;
  success: boolean;
  content?: string;
  claimsUsed: string[];
  evidenceLinksUsed: string[];
  validationPassed: boolean;
  validationDetails?: {
    overallConfidence: number;
    unsupportedClaims: string[];
    followUpQuestions: string[];
  };
  error?: string;
  generationTimeMs: number;
}

export interface ProfileGenerationResult {
  success: boolean;
  userId: string;
  persona: Persona;
  sections: SectionGenerationResult[];
  outputs?: GenerationOutput[];
  totalGenerationTimeMs: number;
  followUpQuestions: string[];
  errors: string[];
}

export class ProfileGenerationPipeline {
  private logger: Logger;
  private openrouter: OpenRouterClient;
  private outputRepo: SQLiteGenerationOutputRepository;
  private auditRepo: SQLiteGenerationAuditRepository;

  constructor() {
    this.logger = new Logger('ProfileGenerationPipeline');
    this.openrouter = new OpenRouterClient();
    this.outputRepo = new SQLiteGenerationOutputRepository();
    this.auditRepo = new SQLiteGenerationAuditRepository();
  }

  async generate(input: ProfileGenerationInput): Promise<ProfileGenerationResult> {
    const startTime = Date.now();
    const results: SectionGenerationResult[] = [];
    const errors: string[] = [];
    const allFollowUpQuestions: string[] = [];
    const outputs: GenerationOutput[] = [];

    this.logger.info(`Starting profile generation for user: ${input.userId}, persona: ${input.persona}`);

    for (const sectionId of input.sections) {
      const sectionTemplate = PROFILE_SECTIONS[sectionId];
      if (!sectionTemplate) {
        errors.push(`Unknown section: ${sectionId}`);
        continue;
      }

      const sectionStartTime = Date.now();
      try {
        const sectionResult = await this.generateSection(
          sectionId,
          sectionTemplate,
          input.factStore,
          input.persona,
          input.options?.saveToDb !== false
        );

        results.push(sectionResult);

        if (sectionResult.validationDetails?.followUpQuestions) {
          allFollowUpQuestions.push(...sectionResult.validationDetails.followUpQuestions);
        }

        if (sectionResult.success && input.options?.saveToDb !== false) {
          const output = await this.saveGenerationOutput(
            input.userId,
            input.persona,
            sectionId,
            sectionResult,
            input.factStore
          );
          outputs.push(output);

          await this.createAuditLog(output.id, 'created', input.userId);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to generate ${sectionId}: ${errorMsg}`);
        results.push({
          sectionId,
          sectionName: sectionTemplate.name,
          success: false,
          claimsUsed: [],
          evidenceLinksUsed: [],
          validationPassed: false,
          error: errorMsg,
          generationTimeMs: Date.now() - sectionStartTime,
        });
      }
    }

    const totalTime = Date.now() - startTime;

    this.logger.info(`Profile generation completed in ${totalTime}ms. Success: ${results.filter(r => r.success).length}/${results.length}`);

    return {
      success: errors.length === 0,
      userId: input.userId,
      persona: input.persona,
      sections: results,
      outputs,
      totalGenerationTimeMs: totalTime,
      followUpQuestions: [...new Set(allFollowUpQuestions)],
      errors,
    };
  }

  private async generateSection(
    sectionId: string,
    template: ProfileSectionTemplate,
    factStore: any,
    persona: Persona,
    saveToDb: boolean
  ): Promise<SectionGenerationResult> {
    const startTime = Date.now();

    const inputData = this.prepareInputData(template.template, factStore, persona);

    const personaInstructions = template.personaSpecificInstructions?.[persona] || '';
    const enhancedTemplate = this.enhanceTemplateWithPersona(template.template.template, persona, personaInstructions);

    this.logger.info(`Generating ${template.name} for persona: ${persona}`);

    const response = await this.openrouter.chatCompletion({
      model: 'anthropic/claude-3-sonnet',
      messages: [
        {
          role: 'system',
          content: enhancedTemplate,
        },
        {
          role: 'user',
          content: `Generate ${template.name} based on the following context:\n\n${JSON.stringify(inputData, null, 2)}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const generatedContent = response.choices[0].message.content;
    const tokensUsed = response.usage?.total_tokens || 0;

    let parsedOutput: any;
    try {
      parsedOutput = JSON.parse(generatedContent);
    } catch (error) {
      throw new Error(`Failed to parse generated content as JSON: ${error}`);
    }

    const claimsUsed = parsedOutput.claimsUsed || [];
    const evidenceLinksUsed = this.extractEvidenceLinks(claimsUsed, factStore);

    const validator = new TruthfulnessValidator(factStore, persona);
    const contentToValidate = parsedOutput.headline || parsedOutput.about || parsedOutput.readme || parsedOutput.summary;
    
    const validationResult = validator.validateClaims(claimsUsed, {
      section: template.name,
      targetContent: contentToValidate,
    });

    if (!validationResult.isValid && validationResult.unsupportedClaims.length > 0) {
      this.logger.warn(`Validation failed for ${template.name}. Unsupported claims: ${validationResult.unsupportedClaims.length}`);
    }

    const generationTimeMs = Date.now() - startTime;

    return {
      sectionId,
      sectionName: template.name,
      success: true,
      content: contentToValidate,
      claimsUsed,
      evidenceLinksUsed,
      validationPassed: validationResult.isValid,
      validationDetails: {
        overallConfidence: validationResult.overallConfidence,
        unsupportedClaims: validationResult.unsupportedClaims.map(uc => uc.claim),
        followUpQuestions: validationResult.followUpQuestions,
      },
      generationTimeMs,
    };
  }

  private prepareInputData(template: PromptTemplate, factStore: any, persona: Persona): Record<string, any> {
    const inputSchema = template.inputSchema;
    const inputData: Record<string, any> = {};

    if (inputSchema.shape.name) inputData.name = factStore.personal?.name || 'Professional';
    if (inputSchema.shape.currentTitle || inputSchema.shape.currentRole) {
      inputData.currentTitle = factStore.career?.currentRole || 'Software Developer';
      inputData.currentRole = factStore.career?.currentRole || 'Software Developer';
    }
    if (inputSchema.shape.targetRole) inputData.targetRole = factStore.career?.targetRole || 'Senior Developer';
    if (inputSchema.shape.industry) inputData.industry = factStore.career?.industry || 'Technology';
    if (inputSchema.shape.yearsExperience) inputData.yearsExperience = factStore.career?.yearsExperience || 5;
    if (inputSchema.shape.valueProposition) {
      inputData.valueProposition = `Experienced ${factStore.career?.currentRole || 'developer'} seeking ${factStore.career?.targetRole || 'new opportunities'}`;
    }

    if (inputSchema.shape.keySkills) {
      inputData.keySkills = (factStore.skills || []).slice(0, 5).map((s: any) => s.name);
    }
    if (inputSchema.shape.skills) {
      inputData.skills = (factStore.skills || []).map((s: any) => s.name);
    }

    if (inputSchema.shape.careerSummary) inputData.careerSummary = factStore.career?.careerSummary || '';
    if (inputSchema.shape.keyAchievements || inputSchema.shape.topAchievements) {
      const achievements = (factStore.experience || []).flatMap((e: any) => e.achievements || []).slice(0, 5);
      inputData.keyAchievements = achievements;
      inputData.topAchievements = achievements;
    }

    if (inputSchema.shape.personality) inputData.personality = 'Professional, detail-oriented, collaborative';
    if (inputSchema.shape.callToAction) inputData.callToAction = 'Open to new opportunities and connections';

    if (inputSchema.shape.username) inputData.username = factStore.personal?.name?.toLowerCase().replace(/\s/g, '') || 'user';
    if (inputSchema.shape.bio) inputData.bio = factStore.career?.careerSummary || '';

    if (inputSchema.shape.featuredProjects) {
      inputData.featuredProjects = (factStore.projects || []).slice(0, 3).map((p: any) => ({
        name: p.name,
        description: p.description,
        url: p.url || '',
      }));
    }

    if (inputSchema.shape.socialLinks) {
      inputData.socialLinks = {
        linkedin: `https://linkedin.com/in/${inputData.username}`,
        github: `https://github.com/${inputData.username}`,
      };
    }

    return inputData;
  }

  private enhanceTemplateWithPersona(template: string, persona: Persona, personaInstructions: string): string {
    const personaConfig = PERSONA_CONFIGS[persona];
    const baseInstructions = `
You are writing content for a ${persona} profile.
Your persona characteristics:
- Key skills: ${personaConfig?.keywords?.join(', ') || 'general technical skills'}
- Avoid overclaiming: Stick to verifiable achievements from provided facts
- Tone: Professional but authentic to ${persona} role

${personaInstructions ? `Specific guidance: ${personaInstructions}` : ''}

Important: Only include claims that are supported by the provided facts. 
Do not invent metrics, team sizes, or achievements that aren't explicitly mentioned.

Output must be valid JSON matching the required schema.
    `.trim();

    return `${baseInstructions}\n\n${template}`;
  }

  private extractEvidenceLinks(claims: string[], factStore: any): string[] {
    const evidenceLinks: Set<string> = new Set();

    claims.forEach(claim => {
      const claimLower = claim.toLowerCase();

      factStore.projects?.forEach((project: any) => {
        if (claimLower.includes(project.name.toLowerCase()) || project.technologies?.some((t: string) => claimLower.includes(t.toLowerCase()))) {
          if (project.url) evidenceLinks.add(project.url);
        }
      });

      factStore.experience?.forEach((exp: any) => {
        if (claimLower.includes(exp.title.toLowerCase()) || claimLower.includes(exp.company.toLowerCase())) {
          evidenceLinks.add(exp.company);
        }
      });
    });

    return Array.from(evidenceLinks);
  }

  private async saveGenerationOutput(
    userId: string,
    persona: Persona,
    sectionId: string,
    result: SectionGenerationResult,
    factStore: any
  ): Promise<GenerationOutput> {
    const sectionTemplate = PROFILE_SECTIONS[sectionId];
    
    const output: GenerationOutput = {
      id: uuidv4(),
      userId,
      persona,
      platform: sectionId.startsWith('linkedin') ? 'linkedin' : sectionId.startsWith('github') ? 'github' : 'resume',
      section: sectionId,
      inputData: factStore,
      outputContent: result.content || '',
      claimsUsed: result.claimsUsed.map(claim => ({
        claim,
        isSupported: result.validationPassed,
        confidence: result.validationDetails?.overallConfidence || 0.5,
        evidence: undefined,
        linkedEvidence: result.evidenceLinksUsed,
      })),
      evidenceLinksUsed: result.evidenceLinksUsed,
      validationPassed: result.validationPassed,
      validationDetails: result.validationDetails ? {
        overallConfidence: result.validationDetails.overallConfidence,
        unsupportedClaims: result.validationDetails.unsupportedClaims,
        followUpQuestions: result.validationDetails.followUpQuestions,
      } : undefined,
      modelUsed: 'anthropic/claude-3-sonnet',
      tokensUsed: 0,
      generationTimeMs: result.generationTimeMs,
      status: 'generated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.outputRepo.create(output);
  }

  private async createAuditLog(generationId: string, action: string, userId: string): Promise<void> {
    const log: GenerationAuditLog = {
      id: uuidv4(),
      generationOutputId: generationId,
      action: action as any,
      performedBy: userId,
      timestamp: new Date().toISOString(),
    };

    await this.auditRepo.createLog(log);
  }

  async getGenerationHistory(userId: string, platform?: string): Promise<GenerationOutput[]> {
    if (platform) {
      return this.outputRepo.findByUserIdAndPlatform(userId, platform);
    }
    return this.outputRepo.findByUserId(userId);
  }

  async getPendingValidations(userId: string): Promise<GenerationOutput[]> {
    return this.outputRepo.listPendingValidation(userId);
  }

  async applyGeneration(outputId: string, userId: string): Promise<GenerationOutput> {
    const output = await this.outputRepo.markAsApplied(outputId);
    await this.createAuditLog(outputId, 'applied', userId);
    return output;
  }

  async rejectGeneration(outputId: string, userId: string, reason?: string): Promise<void> {
    await this.createAuditLog(outputId, 'rejected', userId, { reason });
  }
}

export function createGenerationPipeline(): ProfileGenerationPipeline {
  return new ProfileGenerationPipeline();
}
