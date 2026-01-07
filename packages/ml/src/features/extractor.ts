export const FEATURE_NAMES = [
  'clarity',
  'impact',
  'relevance',
  'readability',
  'keyword_density',
  'completeness',
] as const;

export type FeatureName = typeof FEATURE_NAMES[number];

export interface FeatureVector {
  [key: string]: number;
}

export interface FeatureExtractionResult {
  features: FeatureVector;
  metadata: {
    wordCount: number;
    sentenceCount: number;
    avgWordLength: number;
    sectionType: string;
  };
}

export class FeatureExtractor {
  private readonly featureNames: readonly string[];
  private readonly eliteSamples: Map<string, string[]>;

  constructor(featureNames: readonly string[] = FEATURE_NAMES) {
    this.featureNames = featureNames;
    this.eliteSamples = new Map([
      ['clarity', [
        'Built scalable microservices architecture serving 10M+ daily requests',
        'Led engineering team of 15 developers across 3 time zones',
        'Reduced database query latency by 40% through indexing optimization',
      ]],
      ['impact', [
        'Increased user engagement by 35% through personalized recommendations',
        'Generated $2M additional revenue with new checkout flow',
        'Saved $500K annually by migrating to serverless infrastructure',
      ]],
      ['relevance', [
        'Developed React components for enterprise dashboard',
        'Implemented OAuth 2.0 authentication system',
        'Built RESTful APIs using Node.js and Express',
      ]],
    ]);
  }

  extract(content: string, sectionType: string = 'unknown'): FeatureExtractionResult {
    const normalizedContent = this.normalizeContent(content);
    const words = this.tokenize(normalizedContent);
    const sentences = this.splitSentences(normalizedContent);

    const features: FeatureVector = {};

    features.clarity = this.computeClarity(normalizedContent, words, sentences);
    features.impact = this.computeImpact(normalizedContent, words, sentences);
    features.relevance = this.computeRelevance(normalizedContent, words);
    features.readability = this.computeReadability(normalizedContent, words, sentences);
    features.keyword_density = this.computeKeywordDensity(normalizedContent, words);
    features.completeness = this.computeCompleteness(normalizedContent, words, sentences, sectionType);

    return {
      features: this.orderFeatures(features),
      metadata: {
        wordCount: words.length,
        sentenceCount: sentences.length,
        avgWordLength: words.length > 0 ? words.reduce((sum, w) => sum + w.length, 0) / words.length : 0,
        sectionType,
      },
    };
  }

  private normalizeContent(content: string): string {
    return content
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  private computeClarity(content: string, words: string[], sentences: string[]): number {
    if (content.length === 0) return 0;

    const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;
    const lengthScore = this.normalizeScore(avgSentenceLength, 10, 25);

    const hasActionVerbs = /\b(built|led|created|developed|implemented|designed|managed|orchestrated|achieved|delivered)/i.test(content);
    const actionScore = hasActionVerbs ? 1 : 0;

    const hasNumbers = /\d+/.test(content);
    const numbersScore = hasNumbers ? 0.3 : 0;

    return Math.min(1, lengthScore * 0.4 + actionScore * 0.4 + numbersScore * 0.2);
  }

  private computeImpact(content: string, words: string[], sentences: string[]): number {
    if (content.length === 0) return 0;

    const impactVerbs = /\b(increased|decreased|reduced|improved|optimized|enhanced|generated|saved|achieved|delivered|accelerated|transformed|scaled)/gi;
    const impactVerbCount = (content.match(impactVerbs) || []).length;
    const impactVerbScore = Math.min(1, impactVerbCount * 0.3);

    const metricsPatterns = [
      /\d+%/, /\$\d+/,
      /\d+K|\d+M|\d+B/,
      /\d+\s*(users|customers|requests|users|percent)/i,
    ];

    let metricsScore = 0;
    for (const pattern of metricsPatterns) {
      if (pattern.test(content)) {
        metricsScore = 0.5;
        break;
      }
    }

    const leadershipPatterns = /\b(led|managed|mentored|coached|directed|supervised|headed)/gi;
    const leadershipCount = (content.match(leadershipPatterns) || []).length;
    const leadershipScore = Math.min(1, leadershipCount * 0.3);

    return Math.min(1, impactVerbScore + metricsScore + leadershipScore * 0.3);
  }

  private computeRelevance(content: string, words: string[]): number {
    if (words.length === 0) return 0;

    const techKeywords = [
      'javascript', 'typescript', 'python', 'java', 'rust', 'go', 'golang',
      'react', 'vue', 'angular', 'svelte',
      'node', 'nodejs', 'express', 'fastify', 'nestjs',
      'aws', 'azure', 'gcp', 'cloud', 'kubernetes', 'docker', 'terraform',
      'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
      'api', 'rest', 'graphql', 'grpc', 'websockets',
      'microservices', 'serverless', 'lambda', 'function',
      'machine learning', 'ml', 'ai', 'deep learning', 'neural',
      'testing', 'ci/cd', 'jenkins', 'github actions', 'gitlab',
      'agile', 'scrum', 'kanban',
    ];

    const techKeywordCount = words.filter(word => 
      techKeywords.some(keyword => word.includes(keyword))
    ).length;

    const techDensity = techKeywordCount / words.length;
    const techScore = Math.min(1, techDensity * 20);

    return Math.min(1, 0.7 + techScore * 0.3);
  }

  private computeReadability(content: string, words: string[], sentences: string[]): number {
    if (content.length === 0) return 0;

    const avgWordLength = words.length > 0 
      ? words.reduce((sum, w) => sum + w.length, 0) / words.length 
      : 0;
    const wordLengthScore = this.normalizeScore(avgWordLength, 4, 7);

    const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;
    const sentenceLengthScore = this.normalizeScore(avgSentenceLength, 10, 25);

    const passiveVoice = /\b(is|are|was|were|been|being)\s+\w+ed\b/gi;
    const passiveCount = (content.match(passiveVoice) || []).length;
    const passiveScore = Math.max(0, 1 - passiveCount * 0.1);

    return Math.min(1, wordLengthScore * 0.3 + sentenceLengthScore * 0.4 + passiveScore * 0.3);
  }

  private computeKeywordDensity(content: string, words: string[]): number {
    if (words.length === 0) return 0;

    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
      'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'between', 'under',
    ]);

