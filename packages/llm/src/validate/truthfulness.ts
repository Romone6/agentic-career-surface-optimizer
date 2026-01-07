import { z } from 'zod';
import { Logger } from './logger';

export interface ClaimValidationResult {
  claim: string;
  isSupported: boolean;
  confidence: number;
  evidence?: string;
  linkedEvidence?: string[];
  blockerReason?: string;
  suggestedFollowUp?: string;
}

export interface TruthfulnessValidationResult {
  isValid: boolean;
  claims: ClaimValidationResult[];
  unsupportedClaims: ClaimValidationResult[];
  blockedSections: string[];
  followUpQuestions: string[];
  overallConfidence: number;
}

const PersonaSchema = z.enum(['founder', 'engineer', 'product_manager', 'designer', 'data_scientist']);

export type Persona = z.infer<typeof PersonaSchema>;

export const PERSONA_CONFIGS: Record<string, { 
  keywords: string[]; 
  disallowedClaims: string[]; 
  claimPatterns: Record<string, string[]> 
}> = {
  founder: {
    keywords: ['startup', 'funding', 'pitch', 'investor', 'equity', 'co-founder', 'bootstrapped', 'mvp', 'product-market fit'],
    disallowedClaims: [
      'managed a team of',
      'increased revenue by',
      'scaled to',
    ],
    claimPatterns: {
      'team_size': ['led a team of', 'managed', 'built a team of'],
      'metrics': ['raised', 'bootstrapped', 'achieved', 'scaled'],
      'achievements': ['exited', 'acquired', 'ipo', 'funded'],
    },
  },
  engineer: {
    keywords: ['software', 'code', 'architecture', 'system', 'api', 'database', 'scalable', 'performance'],
    disallowedClaims: [
      'increased sales by',
      'closed deals worth',
    ],
    claimPatterns: {
      'team_size': ['worked with a team of', 'collaborated with'],
      'metrics': ['reduced latency by', 'improved performance by', 'scaled to'],
      'achievements': ['built', 'designed', 'architected', 'implemented'],
    },
  },
  product_manager: {
    keywords: ['roadmap', 'stakeholders', 'feature', 'launch', 'metrics', 'kpi', 'user research'],
    disallowedClaims: [
      'wrote code that',
      'deployed',
    ],
    claimPatterns: {
      'team_size': ['led', 'managed', 'coordinated'],
      'metrics': ['improved', 'increased', 'reduced'],
      'achievements': ['launched', 'shipped', 'delivered'],
    },
  },
  designer: {
    keywords: ['ux', 'ui', 'figma', 'prototype', 'user research', 'design system', 'visual'],
    disallowedClaims: [
      'optimized database queries',
      'implemented api',
    ],
    claimPatterns: {
      'team_size': ['collaborated with', 'worked with'],
      'metrics': ['improved engagement', 'increased conversion'],
      'achievements': ['designed', 'created', 'redesigned'],
    },
  },
  data_scientist: {
    keywords: ['machine learning', 'model', 'algorithm', 'analytics', 'statistical', 'python', 'tensorflow'],
    disallowedClaims: [
      'closed enterprise deal',
      'designed ui for',
    ],
    claimPatterns: {
      'team_size': ['collaborated with', 'worked with'],
      'metrics': ['improved accuracy by', 'reduced error rate', 'increased'],
      'achievements': ['developed', 'trained', 'deployed'],
    },
  },
};

export class TruthfulnessValidator {
  private logger: Logger;
  private persona: Persona;
  private factStore: any;
  private evidenceLinks: Map<string, string[]>;

  constructor(factStore: any, persona: Persona = 'engineer') {
    this.logger = new Logger('TruthfulnessValidator');
    this.factStore = factStore;
    this.persona = persona;
    this.evidenceLinks = new Map();
    this.loadEvidenceLinks();
  }

