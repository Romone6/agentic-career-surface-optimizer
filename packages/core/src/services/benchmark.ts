import { Logger } from '../logger';
import { getDatabase } from '../database';
import {
  BenchmarkProfile,
  BenchmarkSection,
  BenchmarkNeighborResult,
} from '../schema';
import {
  SQLiteBenchmarkProfileRepository,
  SQLiteBenchmarkSectionRepository,
  SQLiteBenchmarkEmbeddingRepository,
  SQLiteBenchmarkCacheRepository,
} from './benchmark';
import { EmbeddingService } from '../embeddings';

export interface BenchmarkSearchOptions {
  platform: 'linkedin' | 'github';
  sectionType: 'headline' | 'about' | 'readme' | 'summary' | 'experience';
  persona?: string;
  limit?: number;
  minRelevanceScore?: number;
}

export interface BenchmarkPattern {
  pattern: string;
  frequency: number;
  examples: string[];
  persona?: string;
}

export interface DataDrivenPlan {
  targetSection: string;
  benchmarkPatterns: BenchmarkPattern[];
  suggestedEdits: {
    type: string;
    description: string;
    benchmarkExamples: string[];
    confidence: number;
  }[];
  personaAlignment: {
    score: number;
    suggestions: string[];
  };
}

export class BenchmarkService {
  private logger: Logger;
  private profileRepo: SQLiteBenchmarkProfileRepository;
  private sectionRepo: SQLiteBenchmarkSectionRepository;
  private embeddingRepo: SQLiteBenchmarkEmbeddingRepository;
  private cacheRepo: SQLiteBenchmarkCacheRepository;
  private embeddingService: EmbeddingService;

  constructor() {
    this.logger = new Logger('BenchmarkService');
    this.profileRepo = new SQLiteBenchmarkProfileRepository();
    this.sectionRepo = new SQLiteBenchmarkSectionRepository();
    this.embeddingRepo = new SQLiteBenchmarkEmbeddingRepository();
    this.cacheRepo = new SQLiteBenchmarkCacheRepository();
    this.embeddingService = new EmbeddingService();
  }