    const uniqueWords = new Set(words.filter(w => !stopWords.has(w)));
    const uniqueRatio = uniqueWords.size / words.length;

    const optimalDensity = 0.02;
    const density = uniqueWords.size > 0 ? (words.length - uniqueWords.size) / words.length : 0;
    const deviation = Math.abs(density - optimalDensity);
    const densityScore = Math.max(0, 1 - deviation * 10);

    return Math.min(1, uniqueRatio * 0.5 + densityScore * 0.5);
  }

  private computeCompleteness(content: string, words: string[], sentences: string[], sectionType: string): number {
    const lengthThresholds: Record<string, { min: number; optimal: number }> = {
      headline: { min: 5, optimal: 15 },
      about: { min: 100, optimal: 300 },
      summary: { min: 50, optimal: 200 },
      experience: { min: 200, optimal: 500 },
      readme: { min: 500, optimal: 2000 },
      repo_readme: { min: 200, optimal: 1000 },
    };

    const thresholds = lengthThresholds[sectionType] || { min: 50, optimal: 200 };
    const lengthScore = this.normalizeScore(words.length, thresholds.min, thresholds.optimal);

    const hasContactInfo = /@|\.com|www\.|http/i.test(content);
    const contactScore = hasContactInfo ? 0.1 : 0;

    const hasStructure = /##|###|\*\*|[-•]/i.test(content);
    const structureScore = hasStructure ? 0.1 : 0;

    const hasCallToAction = /\b(contact|reach|email|linkedin|github|check|view|see)/i.test(content);
    const ctaScore = hasCallToAction ? 0.1 : 0;

    return Math.min(1, lengthScore * 0.7 + contactScore + structureScore + ctaScore);
  }

  private normalizeScore(value: number, min: number, max: number): number {
    if (value <= min) return 0;
    if (value >= max) return 1;
    return (value - min) / (max - min);
  }

  private orderFeatures(features: FeatureVector): FeatureVector {
    const ordered: FeatureVector = {};
    for (const name of this.featureNames) {
      ordered[name] = features[name] ?? 0;
    }
    return ordered;
  }

  getFeatureNames(): readonly string[] {
    return this.featureNames;
  }

  getFeatureVectorLength(): number {
    return this.featureNames.length;
  }

  validateFeatureDirectionality(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    const highQualityContent = 'Built and deployed scalable microservices architecture that increased user engagement by 35% and reduced latency by 40%. Led a team of 10 engineers and mentored junior developers.';
    const lowQualityContent = 'Did some work at a company. Made things better sometimes.';

    const highResult = this.extract(highQualityContent);
    const lowResult = this.extract(lowQualityContent);

    for (const name of this.featureNames) {
      if (highResult.features[name] <= lowResult.features[name]) {
        issues.push(`${name}: high quality (${highResult.features[name].toFixed(2)}) should be > low quality (${lowResult.features[name].toFixed(2)})`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}