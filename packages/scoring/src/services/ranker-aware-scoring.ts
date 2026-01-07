import { ScoringInput, ProfileScoreReport, SectionScore, ProvenanceInfo } from '../schemas';
import { OverallScoringAlgorithm } from '../rubrics/overall';
import { TruthfulnessValidator } from '../validators/truthfulness';
import { Logger } from '@ancso/core';
import { AppError } from '@ancso/core';
import { RankerInferenceService, ScoredItem } from '@ancso/ml';

export class RankerAwareScoringService {
  private logger: Logger;
  private rankerService: RankerInferenceService | null = null;
  private useRanker: boolean = false;

  constructor() {
    this.logger = new Logger('RankerAwareScoring');
    this.initializeRanker();
  }

  private async initializeRanker(): Promise<void> {
    try {
      this.rankerService = new RankerInferenceService();
      this.useRanker = await this.rankerService.initialize();
      
      if (this.useRanker) {
        this.logger.info('Ranker model initialized successfully');
      } else {
        this.logger.info('Using heuristic scoring (ranker not available)');
      }
    } catch (error) {
      this.logger.warn(`Failed to initialize ranker: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.useRanker = false;
    }
  }

  async generateProfileScoreReport(input: ScoringInput): Promise<ProfileScoreReport> {
    try {
      this.logger.info(`Generating ranker-aware score report for user: ${input.userId}`);

      const baseReport = await OverallScoringAlgorithm.generateScoreReport(input);

      if (!this.useRanker || !this.rankerService) {
        return {
          ...baseReport,
          provenance: {
            rankerActive: false,
            scoringMethod: 'heuristic',
            modelVersion: undefined,
          }
        };
      }

      const provenance: ProvenanceInfo = {
        rankerActive: true,
        scoringMethod: 'ranker',
        modelVersion: (await this.rankerService.getModelInfo())?.version,
        rankedAt: new Date().toISOString(),
      };

      const rankedSections = await Promise.all(
        input.sections.map(async (section) => {
          const scoredItem: ScoredItem = {
            id: section.id || `section_${section.type}`,
            platform: input.platform,
            section: section.type,
            sourceRef: section.content.substring(0, 100),
            score: section.score,
            metrics: this.extractSectionMetrics(section),
          };

          const rankerResult = await this.rankerService.scoreItem(scoredItem);

          return {
            ...section,
            rankerScore: rankerResult.score,
            provenance: {
              ...provenance,
              confidence: rankerResult.score,
            },
          } as SectionScore & { rankerScore?: number; provenance: ProvenanceInfo };
        })
      );

      return {
        ...baseReport,
        sections: rankedSections,
        provenance,
      };
    } catch (error) {
      this.logger.error(`Ranker-aware scoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      const baseReport = await OverallScoringAlgorithm.generateScoreReport(input);
      return {
        ...baseReport,
        provenance: {
          rankerActive: false,
          scoringMethod: 'heuristic_fallback',
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      };
    }
  }

  async compareVariants(
    variantA: { content: string; metrics: Record<string, number> },
    variantB: { content: string; metrics: Record<string, number> },
    platform: string,
    section: string
  ): Promise<{
    winner: 'A' | 'B' | 'equal';
    scores: { a: number; b: number };
    provenance: string;
    confidence: number;
  }> {
    if (!this.useRanker || !this.rankerService) {
      const scoreA = this.computeHeuristicScore(variantA.metrics);
      const scoreB = this.computeHeuristicScore(variantB.metrics);
      
      return {
        winner: scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'equal',
        scores: { a: scoreA, b: scoreB },
        provenance: 'heuristic',
        confidence: Math.abs(scoreA - scoreB),
      };
    }

    const itemA: ScoredItem = {
      id: 'variant_a',
      platform,
      section,
      sourceRef: variantA.content.substring(0, 100),
      score: 0,
      metrics: variantA.metrics,
    };

    const itemB: ScoredItem = {
      id: 'variant_b',
      platform,
      section,
      sourceRef: variantB.content.substring(0, 100),
      score: 0,
      metrics: variantB.metrics,
    };

    const result = await this.rankerService.compare(itemA, itemB);

    return {
      winner: result.preference > 0 ? 'A' : result.preference < 0 ? 'B' : 'equal',
      scores: { a: result.aScore, b: result.bScore },
      provenance: result.provenance,
      confidence: result.confidence,
    };
  }

  private extractSectionMetrics(section: any): Record<string, number> {
    return {
      clarity: (section.metrics?.clarity || section.clarity || 0.5) * 100,
      impact: (section.metrics?.impact || section.impact || 0.5) * 100,
      relevance: (section.metrics?.relevance || section.relevance || 0.5) * 100,
      readability: section.wordCount ? Math.min(100, section.wordCount / 2) : 50,
      keyword_density: section.keywords ? section.keywords.length * 10 : 0,
      completeness: section.completeness || 0.5,
    };
  }

  private computeHeuristicScore(metrics: Record<string, number>): number {
    let score = 0;
    score += (metrics.clarity || 0.5) * 0.3;
    score += (metrics.impact || 0.5) * 0.3;
    score += (metrics.relevance || 0.5) * 0.2;
    score += (metrics.completeness || 0.5) * 0.2;
    return Math.min(1, Math.max(0, score));
  }

  getRankerStatus(): { active: boolean; provenance: string } {
    if (this.useRanker && this.rankerService) {
      return this.rankerService.getStatus();
    }
    return { active: false, provenance: 'heuristic' };
  }
}