  async findSimilarBenchmarks(
    queryText: string,
    options: BenchmarkSearchOptions
  ): Promise<BenchmarkNeighborResult[]> {
    this.logger.info(`Finding similar benchmarks for ${options.sectionType} on ${options.platform}`);

    const queryEmbedding = await this.embeddingService.generateEmbedding(queryText);

    const profiles = await this.profileRepo.findByPlatform(options.platform);
    const eligibleProfiles = profiles.filter(p => 
      p.isElite && 
      (!options.persona || p.persona === options.persona) &&
      (!options.minRelevanceScore || p.relevanceScore >= options.minRelevanceScore)
    );

    const results: BenchmarkNeighborResult[] = [];

    for (const profile of eligibleProfiles) {
      const sections = await this.sectionRepo.findByType(profile.id, options.sectionType);

      for (const section of sections) {
        if (section.embeddingId) {
          const embedding = await this.embeddingRepo.findById(section.embeddingId);
          if (embedding) {
            const similarity = this.cosineSimilarity(
              queryEmbedding,
              Buffer.from(embedding.embeddingVector)
            );

            results.push({
              profile,
              section,
              similarity,
              matchedKeywords: this.extractKeywords(queryText, section.content),
            });
          }
        }
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, options.limit || 5);
  }

  async extractPatterns(
    platform: 'linkedin' | 'github',
    sectionType: string,
    persona?: string
  ): Promise<BenchmarkPattern[]> {
    this.logger.info(`Extracting patterns from ${sectionType} on ${platform}`);

    const profiles = await this.profileRepo.findByPlatform(platform);
    const eligibleProfiles = persona 
      ? profiles.filter(p => p.persona === persona)
      : profiles.filter(p => p.isElite);

    const patterns: Map<string, { count: number; examples: Set<string> }> = new Map();

    for (const profile of eligibleProfiles) {
      const sections = await this.sectionRepo.findByType(profile.id, sectionType);

      for (const section of sections) {
        const sectionPatterns = this.analyzeSectionPatterns(section.content);

        sectionPatterns.forEach(pattern => {
          if (!patterns.has(pattern)) {
            patterns.set(pattern, { count: 0, examples: new Set() });
          }
          patterns.get(pattern)!.count++;
          patterns.get(pattern)!.examples.add(section.content.substring(0, 200));
        });
      }
    }

    return Array.from(patterns.entries())
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        examples: Array.from(data.examples).slice(0, 5),
        persona,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async generateDataDrivenPlan(
    userSectionContent: string,
    userPersona: string,
    targetSection: string,
    platform: 'linkedin' | 'github'
  ): Promise<DataDrivenPlan> {
    this.logger.info(`Generating data-driven plan for ${targetSection}`);

    const similarBenchmarks = await this.findSimilarBenchmarks(userSectionContent, {
      platform,
      sectionType: targetSection as any,
      persona: userPersona,
      limit: 10,
    });

    const patterns = await this.extractPatterns(platform, targetSection, userPersona);

    const userKeywords = this.extractKeywords(userSectionContent);
    const benchmarkKeywords = new Set<string>();
    similarBenchmarks.forEach(b => {
      this.extractKeywords(b.section.content).forEach(k => benchmarkKeywords.add(k));
    });

    const missingKeywords = Array.from(benchmarkKeywords).filter(k => 
      !userKeywords.some(uk => uk.includes(k) || k.includes(uk))
    );

    const suggestions: DataDrivenPlan['suggestedEdits'] = [];

    if (similarBenchmarks.length > 0) {
      suggestions.push({
        type: 'structure',
        description: 'Align section structure with top-performing benchmarks',
        benchmarkExamples: similarBenchmarks.slice(0, 3).map(b => b.section.content),
        confidence: Math.min(0.8, similarBenchmarks[0].similarity + 0.2),
      });
    }

    if (missingKeywords.length > 0) {
      suggestions.push({
        type: 'keywords',
        description: `Consider adding relevant keywords: ${missingKeywords.slice(0, 5).join(', ')}`,
        benchmarkExamples: similarBenchmarks.slice(0, 2).map(b => b.section.content),
        confidence: 0.7,
      });
    }

    const personaAlignment = this.evaluatePersonaAlignment(userSectionContent, userPersona);

    return {
      targetSection,
      benchmarkPatterns: patterns.slice(0, 10),
      suggestedEdits: suggestions,
      personaAlignment: {
        score: personaAlignment.score,
        suggestions: personaAlignment.suggestions,
      },
    };
  }

  private cosineSimilarity(a: number[], b: Buffer): number {
    const bArray = new Float32Array(b);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * bArray[i];
      normA += a[i] * a[i];
      normB += bArray[i] * bArray[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private extractKeywords(...texts: string[]): string[] {
    const allWords = texts.join(' ').toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once']);

    const wordCounts = new Map<string, number>();
    allWords.forEach(word => {
      if (word.length > 2 && !stopWords.has(word)) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    });

    return Array.from(wordCounts.entries())
      .filter(([_, count]) => count >= 1)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
  }

  private analyzeSectionPatterns(content: string): string[] {
    const patterns: string[] = [];

    if (/\d+\+ years?/i.test(content)) patterns.push('years_experience');
    if (/\$\d+(?:,\d{3})*(?:k|m|b)?/i.test(content)) patterns.push('currency_metrics');
    if (/increased?|improved?|reduced?|optimized?|enhanced?/i.test(content)) patterns.push('impact_verbs');
    if (/led|managed|mentored|coordinated/i.test(content)) patterns.push('leadership_verbs');
    if (/built|designed|developed|created|implemented/i.test(content)) patterns.push('creation_verbs');
    if (/passionate|dedicated|driven|motivated/i.test(content)) patterns.push('personality_adjectives');
    if (/\d+%|\d+x|\d+\s*(?:times|users|customers)/i.test(content)) patterns.push('specific_metrics');
    if (/expert|senior|principal|staff|lead/i.test(content)) patterns.push('senior_titles');

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length > 0 && sentences[0].length < 100) {
      patterns.push('concise_opening');
    }

    return patterns;
  }

  private evaluatePersonaAlignment(content: string, persona: string): { score: number; suggestions: string[] } {
    const contentLower = content.toLowerCase();
    const suggestions: string[] = [];
    let score = 1.0;

    const personaKeywords: Record<string, string[]> = {
      founder: ['startup', 'funding', 'pitch', 'investor', 'co-founder', 'bootstrapped', 'mvp'],
      engineer: ['architecture', 'scalable', 'performance', 'api', 'database', 'code'],
      product_manager: ['roadmap', 'stakeholders', 'metrics', 'kpi', 'launch', 'feature'],
      designer: ['ux', 'ui', 'figma', 'prototype', 'user research', 'design system'],
      data_scientist: ['machine learning', 'algorithm', 'analytics', 'statistical', 'model', 'insights'],
    };

    const keywords = personaKeywords[persona] || [];
    const foundKeywords = keywords.filter(k => contentLower.includes(k));

    if (foundKeywords.length < keywords.length * 0.5) {
      const missing = keywords.filter(k => !contentLower.includes(k));
      suggestions.push(`Consider adding ${persona}-relevant terms: ${missing.slice(0, 3).join(', ')}`);
      score -= 0.2;
    }

    const disallowedPatterns: Record<string, RegExp[]> = {
      founder: [/\bcode\b/i, /\bapi\b/i, /\bdatabase\b/i],
      engineer: [/\bsales\b/i, /\brevenue\b/i, /\bfunding\b/i],
      product_manager: [/\bcode\b/i, /\bwrote\b/i, /\bimplemented\b/i],
      designer: [/\bapi\b/i, /\bdatabase\b/i, /\bbackend\b/i],
      data_scientist: [/\bui\b/i, /\bux\b/i, /\bdesign\b/i],
    };

    const disallowed = disallowedPatterns[persona]?.filter(r => r.test(content)) || [];
    if (disallowed.length > 0) {
      suggestions.push(`Avoid technical terms not typical for ${persona} role`);
      score -= 0.1 * disallowed.length;
    }

    return { score: Math.max(0, score), suggestions };
  }

  async getBenchmarkStats(): Promise<{
    totalProfiles: number;
    byPlatform: { linkedin: number; github: number };
    eliteCount: number;
    ingestedCount: number;
    sectionsCount: number;
  }> {
    const linkedinCount = await this.profileRepo.count('linkedin');
    const githubCount = await this.profileRepo.count('github');

    const profiles = await this.profileRepo.findByPlatform('linkedin');
    const eliteCount = profiles.filter(p => p.isElite).length + 
                      (await this.profileRepo.findByPlatform('github')).filter(p => p.isElite).length;
    const ingestedCount = profiles.filter(p => p.isIngested).length +
                         (await this.profileRepo.findByPlatform('github')).filter(p => p.isIngested).length;

    return {
      totalProfiles: linkedinCount + githubCount,
      byPlatform: { linkedin: linkedinCount, github: githubCount },
      eliteCount,
      ingestedCount,
      sectionsCount: 0,
    };
  }
}