  private loadEvidenceLinks(): void {
    if (this.factStore.projects) {
      this.factStore.projects.forEach((project: any) => {
        this.evidenceLinks.set(project.name, [
          project.url || '',
          ...(project.technologies || []),
        ]);
      });
    }
    if (this.factStore.experience) {
      this.factStore.experience.forEach((exp: any) => {
        this.evidenceLinks.set(exp.title, [
          exp.company,
          ...(exp.skillsUsed || []),
        ]);
      });
    }
  }

  validateClaims(claims: string[], context: {
    section: string;
    targetContent: string;
  }): TruthfulnessValidationResult {
    this.logger.info(`Validating ${claims.length} claims for section: ${context.section}`);

    const results: ClaimValidationResult[] = claims.map(claim => this.validateSingleClaim(claim, context));
    
    const unsupportedClaims = results.filter(r => !r.isSupported);
    const blockedSections = unsupportedClaims.length > 0 ? [context.section] : [];

    const overallConfidence = results.length > 0
      ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
      : 1.0;

    const followUpQuestions = unsupportedClaims.map(uc => 
      this.generateFollowUpQuestion(uc, context)
    );

    return {
      isValid: unsupportedClaims.length === 0,
      claims: results,
      unsupportedClaims,
      blockedSections,
      followUpQuestions,
      overallConfidence,
    };
  }

  private validateSingleClaim(claim: string, context: { section: string; targetContent: string }): ClaimValidationResult {
    const personaConfig = PERSONA_CONFIGS[this.persona] || PERSONA_CONFIGS.engineer;

    const claimLower = claim.toLowerCase();

    for (const disallowed of personaConfig.disallowedClaims) {
      if (claimLower.includes(disallowed.toLowerCase())) {
        this.logger.warn(`Blocked disallowed claim for ${this.persona}: ${claim}`);
        return {
          claim,
          isSupported: false,
          confidence: 0,
          blockerReason: `Claim type "${disallowed}" is not appropriate for persona "${this.persona}"`,
          suggestedFollowUp: `Can you provide a more relevant achievement for a ${this.persona}?`,
        };
      }
    }

    let confidence = 0.5;
    let evidence: string | undefined;
    let linkedEvidence: string[] | undefined;

    const relatedEvidence = this.findRelatedEvidence(claim);
    if (relatedEvidence.found) {
      confidence = 0.9;
      evidence = relatedEvidence.description;
      linkedEvidence = relatedEvidence.links;
    } else {
      confidence = this.checkPartialMatch(claim, personaConfig);
    }

    const hasMetrics = /\d+%|\$\d+|\d+x|increased|decreased|improved|reduced/i.test(claim);
    if (hasMetrics) {
      const metricsSupported = this.validateMetrics(claim);
      if (!metricsSupported) {
        confidence *= 0.7;
        return {
          claim,
          isSupported: confidence >= 0.5,
          confidence,
          evidence,
          linkedEvidence,
          blockerReason: confidence < 0.5 ? 'Metrics claims require supporting evidence' : undefined,
          suggestedFollowUp: confidence < 0.5 ? 'Can you provide specific metrics with context?' : undefined,
        };
      }
    }

    return {
      claim,
      isSupported: confidence >= 0.5,
      confidence,
      evidence,
      linkedEvidence,
    };
  }

  private findRelatedEvidence(claim: string): { found: boolean; description: string; links: string[] } {
    const claimLower = claim.toLowerCase();
    const keywords = claimLower.split(/\s+/);

    for (const [key, links] of this.evidenceLinks) {
      const keyLower = key.toLowerCase();
      const hasMatch = keywords.some(kw => keyLower.includes(kw) || kw.includes(keyLower));
      
      if (hasMatch) {
        return {
          found: true,
          description: `Related to ${key}`,
          links,
        };
      }
    }

    if (this.factStore.skills) {
      const skillNames = this.factStore.skills.map((s: any) => s.name.toLowerCase());
      const matchingSkills = skillNames.filter(skill => 
        keywords.some(kw => skill.includes(kw) || kw.includes(skill))
      );
      
      if (matchingSkills.length > 0) {
        return {
          found: true,
          description: `Uses skills: ${matchingSkills.join(', ')}`,
          links: matchingSkills,
        };
      }
    }

    if (this.factStore.experience) {
      const expMatch = this.factStore.experience.find((exp: any) =>
        keywords.some(kw => 
          exp.title.toLowerCase().includes(kw) ||
          exp.company.toLowerCase().includes(kw)
        )
      );
      
      if (expMatch) {
        return {
          found: true,
          description: `From experience at ${expMatch.company}`,
          links: [expMatch.company],
        };
      }
    }

    return { found: false, description: '', links: [] };
  }

  private checkPartialMatch(claim: string, personaConfig: typeof PERSONA_CONFIGS['engineer']): number {
    const claimLower = claim.toLowerCase();
    
    let matches = 0;
    const totalPatterns = Object.values(personaConfig.claimPatterns).flat().length;

    for (const patterns of Object.values(personaConfig.claimPatterns)) {
      for (const pattern of patterns) {
        if (claimLower.includes(pattern.toLowerCase())) {
          matches++;
        }
      }
    }

    for (const keyword of personaConfig.keywords) {
      if (claimLower.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    return Math.min(matches / Math.max(totalPatterns, 1) + 0.3, 0.9);
  }

  private validateMetrics(claim: string): boolean {
    const metricRegex = /(\d+)%|\$(\d+(?:,\d{3})*(?:\.\d+)?)|\d+x|\d+\s*(users|customers|revenue|growth)/i;
    const hasMetric = metricRegex.test(claim);

    if (!hasMetric) return true;

    if (this.factStore.experience) {
      const experienceMetrics = this.factStore.experience.flatMap((exp: any) =>
        exp.achievements.filter((a: string) => /\d+|%$|\$/.test(a))
      );
      
      const claimHasNumericMatch = experienceMetrics.some((expMetric: string) => {
        const expNumbers = expMetric.match(/\d+/g) || [];
        const claimNumbers = claim.match(/\d+/g) || [];
        return expNumbers.some((en: string) => claimNumbers.includes(en));
      });

      return claimHasNumericMatch || experienceMetrics.length === 0;
    }

    return true;
  }

  private generateFollowUpQuestion(claimResult: ClaimValidationResult, context: { section: string }): string {
    if (claimResult.suggestedFollowUp) {
      return claimResult.suggestedFollowUp;
    }

    return `For the claim "${claimResult.claim.substring(0, 50)}..." in the ${context.section} section, can you provide specific evidence or examples?`;
  }

  validateAndFilterContent(content: string, section: string): {
    isValid: boolean;
    filteredContent: string;
    validationResult: TruthfulnessValidationResult;
  } {
    const claims = this.extractClaimsFromContent(content);
    const validationResult = this.validateClaims(claims, { section, targetContent: content });

    if (validationResult.isValid) {
      return {
        isValid: true,
        filteredContent: content,
        validationResult,
      };
    }

    const filteredContent = this.filterUnsupportedClaims(content, validationResult.unsupportedClaims);
    
    return {
      isValid: filteredContent.length > 0,
      filteredContent,
      validationResult,
    };
  }

  private extractClaimsFromContent(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.map(s => s.trim());
  }

  private filterUnsupportedClaims(content: string, unsupportedClaims: ClaimValidationResult[]): string {
    if (unsupportedClaims.length === 0) return content;

    let filtered = content;
    unsupportedClaims.forEach(uc => {
      if (uc.claim) {
        const escapedClaim = uc.claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filtered = filtered.replace(new RegExp(escapedClaim, 'g'), '');
      }
    });

    return filtered.split(/[.!?]+/).filter(s => s.trim().length > 10).join('. ') + '.';
  }

  getPersona(): Persona {
    return this.persona;
  }

  setPersona(persona: Persona): void {
    this.persona = persona;
    this.logger.info(`Changed persona to: ${persona}`);
  }
}
